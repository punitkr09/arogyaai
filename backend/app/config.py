import os
from typing import List
from dotenv import load_dotenv

load_dotenv()


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_raw_db_url = os.getenv("DATABASE_URL", "")
if not _raw_db_url or _raw_db_url == "sqlite:///./arogya.db":
    _resolved_db_url = f"sqlite:///{os.path.join(BASE_DIR, 'arogya.db')}"
elif _raw_db_url.startswith("sqlite:///./"):
    _resolved_db_url = f"sqlite:///{os.path.join(BASE_DIR, _raw_db_url[len('sqlite:///./'):])}"
else:
    _resolved_db_url = _raw_db_url


class Settings:
    APP_NAME: str = os.getenv("APP_NAME", "Arogya AI — Pharmaceutical Operations & Autonomous Intelligence")
    APP_VERSION: str = os.getenv("APP_VERSION", "1.0.0")
    APP_ENV: str = os.getenv("APP_ENV", "development")
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")

    DATABASE_URL: str = _resolved_db_url


    # AI provider configuration (local inference with Ollama by default, or OpenAI-compatible)
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "ollama")  # "ollama", "openai", "semantic"
    AI_BASE_URL: str = os.getenv("AI_BASE_URL", "http://localhost:11434/v1")
    AI_MODEL: str = os.getenv("AI_MODEL", "qwen2.5-coder:7b")
    AI_API_KEY: str = os.getenv("AI_API_KEY", "")
    AI_TIMEOUT_SECONDS: int = int(os.getenv("AI_TIMEOUT_SECONDS", "45"))

    # Legacy LLM config aliases for backwards compatibility
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

    CORS_ORIGINS: str = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
    )
    DEFAULT_EXECUTION_MODE: str = os.getenv("DEFAULT_EXECUTION_MODE", "operations")
    # Configurable business reference date (dataset snapshot is 2026-11-16)
    BUSINESS_REFERENCE_DATE: str = os.getenv("BUSINESS_REFERENCE_DATE", "2026-11-16")

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()


def get_business_date() -> datetime:
    """Returns the configured business reference date as timezone-aware UTC datetime."""
    from datetime import datetime, timezone
    try:
        dt = datetime.fromisoformat(settings.BUSINESS_REFERENCE_DATE)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return datetime(2026, 11, 16, 0, 0, 0, tzinfo=timezone.utc)

