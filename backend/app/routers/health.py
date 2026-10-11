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


@router.get("/ai/status")
async def get_ai_status():
    """Live health check for AI inference provider and configured local Ollama model."""
    ai_provider = get_ai_provider()
    if hasattr(ai_provider, "_cached_online"):
        ai_provider._cached_online = None

    health_info = ai_provider.check_health()
    is_online = bool(health_info.get("is_online", False))
    model_avail = bool(health_info.get("model_available", False))

    if is_online and model_avail:
        status_label = "Connected — model available"
    elif is_online and not model_avail:
        status_label = "Model missing or unavailable"
    else:
        status_label = "Offline — Ollama unavailable"

    return {
        "status_label": status_label,
        "is_online": is_online,
        "model_available": model_avail,
        "provider": health_info.get("provider", settings.AI_PROVIDER),
        "model": health_info.get("model", settings.AI_MODEL),
        "latency_ms": health_info.get("latency_ms", 0.0),
        "available_models": health_info.get("available_models", []),
        "message": health_info.get("message", ""),
        "configured_base_url": settings.OLLAMA_BASE_URL or settings.AI_BASE_URL,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
