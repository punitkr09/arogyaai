from datetime import datetime, timezone
from fastapi import APIRouter
from app.config import settings
from app.models import HealthResponse

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def get_health() -> HealthResponse:
    """Health check endpoint to verify backend status, version, and supported agent stages."""
    return HealthResponse(
        status="ok",
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.APP_ENV,
        timestamp=datetime.now(timezone.utc).isoformat(),
        mode=settings.DEFAULT_EXECUTION_MODE,
        available_stages=["planner", "executor", "verifier", "repair"],
    )
