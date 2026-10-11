from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.config import get_business_date
from app.db_models import (
    Recall,
    TemperatureLog,
    BatchInventory,
    Product,
    PurchaseOrder,
    Supplier,
    Dispatch,
    Incident,
)

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


@router.get("")
@router.get("/")
def get_operational_alerts(
    severity: Optional[str] = Query(None, description="Filter by severity (critical, high, medium, low)"),
    category: Optional[str] = Query(None, description="Filter by category (recall, cold_chain, expiry, shortage, replenishment)"),
    db: Session = Depends(get_db),
):
    ref_date = get_business_date()
    alerts = []

    # 1. Recall Alerts (Severity: Critical)
    recalls = db.query(Recall).all()
    for rec in recalls:
        batch_list = [b.strip().upper() for b in rec.batches.split(",") if b.strip()]
        matching_batches = db.query(BatchInventory).filter(BatchInventory.batch_number.in_(batch_list)).all()
        rem_stock = sum(b.available_quantity for b in matching_batches)

        dispatches = (
            db.query(Dispatch)
            .filter((Dispatch.batch_number.in_(batch_list)) | (Dispatch.batch_id.in_([b.id for b in matching_batches])))
            .all()
        )
        disp_qty = sum(d.quantity for d in dispatches)
        recipient_count = len(set(d.customer_id for d in dispatches))

        alerts.append({
            "id": f"alt-recall-{rec.id}",
            "severity": "Critical",
            "category": "recall",
            "title": f"Regulatory Recall: {rec.sku} ({rec.recall_class})",
            "entity": f"SKU {rec.sku} / Batch(es) {rec.batches}",
            "description": f"{rec.reason}. Immediate containment and recipient quarantine required.",
            "evidence": {
                "sku": rec.sku,
                "affected_batches": batch_list,
                "recall_class": rec.recall_class,
                "recall_date": rec.recall_date.isoformat(),
                "remaining_stock_units": rem_stock,
                "dispatched_units": disp_qty,
                "affected_recipients": recipient_count,
            },
            "rule": "GDP Rule 5.1: Class I & II recalls require an immediate freeze on dispatches and notification of all downstream recipients.",
            "recommended_action": "Freeze remaining stock in warehouse, initiate recipient quarantine notices, and formulate replacement order.",
            "action_prompt": f"Investigate recall Batch {rec.batches} and prepare response options.",
        })

    # 2. Cold Chain Excursion Alerts (Severity: Critical / High)
    excursion_logs = (
        db.query(TemperatureLog)
        .filter((TemperatureLog.temperature_celsius < 2.0) | (TemperatureLog.temperature_celsius > 8.0) | (TemperatureLog.is_excursion == True))
        .all()
    )
    for exc in excursion_logs:
        wh_name = exc.warehouse.location if exc.warehouse else "Warehouse"
        batches = (
            db.query(BatchInventory)
            .filter_by(warehouse_id=exc.warehouse_id)
            .filter(BatchInventory.storage_location.ilike(f"%{exc.cold_room_unit}%"))
            .all()
        )
        exposed_units = sum(b.available_quantity for b in batches)

        alerts.append({
            "id": f"alt-cold-{exc.id}",
            "severity": "Critical" if exc.temperature_celsius > 10.0 else "High",
            "category": "cold_chain",
            "title": f"Cold-Chain Thermal Excursion: {wh_name} {exc.cold_room_unit}",
            "entity": f"{wh_name} - {exc.cold_room_unit}",
            "description": f"Temperature reached {exc.temperature_celsius}°C (permitted range 2–8°C) for {exc.duration_minutes or 60} minutes.",
            "evidence": {
                "warehouse": wh_name,
                "cold_room": exc.cold_room_unit,
                "recorded_temperature": exc.temperature_celsius,
                "recorded_at": exc.recorded_at.isoformat(),
                "duration_minutes": exc.duration_minutes,
                "potentially_exposed_batches_count": len(batches),
                "total_exposed_units": exposed_units,
            },
            "rule": "GDP Rule 4.2: Storage between 2°C and 8°C is mandatory for biological and insulin formulations.",
            "recommended_action": "Place affected cold-room stock on temporary QA hold, inspect temperature data logger, and verify batch stability.",
            "action_prompt": f"Investigate cold-chain temperature excursions in {wh_name} {exc.cold_room_unit}.",
        })

    # 3. Near-Expiry & Return Window Alerts (Severity: High / Medium)
    horizon_date = ref_date + timedelta(days=90)
    near_expiry_batches = (
        db.query(BatchInventory)
        .join(Product)
        .filter(BatchInventory.expiry_date <= horizon_date, BatchInventory.available_quantity > 0)
        .order_by(BatchInventory.expiry_date.asc())
        .all()
    )

    suppliers = db.query(Supplier).all()
    sup_return_windows = {s.sku: s.return_window_days for s in suppliers if s.sku}

    for b in near_expiry_batches:
        days_left = (b.expiry_date.replace(tzinfo=timezone.utc) - ref_date).days
        ret_win = sup_return_windows.get(b.product.sku, 60)
        can_return = (0 <= days_left <= ret_win)

        sev = "Critical" if days_left <= 15 else ("High" if days_left <= 45 else "Medium")
        alerts.append({
            "id": f"alt-expiry-{b.id}",
            "severity": sev,
            "category": "expiry",
            "title": f"Impending Expiry: {b.product.name} (Batch {b.batch_number})",
            "entity": f"Batch {b.batch_number} ({b.warehouse.name if b.warehouse else 'Warehouse'})",
            "description": f"{b.available_quantity} units expiring in {days_left} days ({b.expiry_date.strftime('%Y-%m-%d')}).",
            "evidence": {
                "sku": b.product.sku,
                "batch_number": b.batch_number,
                "days_to_expiry": days_left,
                "available_quantity": b.available_quantity,
                "supplier_return_window_days": ret_win,
                "eligible_for_supplier_return": can_return,
            },
            "rule": f"Supplier Return Policy: Manufacturer accepts returns up to {ret_win} days before batch expiration.",
            "recommended_action": (
                "File vendor return RMA immediately while batch is within return window credit period."
                if can_return else
                "Expedite FEFO dispatch or route for authorized bio-quarantine disposal."
            ),
            "action_prompt": f"Investigate batch {b.batch_number} expiry and supplier return window options.",
        })

    # 4. Overdue Purchase Orders (Severity: High)
    overdue_pos = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.expected_delivery_date < ref_date,
            PurchaseOrder.status != "Received",
        )
        .all()
    )
    for po in overdue_pos:
        days_overdue = (ref_date - po.expected_delivery_date.replace(tzinfo=timezone.utc)).days
        alerts.append({
            "id": f"alt-po-{po.id}",
            "severity": "High",
            "category": "replenishment",
            "title": f"Overdue Replenishment: {po.po_number} ({po.sku})",
            "entity": f"PO {po.po_number} - {po.manufacturer}",
            "description": f"Order for {po.quantity} units of {po.sku} was expected on {po.expected_delivery_date.strftime('%Y-%m-%d')} ({days_overdue} days overdue). Status: {po.status}.",
            "evidence": {
                "po_number": po.po_number,
                "sku": po.sku,
                "manufacturer": po.manufacturer,
                "quantity": po.quantity,
                "status": po.status,
                "days_overdue": days_overdue,
            },
            "rule": "Procurement SLA: Open orders past expected delivery date must be escalated to supplier logistics coordinator.",
            "recommended_action": "Contact manufacturer logistics desk to confirm revised ETA or trigger alternate distributor allocation.",
            "action_prompt": f"Analyze purchase order {po.po_number} delay and assess stockout impact.",
        })

    # Filter
    if severity:
        alerts = [a for a in alerts if a["severity"].lower() == severity.lower().strip()]
    if category:
        alerts = [a for a in alerts if a["category"].lower() == category.lower().strip()]

    # Sort: Critical -> High -> Medium -> Low
    sev_order = {"Critical": 1, "High": 2, "Medium": 3, "Low": 4}
    alerts.sort(key=lambda x: sev_order.get(x["severity"], 5))

    return {
        "alerts": alerts,
        "total": len(alerts),
        "counts_by_severity": {
            "critical": sum(1 for a in alerts if a["severity"] == "Critical"),
            "high": sum(1 for a in alerts if a["severity"] == "High"),
            "medium": sum(1 for a in alerts if a["severity"] == "Medium"),
            "low": sum(1 for a in alerts if a["severity"] == "Low"),
        },
        "business_reference_date": ref_date.isoformat(),
    }
