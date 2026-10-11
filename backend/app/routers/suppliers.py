from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, func
from app.database import get_db
from app.config import get_business_date
from app.db_models import Supplier, Product, BatchInventory, Dispatch, PurchaseOrder
from app.schemas import SupplierSchema, CreateSupplierRequest

router = APIRouter(prefix="/api/suppliers", tags=["Suppliers"])


@router.get("")
@router.get("/")
def list_suppliers(
    search: Optional[str] = Query(None, description="Search by manufacturer name or SKU"),
    manufacturer: Optional[str] = Query(None, description="Filter by manufacturer name"),
    risk_only: Optional[bool] = Query(False, description="Filter only suppliers with replenishment risk"),
    sort_by: str = Query("name", description="Sort by name, lead_time_days, min_order_quantity"),
    sort_order: str = Query("asc", description="Sort order"),
    db: Session = Depends(get_db),
):
    query = db.query(Supplier)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter((Supplier.name.ilike(s)) | (Supplier.sku.ilike(s)))

    if manufacturer:
        query = query.filter(Supplier.name.ilike(f"%{manufacturer.strip()}%"))

    sort_col = getattr(Supplier, sort_by, Supplier.name)
    if sort_order.lower() == "desc":
        query = query.order_by(desc(sort_col))
    else:
        query = query.order_by(asc(sort_col))

    suppliers = query.all()

    # Pre-calculate dispatch demand per SKU (last 60 days) to determine replenishment risk
    disp_sums = dict(
        db.query(Dispatch.sku, func.sum(Dispatch.quantity))
        .group_by(Dispatch.sku)
        .all()
    )

    # Pre-calculate available stock per SKU
    stock_sums = dict(
        db.query(Product.sku, func.sum(BatchInventory.available_quantity))
        .join(BatchInventory, Product.id == BatchInventory.product_id)
        .filter(BatchInventory.status != "recalled")
        .group_by(Product.sku)
        .all()
    )

    results = []
    risks_count = 0

    for sup in suppliers:
        sku = sup.sku
        prod = sup.product or (db.query(Product).filter_by(sku=sku).first() if sku else None)
        avail_stock = stock_sums.get(sku, 0) if sku else 0
        total_disp_60d = disp_sums.get(sku, 0) if sku else 0
        daily_burn = round(total_disp_60d / 60.0, 2) if total_disp_60d > 0 else 0.5
        days_of_cover = round(avail_stock / daily_burn, 1) if daily_burn > 0 else 999.0

        lead_time = sup.lead_time_days or 14
        moq = sup.min_order_quantity or 500
        return_window = sup.return_window_days or 60

        # Replenishment risk if days of cover is less than lead time + 7-day safety buffer
        reorder_point = int(daily_burn * (lead_time + 7))
        has_risk = avail_stock < reorder_point
        if has_risk:
            risks_count += 1

        # Recommended order quantity
        reorder_needed = max(0, reorder_point - avail_stock)
        suggested_order_qty = max(moq, ((reorder_needed + moq - 1) // moq) * moq) if reorder_needed > 0 else 0

        if risk_only and not has_risk:
            continue

        results.append({
            "id": sup.id,
            "name": sup.name,
            "sku": sup.sku,
            "product_name": prod.name if prod else (sku or "General Supplier"),
            "product_category": prod.category if prod else "",
            "is_critical_drug": prod.is_critical if prod else False,
            "lead_time_days": lead_time,
            "min_order_quantity": moq,
            "return_window_days": return_window,
            "contact_email": sup.contact_email,
            "phone": sup.phone,
            "current_warehouse_stock": avail_stock,
            "daily_consumption_rate": daily_burn,
            "days_of_cover": days_of_cover,
            "reorder_threshold": reorder_point,
            "replenishment_risk": has_risk,
            "risk_severity": "Critical" if (has_risk and prod and prod.is_critical) else ("High" if has_risk else "Normal"),
            "recommended_order_quantity": suggested_order_qty,
        })

    avg_lead_time = round(sum(s.lead_time_days for s in suppliers) / len(suppliers), 1) if suppliers else 0

    return {
        "items": results,
        "total": len(results),
        "summary": {
            "total_suppliers": len(suppliers),
            "distinct_manufacturers": len(set(s.name for s in suppliers)),
            "average_lead_time_days": avg_lead_time,
            "replenishment_risks_count": risks_count,
        },
    }


@router.get("/{supplier_id}")
def get_supplier_detail(supplier_id: int, db: Session = Depends(get_db)):
    sup = db.query(Supplier).filter_by(id=supplier_id).first()
    if not sup:
        raise HTTPException(status_code=404, detail=f"Supplier ID {supplier_id} not found.")

    pos = db.query(PurchaseOrder).filter_by(supplier_id=sup.id).order_by(desc(PurchaseOrder.order_date)).all()
    po_list = [
        {
            "id": po.id,
            "po_number": po.po_number,
            "sku": po.sku,
            "quantity": po.quantity,
            "unit_price": po.unit_price,
            "total_amount": po.total_amount,
            "status": po.status,
            "order_date": po.order_date.isoformat(),
            "expected_delivery_date": po.expected_delivery_date.isoformat() if po.expected_delivery_date else None,
        }
        for po in pos
    ]

    return {
        "supplier": SupplierSchema.model_validate(sup),
        "purchase_orders": po_list,
        "total_purchase_orders": len(pos),
    }


@router.post("", response_model=SupplierSchema)
@router.post("/", response_model=SupplierSchema)
def create_supplier(payload: CreateSupplierRequest, db: Session = Depends(get_db)):
    """Creates a new pharmaceutical supplier / manufacturer profile."""
    name = payload.name.strip()
    sku = payload.sku.strip().upper() if payload.sku else None

    # Verify SKU exists if provided
    if sku:
        prod = db.query(Product).filter_by(sku=sku).first()
        if not prod:
            raise HTTPException(status_code=404, detail=f"Product with SKU '{sku}' not found.")

    sup = Supplier(
        name=name,
        sku=sku,
        lead_time_days=payload.lead_time_days,
        min_order_quantity=payload.min_order_quantity,
        return_window_days=payload.return_window_days,
        contact_email=payload.contact_email,
        phone=payload.phone,
    )
    db.add(sup)
    db.commit()
    db.refresh(sup)
    return sup
