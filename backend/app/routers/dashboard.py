from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.config import get_business_date
from app.db_models import (
    Product,
    Customer,
    BatchInventory,
    Dispatch,
    PurchaseOrder,
    Recall,
    TemperatureLog,
    Incident,
    ActionProposal,
    Warehouse,
)
from app.schemas import AttentionItem, DashboardSummaryResponse
from app.tools.registry import ToolRegistry

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("", response_model=DashboardSummaryResponse)
@router.get("/", response_model=DashboardSummaryResponse)
@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(db: Session = Depends(get_db)):
    """Computes real-time, database-derived operational metrics and prioritized attention items."""
    ref_date = get_business_date()
    ninety_days_ahead = ref_date + timedelta(days=90)

    total_products = db.query(Product).count()
    total_customers = db.query(Customer).count()
    total_batches = db.query(BatchInventory).count()

    total_inventory_units = (
        db.query(func.sum(BatchInventory.available_quantity))
        .filter(BatchInventory.status != "recalled")
        .scalar()
        or 0
    )

    # Batches near expiry (<= 90 days from business reference date)
    batches_near_expiry_count = (
        db.query(BatchInventory)
        .filter(BatchInventory.expiry_date <= ninety_days_ahead, BatchInventory.available_quantity > 0)
        .count()
    )

    # Active recalls
    recalls_count = db.query(Recall).filter_by(status="active").count()
    if recalls_count == 0:
        recalls_count = db.query(Incident).filter_by(incident_type="recall", status="open").count()

    # Cold chain exceptions (temperature outside 2-8°C or marked as excursion)
    cold_exceptions_count = (
        db.query(TemperatureLog)
        .filter(
            (TemperatureLog.temperature_celsius < 2.0)
            | (TemperatureLog.temperature_celsius > 8.0)
            | (TemperatureLog.is_excursion == True)
        )
        .count()
    )

    # Pending approvals
    pending_approvals = db.query(ActionProposal).filter_by(status="pending_review").count()

    # Dispatches
    total_dispatches = db.query(Dispatch).count()
    total_dispatched_units = db.query(func.sum(Dispatch.quantity)).scalar() or 0

    # Critical drugs count
    critical_drugs_count = db.query(Product).filter_by(is_critical=True).count()

    # Low stock products (available stock < min_safety_stock)
    stock_per_product = dict(
        db.query(BatchInventory.product_id, func.sum(BatchInventory.available_quantity))
        .filter(BatchInventory.status != "recalled")
        .group_by(BatchInventory.product_id)
        .all()
    )
    all_products = db.query(Product).all()
    low_stock_count = sum(1 for p in all_products if stock_per_product.get(p.id, 0) < p.min_safety_stock)

    # Purchase orders
    all_pos = db.query(PurchaseOrder).all()
    delayed_pos = sum(1 for po in all_pos if "Delay" in po.status)
    overdue_pos = sum(
        1 for po in all_pos
        if po.expected_delivery_date
        and po.expected_delivery_date.replace(tzinfo=timezone.utc) < ref_date
        and po.status != "Received"
    )

    # Warehouse distribution
    wh_stock_records = (
        db.query(Warehouse.location, func.sum(BatchInventory.available_quantity))
        .join(BatchInventory, Warehouse.id == BatchInventory.warehouse_id)
        .group_by(Warehouse.location)
        .all()
    )
    warehouse_distribution = {
        r[0]: (r[1] or 0)
        for r in wh_stock_records
    }

    # Live attention items computed from real database records
    attn_data = ToolRegistry.get_attention_items(db)
    raw_items = attn_data.get("attention_items", [])

    attention_items: List[AttentionItem] = [
        AttentionItem(
            id=item["id"],
            priority=item["priority"],
            category=item["category"],
            title=item["title"],
            description=item["description"],
            batch_number=item.get("batch_number"),
            action_prompt=item["action_prompt"],
        )
        for item in raw_items
    ]

    return DashboardSummaryResponse(
        total_products=total_products,
        total_batches=total_batches,
        active_alerts=len(attention_items),
        batches_near_expiry=batches_near_expiry_count,
        active_recalls=recalls_count,
        cold_chain_exceptions=cold_exceptions_count,
        pending_approvals=pending_approvals,
        attention_items=attention_items,
        timestamp=datetime.now(timezone.utc).isoformat(),
        total_customers=total_customers,
        total_inventory_units=total_inventory_units,
        total_dispatches=total_dispatches,
        total_dispatched_units=total_dispatched_units,
        critical_drugs_count=critical_drugs_count,
        low_stock_products_count=low_stock_count,
        delayed_purchase_orders=delayed_pos,
        overdue_purchase_orders=overdue_pos,
        business_reference_date=ref_date.isoformat(),
        warehouse_distribution=warehouse_distribution,
    )
