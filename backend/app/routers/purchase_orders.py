import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, func
from app.database import get_db
from app.config import get_business_date
from app.db_models import PurchaseOrder, Product, Supplier, BatchInventory, Dispatch
from app.schemas import PurchaseOrderSchema, CreatePurchaseOrderRequest, UpdatePurchaseOrderStatusRequest

router = APIRouter(prefix="/api/purchase-orders", tags=["Purchase Orders"])


@router.get("")
@router.get("/")
def list_purchase_orders(
    search: Optional[str] = Query(None, description="Search by PO number, SKU, or manufacturer"),
    status: Optional[str] = Query(None, description="Filter by status (Open, Confirmed, Received, Delayed)"),
    overdue_only: Optional[bool] = Query(False, description="Filter only overdue purchase orders"),
    sort_by: str = Query("expected_delivery_date", description="Sort by field"),
    sort_order: str = Query("asc", description="Sort order"),
    db: Session = Depends(get_db),
):
    ref_date = get_business_date()
    query = db.query(PurchaseOrder).join(Product)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            (PurchaseOrder.po_number.ilike(s))
            | (PurchaseOrder.sku.ilike(s))
            | (PurchaseOrder.manufacturer.ilike(s))
            | (Product.name.ilike(s))
        )

    if status:
        if status.lower() == "overdue":
            overdue_only = True
        else:
            query = query.filter(PurchaseOrder.status.ilike(f"%{status.strip()}%"))

    orders = query.all()

    # Counts
    all_pos = db.query(PurchaseOrder).all()
    open_count = sum(1 for p in all_pos if p.status == "Open")
    conf_count = sum(1 for p in all_pos if p.status == "Confirmed")
    recv_count = sum(1 for p in all_pos if p.status == "Received")
    delay_count = sum(1 for p in all_pos if "Delay" in p.status)

    results = []
    overdue_count = 0

    for o in orders:
        is_overdue = False
        if o.expected_delivery_date:
            exp_tz = o.expected_delivery_date.replace(tzinfo=timezone.utc)
            if exp_tz < ref_date and o.status != "Received":
                is_overdue = True
                overdue_count += 1

        if overdue_only and not is_overdue:
            continue

        results.append({
            "id": o.id,
            "po_number": o.po_number,
            "product_id": o.product_id,
            "product_name": o.product.name if o.product else "Unknown",
            "product_sku": o.sku or (o.product.sku if o.product else ""),
            "manufacturer": o.manufacturer or (o.supplier.name if o.supplier else "Direct"),
            "supplier_id": o.supplier_id,
            "quantity": o.quantity,
            "unit_price": o.unit_price,
            "total_amount": o.total_amount or (o.quantity * o.unit_price),
            "status": o.status,
            "is_overdue": is_overdue,
            "order_date": o.order_date.isoformat() if o.order_date else o.created_at.isoformat(),
            "expected_delivery_date": o.expected_delivery_date.isoformat() if o.expected_delivery_date else None,
            "notes": o.notes,
        })

    # Sort results
    reverse = (sort_order.lower() == "desc")
    if sort_by == "expected_delivery_date":
        results.sort(key=lambda x: x["expected_delivery_date"] or "", reverse=reverse)
    elif sort_by == "po_number":
        results.sort(key=lambda x: x["po_number"], reverse=reverse)
    elif sort_by == "quantity":
        results.sort(key=lambda x: x["quantity"], reverse=reverse)

    return {
        "items": results,
        "total": len(results),
        "summary": {
            "total_orders": len(all_pos),
            "open": open_count,
            "confirmed": conf_count,
            "received": recv_count,
            "delayed": delay_count,
            "overdue": overdue_count,
            "business_reference_date": ref_date.isoformat(),
        },
    }


