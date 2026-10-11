import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.seed import reset_database
from app.db_models import (
    Product,
    Customer,
    Supplier,
    BatchInventory,
    Dispatch,
    PurchaseOrder,
    Recall,
    TemperatureLog,
)
from app.agent.orchestrator import AgentOrchestrator
from app.tools.registry import ToolRegistry


client = TestClient(app)


@pytest.fixture(autouse=True, scope="module")
def setup_full_database():
    reset_database(include_datasets=True)


def test_dataset_exact_counts():
    """Validates that all eight CSV datasets from 07_pharma_distribution.zip are 100% imported."""
    db = SessionLocal()
    try:
        p_count = db.query(Product).count()
        c_count = db.query(Customer).count()
        s_count = db.query(Supplier).count()
        b_count = db.query(BatchInventory).count()
        d_count = db.query(Dispatch).count()
        po_count = db.query(PurchaseOrder).count()
        r_count = db.query(Recall).count()
        t_count = db.query(TemperatureLog).count()

        assert p_count >= 75, f"Expected at least 75 products, found {p_count}"
        assert c_count >= 420, f"Expected at least 420 customers, found {c_count}"
        assert s_count >= 75, f"Expected at least 75 suppliers, found {s_count}"
        assert b_count >= 338, f"Expected at least 338 batches, found {b_count}"
        assert d_count >= 5174, f"Expected at least 5174 dispatches, found {d_count}"
        assert po_count >= 30, f"Expected at least 30 purchase orders, found {po_count}"
        assert r_count >= 2, f"Expected at least 2 recalls, found {r_count}"
        assert t_count >= 1008, f"Expected at least 1008 temperature logs, found {t_count}"
    finally:
        db.close()


def test_overdue_purchase_orders():
    """Validates calculation of overdue purchase orders relative to business reference date 2026-11-16."""
    db = SessionLocal()
    try:
        res = ToolRegistry.get_overdue_purchase_orders(db)
        overdue_orders = res["overdue_orders"]
        assert len(overdue_orders) > 0, "Expected at least one overdue purchase order"
        po_numbers = [po["po_number"] for po in overdue_orders]
        assert "PO-0688" in po_numbers, "Expected PO-0688 to be flagged as overdue"
    finally:
        db.close()


def test_blocked_dispatch_for_recalled_stock():
    """Validates that attempting to dispatch recalled batch B2231 is strictly blocked."""
    resp = client.post(
        "/api/dispatches",
        json={
            "customer_code": "C-001",
            "batch_number": "B2231",
            "quantity": 10,
        },
    )
    assert resp.status_code == 403, f"Expected 403 Forbidden for recalled batch, got {resp.status_code}"
    data = resp.json()
    assert "SAFETY VIOLATION BLOCKED" in data["detail"]


def test_cold_chain_excursion_audit():
    """Validates detection of cold-chain thermal excursions outside 2.0°C-8.0°C."""
    resp = client.get("/api/temperature-logs?excursions_only=true")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] > 0
    stats = data["telemetry_statistics"]
    assert stats["total_excursions_detected"] > 0
    assert stats["overall_max_temperature_c"] >= 8.1


def test_agent_create_data_through_workspace():
    """Validates creating operational records through the Agent Workspace API."""
    # 1. Ingest Batch
    resp_batch = client.post(
        "/api/agent/create-data",
        json={
            "record_type": "batch",
            "data": {
                "batch_number": "TEST-LOT-991",
                "sku": "PH-001",
                "warehouse": "BLR",
                "quantity": 350,
                "expiry_date": "2028-06-30",
            },
        },
    )
    assert resp_batch.status_code == 200
    res_b = resp_batch.json()
    assert res_b["status"] == "success"
    assert res_b["batch_number"] == "TEST-LOT-991"

    # 2. Ingest PO
    resp_po = client.post(
        "/api/agent/create-data",
        json={
            "record_type": "purchase_order",
            "data": {
                "sku": "PH-002",
                "quantity": 400,
                "supplier_name": "Sun Pharma Ltd",
            },
        },
    )
    assert resp_po.status_code == 200
    res_po = resp_po.json()
    assert res_po["status"] == "success"
    assert "PO-" in res_po["po_number"]

    # 3. Log Temperature Check
    resp_temp = client.post(
        "/api/agent/create-data",
        json={
            "record_type": "temperature_log",
            "data": {
                "warehouse": "Mysuru",
                "cold_room_unit": "CR-2",
                "recorded_temperature_celsius": 11.5,
                "duration_minutes": 120,
            },
        },
    )
    assert resp_temp.status_code == 200
    res_t = resp_temp.json()
    assert res_t["status"] == "success"
    assert res_t["is_excursion"] is True


@pytest.mark.parametrize(
    "question,expected_keyword",
    [
        ("Which critical medicines are at risk of running out?", "shortage"),
        ("Show all batches expiring within the next 60 days.", "expir"),
        ("Which products have the highest dispatch demand?", "parac"),
        ("Is any recalled stock still available in Bengaluru?", "bengaluru"),
        ("Which cold rooms recorded temperatures outside the permitted range?", "cr-2"),
        ("Which purchase orders are overdue?", "PO-0688"),
        ("Can you identify products that need replenishment before the next delivery?", "replenishment"),
        ("Find the batches affected by the latest recall and check whether any were dispatched.", "B2231"),
        ("Compare insulin availability across all warehouses.", "units"),
        ("Why is this product being flagged as high risk?", "risk"),
        ("What should I prioritize today, and why?", "critical"),
        ("Explain the evidence behind your recommendation.", "SQLite"),
    ],
)
def test_twelve_master_questions(question, expected_keyword):
    """Validates that all 12 master prompt questions are resolved deterministically by the agent."""
    db = SessionLocal()
    try:
        orchestrator = AgentOrchestrator(db)
        run = orchestrator.run_task(prompt=question, mode="operations")
        report = run.final_report_json
        assert report is not None, f"Final report was empty for question: '{question}'"
        assert expected_keyword.lower() in report.lower(), (
            f"Expected keyword '{expected_keyword}' not found in report for: '{question}'"
        )
    finally:
        db.close()
