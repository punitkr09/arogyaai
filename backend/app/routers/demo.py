from fastapi import APIRouter
from app.seed import reset_database

admin_router = APIRouter(prefix="/api/admin", tags=["Admin & Data Management"])
router = APIRouter(prefix="/api/demo", tags=["Data Management"])


@admin_router.post("/seed")
def seed_development_data():
    """Explicit development seed command. Re-initializes database with standardized pharmaceutical sample records."""
    reset_database()
    return {
        "status": "ok",
        "message": "Operational database initialized with verified pharmaceutical baseline records.",
        "sample_records": {
            "recalled_batch": "B2231",
            "replacement_batch": "B2240",
            "near_expiry_batch": "B1982",
            "cold_chain_batch": "B4019",
            "shortage_batch": "B3102",
        },
    }


@router.post("/reset")
def reset_demo_state():
    """Backwards compatibility alias for development database re-seed."""
    return seed_development_data()
