from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from app.database import get_db
from app.config import get_business_date
from app.db_models import Product, BatchInventory, Dispatch, Supplier, PurchaseOrder
from app.schemas import ProductSchema, CreateProductRequest, UpdateProductRequest

router = APIRouter(prefix="/api/products", tags=["Products"])


@router.get("")
@router.get("/")
def list_products(
    search: Optional[str] = Query(None, description="Search by SKU, molecule, brand, or name"),
    category: Optional[str] = Query(None, description="Filter by therapeutic category"),
    storage: Optional[str] = Query(None, description="Filter by storage condition (Ambient, 2°C - 8°C)"),
    is_critical: Optional[bool] = Query(None, description="Filter by critical drug status"),
    sort_by: str = Query("name", description="Field to sort by (sku, name, molecule, brand, category)"),
    sort_order: str = Query("asc", description="Sort order (asc, desc)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=200, description="Items per page"),
    db: Session = Depends(get_db),
):
    query = db.query(Product)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            (Product.sku.ilike(s))
            | (Product.name.ilike(s))
            | (Product.molecule.ilike(s))
            | (Product.brand.ilike(s))
        )

    if category:
        query = query.filter(Product.category.ilike(f"%{category.strip()}%"))

    if storage:
        query = query.filter(Product.storage_range.ilike(f"%{storage.strip()}%"))

    if is_critical is not None:
        query = query.filter(Product.is_critical == is_critical)

    # Sorting
    sort_column = getattr(Product, sort_by, Product.name)
    if sort_order.lower() == "desc":
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(asc(sort_column))

    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()

    # Enrich each product with live stock totals
    results = []
    for p in items:
        total_stock = sum(b.available_quantity for b in p.batches if b.status != "recalled")
        recalled_stock = sum(b.available_quantity for b in p.batches if b.status == "recalled")
        batches_count = len(p.batches)
        results.append({
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "molecule": p.molecule,
            "brand": p.brand,
            "category": p.category,
            "storage_range": p.storage_range,
            "is_critical": p.is_critical,
            "unit_price": p.unit_price,
            "unit_of_measure": p.unit_of_measure,
            "min_safety_stock": p.min_safety_stock,
            "total_available_stock": total_stock,
            "recalled_stock": recalled_stock,
            "batches_count": batches_count,
            "stock_status": "Out of Stock" if total_stock == 0 else ("Low Stock" if total_stock < p.min_safety_stock else "Adequate"),
        })

    return {
        "items": results,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if limit > 0 else 1,
    }


