import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.database import SessionLocal
from app.seed import reset_database
from app.db_models import BatchInventory, Dispatch, Customer, ActionProposal
from app.tools.registry import ToolRegistry
from app.agent.orchestrator import AgentOrchestrator


@pytest.fixture(autouse=True)
def setup_test_db():
    reset_database()
    yield


# ---------------------------------------------------------------------------
# 1. Deterministic Batch Reconciliation & Recipient Tracing Tests
# ---------------------------------------------------------------------------
def test_batch_quantity_reconciliation_and_recipients():
    db = SessionLocal()
    try:
        b2231 = db.query(BatchInventory).filter_by(batch_number="B2231").first()
        assert b2231 is not None

        # 180 units remaining in warehouse
        assert b2231.available_quantity == 180

        # Dispatches sum to exactly 640
        dispatches = db.query(Dispatch).filter_by(batch_id=b2231.id).all()
        total_disp = sum(d.quantity for d in dispatches)
        assert total_disp == 640

        # Trace recipients: exactly 23 chemists + 2 hospitals = 25 distinct
        trace = ToolRegistry.trace_batch_recipients(db, "B2231")
        assert trace["total_dispatched_quantity"] == 640
        assert trace["total_recipients_count"] == 25
        assert trace["breakdown"]["hospitals"]["count"] == 2
        assert trace["breakdown"]["hospitals"]["quantity"] == 150
        assert trace["breakdown"]["chemists"]["count"] == 23
        assert trace["breakdown"]["chemists"]["quantity"] == 490

        # Separation check: warehouse remaining != dispatched
        assert b2231.available_quantity != total_disp
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 2. Replacement Availability & Shortage Calculation Tests
# ---------------------------------------------------------------------------
def test_replacement_availability_calculations():
    db = SessionLocal()
    try:
        calc = ToolRegistry.calculate_replacement_availability(db, "B2231", "B2240", lead_time_days=14)
        # B2240 has 400 available units
        assert calc["available_replacement_stock"] == 400
        # Recalled units = 640
        assert calc["recalled_units_needing_replacement"] == 640
        # Normal 14-day demand forecast (15 * 14 = 210)
        assert calc["forecast_normal_demand"] == 210
        # Total combined demand = 640 + 210 = 850
        assert calc["total_combined_demand"] == 850
        # Net shortfall = 850 - 400 = 450
        assert calc["total_net_shortfall"] == 450
        # Cannot cover both
        assert calc["can_cover_both"] is False
        assert calc["can_cover_replacements_only"] is False
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 3. Expiry and Return Window Rules Tests
# ---------------------------------------------------------------------------
def test_expiry_and_return_window_rules():
    db = SessionLocal()
    try:
        risks = ToolRegistry.get_expiry_risks(db, days_threshold=90)
        assert risks["batches_at_risk_count"] >= 1
        b1982_risk = next((b for b in risks["batches"] if b["batch_number"] == "B1982"), None)
        assert b1982_risk is not None
        assert b1982_risk["available_quantity"] == 350
        assert b1982_risk["days_to_expiry"] <= 35
        assert b1982_risk["eligible_for_supplier_return"] is True
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 4. Temperature Excursion Detection Tests
# ---------------------------------------------------------------------------
def test_temperature_excursion_detection():
    db = SessionLocal()
    try:
        excursions = ToolRegistry.get_temperature_excursions(db)
        assert excursions["excursions_count"] >= 1
        exc = excursions["excursions"][0]
        assert exc["recorded_temperature_celsius"] == 12.8
        assert exc["duration_minutes"] == 270
        assert exc["delta_celsius"] == 4.8
        assert any(b["batch_number"] == "B4019" for b in exc["affected_batches"])
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 5. Invalid Stock Allocations & Verification Failures Tests
# ---------------------------------------------------------------------------
def test_independent_verification_and_failure_detection():
    db = SessionLocal()
    try:
        # Successful verification with true facts
        checks_pass = ToolRegistry.verify_incident_report(
            db,
            batch_number="B2231",
            reported_dispatched=640,
            reported_recipients_count=25,
            replacement_batch_number="B2240",
            proposed_replacement_allocation=400,
            proposed_po_quantity=600,
        )
        assert all(c["status"] == "passed" for c in checks_pass)

        # Deliberate failure test: falsified dispatched quantity (e.g. 500 instead of 640)
        checks_fail_disp = ToolRegistry.verify_incident_report(
            db,
            batch_number="B2231",
            reported_dispatched=500,  # FALSE
            reported_recipients_count=25,
            replacement_batch_number="B2240",
            proposed_replacement_allocation=400,
            proposed_po_quantity=600,
        )
        disp_check = next(c for c in checks_fail_disp if c["check_name"] == "reconciliation_dispatched_sum")
        assert disp_check["status"] == "failed"
        assert disp_check["is_valid"] is False

        # Deliberate failure test: exceeding replacement batch stock (allocating 500 when only 400 exist)
        checks_fail_alloc = ToolRegistry.verify_incident_report(
            db,
            batch_number="B2231",
            reported_dispatched=640,
            reported_recipients_count=25,
            replacement_batch_number="B2240",
            proposed_replacement_allocation=500,  # INVALID EXCEEDS 400
            proposed_po_quantity=600,
        )
        alloc_check = next(c for c in checks_fail_alloc if c["check_name"] == "stock_allocation_boundary")
        assert alloc_check["status"] == "failed"
        assert alloc_check["is_valid"] is False
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 6. End-to-End Recall Agent Workflow & State Transitions
# ---------------------------------------------------------------------------
def test_agent_recall_workflow_e2e():
    db = SessionLocal()
    try:
        orchestrator = AgentOrchestrator(db)
        run = orchestrator.run_task("Investigate recall Batch B2231.")

        assert run.state == "awaiting_approval"
        assert run.plan_json is not None
        assert run.evidence_json is not None
        assert run.verification_json is not None
        assert run.final_report_json is not None

        # Check action proposals were created in pending_review
        proposals = db.query(ActionProposal).filter_by(run_id=run.id).all()
        assert len(proposals) == 4
        action_types = [p.action_type for p in proposals]
        assert "dispatch_hold" in action_types
        assert "customer_notice" in action_types
        assert "purchase_order" in action_types
        assert "stock_allocation" in action_types
        assert all(p.status == "pending_review" for p in proposals)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 7. Human Approval Gate: Consequential Actions
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_human_approval_applies_consequential_changes():
    db = SessionLocal()
    try:
        orchestrator = AgentOrchestrator(db)
        run = orchestrator.run_task("Investigate recall Batch B2231.")
        hold_prop = db.query(ActionProposal).filter_by(run_id=run.id, action_type="dispatch_hold").first()
        assert hold_prop is not None
        hold_prop_id = hold_prop.id

        # Verify initial batch status is 'active'
        b2231 = db.query(BatchInventory).filter_by(batch_number="B2231").first()
        assert b2231.status == "active"
        db.close()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Approve proposal
            payload = {
                "decision": "approved",
                "approver_role": "Lead Pharmacist",
                "approver_name": "Dr. Ananya Sharma, R.Ph",
                "notes": "Verified 25 recipient dispatches; applying immediate dispatch hold.",
            }
            res = await client.post(f"/api/approvals/{hold_prop_id}/action", json=payload)
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "approved"
            assert "Dr. Ananya Sharma" in data["approved_by"]

            # Verify batch status in DB transitioned to 'dispatch_hold'!
            db2 = SessionLocal()
            try:
                b_updated = db2.query(BatchInventory).filter_by(batch_number="B2231").first()
                assert b_updated.status == "dispatch_hold"
            finally:
                db2.close()
    finally:
        pass


