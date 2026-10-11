from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, func
from app.database import get_db
from app.config import get_business_date
from app.db_models import TemperatureLog, Warehouse, BatchInventory, Product
from app.schemas import TemperatureLogSchema, CreateTemperatureLogRequest

router = APIRouter(prefix="/api/temperature-logs", tags=["Temperature Logs"])


@router.get("")
@router.get("/")
def list_temperature_logs(
    warehouse: Optional[str] = Query(None, description="Filter by warehouse location or code"),
    cold_room: Optional[str] = Query(None, description="Filter by cold room (CR-1, CR-2)"),
    excursions_only: Optional[bool] = Query(False, description="Filter only readings outside 2-8°C"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(100, ge=1, le=1200, description="Items per page"),
    db: Session = Depends(get_db),
):
    query = db.query(TemperatureLog).join(Warehouse)

    if warehouse:
        w_term = f"%{warehouse.strip()}%"
        query = query.filter((Warehouse.name.ilike(w_term)) | (Warehouse.location.ilike(w_term)) | (Warehouse.code.ilike(w_term)))

    if cold_room:
        query = query.filter(TemperatureLog.cold_room_unit.ilike(f"%{cold_room.strip()}%"))

    if excursions_only:
        query = query.filter((TemperatureLog.temperature_celsius < 2.0) | (TemperatureLog.temperature_celsius > 8.0) | (TemperatureLog.is_excursion == True))

    total = query.count()
    items = query.order_by(desc(TemperatureLog.recorded_at)).offset((page - 1) * limit).limit(limit).all()

    # Aggregate statistics across all readings
    all_logs = db.query(TemperatureLog).all()
    all_temps = [l.temperature_celsius for l in all_logs] if all_logs else [5.0]

    min_temp = min(all_temps) if all_temps else 0.0
    max_temp = max(all_temps) if all_temps else 0.0
    avg_temp = round(sum(all_temps) / len(all_temps), 2) if all_temps else 0.0

    excursion_records = [l for l in all_logs if l.temperature_celsius < 2.0 or l.temperature_celsius > 8.0 or l.is_excursion]

    # Group by warehouse stats
    wh_stats = {}
    for l in all_logs:
        wh_name = l.warehouse.location if l.warehouse else "Unknown"
        if wh_name not in wh_stats:
            wh_stats[wh_name] = {"temps": [], "excursions": 0}
        wh_stats[wh_name]["temps"].append(l.temperature_celsius)
        if l.temperature_celsius < 2.0 or l.temperature_celsius > 8.0 or l.is_excursion:
            wh_stats[wh_name]["excursions"] += 1

    facilities_summary = {}
    for wh_name, st in wh_stats.items():
        tmps = st["temps"]
        facilities_summary[wh_name] = {
            "total_readings": len(tmps),
            "min_c": min(tmps),
            "max_c": max(tmps),
            "avg_c": round(sum(tmps) / len(tmps), 2),
            "excursions_count": st["excursions"],
        }

    results = []
    for l in items:
        is_exc = l.temperature_celsius < 2.0 or l.temperature_celsius > 8.0 or l.is_excursion
        results.append({
            "id": l.id,
            "warehouse_id": l.warehouse_id,
            "warehouse_name": l.warehouse.name if l.warehouse else l.warehouse_name,
            "warehouse_location": l.warehouse.location if l.warehouse else "",
            "cold_room_unit": l.cold_room_unit,
            "recorded_at": l.recorded_at.isoformat(),
            "recorded_temperature_celsius": l.temperature_celsius,
            "permitted_range": "2°C - 8°C",
            "is_excursion": is_exc,
            "duration_minutes": l.duration_minutes,
            "thermal_severity": "Critical" if (l.temperature_celsius > 10.0 or l.temperature_celsius < 0.0) else ("Warning" if is_exc else "Normal"),
            "notes": l.notes,
        })

    return {
        "items": results,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if limit > 0 else 1,
        "telemetry_statistics": {
            "total_readings_logged": len(all_logs),
            "overall_min_temperature_c": min_temp,
            "overall_max_temperature_c": max_temp,
            "overall_avg_temperature_c": avg_temp,
            "total_excursions_detected": len(excursion_records),
            "permitted_range": "2.0°C - 8.0°C",
            "facilities": facilities_summary,
            "active_excursions": [
                {
                    "warehouse": e.warehouse.location if e.warehouse else e.warehouse_name,
                    "cold_room": e.cold_room_unit,
                    "temperature_c": e.temperature_celsius,
                    "timestamp": e.recorded_at.isoformat(),
                    "duration_minutes": e.duration_minutes,
                }
                for e in excursion_records
            ],
        },
    }


@router.get("/excursions/affected-inventory")
def get_affected_cold_chain_inventory(db: Session = Depends(get_db)):
    """Cross-references temperature excursions with cold-chain inventory stored in the affected cold rooms."""
    excursion_logs = (
        db.query(TemperatureLog)
        .filter((TemperatureLog.temperature_celsius < 2.0) | (TemperatureLog.temperature_celsius > 8.0) | (TemperatureLog.is_excursion == True))
        .all()
    )

    affected_report = []
    for exc in excursion_logs:
        # Find inventory stored in the same warehouse and cold room location (CR-1, CR-2)
        cold_room_code = exc.cold_room_unit.strip()
        batches = (
            db.query(BatchInventory)
            .filter_by(warehouse_id=exc.warehouse_id)
            .filter(BatchInventory.storage_location.ilike(f"%{cold_room_code}%"))
            .all()
        )

        affected_report.append({
            "excursion": {
                "id": exc.id,
                "warehouse": exc.warehouse.location if exc.warehouse else "Warehouse",
                "cold_room": exc.cold_room_unit,
                "recorded_temperature": exc.temperature_celsius,
                "recorded_at": exc.recorded_at.isoformat(),
                "duration_minutes": exc.duration_minutes,
            },
            "potentially_exposed_batches": [
                {
                    "batch_number": b.batch_number,
                    "product_sku": b.product.sku,
                    "product_name": b.product.name,
                    "is_critical": b.product.is_critical,
                    "available_quantity": b.available_quantity,
                    "expiry_date": b.expiry_date.isoformat(),
                    "status": b.status,
                }
                for b in batches
            ],
            "total_exposed_units": sum(b.available_quantity for b in batches),
        })

    return {
        "excursions_count": len(excursion_logs),
        "reports": affected_report,
    }


@router.post("", response_model=TemperatureLogSchema)
@router.post("/", response_model=TemperatureLogSchema)
def create_temperature_log(payload: CreateTemperatureLogRequest, db: Session = Depends(get_db)):
    wh = db.query(Warehouse).filter_by(id=payload.warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail=f"Warehouse {payload.warehouse_id} not found.")

    now = datetime.now(timezone.utc)
    temp = payload.recorded_temperature_celsius
    is_excursion = temp < 2.0 or temp > 8.0

    tlog = TemperatureLog(
        warehouse_id=wh.id,
        warehouse_name=wh.name,
        cold_room_unit=payload.cold_room_unit.strip(),
        recorded_at=now,
        temperature_celsius=temp,
        is_excursion=is_excursion,
        duration_minutes=payload.duration_minutes,
        alert_sent=is_excursion,
        permitted_range=payload.permitted_range,
        thermal_severity=payload.thermal_severity if payload.thermal_severity else ("Critical" if is_excursion else "Normal"),
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
        recorded_temperature_celsius=tlog.temperature_celsius,
        permitted_range=tlog.permitted_range,
        duration_minutes=tlog.duration_minutes,
        thermal_severity=tlog.thermal_severity,
        notes=tlog.notes,
    )
