from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.db_models import (
    Product,
    Warehouse,
    BatchInventory,
    StockMovement,
    Dispatch,
)
from app.schemas import (
    BatchDetailSchema,
    BatchSummarySchema,
    MovementSchema,
    DispatchSchema,
    ProductSchema,
)

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])


@router.get("/products", response_model=List[ProductSchema])
def list_products(db: Session = Depends(get_db)):
    products = db.query(Product).order_by(Product.name).all()
    return products


@router.get("/batches", response_model=List[BatchSummarySchema])
def list_batches(
    search: Optional[str] = Query(None, description="Search by batch number or product name"),
    status: Optional[str] = Query(None, description="Filter by status (active, quarantine, dispatch_hold, recalled)"),
    warehouse_code: Optional[str] = Query(None, description="Filter by warehouse code"),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    query = db.query(BatchInventory).join(Product).join(Warehouse)

    if search:
        s = f"%{search}%"
        query = query.filter(
            (BatchInventory.batch_number.ilike(s))
            | (Product.name.ilike(s))
            | (Product.brand.ilike(s))
            | (Product.sku.ilike(s))
        )
    if status:
        query = query.filter(BatchInventory.status == status)
    if warehouse_code:
        query = query.filter(Warehouse.code == warehouse_code)

    batches = query.order_by(BatchInventory.expiry_date.asc()).all()

    results = []
    for b in batches:
        days_left = (b.expiry_date.replace(tzinfo=timezone.utc) - now).days
        results.append(
            BatchSummarySchema(
                id=b.id,
                batch_number=b.batch_number,
                product_id=b.product.id,
                product_name=b.product.name,
                product_sku=b.product.sku,
                warehouse_code=b.warehouse.code,
                warehouse_name=b.warehouse.name,
                available_quantity=b.available_quantity,
                initial_quantity=b.initial_quantity,
                manufacturing_date=b.manufacturing_date.isoformat(),
                expiry_date=b.expiry_date.isoformat(),
                status=b.status,
                storage_condition=b.storage_condition,
                days_to_expiry=days_left,
            )
        )
    return results


@router.get("/batches/{batch_number}", response_model=BatchDetailSchema)
def get_batch_details(batch_number: str, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    b = db.query(BatchInventory).filter_by(batch_number=batch_number).first()
    if not b:
        raise HTTPException(status_code=404, detail=f"Batch '{batch_number}' not found.")

    prod = b.product
    wh = b.warehouse
    days_left = (b.expiry_date.replace(tzinfo=timezone.utc) - now).days

    batch_summary = BatchSummarySchema(
        id=b.id,
        batch_number=b.batch_number,
        product_id=prod.id,
        product_name=prod.name,
        product_sku=prod.sku,
        warehouse_code=wh.code,
        warehouse_name=wh.name,
        available_quantity=b.available_quantity,
        initial_quantity=b.initial_quantity,
        manufacturing_date=b.manufacturing_date.isoformat(),
        expiry_date=b.expiry_date.isoformat(),
        status=b.status,
        storage_condition=b.storage_condition,
        days_to_expiry=days_left,
    )

    movements = (
        db.query(StockMovement)
        .filter_by(batch_id=b.id)
        .order_by(StockMovement.timestamp.desc())
        .all()
    )
    movement_schemas = [
        MovementSchema(
            id=m.id,
            movement_type=m.movement_type,
            quantity=m.quantity,
            reference_doc=m.reference_doc,
            timestamp=m.timestamp.isoformat(),
            notes=m.notes,
        )
        for m in movements
    ]

    dispatches = (
        db.query(Dispatch)
        .filter_by(batch_id=b.id)
        .order_by(Dispatch.dispatch_date.desc())
        .all()
    )
    total_dispatched = sum(d.quantity for d in dispatches)
    dispatch_schemas = [
        DispatchSchema(
            id=d.id,
            dispatch_number=d.dispatch_number,
            customer_name=d.customer.name,
            customer_type=d.customer.customer_type,
            quantity=d.quantity,
            dispatch_date=d.dispatch_date.isoformat(),
            status=d.status,
            tracking_ref=d.tracking_ref,
        )
        for d in dispatches
    ]

    return BatchDetailSchema(
        batch=batch_summary,
        product=ProductSchema.model_validate(prod),
        movements=movement_schemas,
        dispatches=dispatch_schemas,
        total_dispatched=total_dispatched,
    )
