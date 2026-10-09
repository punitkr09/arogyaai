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

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    ninety_days_ahead = now + timedelta(days=90)

    total_products = db.query(Product).count()
    total_batches = db.query(BatchInventory).count()

    # Batches near expiry (<= 90 days)
    near_expiry_batches = (
        db.query(BatchInventory)
        .filter(BatchInventory.expiry_date <= ninety_days_ahead, BatchInventory.available_quantity > 0)
        .all()
    )
    batches_near_expiry_count = len(near_expiry_batches)

    # Active recalls
    active_recalls = db.query(Incident).filter_by(incident_type="recall", status="open").all()
    active_recalls_count = len(active_recalls)

    # Cold chain exceptions
    cold_exceptions = db.query(TemperatureLog).filter_by(is_excursion=True).all()
    cold_exceptions_count = len(cold_exceptions)

    # Pending approvals
    pending_approvals = db.query(ActionProposal).filter_by(status="pending_review").count()

    # Attention Items (Prioritized "What needs attention today?")
    attention_items: List[AttentionItem] = []

    # Priority 1: Recalls
    for inc in active_recalls:
        attention_items.append(
            AttentionItem(
                id=f"attn-recall-{inc.id}",
                priority="critical",
                category="recall",
                title=f"URGENT: {inc.title}",
                description="Regulatory recall notice requires immediate dispatch hold, 25-customer recipient trace, and replacement reconciliation.",
                batch_number=inc.affected_batch_number,
                action_prompt=f"Investigate recall Batch {inc.affected_batch_number}.",
            )
        )

    # Priority 2: Cold chain thermal excursions
    for log in cold_exceptions:
        attention_items.append(
            AttentionItem(
                id=f"attn-temp-{log.id}",
                priority="critical",
                category="cold_chain",
                title=f"Thermal Excursion Alert: {log.cold_room_unit} ({log.temperature_celsius}°C)",
                description=f"Cold room exceeded 2-8°C limit for {log.duration_minutes} mins. Requires biological quarantine audit.",
                batch_number="B4019",
                action_prompt="Investigate a cold-chain temperature excursion.",
            )
        )

    # Priority 3: Batches approaching expiry
    for b in near_expiry_batches:
        days_left = (b.expiry_date.replace(tzinfo=timezone.utc) - now).days
        attention_items.append(
            AttentionItem(
                id=f"attn-exp-{b.id}",
                priority="high",
                category="expiry",
                title=f"Expiring in {days_left} Days: Batch {b.batch_number} ({b.product.brand})",
                description=f"{b.available_quantity} units at risk. Evaluate supplier return window credit before RMA deadline.",
                batch_number=b.batch_number,
                action_prompt="Find batches likely to expire before they can be sold.",
            )
        )

    # Priority 4: Shortages
    critical_shortages = (
        db.query(BatchInventory)
        .join(Product)
        .filter(Product.is_critical == True, BatchInventory.available_quantity < Product.min_safety_stock)
        .all()
    )
    for b in critical_shortages:
        attention_items.append(
            AttentionItem(
                id=f"attn-short-{b.id}",
                priority="high",
                category="shortage",
                title=f"Critical Buffer Depleted: {b.product.brand} ({b.available_quantity} units left)",
                description=f"Current stock below safety threshold ({b.product.min_safety_stock} units). Emergency PO required.",
                batch_number=b.batch_number,
                action_prompt="Identify critical medicine shortage risks.",
            )
        )

    active_alerts = len(attention_items)

    return DashboardSummaryResponse(
        total_products=total_products,
        total_batches=total_batches,
        active_alerts=active_alerts,
        batches_near_expiry=batches_near_expiry_count,
        active_recalls=active_recalls_count,
        cold_chain_exceptions=cold_exceptions_count,
        pending_approvals=pending_approvals,
        attention_items=attention_items,
    )
