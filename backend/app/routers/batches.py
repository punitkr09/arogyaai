from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from app.database import get_db
from app.config import get_business_date
from app.db_models import BatchInventory, Product, Warehouse, StockMovement, Dispatch, Supplier, Recall
from app.schemas import BatchDetailSchema, BatchSummarySchema, TraceabilityResponse
from app.tools.registry import ToolRegistry

router = APIRouter(prefix="/api/batches", tags=["Batches"])


@router.get("")
@router.get("/")
def list_batches(
    search: Optional[str] = Query(None, description="Search by batch number, SKU, molecule, or brand"),
    status: Optional[str] = Query(None, description="Filter by status (active, recalled, quarantine, dispatch_hold)"),
    warehouse: Optional[str] = Query(None, description="Filter by warehouse code or name"),
    storage_location: Optional[str] = Query(None, description="Filter by storage location (CR-1, CR-2, AMB)"),
    expiry_horizon_days: Optional[int] = Query(None, description="Filter batches expiring within N days"),
    fefo_only: Optional[bool] = Query(False, description="Sort strictly by First-Expiry-First-Out"),
    sort_by: str = Query("expiry_date", description="Field to sort by (expiry_date, batch_number, available_quantity)"),
    sort_order: str = Query("asc", description="Sort order (asc, desc)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=500, description="Items per page"),
    db: Session = Depends(get_db),
):
    ref_date = get_business_date()
    query = db.query(BatchInventory).join(Product).join(Warehouse)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            (BatchInventory.batch_number.ilike(s))
            | (Product.sku.ilike(s))
            | (Product.name.ilike(s))
            | (Product.molecule.ilike(s))
            | (Product.brand.ilike(s))
        )

    if status:
        query = query.filter(BatchInventory.status.ilike(status.strip()))

    if warehouse:
        w_term = f"%{warehouse.strip()}%"
        query = query.filter((Warehouse.code.ilike(w_term)) | (Warehouse.name.ilike(w_term)) | (Warehouse.location.ilike(w_term)))

    if storage_location:
        query = query.filter(BatchInventory.storage_location.ilike(storage_location.strip()))

    if expiry_horizon_days is not None:
        from datetime import timedelta
        horizon_dt = ref_date + timedelta(days=expiry_horizon_days)
        query = query.filter(BatchInventory.expiry_date <= horizon_dt, BatchInventory.available_quantity > 0)

    # Pre-fetch recalls for instant safety lookup
    recalls = db.query(Recall).all()
    recalled_batch_set = set()
    for rec in recalls:
        for b_str in rec.batches.split(","):
            if b_str.strip():
                recalled_batch_set.add(b_str.strip().upper())

    # Pre-fetch suppliers for return window check
    suppliers = db.query(Supplier).all()
    sup_return_windows = {s.sku: s.return_window_days for s in suppliers if s.sku}

    # Sorting
    if fefo_only or sort_by == "expiry_date":
        query = query.order_by(asc(BatchInventory.expiry_date))
    else:
        sort_col = getattr(BatchInventory, sort_by, BatchInventory.expiry_date)
        if sort_order.lower() == "desc":
            query = query.order_by(desc(sort_col))
        else:
            query = query.order_by(asc(sort_col))

    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()

    results = []
    for b in items:
        days_left = (b.expiry_date.replace(tzinfo=timezone.utc) - ref_date).days if b.expiry_date else 0
        is_recalled = b.batch_number.upper() in recalled_batch_set or b.status == "recalled"
        is_expired = days_left < 0

        # Safety dispatch rule: Cannot dispatch if recalled, expired, or on hold
        is_safe_dispatch = not is_recalled and not is_expired and b.status not in ("quarantine", "dispatch_hold", "recalled")

        ret_window = sup_return_windows.get(b.product.sku, 60)
        can_return = (0 <= days_left <= ret_window)

        results.append({
            "id": b.id,
            "batch_number": b.batch_number,
            "product_id": b.product_id,
            "product_sku": b.product.sku,
            "product_name": b.product.name,
            "product_molecule": b.product.molecule,
            "product_brand": b.product.brand,
            "product_category": b.product.category,
            "is_critical_drug": b.product.is_critical,
            "warehouse_id": b.warehouse_id,
            "warehouse_code": b.warehouse.code,
            "warehouse_name": b.warehouse.name,
            "warehouse_location": b.warehouse.location,
            "storage_location": b.storage_location,
            "storage_condition": b.storage_condition,
            "available_quantity": b.available_quantity,
            "initial_quantity": b.initial_quantity,
            "manufacturing_date": b.manufacturing_date.isoformat() if b.manufacturing_date else None,
            "expiry_date": b.expiry_date.isoformat() if b.expiry_date else None,
            "days_to_expiry": days_left,
            "status": "recalled" if is_recalled else b.status,
            "is_recalled": is_recalled,
            "is_expired": is_expired,
            "is_safe_to_dispatch": is_safe_dispatch,
            "safety_warning": "CRITICAL RECALL - DISPATCH BLOCKED" if is_recalled else ("EXPIRED - DISPATCH BLOCKED" if is_expired else None),
            "eligible_for_supplier_return": can_return,
            "supplier_return_window_days": ret_window,
        })

    return {
        "items": results,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if limit > 0 else 1,
        "business_reference_date": ref_date.isoformat(),
    }


