import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.database import SessionLocal
from app.seed import reset_database
from app.db_models import (
    BatchInventory,
    Dispatch,
    PurchaseOrder,
    StockMovement,
    ActionProposal,
    AgentRun,
)
from app.simulator.engine import WhatIfSimulatorEngine


@pytest.fixture(autouse=True)
def setup_test_db():
    reset_database()
    yield


def test_simulator_isolation_proves_zero_mutations():
    """Verify that What-If Simulator runs strictly in isolation and mutates ZERO live records."""
    db = SessionLocal()
    try:
        # Snapshot before running simulations
        batches_before = {
            b.id: (b.batch_number, b.available_quantity, b.status)
            for b in db.query(BatchInventory).all()
        }
        dispatches_before = [d.id for d in db.query(Dispatch).all()]
        pos_before = [p.id for p in db.query(PurchaseOrder).all()]
        movements_before = [m.id for m in db.query(StockMovement).all()]

        engine = WhatIfSimulatorEngine(db=db)

        # 1. Run Recall Simulation
        res_recall = engine.run_simulation(
            scenario_type="recall",
            batch_number="B2231",
            replacement_batch_number="B2232",
        )
        assert res_recall["simulation_id"].startswith("SIM-")
        assert len(res_recall["strategies"]) >= 2

        # 2. Run Cold Chain Excursion Simulation
        res_cold = engine.run_simulation(
            scenario_type="cold_chain_excursion",
            warehouse_id=1,
            batch_number="B3011",
        )
        assert len(res_cold["strategies"]) >= 2

        # 3. Run Expiry Risk Simulation
        res_expiry = engine.run_simulation(
            scenario_type="expiry_risk",
            batch_number="B1042",
        )
        assert len(res_expiry["strategies"]) >= 2

        # 4. Run Supplier Delay Simulation
        res_delay = engine.run_simulation(
            scenario_type="supplier_delay",
            product_id=1,
            supplier_delay_days=14,
            demand_surge_percent=20.0,
        )
        assert len(res_delay["strategies"]) >= 2

        # 5. Run Hospital Demand Surge Simulation
        res_surge = engine.run_simulation(
            scenario_type="competing_hospital_demand",
            product_id=2,
            demand_surge_percent=30.0,
            hospital_priority_weight=2.0,
        )
        assert len(res_surge["strategies"]) >= 2

        # Verify DB records are 100% UNCHANGED
        batches_after = {
            b.id: (b.batch_number, b.available_quantity, b.status)
            for b in db.query(BatchInventory).all()
        }
        dispatches_after = [d.id for d in db.query(Dispatch).all()]
        pos_after = [p.id for p in db.query(PurchaseOrder).all()]
        movements_after = [m.id for m in db.query(StockMovement).all()]

        assert batches_before == batches_after, "Simulation must NOT mutate batch inventory quantities or statuses!"
        assert dispatches_before == dispatches_after, "Simulation must NOT create or alter real dispatches!"
        assert pos_before == pos_after, "Simulation must NOT create purchase orders during run!"
        assert movements_before == movements_after, "Simulation must NOT log stock movement ledger entries!"
    finally:
        db.close()


def test_b2231_recall_deterministic_math():
    """Verify calculation correctness for B2231 recall benchmark dynamically."""
    db = SessionLocal()
    try:
        engine = WhatIfSimulatorEngine(db=db)
        res = engine.run_simulation(
            scenario_type="recall",
            batch_number="B2231",
            replacement_batch_number="B2232",
        )

        assert "B2231" in res["scenario_name"]
        baseline = res["baseline"]

        # Dispatched units should match database state (640 units across hospitals and chemists)
        assert baseline["recalled_batch_dispatched_units"] == 640
        assert baseline["hospital_units_at_risk"] > 0
        assert baseline["chemist_units_at_risk"] > 0
        assert baseline["replacement_batch_available_units"] > 0

        # Strategies comparison
        strategies = res["strategies"]
        assert len(strategies) >= 2

        strat_1 = next(s for s in strategies if "HOSPITAL" in s["strategy_id"])
        strat_2 = next(s for s in strategies if "PRO-RATA" in s["strategy_id"])

        # Hospital Defense gives 100% hospital allocation
        assert strat_1["hospital_fulfillment_percent"] == 100.0
        assert strat_1["is_recommended"] is True
        # Deficit calculation: 640 dispatched + 360 demand - 400 available = 600 deficit
        assert strat_1["replacement_deficit"] == 600
        assert strat_1["emergency_order_units"] >= 500

        # Pro-rata gives equal fulfillment
        assert strat_2["hospital_fulfillment_percent"] <= 60.0
        assert strat_2["is_recommended"] is False
        assert strat_2["emergency_order_units"] == 0

        # Assumptions and safety notice
        assert len(res["assumptions"]) > 0
        assert "clinical_safety_notice" in res
        assert "Qualified Person" in res["clinical_safety_notice"]
    finally:
        db.close()


