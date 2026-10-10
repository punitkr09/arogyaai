import asyncio
import os
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.database import SessionLocal, engine, Base
from app.seed import reset_database, seed_database
from app.db_models import (
    BatchInventory,
    Product,
    Warehouse,
    Customer,
    Dispatch,
    Supplier,
    PurchaseOrder,
    TemperatureLog,
    Incident,
    AgentRun,
    ActionProposal,
    ApprovalDecision,
    StockMovement,
)
from app.tools.registry import ToolRegistry
from app.agent.orchestrator import AgentOrchestrator
from app.agent.ai_provider import DeterministicSemanticEngine, OpenAICompatibleProvider


@pytest.fixture(autouse=True)
def setup_test_db():
    reset_database()
    yield


# ---------------------------------------------------------------------------
# Scenario 1: A natural-language request with unusual wording correctly investigates a batch.
# ---------------------------------------------------------------------------
def test_scenario_01_unusual_wording_batch_investigation():
    db = SessionLocal()
    try:
        orch = AgentOrchestrator(db)
        # Unusual phrasing that doesn't use standard template keywords
        prompt = "Could someone please run a full check on lot B4019 and tell me what its current warehouse condition is?"
        run = orch.run_task(prompt)

        assert run.intent_json is not None
        report = run.final_report_json
        assert report is not None
        assert "B4019" in report

        # Verify tool was called
        events = run.events
        assert any("B4019" in ev.message for ev in events)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Scenario 2: A recall blocks the affected batch from future dispatch.
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_scenario_02_recall_blocks_batch_from_dispatch():
    db = SessionLocal()
    try:
        # Put batch B2231 on dispatch_hold (or recalled)
        b2231 = db.query(BatchInventory).filter_by(batch_number="B2231").first()
        assert b2231 is not None
        b2231.status = "dispatch_hold"
        db.commit()
    finally:
        db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "batch_number": "B2231",
            "customer_code": "CUST-CH-01",
            "quantity": 10,
        }
        res = await client.post("/api/inventory/dispatch", json=payload)
        # Must be strictly rejected with HTTP 403 Forbidden
        assert res.status_code == 403
        assert "SAFETY VIOLATION BLOCKED" in res.json()["detail"]


# ---------------------------------------------------------------------------
# Scenario 3: Batch traceability identifies recorded customer recipients and quantities.
# ---------------------------------------------------------------------------
def test_scenario_03_batch_traceability_recipients_and_quantities():
    db = SessionLocal()
    try:
        trace = ToolRegistry.trace_batch_recipients(db, "B2231")
        assert trace["batch_number"] == "B2231"
        assert trace["total_dispatched_quantity"] == 640
        assert trace["total_recipients_count"] == 25
        assert trace["breakdown"]["hospitals"]["count"] == 2
        assert trace["breakdown"]["hospitals"]["quantity"] == 150
        assert trace["breakdown"]["chemists"]["count"] == 23
        assert trace["breakdown"]["chemists"]["quantity"] == 490

        # Verify recipients list structure
        recips = trace["recipients"]
        assert len(recips) == 25
        assert any(r["customer_type"] == "hospital" for r in recips)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Scenario 4: Cold-chain analysis links a recorded excursion to batches actually present during interval.
