from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from collections import defaultdict
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc
from app.database import get_db
from app.config import get_business_date
from app.db_models import Dispatch, Product, BatchInventory, Customer, Warehouse, PurchaseOrder

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/overview")
def get_analytics_overview(
    days: int = Query(60, ge=7, le=180, description="Time window in days for dispatch trends"),
    db: Session = Depends(get_db),
):
    ref_date = get_business_date()
    window_start = ref_date - timedelta(days=days)

    # 1. Total Dispatches & Quantity
    total_dispatches = db.query(Dispatch).count()
    total_units_dispatched = db.query(func.sum(Dispatch.quantity)).scalar() or 0
    unique_products = db.query(func.count(func.distinct(Dispatch.product_id))).scalar() or 0
    unique_customers = db.query(func.count(func.distinct(Dispatch.customer_id))).scalar() or 0

    # 2. Daily Dispatch Volumes
    daily_records = (
        db.query(
            func.date(Dispatch.dispatch_date).label("d_date"),
            func.count(Dispatch.id).label("orders_count"),
            func.sum(Dispatch.quantity).label("units_sum"),
        )
        .filter(Dispatch.dispatch_date >= window_start)
        .group_by(func.date(Dispatch.dispatch_date))
        .order_by(asc("d_date"))
        .all()
    )

    daily_trends = [
        {"date": str(r[0]), "orders": r[1], "quantity": r[2]}
        for r in daily_records
    ]
    daily_trend = [
        {"date": str(r[0]), "quantity": r[2] or 0, "dispatches_count": r[1] or 0}
        for r in daily_records
    ]

    # 3. Top Dispatched Products
    top_products_data = (
        db.query(
            Product.sku,
            Product.name,
            Product.brand,
            Product.category,
            Product.is_critical,
            func.sum(Dispatch.quantity).label("total_qty"),
            func.count(Dispatch.id).label("total_orders"),
        )
        .join(Dispatch, Product.id == Dispatch.product_id)
        .group_by(Product.id)
        .order_by(desc("total_qty"))
        .limit(10)
        .all()
    )

    top_products = [
        {
            "sku": r[0],
            "name": r[1],
            "brand": r[2] or r[1],
            "category": r[3],
            "is_critical": r[4],
            "total_quantity": r[5] or 0,
            "total_orders": r[6] or 0,
        }
        for r in top_products_data
    ]

    top_products_by_volume = [
        {
            "sku": r[0],
            "name": r[1],
            "brand": r[2] or r[1],
            "quantity": r[5] or 0,
            "dispatches_count": r[6] or 0,
        }
        for r in top_products_data
    ]

    # 4. Customer Segment Demand (Hospital vs Chemist)
    cust_segment_data = (
        db.query(
            Customer.customer_type,
            func.sum(Dispatch.quantity).label("units_sum"),
            func.count(Dispatch.id).label("orders_count"),
        )
        .join(Dispatch, Customer.id == Dispatch.customer_id)
        .group_by(Customer.customer_type)
        .all()
    )

    customer_segments = {
        r[0]: {"quantity": r[1] or 0, "orders": r[2] or 0}
        for r in cust_segment_data
    }

    total_cust_qty = sum(r[1] or 0 for r in cust_segment_data)
    customer_segmentation = [
        {
            "segment": r[0] or "unknown",
            "quantity": r[1] or 0,
            "dispatches_count": r[2] or 0,
            "percent": round(((r[1] or 0) / total_cust_qty * 100), 1) if total_cust_qty > 0 else 0,
        }
        for r in cust_segment_data
    ]

    # 5. Top Location Demand
    location_data = (
        db.query(
            Customer.location,
            func.sum(Dispatch.quantity).label("units_sum"),
            func.count(Dispatch.id).label("orders_count"),
        )
        .join(Dispatch, Customer.id == Dispatch.customer_id)
        .filter(Customer.location.isnot(None))
        .group_by(Customer.location)
        .order_by(desc("units_sum"))
        .limit(10)
        .all()
    )

    top_locations = [
        {"location": r[0], "quantity": r[1] or 0, "orders": r[2] or 0}
        for r in location_data
    ]

    # 6. Warehouse Stock Distribution
    wh_stock = (
        db.query(
            Warehouse.name,
            Warehouse.code,
            func.sum(BatchInventory.available_quantity).label("total_qty"),
            func.count(BatchInventory.id).label("batches_count"),
        )
        .join(BatchInventory, Warehouse.id == BatchInventory.warehouse_id)
        .group_by(Warehouse.id)
        .all()
    )

    warehouse_distribution = [
        {
            "warehouse": r[0],
            "code": r[1],
            "quantity": r[2] or 0,
            "batches": r[3] or 0,
            "dispatches_count": r[3] or 0,
        }
        for r in wh_stock
    ]

    # 7. Critical-Drug vs Standard Drug Distribution
    critical_split = (
        db.query(
            Product.is_critical,
            func.sum(Dispatch.quantity).label("units_sum"),
            func.count(Dispatch.id).label("orders_count"),
        )
        .join(Dispatch, Product.id == Dispatch.product_id)
        .group_by(Product.is_critical)
        .all()
    )

    critical_analysis = {
        "critical_drugs": {"quantity": 0, "orders": 0},
        "standard_drugs": {"quantity": 0, "orders": 0},
    }
    for r in critical_split:
        key = "critical_drugs" if r[0] else "standard_drugs"
        critical_analysis[key] = {"quantity": r[1] or 0, "orders": r[2] or 0}

    # 8. Category Breakdown
    cat_data = (
        db.query(
            Product.category,
            func.sum(Dispatch.quantity).label("units_sum"),
            func.count(Dispatch.id).label("orders_count"),
        )
        .join(Dispatch, Product.id == Dispatch.product_id)
        .group_by(Product.category)
        .order_by(desc("units_sum"))
        .all()
    )

    category_breakdown = [
        {"category": r[0], "quantity": r[1] or 0, "orders": r[2] or 0}
        for r in cat_data
    ]

    return {
        "time_window_days": days,
        "business_reference_date": ref_date.isoformat(),
        "total_dispatches": total_dispatches,
        "total_quantity": total_units_dispatched,
        "total_units_dispatched": total_units_dispatched,
        "unique_products": unique_products,
        "unique_customers": unique_customers,
        "average_units_per_dispatch": round(total_units_dispatched / total_dispatches, 1) if total_dispatches > 0 else 0,
        "top_products_by_volume": top_products_by_volume,
        "customer_segmentation": customer_segmentation,
        "warehouse_distribution": warehouse_distribution,
        "daily_trend": daily_trend,
        "daily_trends": daily_trends,
        "top_products": top_products,
        "customer_segments": customer_segments,
        "top_locations": top_locations,
        "critical_drug_analysis": critical_analysis,
        "category_breakdown": category_breakdown,
    }

