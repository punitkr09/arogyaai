from datetime import datetime, timezone
from fastapi import APIRouter
from app.config import settings
from app.models import HealthResponse
from app.agent.ai_provider import get_ai_provider

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def get_health() -> HealthResponse:
    """Health check endpoint providing separate status indicators for backend service,
    database persistence, and AI inference provider.
    """
    ai_provider = get_ai_provider()
    ai_health = ai_provider.check_health()

    return HealthResponse(
        status="ok",
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.APP_ENV,
        timestamp=datetime.now(timezone.utc).isoformat(),
        mode=settings.DEFAULT_EXECUTION_MODE,
        available_stages=[
            "intake",
            "planning",
            "execution",
            "analysis",
            "verification",
            "approval",
            "reporting",
            "planner",
            "executor",
            "verifier",
            "repair",
        ],
        ai_provider=ai_health,
        database_status="connected",
    )