@router.get("/recommendations")
def get_reorder_recommendations(db: Session = Depends(get_db)):
    """Computes explainable reorder recommendations based on stock availability,
    daily dispatch rate, supplier lead times, and minimum order quantities (MOQ).
    """
    ref_date = get_business_date()
    products = db.query(Product).all()

    # Pre-calculate dispatch demand per SKU (last 60 days)
    disp_sums = dict(
        db.query(Dispatch.sku, func.sum(Dispatch.quantity))
        .group_by(Dispatch.sku)
        .all()
    )

    # Pre-calculate stock on hand per product
    stock_sums = dict(
        db.query(BatchInventory.product_id, func.sum(BatchInventory.available_quantity))
        .filter(BatchInventory.status != "recalled")
        .group_by(BatchInventory.product_id)
        .all()
    )

    # Incoming PO quantities (Open / Confirmed)
    incoming_pos = dict(
        db.query(PurchaseOrder.product_id, func.sum(PurchaseOrder.quantity))
        .filter(PurchaseOrder.status.in_(["Open", "Confirmed"]))
        .group_by(PurchaseOrder.product_id)
        .all()
    )

    # Suppliers lookup
    suppliers = db.query(Supplier).all()
    sku_suppliers = {s.sku: s for s in suppliers if s.sku}

    recommendations = []
    for p in products:
        on_hand = stock_sums.get(p.id, 0)
        on_order = incoming_pos.get(p.id, 0)
        total_disp_60d = disp_sums.get(p.sku, 0)
        daily_burn = round(total_disp_60d / 60.0, 2) if total_disp_60d > 0 else 1.0

        sup = sku_suppliers.get(p.sku) or db.query(Supplier).filter_by(name=p.brand).first()
        lead_time = sup.lead_time_days if sup else 14
        moq = sup.min_order_quantity if sup else 500

        # Safety buffer (7 days of cover)
        reorder_point = int(daily_burn * (lead_time + 7))
        effective_stock = on_hand + on_order

        if effective_stock < reorder_point:
            deficit = reorder_point - effective_stock
            order_qty = max(moq, ((deficit + moq - 1) // moq) * moq)
            days_of_cover = round(on_hand / daily_burn, 1) if daily_burn > 0 else 999.0

            recommendations.append({
                "product_id": p.id,
                "sku": p.sku,
                "product_name": p.name,
                "category": p.category,
                "is_critical": p.is_critical,
                "supplier_name": sup.name if sup else p.brand,
                "on_hand_stock": on_hand,
                "incoming_on_order": on_order,
                "effective_pipeline_stock": effective_stock,
                "reorder_threshold": reorder_point,
                "daily_burn_rate": daily_burn,
                "days_of_cover": days_of_cover,
                "supplier_lead_time_days": lead_time,
                "supplier_moq": moq,
                "recommended_order_quantity": order_qty,
                "urgency": "Emergency" if (p.is_critical and on_hand < 100) else ("High" if on_hand < reorder_point else "Medium"),
                "reason": (
                    f"Current on-hand stock ({on_hand} units) provides only {days_of_cover} days of cover. "
                    f"With a {lead_time}-day supplier lead time and {daily_burn} units/day burn rate, "
                    f"reorder point is {reorder_point} units. Reorder of {order_qty} units (MOQ {moq}) recommended."
                ),
            })

    recommendations.sort(key=lambda x: (x["urgency"] != "Emergency", x["days_of_cover"]))
    return {
        "recommendations": recommendations,
        "total_recommendations": len(recommendations),
        "business_reference_date": ref_date.isoformat(),
    }


@router.post("", response_model=PurchaseOrderSchema)
@router.post("/", response_model=PurchaseOrderSchema)
def create_purchase_order(payload: CreatePurchaseOrderRequest, db: Session = Depends(get_db)):
    product = db.query(Product).filter_by(id=payload.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail=f"Product {payload.product_id} not found.")

    supplier = None
    if payload.supplier_id:
        supplier = db.query(Supplier).filter_by(id=payload.supplier_id).first()
    if not supplier:
        supplier = db.query(Supplier).filter_by(sku=product.sku).first() or db.query(Supplier).filter_by(name=product.brand).first()

    now = datetime.now(timezone.utc)
    unit_price = payload.unit_price if payload.unit_price is not None else product.unit_price
    po_num = f"PO-{now.strftime('%Y%m%d%H%M')}-{uuid.uuid4().hex[:4].upper()}"

    po = PurchaseOrder(
        po_number=po_num,
        product_id=product.id,
        supplier_id=supplier.id if supplier else None,
        manufacturer=supplier.name if supplier else product.brand,
        sku=product.sku,
        quantity=payload.quantity,
        unit_price=unit_price,
        total_amount=payload.quantity * unit_price,
        status="Open",
        order_date=now,
        notes=payload.notes or f"Manual PO created for {product.name}",
    )
    db.add(po)
    db.commit()
    db.refresh(po)

    return PurchaseOrderSchema(
        id=po.id,
        po_number=po.po_number,
        product_name=product.name,
        product_sku=product.sku,
        supplier_name=supplier.name if supplier else "Primary Manufacturer",
        manufacturer=po.manufacturer,
        sku=po.sku,
        quantity=po.quantity,
        unit_price=po.unit_price,
        total_amount=po.total_amount,
        status=po.status,
        order_date=po.order_date.isoformat(),
        expected_delivery_date=None,
        is_overdue=False,
        notes=po.notes,
    )


@router.put("/{po_id}/status", response_model=PurchaseOrderSchema)
def update_purchase_order_status(po_id: int, payload: UpdatePurchaseOrderStatusRequest, db: Session = Depends(get_db)):
    po = db.query(PurchaseOrder).filter_by(id=po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail=f"Purchase order {po_id} not found.")

    po.status = payload.status.strip()
    if payload.notes:
        po.notes = f"{po.notes or ''}; {payload.notes}"

    db.commit()
    db.refresh(po)

    ref_date = get_business_date()
    is_overdue = po.expected_delivery_date and po.expected_delivery_date.replace(tzinfo=timezone.utc) < ref_date and po.status != "Received"

    return PurchaseOrderSchema(
        id=po.id,
        po_number=po.po_number,
        product_name=po.product.name if po.product else "Unknown",
        product_sku=po.sku or (po.product.sku if po.product else ""),
        supplier_name=po.supplier.name if po.supplier else "Supplier",
        manufacturer=po.manufacturer,
        sku=po.sku,
        quantity=po.quantity,
        unit_price=po.unit_price,
        total_amount=po.total_amount,
        status=po.status,
        order_date=po.order_date.isoformat() if po.order_date else po.created_at.isoformat(),
        expected_delivery_date=po.expected_delivery_date.isoformat() if po.expected_delivery_date else None,
        is_overdue=bool(is_overdue),
        notes=po.notes,
    )