def test_natural_language_scenario_parsing():
    """Verify parsing natural language prompts into structured simulation parameters."""
    db = SessionLocal()
    try:
        engine = WhatIfSimulatorEngine(db=db)

        # 1. Delay prompt
        parsed_1 = engine.parse_natural_language_scenario("Sun Pharma delayed by 14 days with 20% demand surge")
        assert parsed_1["scenario_type"] == "supplier_delay"
        assert parsed_1["supplier_delay_days"] == 14
        assert parsed_1["demand_surge_percent"] == 20.0

        # 2. Thermal excursion prompt
        parsed_2 = engine.parse_natural_language_scenario("What happens if cold room has a temperature excursion for batch B3011?")
        assert parsed_2["scenario_type"] == "cold_chain_excursion"
        assert parsed_2["batch_number"] == "B3011"

        # 3. Expiry prompt
        parsed_3 = engine.parse_natural_language_scenario("Show RMA return vs transfer options for expiring lot B1042")
        assert parsed_3["scenario_type"] == "expiry_risk"
        assert parsed_3["batch_number"] == "B1042"

        # 4. Hospital surge prompt
        parsed_4 = engine.parse_natural_language_scenario("Simulate a competing hospital ICU demand surge of 35%")
        assert parsed_4["scenario_type"] == "competing_hospital_demand"
        assert parsed_4["demand_surge_percent"] == 35.0
    finally:
        db.close()


@pytest.mark.asyncio
async def test_stage_proposal_creates_pending_review_and_executes_on_approval():
    """Verify that staging a simulation proposal creates a real ActionProposal in pending_review
    and executing it requires Qualified Person approval with fresh validation.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Run simulation via API
        run_res = await client.post(
            "/api/simulator/run",
            json={
                "scenario_type": "recall",
                "batch_number": "B2231",
                "replacement_batch_number": "B2232",
            },
        )
        assert run_res.status_code == 200
        sim_data = run_res.json()
        assert "simulation_id" in sim_data
        rec_strat = sim_data["strategies"][0]

        # 2. Stage the recommended strategy into official ActionProposals
        stage_res = await client.post(
            "/api/simulator/propose",
            json={
                "simulation_id": sim_data["simulation_id"],
                "strategy_id": rec_strat["strategy_id"],
                "strategy_name": rec_strat["name"],
                "scenario_name": sim_data["scenario_name"],
                "proposals": rec_strat["action_proposals"],
            },
        )
        assert stage_res.status_code == 200
        stage_data = stage_res.json()
        assert stage_data["success"] is True
        assert len(stage_data["created_proposal_ids"]) >= 1

        proposal_id = stage_data["created_proposal_ids"][0]

        # 3. Verify the proposal is in pending_review
        prop_res = await client.get("/api/approvals?status=pending_review")
        assert prop_res.status_code == 200
        pending_props = prop_res.json()
        matching = [p for p in pending_props if p["id"] == proposal_id]
        assert len(matching) == 1
        assert matching[0]["status"] == "pending_review"

        # 4. Verify batch B2231 is still ACTIVE (not quarantined yet because not approved)
        batch_res = await client.get("/api/inventory/batches/B2231")
        assert batch_res.status_code == 200
        assert batch_res.json()["batch"]["status"] == "active"

        # 5. Authorize the proposal as Qualified Person (R.Ph)
        approve_res = await client.post(
            f"/api/approvals/{proposal_id}/action",
            json={
                "decision": "approved",
                "approver_name": "Dr. Ananya Sharma",
                "approver_role": "Chief Pharmacist (R.Ph / QP)",
                "notes": "Verified against What-If simulation evidence. Approved for regulatory compliance.",
            },
        )
        assert approve_res.status_code == 200
        assert approve_res.json()["status"] == "approved"

        # 6. Verify that approval executed the hold: Batch B2231 is now in dispatch_hold!
        batch_after = await client.get("/api/inventory/batches/B2231")
        assert batch_after.status_code == 200
        assert batch_after.json()["batch"]["status"] == "dispatch_hold"


@pytest.mark.asyncio
async def test_simulator_scenarios_and_explanation_endpoints():
    """Verify preset scenarios and AI explanation endpoints."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Presets
        scenarios_res = await client.get("/api/simulator/scenarios")
        assert scenarios_res.status_code == 200
        scenarios = scenarios_res.json()
        assert len(scenarios) >= 5
        assert any(s["benchmark"] is True for s in scenarios)

        # Natural language parsing endpoint
        parse_res = await client.post(
            "/api/simulator/parse-prompt",
            json={"prompt": "What if Cipla delivery is delayed by 10 days and hospital demand surges by 25%?"},
        )
        assert parse_res.status_code == 200
        parsed = parse_res.json()["extracted_parameters"]
        assert parsed["scenario_type"] in ["supplier_delay", "competing_hospital_demand"]

        # Explain scenario endpoint
        explain_res = await client.post(
            "/api/simulator/explain",
            json={"prompt": "Explain the trade-offs of holding Batch B3011 under thermal excursion."},
        )
        assert explain_res.status_code == 200
        assert "explanation" in explain_res.json()
        assert len(explain_res.json()["explanation"]) > 20
