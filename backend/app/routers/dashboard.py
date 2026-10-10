from datetime import datetime, timedelta, timezone
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.db_models import (
    Product,
    BatchInventory,
    Incident,
    TemperatureLog,
    ActionProposal,
)
from app.schemas import AttentionItem, DashboardSummaryResponse
from app.tools.registry import ToolRegistry

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(db: Session = Depends(get_db)):
    """Computes live database-backed operational metrics and prioritized attention items."""
    now = datetime.now(timezone.utc)
    ninety_days_ahead = now + timedelta(days=90)

    total_products = db.query(Product).count()
    total_batches = db.query(BatchInventory).count()

    # Batches near expiry (<= 90 days)
    batches_near_expiry_count = (
        db.query(BatchInventory)
        .filter(BatchInventory.expiry_date <= ninety_days_ahead, BatchInventory.available_quantity > 0)
        .count()
    )

    # Active recalls
    active_recalls_count = db.query(Incident).filter_by(incident_type="recall", status="open").count()

    # Cold chain exceptions
    cold_exceptions_count = db.query(TemperatureLog).filter_by(is_excursion=True).count()

    # Pending approvals
    pending_approvals = db.query(ActionProposal).filter_by(status="pending_review").count()

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
        active_recalls=active_recalls_count,
        cold_chain_exceptions=cold_exceptions_count,
        pending_approvals=pending_approvals,
        attention_items=attention_items,
        timestamp=now.isoformat(),
    )