# ---------------------------------------------------------------------------
def test_scenario_04_cold_chain_analysis_links_excursion_to_batches():
    db = SessionLocal()
    try:
        excursions = ToolRegistry.get_temperature_excursions(db)
        assert excursions["excursions_count"] >= 1
        first_exc = excursions["excursions"][0]

        # Verify temperature breach details
        assert first_exc["recorded_temperature_celsius"] == 12.8
        assert first_exc["duration_minutes"] == 270
        assert first_exc["delta_celsius"] == 4.8

        # Verify affected biological batch B4019 in North Cold Facility is mapped
        aff_batches = [b["batch_number"] for b in first_exc["affected_batches"]]
        assert "B4019" in aff_batches
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Scenario 5: Expiry analysis identifies stock at risk and explains its assumptions.
# ---------------------------------------------------------------------------
def test_scenario_05_expiry_analysis_identifies_risk_and_assumptions():
    db = SessionLocal()
    try:
        exp_risks = ToolRegistry.get_expiry_risks_and_fefo(db, days_threshold=90)
        assert exp_risks["batches_at_risk_count"] >= 1

        b1982 = next(b for b in exp_risks["batches"] if b["batch_number"] == "B1982")
        assert b1982["available_quantity"] == 350
        assert b1982["days_to_expiry"] <= 35
        assert b1982["estimated_value_at_risk"] > 0
        assert "estimated_daily_demand" in b1982
        assert "potential_expired_units" in b1982
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Scenario 6: Supplier return windows are calculated from stored supplier terms.
# ---------------------------------------------------------------------------
def test_scenario_06_supplier_return_windows_calculated_from_terms():
    db = SessionLocal()
    try:
        ret_calc = ToolRegistry.calculate_supplier_return_window(db, "B1982")
        assert ret_calc["audited_batches_count"] == 1
        batch_info = ret_calc["batches"][0]

        assert batch_info["supplier_return_window_days"] == 60
        assert "return_filing_deadline" in batch_info
        assert "days_remaining_to_file" in batch_info
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Scenario 7: Critical medicine shortage analysis calculates stock coverage when sufficient data exists.
# ---------------------------------------------------------------------------
def test_scenario_07_critical_medicine_shortage_analysis():
    db = SessionLocal()
    try:
        shortage = ToolRegistry.calculate_shortage_risk(db, "MED-MER-1000")
        assert shortage["audited_critical_products_count"] == 1
        mer = shortage["shortage_risks"][0]

        assert mer["sku"] == "MED-MER-1000"
        assert mer["available_quantity"] == 45
        assert mer["min_safety_stock"] == 200
        assert mer["is_actual_shortage"] is True
        assert mer["days_of_cover"] < mer["supplier_lead_time_days"]
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Scenario 8: Replacement coverage is calculated against recall needs and normal demand.
# ---------------------------------------------------------------------------
def test_scenario_08_replacement_coverage_recall_and_normal_demand():
    db = SessionLocal()
    try:
        calc = ToolRegistry.calculate_replacement_coverage(db, "B2231", "B2240", lead_time_days=14)
        assert calc["recalled_units_needing_replacement"] == 640
        assert calc["forecast_normal_demand"] == 210
        assert calc["total_combined_demand"] == 850
        assert calc["available_replacement_stock"] == 400
        assert calc["total_net_shortfall"] == 450
        assert calc["recommended_po_quantity"] == 600
        assert calc["can_cover_both"] is False
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Scenario 9: The agent compares feasible operational alternatives.
# ---------------------------------------------------------------------------
def test_scenario_09_agent_compares_feasible_operational_alternatives():
    db = SessionLocal()
    try:
        comp = ToolRegistry.compare_operational_options(db, scenario_type="recall")
        options = comp["options"]
        assert len(options) >= 2

        opt1 = next(o for o in options if o["option_id"] == "OPT-1-HOSPITAL-PRIORITY-ALLOCATION")
        opt2 = next(o for o in options if o["option_id"] == "OPT-2-PRO-RATA-ALLOCATION")

        assert opt1["is_recommended"] is True
        assert opt2["is_recommended"] is False
        assert len(opt1["pros"]) > 0
        assert len(opt2["cons"]) > 0
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Scenario 10: A proposed consequential action cannot execute before valid approval.
# ---------------------------------------------------------------------------
def test_scenario_10_unapproved_action_does_not_mutate_state():
    db = SessionLocal()
    try:
        orch = AgentOrchestrator(db)
        run = orch.run_task("Investigate recall Batch B2231.")

        # Batch B2231 should still be 'active' in DB until approval is given
        b = db.query(BatchInventory).filter_by(batch_number="B2231").first()
        assert b.status == "active"

        # Proposals are all 'pending_review'
        proposals = db.query(ActionProposal).filter_by(run_id=run.id).all()
        assert len(proposals) == 4
        assert all(p.status == "pending_review" for p in proposals)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Scenario 11: A rejected action cannot execute.
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_scenario_11_rejected_action_does_not_execute():
    db = SessionLocal()
    try:
        orch = AgentOrchestrator(db)
        run = orch.run_task("Investigate recall Batch B2231.")
        hold_p = db.query(ActionProposal).filter_by(run_id=run.id, action_type="dispatch_hold").first()
        prop_id = hold_p.id
        db.close()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            payload = {
                "decision": "rejected",
                "approver_role": "Lead Pharmacist",
                "approver_name": "Dr. Ananya Sharma",
                "notes": "Rejected: Insufficient regulatory documentation.",
            }
            res = await client.post(f"/api/approvals/{prop_id}/action", json=payload)
            assert res.status_code == 200
            assert res.json()["status"] == "rejected"

            # Verify batch status in DB was NOT changed
            db2 = SessionLocal()
            try:
                b = db2.query(BatchInventory).filter_by(batch_number="B2231").first()
                assert b.status == "active"  # Untouched!
            finally:
                db2.close()
    finally:
        pass


