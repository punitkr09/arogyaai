from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.database import get_db
from app.config import get_business_date
from app.db_models import Recall, Product, BatchInventory, Dispatch, Incident, StockMovement
from app.schemas import CreateRecallRequest
from app.tools.registry import ToolRegistry

router = APIRouter(prefix="/api/recalls", tags=["Recalls"])


@router.get("")
@router.get("/")
def list_recalls(db: Session = Depends(get_db)):
    ref_date = get_business_date()
    recalls = db.query(Recall).order_by(desc(Recall.recall_date)).all()

    results = []
    for rec in recalls:
        prod = rec.product or db.query(Product).filter_by(sku=rec.sku).first()
        batch_list = [b.strip().upper() for b in rec.batches.split(",") if b.strip()]

        # Query remaining stock for affected batches
        matching_batches = db.query(BatchInventory).filter(BatchInventory.batch_number.in_(batch_list)).all()
        remaining_units = sum(b.available_quantity for b in matching_batches)
        warehouse_locations = [
            {
                "warehouse_code": b.warehouse.code if b.warehouse else "",
                "warehouse_name": b.warehouse.name if b.warehouse else "",
                "storage_location": b.storage_location,
                "batch_number": b.batch_number,
                "available_quantity": b.available_quantity,
                "status": b.status,
            }
            for b in matching_batches
        ]

        # Query dispatches for affected batches
        dispatches = (
            db.query(Dispatch)
            .filter((Dispatch.batch_number.in_(batch_list)) | (Dispatch.batch_id.in_([b.id for b in matching_batches])))
            .all()
        )
        total_dispatched_units = sum(d.quantity for d in dispatches)
        recipient_ids = set(d.customer_id for d in dispatches)

        hosp_units = sum(d.quantity for d in dispatches if d.customer and d.customer.customer_type == "hospital")
        chem_units = total_dispatched_units - hosp_units
        hosp_count = len(set(d.customer_id for d in dispatches if d.customer and d.customer.customer_type == "hospital"))
        chem_count = len(recipient_ids) - hosp_count

        results.append({
            "id": rec.id,
            "recall_date": rec.recall_date.isoformat(),
            "sku": rec.sku,
            "product_name": prod.name if prod else rec.sku,
            "product_category": prod.category if prod else "",
            "is_critical": prod.is_critical if prod else False,
            "batches": rec.batches,
            "affected_batches_list": batch_list,
            "reason": rec.reason,
            "recall_class": rec.recall_class,
            "status": rec.status,
            "reconciliation": {
                "remaining_warehouse_stock": remaining_units,
                "total_dispatched_units": total_dispatched_units,
                "total_affected_recipients": len(recipient_ids),
                "hospitals": {"count": hosp_count, "units": hosp_units},
                "chemists": {"count": chem_count, "units": chem_units},
                "warehouse_breakdown": warehouse_locations,
            },
            "dispatch_hold_active": True,
        })

    return {
        "items": results,
        "total": len(results),
        "business_reference_date": ref_date.isoformat(),
    }


@router.get("/{id_or_sku}")
def get_recall_detail(id_or_sku: str, db: Session = Depends(get_db)):
    rec = None
    if id_or_sku.isdigit():
        rec = db.query(Recall).filter_by(id=int(id_or_sku)).first()
    if not rec:
        rec = db.query(Recall).filter_by(sku=id_or_sku.strip().upper()).first()
    if not rec:
        raise HTTPException(status_code=404, detail=f"Recall '{id_or_sku}' not found.")

    prod = rec.product or db.query(Product).filter_by(sku=rec.sku).first()
    batch_list = [b.strip().upper() for b in rec.batches.split(",") if b.strip()]

    # Traces for each affected batch
    batch_traces = {}
    for b_num in batch_list:
        trace = ToolRegistry.trace_batch_recipients(db, b_num)
        batch_traces[b_num] = trace

    return {
        "recall": {
            "id": rec.id,
            "recall_date": rec.recall_date.isoformat(),
            "sku": rec.sku,
            "product_name": prod.name if prod else rec.sku,
            "batches": rec.batches,
            "reason": rec.reason,
            "recall_class": rec.recall_class,
            "status": rec.status,
        },
        "traces": batch_traces,
    }


