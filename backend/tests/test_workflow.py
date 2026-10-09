import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_workflow_templates():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/workflow/templates")
        assert response.status_code == 200
        templates = response.json()
        assert len(templates) >= 1
        assert "problem_statement" in templates[0]


@pytest.mark.asyncio
async def test_workflow_run_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "problem_statement": "Optimize cache stampede prevention across microservices",
            "mode": "demo",
            "max_repair_iterations": 2,
        }
        response = await client.post("/api/workflow/run", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["is_demo"] is True
        assert data["demo_badge"] == "DEMO SIMULATION"
        assert len(data["stages"]) == 4
        stage_names = [s["name"] for s in data["stages"]]
        assert "planner" in stage_names
        assert "executor" in stage_names
        assert "verifier" in stage_names
        assert "repair" in stage_names
        assert len(data["timeline"]) > 0
        assert data["results"]["final_status"] == "success"
        assert len(data["limitations"]) > 0


@pytest.mark.asyncio
async def test_workflow_validation_error():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Problem statement too short
        payload = {"problem_statement": "hi"}
        response = await client.post("/api/workflow/run", json=payload)
        assert response.status_code == 422
