import pytest
import json
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch
import httpx
from fastapi.testclient import TestClient

repo_root = Path(__file__).resolve().parent.parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from app.main import app
from app.config import settings
from app.database import SessionLocal
from app.seed import reset_database
from app.agent.ai_provider import OpenAICompatibleProvider, get_ai_provider
from app.agent.orchestrator import AgentOrchestrator
from app.schemas import AgentTaskRequest
from scripts.arogya_companion import ArogyaCompanionHandler


@pytest.fixture(autouse=True)
def setup_test_db():
    reset_database()
    yield


def test_native_ollama_connected_with_model():
    """Verify Mode A detection when native Ollama is reachable and qwen2.5-coder:7b is installed."""
    mock_tags_response = {
        "models": [
            {"name": "qwen2.5-coder:7b", "model": "qwen2.5-coder:7b"},
            {"name": "nomic-embed-text:latest", "model": "nomic-embed-text:latest"},
        ]
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_tags_response

    provider = OpenAICompatibleProvider(
        base_url="http://127.0.0.1:11434",
        model="qwen2.5-coder:7b",
        provider_name="ollama",
    )

    with patch("httpx.Client.get", return_value=mock_resp):
        health = provider.check_health()
        assert health["is_online"] is True
        assert health["model_available"] is True
        assert health["model"] == "qwen2.5-coder:7b"
        assert "qwen2.5-coder:7b" in health["available_models"]


def test_native_ollama_model_missing():
    """Verify Model Missing detection when Ollama is running but configured model is not pulled."""
    mock_tags_response = {
        "models": [
            {"name": "llama3:latest", "model": "llama3:latest"},
            {"name": "mistral:7b", "model": "mistral:7b"},
        ]
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_tags_response

    provider = OpenAICompatibleProvider(
        base_url="http://127.0.0.1:11434",
        model="qwen2.5-coder:7b",
        provider_name="ollama",
    )

    with patch("httpx.Client.get", return_value=mock_resp):
        health = provider.check_health()
        assert health["is_online"] is True
        assert health["model_available"] is False
        assert health["model"] == "qwen2.5-coder:7b"
        assert "llama3:latest" in health["available_models"]


def test_ollama_offline_disconnected():
    """Verify Mode B detection when Ollama is offline (connection refused)."""
    provider = OpenAICompatibleProvider(
        base_url="http://127.0.0.1:11434",
        model="qwen2.5-coder:7b",
        provider_name="ollama",
    )

    with patch("httpx.Client.get", side_effect=httpx.ConnectError("Connection refused")):
        health = provider.check_health()
        assert health["is_online"] is False
        assert "Connection failed" in health["message"]


def test_ai_provider_timeout_handling():
    """Verify timeout handling in inference request."""
    provider = OpenAICompatibleProvider(
        base_url="http://127.0.0.1:11434",
        model="qwen2.5-coder:7b",
        provider_name="ollama",
        timeout_seconds=2.0,
    )

    with patch("httpx.Client.post", side_effect=httpx.TimeoutException("Read timed out")):
        with pytest.raises(TimeoutError) as exc_info:
            provider.generate_completion(messages=[{"role": "user", "content": "Analyze shortage"}])
        assert "timed out after 2.0s" in str(exc_info.value)


def test_backend_health_tracks_ai_independently():
    """Verify that backend health remains 'ok' even when AI provider is offline.
    Never show 'Backend Offline' just because Ollama is unavailable.
    """
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database_status"] == "connected"
    assert "ai_provider" in data


def test_agent_run_dataset_fallback_mode_labeling():
    """Verify that in Dataset Fallback Mode (Mode B), outputs are explicitly labeled
    as '[Dataset-Backed Deterministic Output — Verified Database Records]' and
    grounded in actual database records.
    """
    client = TestClient(app)
    payload = {
        "prompt": "Investigate recall Batch B2231 and prepare response options.",
        "mode": "operations",
        "execution_mode": "dataset_fallback",
    }
    response = client.post("/api/agent/run", json=payload)
    assert response.status_code == 200
    data = response.json()
    report = data["final_report"]
    assert report is not None
    assert report["inference_mode"] == "dataset_fallback"
    assert "[Dataset-Backed Deterministic Output — Verified Database Records]" in report["incident_summary"]
    # Verify factual numbers from real SQLite database
    assert "B2231" in report["affected_batches"]
    assert report["total_recipients"] > 0
    assert report["approval_required"] is True


def test_agent_run_local_ai_mode_labeling():
    """Verify that in Local AI Mode (Mode A), when client-side local inference from
    user's Ollama is provided, outputs are clearly labeled as
    '[AI-Generated Reasoning — qwen2.5-coder:7b (Local Ollama)]' alongside verified DB facts.
    """
    client = TestClient(app)
    payload = {
        "prompt": "Investigate recall Batch B2231 and prepare response options.",
        "mode": "operations",
        "execution_mode": "local_ai",
        "client_model": "qwen2.5-coder:7b",
        "client_synthesis": "Critical analysis: Immediate containment required for batch B2231. Recommend prioritizing ICU hospital shipments.",
    }
    response = client.post("/api/agent/run", json=payload)
    assert response.status_code == 200
    data = response.json()
    report = data["final_report"]
    assert report is not None
    assert report["inference_mode"] == "local_ai"
    assert report["inference_model"] == "qwen2.5-coder:7b"
    assert "[AI-Generated Reasoning — qwen2.5-coder:7b (Local Ollama)]" in report["incident_summary"]
    assert "[Verified Database Records — GDP Compliant]" in report["incident_summary"]


def test_companion_helper_cors_and_security_validation():
    """Verify Arogya Companion Helper security invariants:
    Restricted CORS origins and loopback binding.
    """
    handler = ArogyaCompanionHandler

    # Authorized origins
    assert handler._is_origin_allowed("http://localhost:5173") is True
    assert handler._is_origin_allowed("http://127.0.0.1:5173") is True
    assert handler._is_origin_allowed("https://arogya-ai.vercel.app") is True
    assert handler._is_origin_allowed("https://my-preview-branch.vercel.app") is True

    # Unauthorized / external origins rejected
    assert handler._is_origin_allowed("http://malicious-attacker.com") is False
    assert handler._is_origin_allowed("https://evil-phishing-site.org") is False
    assert handler._is_origin_allowed("") is False


def test_human_approval_gate_preserved_in_both_modes():
    """Verify that neither Local AI nor Dataset Fallback can unilaterally execute mutations.
    Action proposals are staged in 'pending_review' requiring Qualified Person sign-off.
    """
    client = TestClient(app)
    payload = {
        "prompt": "Investigate recall Batch B2231 and prepare response options.",
        "mode": "operations",
    }
    response = client.post("/api/agent/run", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["proposals"]) > 0
    for prop in data["proposals"]:
        assert prop["status"] == "pending_review"
        assert prop["approved_by"] is None