@router.get("/{batch_number}")
def get_batch_details(batch_number: str, db: Session = Depends(get_db)):
    ref_date = get_business_date()
    b = db.query(BatchInventory).filter_by(batch_number=batch_number.strip().upper()).first()
    if not b:
        raise HTTPException(status_code=404, detail=f"Batch '{batch_number}' not found.")

    prod = b.product
    wh = b.warehouse
    days_left = (b.expiry_date.replace(tzinfo=timezone.utc) - ref_date).days if b.expiry_date else 0

    # Movements
    movements = db.query(StockMovement).filter_by(batch_id=b.id).order_by(desc(StockMovement.timestamp)).all()
    movement_schemas = [
        {
            "id": m.id,
            "movement_type": m.movement_type,
            "quantity": m.quantity,
            "reference_doc": m.reference_doc,
            "timestamp": m.timestamp.isoformat(),
            "notes": m.notes,
        }
        for m in movements
    ]

    # Dispatches
    dispatches = (
        db.query(Dispatch)
        .filter((Dispatch.batch_number == b.batch_number) | (Dispatch.batch_id == b.id))
        .order_by(desc(Dispatch.dispatch_date))
        .all()
    )
    total_dispatched = sum(d.quantity for d in dispatches)
    dispatch_schemas = [
        {
            "id": d.id,
            "dispatch_number": d.dispatch_number,
            "customer_code": d.customer.code if d.customer else "",
            "customer_name": d.customer.name if d.customer else "",
            "customer_type": d.customer.customer_type if d.customer else "",
            "quantity": d.quantity,
            "dispatch_date": d.dispatch_date.isoformat(),
            "status": d.status,
            "tracking_ref": d.tracking_ref,
        }
        for d in dispatches
    ]

    # Check recall
    rec = db.query(Recall).filter(Recall.batches.ilike(f"%{b.batch_number}%")).first()
    is_recalled = rec is not None or b.status == "recalled"

    return {
        "batch": {
            "id": b.id,
            "batch_number": b.batch_number,
            "product_id": prod.id,
            "product_name": prod.name,
            "product_sku": prod.sku,
            "warehouse_code": wh.code,
            "warehouse_name": wh.name,
            "warehouse_location": wh.location,
            "storage_location": b.storage_location,
            "available_quantity": b.available_quantity,
            "initial_quantity": b.initial_quantity,
            "manufacturing_date": b.manufacturing_date.isoformat() if b.manufacturing_date else None,
            "expiry_date": b.expiry_date.isoformat() if b.expiry_date else None,
            "days_to_expiry": days_left,
            "status": "recalled" if is_recalled else b.status,
            "is_recalled": is_recalled,
            "recall_reason": rec.reason if rec else None,
            "storage_condition": b.storage_condition,
            "is_safe_to_dispatch": not is_recalled and days_left >= 0 and b.status not in ("quarantine", "dispatch_hold"),
        },
        "product": {
            "id": prod.id,
            "sku": prod.sku,
            "name": prod.name,
            "molecule": prod.molecule,
            "brand": prod.brand,
            "category": prod.category,
            "storage_range": prod.storage_range,
            "is_critical": prod.is_critical,
            "unit_price": prod.unit_price,
            "unit_of_measure": prod.unit_of_measure,
            "min_safety_stock": prod.min_safety_stock,
        },
        "movements": movement_schemas,
        "dispatches": dispatch_schemas,
        "total_dispatched": total_dispatched,
        "business_reference_date": ref_date.isoformat(),
    }


@router.get("/{batch_number}/trace")
def trace_batch(batch_number: str, db: Session = Depends(get_db)):
    trace_data = ToolRegistry.trace_batch_recipients(db, batch_number)
    if "error" in trace_data:
        raise HTTPException(status_code=404, detail=trace_data["error"])
    return trace_data
