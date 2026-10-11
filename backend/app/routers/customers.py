from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, func
from app.database import get_db
from app.db_models import Customer, Dispatch
from app.schemas import CustomerSchema, CreateCustomerRequest, UpdateCustomerRequest

router = APIRouter(prefix="/api/customers", tags=["Customers"])


@router.get("")
@router.get("/")
def list_customers(
    search: Optional[str] = Query(None, description="Search by code, name, or location"),
    customer_type: Optional[str] = Query(None, description="Filter by type (Chemist, Hospital)"),
    location: Optional[str] = Query(None, description="Filter by geographical location"),
    credit_terms: Optional[str] = Query(None, description="Filter by credit terms"),
    sort_by: str = Query("name", description="Field to sort by (code, name, location, priority_tier)"),
    sort_order: str = Query("asc", description="Sort order (asc, desc)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=500, description="Items per page"),
    db: Session = Depends(get_db),
):
    query = db.query(Customer)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            (Customer.code.ilike(s))
            | (Customer.name.ilike(s))
            | (Customer.location.ilike(s))
            | (Customer.address.ilike(s))
        )

    if customer_type:
        query = query.filter(Customer.customer_type.ilike(f"%{customer_type.strip()}%"))

    if location:
        query = query.filter(Customer.location.ilike(f"%{location.strip()}%"))

    if credit_terms:
        query = query.filter(Customer.credit_terms.ilike(f"%{credit_terms.strip()}%"))

    sort_col = getattr(Customer, sort_by, Customer.name)
    if sort_order.lower() == "desc":
        query = query.order_by(desc(sort_col))
    else:
        query = query.order_by(asc(sort_col))

    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()

    # Calculate dispatch summaries per customer in this page
    cust_ids = [c.id for c in items]
    disp_stats = {}
    if cust_ids:
        rows = (
            db.query(
                Dispatch.customer_id,
                func.count(Dispatch.id).label("total_orders"),
                func.sum(Dispatch.quantity).label("total_units"),
                func.max(Dispatch.dispatch_date).label("last_order_date"),
            )
            .filter(Dispatch.customer_id.in_(cust_ids))
            .group_by(Dispatch.customer_id)
            .all()
        )
        for r in rows:
            disp_stats[r[0]] = {
                "total_orders": r[1],
                "total_units": r[2] or 0,
                "last_order_date": r[3].isoformat() if r[3] else None,
            }

    results = []
    for c in items:
        st = disp_stats.get(c.id, {"total_orders": 0, "total_units": 0, "last_order_date": None})
        results.append({
            "id": c.id,
            "code": c.code,
            "name": c.name,
            "customer_type": c.customer_type,
            "location": c.location,
            "credit_terms": c.credit_terms,
            "priority_tier": c.priority_tier,
            "contact_email": c.contact_email,
            "phone": c.phone,
            "address": c.address,
            "total_orders": st["total_orders"],
            "total_units_dispatched": st["total_units"],
            "last_order_date": st["last_order_date"],
        })

    # Summary breakdown
    type_counts = dict(
        db.query(Customer.customer_type, func.count(Customer.id))
        .group_by(Customer.customer_type)
        .all()
    )

    return {
        "items": results,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if limit > 0 else 1,
        "summary": {
            "total_customers": total,
            "type_breakdown": type_counts,
        },
    }


@router.get("/{code_or_id}")
def get_customer_detail(code_or_id: str, db: Session = Depends(get_db)):
    cust = None
    if code_or_id.isdigit():
        cust = db.query(Customer).filter_by(id=int(code_or_id)).first()
    if not cust:
        cust = db.query(Customer).filter_by(code=code_or_id.strip().upper()).first()
    if not cust:
        raise HTTPException(status_code=404, detail=f"Customer '{code_or_id}' not found.")

    dispatches = (
        db.query(Dispatch)
        .filter_by(customer_id=cust.id)
        .order_by(desc(Dispatch.dispatch_date))
        .all()
    )

    total_units = sum(d.quantity for d in dispatches)
    recent_dispatches = [
        {
            "id": d.id,
            "dispatch_number": d.dispatch_number,
            "sku": d.sku or (d.product.sku if d.product else ""),
            "product_name": d.product.name if d.product else "",
            "batch_number": d.batch_number or (d.batch.batch_number if d.batch else ""),
            "quantity": d.quantity,
            "dispatch_date": d.dispatch_date.isoformat(),
            "status": d.status,
            "tracking_ref": d.tracking_ref,
        }
        for d in dispatches
    ]

    return {
        "customer": CustomerSchema.model_validate(cust),
        "total_dispatches_count": len(dispatches),
        "total_units_received": total_units,
        "dispatches": recent_dispatches,
    }


@router.post("", response_model=CustomerSchema)
@router.post("/", response_model=CustomerSchema)
def create_customer(payload: CreateCustomerRequest, db: Session = Depends(get_db)):
    code = payload.code.strip().upper()
    existing = db.query(Customer).filter_by(code=code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Customer with code '{code}' already exists.")

    cust = Customer(
        code=code,
        name=payload.name.strip(),
        customer_type=payload.customer_type.lower().strip(),
        location=payload.location.strip() if payload.location else None,
        credit_terms=payload.credit_terms.strip() if payload.credit_terms else "30 days",
        priority_tier=payload.priority_tier,
        contact_email=payload.contact_email,
        phone=payload.phone,
        address=payload.address,
    )
    db.add(cust)
    db.commit()
    db.refresh(cust)
    return cust


@router.put("/{customer_id}", response_model=CustomerSchema)
def update_customer(customer_id: int, payload: UpdateCustomerRequest, db: Session = Depends(get_db)):
    cust = db.query(Customer).filter_by(id=customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail=f"Customer {customer_id} not found.")

    if payload.name is not None: cust.name = payload.name.strip()
    if payload.customer_type is not None: cust.customer_type = payload.customer_type.lower().strip()
    if payload.location is not None: cust.location = payload.location.strip()
    if payload.credit_terms is not None: cust.credit_terms = payload.credit_terms.strip()
    if payload.priority_tier is not None: cust.priority_tier = payload.priority_tier
    if payload.contact_email is not None: cust.contact_email = payload.contact_email
    if payload.phone is not None: cust.phone = payload.phone
    if payload.address is not None: cust.address = payload.address

    db.commit()
    db.refresh(cust)
    return cust