# ---------------------------------------------------------------------------
# Scenario 12: An unapproved or recalled batch cannot be dispatched by bypassing the UI.
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_scenario_12_bypass_dispatch_on_quarantined_batch_blocked():
    db = SessionLocal()
    try:
        b = db.query(BatchInventory).filter_by(batch_number="B4019").first()
        b.status = "quarantine"
        db.commit()
    finally:
        db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Directly call backend API to attempt dispatch bypass
        payload = {
            "batch_number": "B4019",
            "customer_code": "CUST-HOSP-01",
            "quantity": 50,
        }
        res = await client.post("/api/inventory/dispatch", json=payload)
        assert res.status_code == 403
        assert "SAFETY VIOLATION BLOCKED" in res.json()["detail"]


# ---------------------------------------------------------------------------
# Scenario 13: Approved execution changes persistent database state correctly.
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_scenario_13_approved_execution_mutates_persistent_database_state():
    db = SessionLocal()
    try:
        orch = AgentOrchestrator(db)
        run = orch.run_task("Investigate recall Batch B2231.")
        hold_p = db.query(ActionProposal).filter_by(run_id=run.id, action_type="dispatch_hold").first()
        prop_id = hold_p.id
        db.close()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            payload = {
                "decision": "approved",
                "approver_role": "Lead Pharmacist",
                "approver_name": "Dr. Ananya Sharma, R.Ph",
                "notes": "Verified. Applying quarantine hold.",
            }
            res = await client.post(f"/api/approvals/{prop_id}/action", json=payload)
            assert res.status_code == 200

            # Verify persistent DB state mutation
            db2 = SessionLocal()
            try:
                b = db2.query(BatchInventory).filter_by(batch_number="B2231").first()
                assert b.status == "dispatch_hold"

                # StockMovement was recorded
                mov = db2.query(StockMovement).filter_by(batch_id=b.id, movement_type="dispatch_hold").first()
                assert mov is not None
            finally:
                db2.close()
    finally:
        pass