@router.post("")
@router.post("/")
def create_recall(payload: CreateRecallRequest, db: Session = Depends(get_db)):
    """Issues a new regulatory or voluntary batch recall.
    Automatically locks affected batches in warehouse inventory to prevent dispatches.
    """
    sku = payload.sku.strip().upper()
    prod = db.query(Product).filter_by(sku=sku).first()
    if not prod:
        raise HTTPException(status_code=404, detail=f"Product SKU '{sku}' not found.")

    batches_str = payload.batches.strip().upper()
    batch_list = [b.strip() for b in batches_str.split(",") if b.strip()]
    if not batch_list:
        raise HTTPException(status_code=400, detail="At least one batch number must be provided.")

    now = datetime.now(timezone.utc)
    recall = Recall(
        sku=sku,
        batches=batches_str,
        reason=payload.reason.strip(),
        recall_class=payload.recall_class.strip(),
        recall_date=now,
        status="active",
    )
    db.add(recall)
    db.flush()

    # Quarantine matching inventory batches immediately
    matching_batches = db.query(BatchInventory).filter(BatchInventory.batch_number.in_(batch_list)).all()
    quarantined_count = 0
    for b in matching_batches:
        b.status = "recalled"
        quarantined_count += 1
        mov = StockMovement(
            batch_id=b.id,
            movement_type="recall_quarantine",
            quantity=0,
            reference_doc=f"RECALL-{recall.id}",
            timestamp=now,
            notes=f"Automated quarantine lock triggered by Recall #{recall.id} ({payload.recall_class}): {payload.reason}",
        )
        db.add(mov)

    # Create incident record
    incident = Incident(
        incident_number=f"INC-REC-{now.strftime('%Y%m%d%H%M%S')}",
        title=f"Batch Recall Issued: {sku} ({payload.recall_class})",
        incident_type="recall",
        severity="critical" if payload.recall_class in ("Class I", "Class II") else "high",
        affected_batch_number=batches_str,
        status="investigating",
        details_json=f'{{"sku": "{sku}", "batches": "{batches_str}", "reason": "{payload.reason}", "quarantined_batches": {quarantined_count}}}',
        created_at=now,
    )
    db.add(incident)

    db.commit()
    db.refresh(recall)

    return {
        "id": recall.id,
        "sku": recall.sku,
        "batches": recall.batches,
        "reason": recall.reason,
        "recall_class": recall.recall_class,
        "recall_date": recall.recall_date.isoformat(),
        "status": recall.status,
        "quarantined_batches_count": quarantined_count,
        "message": f"Recall #{recall.id} recorded successfully. {quarantined_count} batch(es) quarantined and locked from outbound dispatch.",
    }


@router.put("/{recall_id}/status")
@router.patch("/{recall_id}/status")
def update_recall_status(
    recall_id: int,
    status: str = Query(..., description="New status: active, completed, closed"),
    notes: Optional[str] = Query(None, description="Resolution notes"),
    db: Session = Depends(get_db),
):
    rec = db.query(Recall).filter_by(id=recall_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail=f"Recall {recall_id} not found.")

    valid_statuses = ["active", "completed", "closed", "resolved"]
    if status.lower().strip() not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status '{status}'. Must be one of {valid_statuses}")

    rec.status = status.lower().strip()
    db.commit()
    db.refresh(rec)
    return {
        "id": rec.id,
        "sku": rec.sku,
        "status": rec.status,
        "message": f"Recall #{rec.id} status updated to '{rec.status}'.",
    }
