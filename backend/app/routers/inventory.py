import uuid
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
    Customer,
    Dispatch,
    TemperatureLog,
    PurchaseOrder,
    Supplier,
)
from app.schemas import (
    BatchDetailSchema,
    BatchSummarySchema,
    MovementSchema,
    DispatchSchema,
    ProductSchema,
    CreateDispatchRequest,
    TraceabilityResponse,
    CreateBatchRequest,
    UpdateBatchRequest,
    CreateProductRequest,
    UpdateProductRequest,
    CustomerSchema,
    CreateCustomerRequest,
    UpdateCustomerRequest,
    WarehouseSchema,
    CreateWarehouseRequest,
    TemperatureLogSchema,
    CreateTemperatureLogRequest,
    PurchaseOrderSchema,
    CreatePurchaseOrderRequest,
    UpdatePurchaseOrderStatusRequest,
)
from app.tools.registry import ToolRegistry

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


@router.get("/batches/{batch_number}/trace", response_model=TraceabilityResponse)
def trace_batch(batch_number: str, db: Session = Depends(get_db)):
    """Traces all recorded recipients, customer types, quantities, and dates for a batch."""
    trace_data = ToolRegistry.trace_batch_recipients(db, batch_number)
    if "error" in trace_data:
        raise HTTPException(status_code=404, detail=trace_data["error"])
    return trace_data