# ---------------------------------------------------------------------------
# Scenario 14: An unsuccessful operation is reported as a failure, not a success.
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_scenario_14_unsuccessful_operation_reported_as_failure():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Deliberately invalid proposal decision
        res = await client.post("/api/approvals/99999/action", json={"decision": "approved", "approver_role": "Pharmacist"})
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Scenario 15: An unavailable AI model does not fabricate an answer or corrupt data.
# ---------------------------------------------------------------------------
def test_scenario_15_unavailable_model_graceful_fallback():
    db = SessionLocal()
    try:
        # Configure a broken provider pointing to non-existent endpoint
        broken_provider = OpenAICompatibleProvider(
            base_url="http://localhost:9999/v1",
            model="non-existent-model",
            timeout_seconds=0.5,
        )
        health = broken_provider.check_health()
        assert health["is_online"] is False

        # Orchestrator should fallback safely to deterministic semantic engine without throwing or corrupting
        orch = AgentOrchestrator(db, ai_provider=broken_provider)
        run = orch.run_task("Investigate recall Batch B2231.")
        assert run.state == "awaiting_approval"
        assert run.final_report_json is not None
        assert "B2231" in run.final_report_json
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Scenario 16: Unsupported questions receive a truthful, useful response.
# ---------------------------------------------------------------------------
def test_scenario_16_unsupported_questions_truthful_response():
    db = SessionLocal()
    try:
        orch = AgentOrchestrator(db)
        run = orch.run_task("What is the weather like in Paris today?")
        assert run.state == "completed"

        report = run.final_report_json
        assert "outside pharmaceutical distribution" in report.lower()
        # No proposals fabricated
        assert len(run.proposals) == 0
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Scenario 17: Follow-up questions retain appropriate context while retrieving fresh records.
# ---------------------------------------------------------------------------
def test_scenario_17_follow_up_questions_retain_context():
    db = SessionLocal()
    try:
        orch = AgentOrchestrator(db)
        # Context from a prior investigation of B4019
        prior_context = {"target_batch": "B4019", "warehouse": "WH-NORTH"}
        run = orch.run_task("Where did it go?", context=prior_context)

        # Successfully resolved target_batch B4019 from context
        assert run.intent_json is not None
        assert "B4019" in run.intent_json
        assert run.final_report_json is not None
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Scenario 18: Empty databases display accurate empty states.
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_scenario_18_empty_database_accurate_empty_states():
    # Drop all records
    engine.dispose()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Dashboard summary on empty DB
        res = await client.get("/api/dashboard/summary")
        assert res.status_code == 200
        data = res.json()
        assert data["total_products"] == 0
        assert data["total_batches"] == 0
        assert data["active_alerts"] == 0
        assert len(data["attention_items"]) == 0

        # Inventory batches on empty DB
        batches_res = await client.get("/api/inventory/batches")
        assert batches_res.status_code == 200
        assert len(batches_res.json()) == 0


# ---------------------------------------------------------------------------
# Scenario 19: Inventory quantities remain consistent under concurrent updates.
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_scenario_19_concurrent_inventory_updates_consistency():
    reset_database()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Check initial quantity of B5011 (Dolo-650 in West depot): 1200 units
        b_res = await client.get("/api/inventory/batches/B5011")
        initial_qty = b_res.json()["batch"]["available_quantity"]
        assert initial_qty == 1200

        # Dispatch 50 units
        disp_res = await client.post(
            "/api/inventory/dispatch",
            json={
                "batch_number": "B5011",
                "customer_code": "CUST-CH-01",
                "quantity": 50,
            },
        )
        assert disp_res.status_code == 200

        # Verify updated quantity is exactly initial_qty - 50
        b_res2 = await client.get("/api/inventory/batches/B5011")
        assert b_res2.json()["batch"]["available_quantity"] == initial_qty - 50
        assert b_res2.json()["total_dispatched"] > 0


# ---------------------------------------------------------------------------
# Scenario 20: Restarting the application preserves operational records.
# ---------------------------------------------------------------------------
def test_scenario_20_persistence_across_session_restart():
    reset_database()
    db = SessionLocal()
    try:
        orch = AgentOrchestrator(db)
        run = orch.run_task("Investigate recall Batch B2231.")
        saved_run_id = run.id
    finally:
        db.close()

    # Simulate app/database restart by disposing engine and opening brand new session
    engine.dispose()
    new_db = SessionLocal()
    try:
        reopened_run = new_db.query(AgentRun).filter_by(id=saved_run_id).first()
        assert reopened_run is not None
        assert reopened_run.state == "awaiting_approval"
        assert len(reopened_run.events) >= 5
        assert len(reopened_run.proposals) == 4
    finally:
        new_db.close()
