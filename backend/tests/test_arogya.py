import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.database import SessionLocal
from app.seed import reset_database
from app.db_models import (
    BatchInventory,
    Dispatch,
    Customer,
    ActionProposal,
    PurchaseOrder,
    Product,
    StockMovement,
)
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


# ---------------------------------------------------------------------------
# 9. Regression & Validation Tests for Proposal Actions
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_meropenem_shortage_po_does_not_create_amoxicillin_po():
    """Regression test proving Meropenem PO creates a Meropenem PO, NOT Amoxicillin."""
    db = SessionLocal()
    try:
        orchestrator = AgentOrchestrator(db)
        run = orchestrator.run_task("Identify critical medicine shortage risks.")
        po_prop = (
            db.query(ActionProposal)
            .filter_by(run_id=run.id, action_type="purchase_order")
            .first()
        )
        assert po_prop is not None
        assert "Meropenem" in po_prop.title
        prop_id = po_prop.id

        # Verify initial PO count is 0
        assert db.query(PurchaseOrder).count() == 0
        db.close()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            payload = {
                "decision": "approved",
                "approver_role": "Operations Director",
                "approver_name": "Rajiv Kapoor",
                "notes": "Emergency ICU replenishment authorized.",
            }
            res = await client.post(f"/api/approvals/{prop_id}/action", json=payload)
            assert res.status_code == 200
            assert res.json()["status"] == "approved"

            db2 = SessionLocal()
            try:
                # Exactly 1 PO was created
                all_pos = db2.query(PurchaseOrder).all()
                assert len(all_pos) == 1
                created_po = all_pos[0]

                # Target must be Meropenem (MED-MER-1000), NOT Amoxicillin (MED-AMX-625)
                assert created_po.product.sku == "MED-MER-1000"
                assert "Meropenem" in created_po.product.name
                assert created_po.quantity == 500
                assert created_po.supplier.name == "Sun Pharma Direct Distribution"
                assert created_po.status == "submitted"

                # Verify Amoxicillin has 0 purchase orders
                amx_pos = (
                    db2.query(PurchaseOrder)
                    .join(Product)
                    .filter(Product.sku == "MED-AMX-625")
                    .all()
                )
                assert len(amx_pos) == 0
            finally:
                db2.close()
    finally:
        pass


@pytest.mark.asyncio
async def test_recall_amoxicillin_po_creates_cipla_po():
    """Verify recall PO creates an Amoxicillin PO with Cipla Direct."""
    db = SessionLocal()
    try:
        orchestrator = AgentOrchestrator(db)
        run = orchestrator.run_task("Investigate recall Batch B2231.")
        po_prop = (
            db.query(ActionProposal)
            .filter_by(run_id=run.id, action_type="purchase_order")
            .first()
        )
        assert po_prop is not None
        prop_id = po_prop.id
        db.close()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            payload = {
                "decision": "approved",
                "approver_role": "Operations Director",
                "approver_name": "Rajiv Kapoor",
                "notes": "Emergency recall buffer approved.",
            }
            res = await client.post(f"/api/approvals/{prop_id}/action", json=payload)
            assert res.status_code == 200

            db2 = SessionLocal()
            try:
                po = db2.query(PurchaseOrder).first()
                assert po is not None
                assert po.product.sku == "MED-AMX-625"
                assert po.quantity == 600
                assert po.supplier.name == "Cipla Direct Formulations"
            finally:
                db2.close()
    finally:
        pass


@pytest.mark.asyncio
async def test_quarantine_action_updates_batch_status_and_movement():
    """Verify approving quarantine order sets status to quarantine and records movement."""
    db = SessionLocal()
    try:
        orchestrator = AgentOrchestrator(db)
        run = orchestrator.run_task("Investigate a cold-chain temperature excursion.")
        q_prop = (
            db.query(ActionProposal)
            .filter_by(run_id=run.id, action_type="quarantine_order")
            .first()
        )
        assert q_prop is not None
        prop_id = q_prop.id

        b4019 = db.query(BatchInventory).filter_by(batch_number="B4019").first()
        assert b4019.status == "active"
        db.close()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            payload = {
                "decision": "approved",
                "approver_role": "QA Compliance Officer",
                "approver_name": "Meera Joshi",
                "notes": "Cold storage excursion quarantine lock applied.",
            }
            res = await client.post(f"/api/approvals/{prop_id}/action", json=payload)
            assert res.status_code == 200

            db2 = SessionLocal()
            try:
                b4019_updated = db2.query(BatchInventory).filter_by(batch_number="B4019").first()
                assert b4019_updated.status == "quarantine"

                mov = (
                    db2.query(StockMovement)
                    .filter_by(batch_id=b4019_updated.id, movement_type="quarantine_hold")
                    .first()
                )
                assert mov is not None
            finally:
                db2.close()
    finally:
        pass


