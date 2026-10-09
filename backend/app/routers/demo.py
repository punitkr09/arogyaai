from fastapi import APIRouter
from app.seed import reset_database

router = APIRouter(prefix="/api/demo", tags=["Demo"])


@router.post("/reset")
def reset_demo_state():
    reset_database()
    return {
        "status": "ok",
        "message": "Demo database successfully reset and re-seeded to pristine baseline.",
        "recalled_batch": "B2231",
        "replacement_batch": "B2240",
    }
