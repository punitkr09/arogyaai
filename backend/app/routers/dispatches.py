import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, func
from app.database import get_db
from app.config import get_business_date
from app.db_models import Dispatch, Customer, Product, BatchInventory, StockMovement, Recall
from app.schemas import CreateDispatchRequest, DispatchSchema

router = APIRouter(prefix="/api/dispatches", tags=["Dispatches"])


@router.get("")
@router.get("/")
def list_dispatches(
    search: Optional[str] = Query(None, description="Search by dispatch number, customer, SKU, or batch"),
    customer_code: Optional[str] = Query(None, description="Filter by customer code"),
    customer_type: Optional[str] = Query(None, description="Filter by customer type (chemist, hospital)"),
    sku: Optional[str] = Query(None, description="Filter by product SKU"),
    batch_number: Optional[str] = Query(None, description="Filter by batch number"),
    from_date: Optional[str] = Query(None, description="Filter dispatches from date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="Filter dispatches to date (YYYY-MM-DD)"),
    sort_by: str = Query("dispatch_date", description="Field to sort by (dispatch_date, quantity, dispatch_number)"),
    sort_order: str = Query("desc", description="Sort order (asc, desc)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=500, description="Items per page"),
    page_size: Optional[int] = Query(None, ge=1, le=500, description="Alias for limit"),
    db: Session = Depends(get_db),
):
    if page_size:
        limit = page_size

    query = db.query(Dispatch).join(Customer).join(Product)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            (Dispatch.dispatch_number.ilike(s))
            | (Customer.code.ilike(s))
            | (Customer.name.ilike(s))
            | (Product.sku.ilike(s))
            | (Product.name.ilike(s))
            | (Dispatch.batch_number.ilike(s))
        )

    if customer_code:
        query = query.filter(Customer.code.ilike(customer_code.strip()))

    if customer_type:
        query = query.filter(Customer.customer_type.ilike(f"%{customer_type.strip()}%"))

    if sku:
        query = query.filter((Dispatch.sku.ilike(sku.strip())) | (Product.sku.ilike(sku.strip())))

    if batch_number:
        query = query.filter(Dispatch.batch_number.ilike(batch_number.strip()))

    if from_date:
        try:
            from_dt = datetime.fromisoformat(from_date.strip()).replace(tzinfo=timezone.utc)
            query = query.filter(Dispatch.dispatch_date >= from_dt)
        except Exception:
            pass

    if to_date:
        try:
            to_dt = datetime.fromisoformat(to_date.strip()).replace(tzinfo=timezone.utc)
            query = query.filter(Dispatch.dispatch_date <= to_dt)
        except Exception:
            pass

    # Aggregates across matching query
    total_matching = query.count()

    # Sorting
    sort_col = getattr(Dispatch, sort_by, Dispatch.dispatch_date)
    if sort_order.lower() == "desc":
        query = query.order_by(desc(sort_col))
    else:
        query = query.order_by(asc(sort_col))

    items = query.offset((page - 1) * limit).limit(limit).all()

    results = []
    for d in items:
        results.append({
            "id": d.id,
            "dispatch_number": d.dispatch_number,
            "customer_id": d.customer_id,
            "product_id": d.product_id,
            "batch_id": d.batch_id,
            "customer_code": d.customer.code if d.customer else "",
            "customer_name": d.customer.name if d.customer else "",
            "customer_type": d.customer.customer_type if d.customer else "",
            "customer_location": d.customer.location if d.customer else "",
            "customer": {
                "id": d.customer.id,
                "code": d.customer.code,
                "name": d.customer.name,
                "customer_type": d.customer.customer_type,
                "location": d.customer.location,
            } if d.customer else None,
            "product": {
                "id": d.product.id,
                "sku": d.product.sku,
                "name": d.product.name,
                "category": d.product.category,
                "is_critical": d.product.is_critical,
            } if d.product else None,
            "sku": d.sku or (d.product.sku if d.product else ""),
            "product_name": d.product.name if d.product else "",
            "is_critical_drug": d.product.is_critical if d.product else False,
            "batch_number": d.batch_number or (d.batch.batch_number if d.batch else ""),
            "quantity": d.quantity,
            "dispatch_date": d.dispatch_date.isoformat(),
            "status": d.status,
            "tracking_ref": d.tracking_ref,
        })

    return {
        "items": results,
        "total": total_matching,
        "page": page,
        "limit": limit,
        "page_size": limit,
        "total_pages": (total_matching + limit - 1) // limit if limit > 0 else 1,
        "summary": {
            "total_dispatches": total_matching,
        },
    }


@router.get("/{id_or_num}")
def get_dispatch_detail(id_or_num: str, db: Session = Depends(get_db)):
    disp = None
    if id_or_num.isdigit():
        disp = db.query(Dispatch).filter_by(id=int(id_or_num)).first()
    if not disp:
        disp = db.query(Dispatch).filter_by(dispatch_number=id_or_num.strip()).first()
    if not disp:
        raise HTTPException(status_code=404, detail=f"Dispatch '{id_or_num}' not found.")

    return {
        "id": disp.id,
        "dispatch_number": disp.dispatch_number,
        "customer": {
            "id": disp.customer.id if disp.customer else None,
            "code": disp.customer.code if disp.customer else "",
            "name": disp.customer.name if disp.customer else "",
            "customer_type": disp.customer.customer_type if disp.customer else "",
            "location": disp.customer.location if disp.customer else "",
            "address": disp.customer.address if disp.customer else "",
        },
        "product": {
            "id": disp.product.id if disp.product else None,
            "sku": disp.product.sku if disp.product else "",
            "name": disp.product.name if disp.product else "",
            "category": disp.product.category if disp.product else "",
            "is_critical": disp.product.is_critical if disp.product else False,
        },
        "batch_number": disp.batch_number or (disp.batch.batch_number if disp.batch else ""),
        "quantity": disp.quantity,
        "dispatch_date": disp.dispatch_date.isoformat(),
        "status": disp.status,
        "tracking_ref": disp.tracking_ref,
    }


@router.post("", response_model=DispatchSchema)
@router.post("/", response_model=DispatchSchema)
def create_dispatch(payload: CreateDispatchRequest, db: Session = Depends(get_db)):
    """Creates a new outbound dispatch with pharmaceutical safety controls.
    STRICT SAFETY RULE: Recalled or expired stock is categorically blocked from dispatch.
    """
    ref_date = get_business_date()
    batch = db.query(BatchInventory).filter_by(batch_number=payload.batch_number.strip().upper()).first()
    if not batch:
        raise HTTPException(status_code=404, detail=f"Batch '{payload.batch_number}' not found.")

    # 1. Recall Check
    rec = db.query(Recall).filter(Recall.batches.ilike(f"%{batch.batch_number}%")).first()
    if rec or batch.status == "recalled":
        raise HTTPException(
            status_code=403,
            detail=(
                f"SAFETY VIOLATION BLOCKED: Batch '{batch.batch_number}' is under active recall "
                f"({rec.reason if rec else 'Regulatory Recall'}). Outbound dispatches are strictly prohibited."
            ),
        )

    # 2. Expiry Check
    days_left = (batch.expiry_date.replace(tzinfo=timezone.utc) - ref_date).days if batch.expiry_date else 0
    if days_left < 0 or batch.status in ("dispatch_hold", "quarantine"):
        raise HTTPException(
            status_code=403,
            detail=(
                f"SAFETY VIOLATION BLOCKED: Batch '{batch.batch_number}' is expired or under status '{batch.status}'. "
                f"Cannot dispatch unsafe pharmaceutical inventory."
            ),
        )

    # 3. Stock Availability
    if batch.available_quantity < payload.quantity:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient inventory: Requested {payload.quantity} units, but Batch '{batch.batch_number}' "
                f"has only {batch.available_quantity} available units."
            ),
        )

    customer = db.query(Customer).filter_by(code=payload.customer_code.strip().upper()).first()
    if not customer:
        raise HTTPException(status_code=404, detail=f"Customer '{payload.customer_code}' not found.")

    now_dt = datetime.now(timezone.utc)
    disp_num = f"DISP-{now_dt.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"

    # Atomic inventory deduction
    batch.available_quantity -= payload.quantity

    movement = StockMovement(
        batch_id=batch.id,
        movement_type="dispatch",
        quantity=-payload.quantity,
        reference_doc=disp_num,
        timestamp=now_dt,
        notes=payload.notes or f"Outbound dispatch to {customer.name} ({customer.code})",
    )
    db.add(movement)

    disp = Dispatch(
        dispatch_number=disp_num,
        customer_id=customer.id,
        batch_id=batch.id,
        batch_number=batch.batch_number,
        product_id=batch.product_id,
        sku=batch.product.sku,
        quantity=payload.quantity,
        dispatch_date=now_dt,
        status="delivered",
        tracking_ref=f"TRK-{uuid.uuid4().hex[:8].upper()}",
    )
    db.add(disp)
    db.commit()
    db.refresh(disp)

    return DispatchSchema(
        id=disp.id,
        dispatch_number=disp.dispatch_number,
        customer_name=customer.name,
        customer_type=customer.customer_type,
        quantity=disp.quantity,
        dispatch_date=disp.dispatch_date.isoformat(),
        status=disp.status,
        tracking_ref=disp.tracking_ref,
    )