@pytest.mark.asyncio
async def test_stock_allocation_action_and_boundary_failure():
    """Verify approving stock allocation updates available stock and rejects over-allocation."""
    db = SessionLocal()
    try:
        orchestrator = AgentOrchestrator(db)
        run = orchestrator.run_task("Investigate recall Batch B2231.")
        alloc_prop = (
            db.query(ActionProposal)
            .filter_by(run_id=run.id, action_type="stock_allocation")
            .first()
        )
        assert alloc_prop is not None
        prop_id = alloc_prop.id

        b2240 = db.query(BatchInventory).filter_by(batch_number="B2240").first()
        assert b2240.available_quantity == 400
        db.close()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            payload = {
                "decision": "approved",
                "approver_role": "Lead Pharmacist",
                "approver_name": "Dr. Ananya Sharma, R.Ph",
                "notes": "Allocating 400 units of B2240 (150 to hospitals, 250 to chemists).",
            }
            res = await client.post(f"/api/approvals/{prop_id}/action", json=payload)
            assert res.status_code == 200

            db2 = SessionLocal()
            try:
                b2240_updated = db2.query(BatchInventory).filter_by(batch_number="B2240").first()
                # 400 units were allocated -> available quantity is now 0
                assert b2240_updated.available_quantity == 0

                mov = (
                    db2.query(StockMovement)
                    .filter_by(batch_id=b2240_updated.id, movement_type="allocation")
                    .first()
                )
                assert mov is not None
                assert mov.quantity == -400

                # Now create another proposal attempting to allocate 100 units from B2240 (which has 0 available)
                p_over = ToolRegistry.create_action_proposal(
                    db2,
                    run_id=run.id,
                    action_type="stock_allocation",
                    title="Allocate 100 Units Batch B2240",
                    description="Excess allocation attempt.",
                    rationale="Testing boundary rejection.",
                    supporting_evidence={"batch_number": "B2240", "quantity": 100},
                    target_entity="Chemists",
                    expected_impact="Should fail boundary check.",
                )
                over_id = p_over["proposal_id"]
            finally:
                db2.close()

            # Attempting to approve over-allocation must fail with HTTP 400
            res_fail = await client.post(f"/api/approvals/{over_id}/action", json=payload)
            assert res_fail.status_code == 400
            assert "exceeds available stock" in res_fail.json()["detail"]

            # DB remains unmutated
            db3 = SessionLocal()
            try:
                b2240_after_fail = db3.query(BatchInventory).filter_by(batch_number="B2240").first()
                assert b2240_after_fail.available_quantity == 0
            finally:
                db3.close()
    finally:
        pass


@pytest.mark.asyncio
async def test_rejected_proposal_does_not_mutate_database():
    """Verify rejected proposals are recorded with rejection notes and do not mutate inventory or create POs."""
    db = SessionLocal()
    try:
        orchestrator = AgentOrchestrator(db)
        run = orchestrator.run_task("Investigate recall Batch B2231.")
        hold_prop = (
            db.query(ActionProposal)
            .filter_by(run_id=run.id, action_type="dispatch_hold")
            .first()
        )
        po_prop = (
            db.query(ActionProposal)
            .filter_by(run_id=run.id, action_type="purchase_order")
            .first()
        )
        hold_id = hold_prop.id
        po_id = po_prop.id
        db.close()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Reject dispatch hold
            payload_reject_hold = {
                "decision": "rejected",
                "approver_role": "QA Compliance Officer",
                "approver_name": "Meera Joshi",
                "notes": "Rejected: Batch certificate was validated as clean.",
            }
            res_hold = await client.post(f"/api/approvals/{hold_id}/action", json=payload_reject_hold)
            assert res_hold.status_code == 200
            data_hold = res_hold.json()
            assert data_hold["status"] == "rejected"
            assert "Meera Joshi" in data_hold["approved_by"]
            assert "Batch certificate was validated" in data_hold["rejection_reason"]

            # Reject PO
            payload_reject_po = {
                "decision": "rejected",
                "approver_role": "Operations Director",
                "approver_name": "Rajiv Kapoor",
                "notes": "PO cancelled due to existing local inventory buffer.",
            }
            res_po = await client.post(f"/api/approvals/{po_id}/action", json=payload_reject_po)
            assert res_po.status_code == 200
            assert res_po.json()["status"] == "rejected"

            # Verify database was NOT mutated
            db2 = SessionLocal()
            try:
                b2231 = db2.query(BatchInventory).filter_by(batch_number="B2231").first()
                assert b2231.status == "active"  # NOT dispatch_hold!
                assert db2.query(PurchaseOrder).count() == 0  # No PO created!
            finally:
                db2.close()
    finally:
        pass