# ---------------------------------------------------------------------------
# 8. API Endpoints Tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_api_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Dashboard Summary
        dash_res = await client.get("/api/dashboard/summary")
        assert dash_res.status_code == 200
        dash_data = dash_res.json()
        assert dash_data["total_batches"] >= 5
        assert dash_data["active_recalls"] >= 1
        assert len(dash_data["attention_items"]) >= 1

        # Inventory Batches list
        batches_res = await client.get("/api/inventory/batches")
        assert batches_res.status_code == 200
        batches = batches_res.json()
        assert any(b["batch_number"] == "B2231" for b in batches)

        # Batch B2231 Detail
        b_detail_res = await client.get("/api/inventory/batches/B2231")
        assert b_detail_res.status_code == 200
        b_detail = b_detail_res.json()
        assert b_detail["total_dispatched"] == 640
        assert len(b_detail["dispatches"]) == 25
        assert b_detail["batch"]["available_quantity"] == 180

        # Agent Run Endpoint
        agent_res = await client.post("/api/agent/run", json={"prompt": "Investigate recall Batch B2231."})
        assert agent_res.status_code == 200
        agent_data = agent_res.json()
        assert agent_data["state"] == "awaiting_approval"
        assert len(agent_data["events"]) >= 5
        assert len(agent_data["proposals"]) == 4
        assert agent_data["final_report"]["total_recipients"] == 25