@router.get("/{sku_or_id}")
def get_product_detail(sku_or_id: str, db: Session = Depends(get_db)):
    ref_date = get_business_date()
    p = None
    if sku_or_id.isdigit():
        p = db.query(Product).filter_by(id=int(sku_or_id)).first()
    if not p:
        p = db.query(Product).filter_by(sku=sku_or_id.strip().upper()).first()
    if not p:
        raise HTTPException(status_code=404, detail=f"Product '{sku_or_id}' not found.")

    # Batches
    batches_data = []
    for b in p.batches:
        days_left = (b.expiry_date.replace(tzinfo=timezone.utc) - ref_date).days if b.expiry_date else 0
        batches_data.append({
            "id": b.id,
            "batch_number": b.batch_number,
            "warehouse_id": b.warehouse_id,
            "warehouse_name": b.warehouse.name if b.warehouse else "",
            "warehouse_code": b.warehouse.code if b.warehouse else "",
            "storage_location": b.storage_location,
            "available_quantity": b.available_quantity,
            "initial_quantity": b.initial_quantity,
            "manufacturing_date": b.manufacturing_date.isoformat() if b.manufacturing_date else None,
            "expiry_date": b.expiry_date.isoformat() if b.expiry_date else None,
            "days_to_expiry": days_left,
            "status": b.status,
            "storage_condition": b.storage_condition,
        })

    # Dispatches summary
    dispatches = db.query(Dispatch).filter_by(product_id=p.id).order_by(desc(Dispatch.dispatch_date)).all()
    total_dispatched_qty = sum(d.quantity for d in dispatches)
    recent_dispatches = [
        {
            "id": d.id,
            "dispatch_number": d.dispatch_number,
            "customer_code": d.customer.code if d.customer else "",
            "customer_name": d.customer.name if d.customer else "",
            "customer_type": d.customer.customer_type if d.customer else "",
            "batch_number": d.batch_number or (d.batch.batch_number if d.batch else ""),
            "quantity": d.quantity,
            "dispatch_date": d.dispatch_date.isoformat(),
            "status": d.status,
        }
        for d in dispatches[:20]
    ]

    # Supplier info
    supplier = db.query(Supplier).filter_by(sku=p.sku).first()
    if not supplier:
        supplier = db.query(Supplier).filter_by(name=p.brand).first()
    supplier_info = None
    if supplier:
        supplier_info = {
            "id": supplier.id,
            "name": supplier.name,
            "lead_time_days": supplier.lead_time_days,
            "min_order_quantity": supplier.min_order_quantity,
            "return_window_days": supplier.return_window_days,
            "contact_email": supplier.contact_email,
            "phone": supplier.phone,
        }

    # Purchase orders
    pos = db.query(PurchaseOrder).filter_by(product_id=p.id).order_by(desc(PurchaseOrder.order_date)).all()
    po_list = [
        {
            "id": po.id,
            "po_number": po.po_number,
            "quantity": po.quantity,
            "unit_price": po.unit_price,
            "total_amount": po.total_amount,
            "status": po.status,
            "expected_delivery_date": po.expected_delivery_date.isoformat() if po.expected_delivery_date else None,
            "is_overdue": po.expected_delivery_date and po.expected_delivery_date.replace(tzinfo=timezone.utc) < ref_date and po.status != "Received",
            "notes": po.notes,
        }
        for po in pos
    ]

    total_avail = sum(b["available_quantity"] for b in batches_data if b["status"] != "recalled")
    return {
        "product": ProductSchema.model_validate(p),
        "total_available_stock": total_avail,
        "batches": batches_data,
        "dispatches_summary": {
            "total_dispatched_units": total_dispatched_qty,
            "total_dispatch_count": len(dispatches),
            "recent_dispatches": recent_dispatches,
        },
        "supplier": supplier_info,
        "purchase_orders": po_list,
        "business_reference_date": ref_date.isoformat(),
    }


@router.post("", response_model=ProductSchema)
@router.post("/", response_model=ProductSchema)
def create_product(payload: CreateProductRequest, db: Session = Depends(get_db)):
    sku = payload.sku.strip().upper()
    existing = db.query(Product).filter_by(sku=sku).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Product with SKU '{sku}' already exists.")

    p = Product(
        sku=sku,
        name=payload.name.strip(),
        molecule=payload.molecule.strip(),
        brand=payload.brand.strip(),
        category=payload.category.strip(),
        storage_range=payload.storage_range.strip(),
        is_critical=payload.is_critical,
        unit_price=payload.unit_price,
        unit_of_measure=payload.unit_of_measure,
        min_safety_stock=payload.min_safety_stock,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.put("/{product_id}", response_model=ProductSchema)
def update_product(product_id: int, payload: UpdateProductRequest, db: Session = Depends(get_db)):
    p = db.query(Product).filter_by(id=product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail=f"Product {product_id} not found.")

    if payload.name is not None: p.name = payload.name.strip()
    if payload.molecule is not None: p.molecule = payload.molecule.strip()
    if payload.brand is not None: p.brand = payload.brand.strip()
    if payload.category is not None: p.category = payload.category.strip()
    if payload.storage_range is not None: p.storage_range = payload.storage_range.strip()
    if payload.is_critical is not None: p.is_critical = payload.is_critical
    if payload.unit_price is not None: p.unit_price = payload.unit_price
    if payload.unit_of_measure is not None: p.unit_of_measure = payload.unit_of_measure
    if payload.min_safety_stock is not None: p.min_safety_stock = payload.min_safety_stock

    db.commit()
    db.refresh(p)
    return p


@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    """Deletes a product if no batches currently hold physical inventory."""
    p = db.query(Product).filter_by(id=product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail=f"Product {product_id} not found.")

    active_batches = [b for b in p.batches if b.available_quantity > 0]
    if active_batches:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete product '{p.sku}': {len(active_batches)} active batch(es) currently hold physical stock ({sum(b.available_quantity for b in active_batches)} units).",
        )

    sku = p.sku
    name = p.name
    db.delete(p)
    db.commit()
    return {"status": "ok", "message": f"Product '{name}' ({sku}) deleted successfully."}