@pytest.mark.asyncio
async def test_invalid_and_malformed_proposals_rejected_without_mutation():
    """Verify invalid batch, missing targets, or MOQ violations return 400 and leave DB unmutated."""
    db = SessionLocal()
    try:
        # 1. Non-existent batch
        p_invalid_batch = ToolRegistry.create_action_proposal(
            db,
            run_id="run-test-invalid",
            action_type="dispatch_hold",
            title="Dispatch Hold: Batch B9999",
            description="Targeting non-existent batch.",
            rationale="Test non-existent batch.",
            supporting_evidence={"batch_number": "B9999"},
            target_entity="Warehouse / Batch B9999",
            expected_impact="Should be rejected.",
        )
        id_invalid_batch = p_invalid_batch["proposal_id"]

        # 2. Invalid PO quantity <= 0
        p_invalid_qty = ToolRegistry.create_action_proposal(
            db,
            run_id="run-test-invalid",
            action_type="purchase_order",
            title="PO for Amoxicillin",
            description="Negative quantity.",
            rationale="Test invalid quantity.",
            supporting_evidence={"sku": "MED-AMX-625", "quantity": -50},
            target_entity="Cipla Direct",
            expected_impact="Should be rejected.",
        )
        id_invalid_qty = p_invalid_qty["proposal_id"]

        # 3. PO violating supplier MOQ (100 units when Cipla MOQ is 500)
        p_moq_viol = ToolRegistry.create_action_proposal(
            db,
            run_id="run-test-invalid",
            action_type="purchase_order",
            title="PO below MOQ",
            description="Ordering 100 units.",
            rationale="Test MOQ violation.",
            supporting_evidence={
                "sku": "MED-AMX-625",
                "supplier": "Cipla Direct Formulations",
                "quantity": 100,
            },
            target_entity="Cipla Direct",
            expected_impact="Should be rejected.",
        )
        id_moq_viol = p_moq_viol["proposal_id"]
        db.close()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            payload = {
                "decision": "approved",
                "approver_role": "Lead Pharmacist",
                "approver_name": "Dr. Ananya Sharma",
                "notes": "Testing invalid proposals.",
            }

            # 1. Fails because B9999 does not exist
            r1 = await client.post(f"/api/approvals/{id_invalid_batch}/action", json=payload)
            assert r1.status_code == 400
            assert "not found" in r1.json()["detail"].lower()

            # 2. Fails because quantity <= 0
            r2 = await client.post(f"/api/approvals/{id_invalid_qty}/action", json=payload)
            assert r2.status_code == 400
            assert "greater than zero" in r2.json()["detail"].lower()

            # 3. Fails because quantity violates MOQ
            r3 = await client.post(f"/api/approvals/{id_moq_viol}/action", json=payload)
            assert r3.status_code == 400
            assert "minimum order quantity" in r3.json()["detail"].lower()

            # Verify proposals remain pending_review and no PO was created
            db2 = SessionLocal()
            try:
                assert db2.query(PurchaseOrder).count() == 0
                for pid in [id_invalid_batch, id_invalid_qty, id_moq_viol]:
                    p = db2.query(ActionProposal).filter_by(id=pid).first()
                    assert p.status == "pending_review"
            finally:
                db2.close()
    finally:
        pass