@router.post("/dispatch", response_model=DispatchSchema)
def create_dispatch(payload: CreateDispatchRequest, db: Session = Depends(get_db)):
    """Creates a new outbound dispatch.
    CRITICAL PHARMACEUTICAL SAFETY CONTROL:
    Recalled, quarantined, or dispatch-held batches are strictly blocked from future dispatch.
    """
    batch = db.query(BatchInventory).filter_by(batch_number=payload.batch_number.strip()).first()
    if not batch:
        raise HTTPException(status_code=404, detail=f"Batch '{payload.batch_number}' not found.")

    # MANDATORY SAFETY CHECK: Status check
    blocked_statuses = ["dispatch_hold", "quarantine", "recalled"]
    if batch.status in blocked_statuses:
        raise HTTPException(
            status_code=403,
            detail=(
                f"SAFETY VIOLATION BLOCKED: Batch '{batch.batch_number}' is under '{batch.status}' status. "
                f"Pharmaceutical distribution safety policies strictly prohibit outbound dispatches of blocked stock."
            ),
        )

    customer = db.query(Customer).filter_by(code=payload.customer_code.strip()).first()
    if not customer:
        raise HTTPException(status_code=404, detail=f"Customer '{payload.customer_code}' not found.")

    # Inventory quantity check
    if batch.available_quantity < payload.quantity:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient stock: Requested {payload.quantity} units, but Batch '{batch.batch_number}' "
                f"has only {batch.available_quantity} available units."
            ),
        )

    now_dt = datetime.now(timezone.utc)
    dispatch_num = f"DISP-{now_dt.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"

    # Atomic inventory deduction
    batch.available_quantity -= payload.quantity

    movement = StockMovement(
        batch_id=batch.id,
        movement_type="dispatch",
        quantity=-payload.quantity,
        reference_doc=dispatch_num,
        timestamp=now_dt,
        notes=payload.notes or f"Outbound dispatch to {customer.name}",
    )
    db.add(movement)

    disp = Dispatch(
        dispatch_number=dispatch_num,
        customer_id=customer.id,
        batch_id=batch.id,
        product_id=batch.product_id,
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


# ---------------------------------------------------------------------------
# Batch Create & Edit
# ---------------------------------------------------------------------------
@router.post("/batches", response_model=BatchSummarySchema)
def create_batch(payload: CreateBatchRequest, db: Session = Depends(get_db)):
    batch_no = payload.batch_number.strip().upper()
    existing = db.query(BatchInventory).filter_by(batch_number=batch_no).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Batch '{batch_no}' already exists.")

    product = db.query(Product).filter_by(id=payload.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail=f"Product ID {payload.product_id} not found.")

    warehouse = db.query(Warehouse).filter_by(id=payload.warehouse_id).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail=f"Warehouse ID {payload.warehouse_id} not found.")

    now = datetime.now(timezone.utc)
    try:
        exp_dt = datetime.fromisoformat(payload.expiry_date.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid expiry_date format. Use ISO format (YYYY-MM-DD).")

    mfg_dt = now
    if payload.manufacturing_date:
        try:
            mfg_dt = datetime.fromisoformat(payload.manufacturing_date.replace("Z", "+00:00"))
        except Exception:
            pass

    initial_qty = payload.initial_quantity if payload.initial_quantity is not None else payload.available_quantity

    new_batch = BatchInventory(
        batch_number=batch_no,
        product_id=product.id,
        warehouse_id=warehouse.id,
        available_quantity=payload.available_quantity,
        initial_quantity=initial_qty,
        manufacturing_date=mfg_dt,
        expiry_date=exp_dt,
        status=payload.status.lower().strip(),
        storage_condition=payload.storage_condition,
    )
    db.add(new_batch)
    db.flush()

    # Log initial stock movement
    movement = StockMovement(
        batch_id=new_batch.id,
        movement_type="initial_receipt",
        quantity=payload.available_quantity,
        reference_doc=f"GRN-{uuid.uuid4().hex[:6].upper()}",
        timestamp=now,
        notes=f"Initial stock intake for {batch_no}",
    )
    db.add(movement)
    db.commit()
    db.refresh(new_batch)

    days_left = (new_batch.expiry_date.replace(tzinfo=timezone.utc) - now).days
    return BatchSummarySchema(
        id=new_batch.id,
        batch_number=new_batch.batch_number,
        product_id=product.id,
        product_name=product.name,
        product_sku=product.sku,
        warehouse_code=warehouse.code,
        warehouse_name=warehouse.name,
        available_quantity=new_batch.available_quantity,
        initial_quantity=new_batch.initial_quantity,
        manufacturing_date=new_batch.manufacturing_date.isoformat(),
        expiry_date=new_batch.expiry_date.isoformat(),
        status=new_batch.status,
        storage_condition=new_batch.storage_condition,
        days_to_expiry=days_left,
    )


@router.put("/batches/{batch_number}", response_model=BatchSummarySchema)
def update_batch(batch_number: str, payload: UpdateBatchRequest, db: Session = Depends(get_db)):
    batch = db.query(BatchInventory).filter_by(batch_number=batch_number.strip().upper()).first()
    if not batch:
        raise HTTPException(status_code=404, detail=f"Batch '{batch_number}' not found.")

    now = datetime.now(timezone.utc)
    if payload.available_quantity is not None:
        delta = payload.available_quantity - batch.available_quantity
        batch.available_quantity = payload.available_quantity
        if delta != 0:
            db.add(StockMovement(
                batch_id=batch.id,
                movement_type="adjustment",
                quantity=delta,
                reference_doc=f"ADJ-{uuid.uuid4().hex[:6].upper()}",
                timestamp=now,
                notes=f"Manual inventory stock adjustment by operator",
            ))

    if payload.status is not None:
        batch.status = payload.status.lower().strip()

    if payload.warehouse_id is not None:
        wh = db.query(Warehouse).filter_by(id=payload.warehouse_id).first()
        if not wh:
            raise HTTPException(status_code=404, detail=f"Warehouse ID {payload.warehouse_id} not found.")
        batch.warehouse_id = wh.id

    if payload.expiry_date is not None:
        try:
            batch.expiry_date = datetime.fromisoformat(payload.expiry_date.replace("Z", "+00:00"))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid expiry_date format.")

    if payload.storage_condition is not None:
        batch.storage_condition = payload.storage_condition

    db.commit()
    db.refresh(batch)

    days_left = (batch.expiry_date.replace(tzinfo=timezone.utc) - now).days
    return BatchSummarySchema(
        id=batch.id,
        batch_number=batch.batch_number,
        product_id=batch.product.id,
        product_name=batch.product.name,
        product_sku=batch.product.sku,
        warehouse_code=batch.warehouse.code,
        warehouse_name=batch.warehouse.name,
        available_quantity=batch.available_quantity,
        initial_quantity=batch.initial_quantity,
        manufacturing_date=batch.manufacturing_date.isoformat(),
        expiry_date=batch.expiry_date.isoformat(),
        status=batch.status,
        storage_condition=batch.storage_condition,
        days_to_expiry=days_left,
    )


# ---------------------------------------------------------------------------
# Product Create & Edit
# ---------------------------------------------------------------------------
@router.post("/products", response_model=ProductSchema)
def create_product(payload: CreateProductRequest, db: Session = Depends(get_db)):
    sku = payload.sku.strip().upper()
    existing = db.query(Product).filter_by(sku=sku).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Product with SKU '{sku}' already exists.")

    product = Product(
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
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.put("/products/{product_id}", response_model=ProductSchema)
def update_product(product_id: int, payload: UpdateProductRequest, db: Session = Depends(get_db)):
    product = db.query(Product).filter_by(id=product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail=f"Product {product_id} not found.")

    if payload.name is not None:
        product.name = payload.name.strip()
    if payload.molecule is not None:
        product.molecule = payload.molecule.strip()
    if payload.brand is not None:
        product.brand = payload.brand.strip()
    if payload.category is not None:
        product.category = payload.category.strip()
    if payload.storage_range is not None:
        product.storage_range = payload.storage_range.strip()
    if payload.is_critical is not None:
        product.is_critical = payload.is_critical
    if payload.unit_price is not None:
        product.unit_price = payload.unit_price
    if payload.unit_of_measure is not None:
        product.unit_of_measure = payload.unit_of_measure
    if payload.min_safety_stock is not None:
        product.min_safety_stock = payload.min_safety_stock

    db.commit()
    db.refresh(product)
    return product


# ---------------------------------------------------------------------------
# Customer Create & Edit
# ---------------------------------------------------------------------------
@router.get("/customers", response_model=List[CustomerSchema])
def list_customers(db: Session = Depends(get_db)):
    customers = db.query(Customer).order_by(Customer.priority_tier.asc(), Customer.name.asc()).all()
    return customers


@router.post("/customers", response_model=CustomerSchema)
def create_customer(payload: CreateCustomerRequest, db: Session = Depends(get_db)):
    code = payload.code.strip().upper()
    existing = db.query(Customer).filter_by(code=code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Customer with code '{code}' already exists.")

    customer = Customer(
        code=code,
        name=payload.name.strip(),
        customer_type=payload.customer_type.lower().strip(),
        priority_tier=payload.priority_tier,
        contact_email=payload.contact_email,
        phone=payload.phone,
        address=payload.address,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.put("/customers/{customer_id}", response_model=CustomerSchema)
def update_customer(customer_id: int, payload: UpdateCustomerRequest, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter_by(id=customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail=f"Customer {customer_id} not found.")

    if payload.name is not None:
        customer.name = payload.name.strip()
    if payload.customer_type is not None:
        customer.customer_type = payload.customer_type.lower().strip()
    if payload.priority_tier is not None:
        customer.priority_tier = payload.priority_tier
    if payload.contact_email is not None:
        customer.contact_email = payload.contact_email
    if payload.phone is not None:
        customer.phone = payload.phone
    if payload.address is not None:
        customer.address = payload.address

    db.commit()
    db.refresh(customer)
    return customer


# ---------------------------------------------------------------------------
# Warehouse Create & List
# ---------------------------------------------------------------------------
@router.get("/warehouses", response_model=List[WarehouseSchema])
def list_warehouses(db: Session = Depends(get_db)):
    warehouses = db.query(Warehouse).order_by(Warehouse.code.asc()).all()
    return warehouses


@router.post("/warehouses", response_model=WarehouseSchema)
def create_warehouse(payload: CreateWarehouseRequest, db: Session = Depends(get_db)):
    code = payload.code.strip().upper()
    existing = db.query(Warehouse).filter_by(code=code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Warehouse '{code}' already exists.")

    wh = Warehouse(
        code=code,
        name=payload.name.strip(),
        location=payload.location.strip(),
        cold_storage_available=payload.cold_storage_available,
    )
    db.add(wh)
    db.commit()
    db.refresh(wh)
    return wh


# ---------------------------------------------------------------------------
# Temperature Telemetry Logs (Cold Chain)
# ---------------------------------------------------------------------------
@router.get("/temperature-logs", response_model=List[TemperatureLogSchema])
def list_temperature_logs(db: Session = Depends(get_db)):
    logs = db.query(TemperatureLog).order_by(TemperatureLog.recorded_at.desc()).limit(100).all()
    results = []
    for l in logs:
        results.append(TemperatureLogSchema(
            id=l.id,
            warehouse_id=l.warehouse_id,
            warehouse_name=l.warehouse.name if l.warehouse else f"Warehouse {l.warehouse_id}",
            cold_room_unit=l.cold_room_unit,
            recorded_at=l.recorded_at.isoformat(),
            recorded_temperature_celsius=l.recorded_temperature_celsius,
            permitted_range=l.permitted_range,
            duration_minutes=l.duration_minutes,
            thermal_severity=l.thermal_severity,
            notes=l.notes,
        ))
    return results


@router.post("/temperature-logs", response_model=TemperatureLogSchema)
def create_temperature_log(payload: CreateTemperatureLogRequest, db: Session = Depends(get_db)):
    wh = db.query(Warehouse).filter_by(id=payload.warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail=f"Warehouse {payload.warehouse_id} not found.")

    now = datetime.now(timezone.utc)
    tlog = TemperatureLog(
        warehouse_id=wh.id,
        cold_room_unit=payload.cold_room_unit.strip(),
        recorded_at=now,
        recorded_temperature_celsius=payload.recorded_temperature_celsius,
        permitted_range=payload.permitted_range,
        duration_minutes=payload.duration_minutes,
        thermal_severity=payload.thermal_severity,
        notes=payload.notes,
    )
    db.add(tlog)
    db.commit()
    db.refresh(tlog)

    return TemperatureLogSchema(
        id=tlog.id,
        warehouse_id=wh.id,
        warehouse_name=wh.name,
        cold_room_unit=tlog.cold_room_unit,
        recorded_at=tlog.recorded_at.isoformat(),
        recorded_temperature_celsius=tlog.recorded_temperature_celsius,
        permitted_range=tlog.permitted_range,
        duration_minutes=tlog.duration_minutes,
        thermal_severity=tlog.thermal_severity,
        notes=tlog.notes,
    )


# ---------------------------------------------------------------------------
# Purchase Orders (Shortage & Replenishment)
# ---------------------------------------------------------------------------
@router.get("/purchase-orders", response_model=List[PurchaseOrderSchema])
def list_purchase_orders(db: Session = Depends(get_db)):
    orders = db.query(PurchaseOrder).order_by(PurchaseOrder.order_date.desc()).all()
    results = []
    for o in orders:
        results.append(PurchaseOrderSchema(
            id=o.id,
            po_number=o.po_number,
            product_name=o.product.name if o.product else "Unknown Product",
            product_sku=o.product.sku if o.product else "Unknown SKU",
            supplier_name=o.supplier.name if o.supplier else "Direct Manufacturer",
            quantity=o.quantity,
            unit_price=o.unit_price,
            total_amount=o.total_amount,
            status=o.status,
            order_date=o.order_date.isoformat(),
            expected_delivery_date=o.expected_delivery_date.isoformat() if o.expected_delivery_date else None,
            notes=o.notes,
        ))
    return results


@router.post("/purchase-orders", response_model=PurchaseOrderSchema)
def create_purchase_order(payload: CreatePurchaseOrderRequest, db: Session = Depends(get_db)):
    product = db.query(Product).filter_by(id=payload.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail=f"Product {payload.product_id} not found.")

    supplier_id = payload.supplier_id
    if not supplier_id:
        supplier = db.query(Supplier).first()
        supplier_id = supplier.id if supplier else 1
    else:
        supplier = db.query(Supplier).filter_by(id=supplier_id).first()

    now = datetime.now(timezone.utc)
    unit_price = payload.unit_price if payload.unit_price is not None else product.unit_price
    po_num = f"PO-{now.strftime('%Y%m%d%H%M')}-{uuid.uuid4().hex[:4].upper()}"

    po = PurchaseOrder(
        po_number=po_num,
        product_id=product.id,
        supplier_id=supplier_id,
        quantity=payload.quantity,
        unit_price=unit_price,
        total_amount=payload.quantity * unit_price,
        status="submitted",
        order_date=now,
        notes=payload.notes,
    )
    db.add(po)
    db.commit()
    db.refresh(po)

    return PurchaseOrderSchema(
        id=po.id,
        po_number=po.po_number,
        product_name=product.name,
        product_sku=product.sku,
        supplier_name=supplier.name if supplier else "Primary Supplier",
        quantity=po.quantity,
        unit_price=po.unit_price,
        total_amount=po.total_amount,
        status=po.status,
        order_date=po.order_date.isoformat(),
        expected_delivery_date=None,
        notes=po.notes,
    )


@router.put("/purchase-orders/{po_id}/status", response_model=PurchaseOrderSchema)
def update_purchase_order_status(po_id: int, payload: UpdatePurchaseOrderStatusRequest, db: Session = Depends(get_db)):
    po = db.query(PurchaseOrder).filter_by(id=po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail=f"Purchase order {po_id} not found.")

    po.status = payload.status.lower().strip()
    if payload.notes:
        po.notes = f"{po.notes or ''}; {payload.notes}"

    db.commit()
    db.refresh(po)

    return PurchaseOrderSchema(
        id=po.id,
        po_number=po.po_number,
        product_name=po.product.name if po.product else "Unknown",
        product_sku=po.product.sku if po.product else "Unknown",
        supplier_name=po.supplier.name if po.supplier else "Supplier",
        quantity=po.quantity,
        unit_price=po.unit_price,
        total_amount=po.total_amount,
        status=po.status,
        order_date=po.order_date.isoformat(),
        expected_delivery_date=po.expected_delivery_date.isoformat() if po.expected_delivery_date else None,
        notes=po.notes,
    )

