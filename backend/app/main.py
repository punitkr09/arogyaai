from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.seed import seed_database
from app.routers import health_router, workflow_router
from app.routers.dashboard import router as dashboard_router
from app.routers.inventory import router as inventory_router
from app.routers.agent import router as agent_router
from app.routers.approvals import router as approvals_router
from app.routers.demo import router as demo_router, admin_router
from app.routers.simulator import router as simulator_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database is created and seeded upon server start
    seed_database()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Arogya AI: Pharmaceutical Inventory Intelligence & Autonomous Operations Agent. "
        "Provides decision support for batch recalls, expiry risks, cold-chain temperature excursions, "
        "and critical medicine shortages with deterministic verification and human approval gates."
    ),
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route handlers
app.include_router(health_router)
app.include_router(dashboard_router)
app.include_router(inventory_router)
app.include_router(agent_router)
app.include_router(approvals_router)
app.include_router(demo_router)
app.include_router(admin_router)
app.include_router(workflow_router)
app.include_router(simulator_router)


@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "online",
        "docs_url": "/docs",
        "health_check": "/api/health",
        "dashboard_summary": "/api/dashboard/summary",
        "inventory_batches": "/api/inventory/batches",
        "agent_workspace": "/api/agent/run",
        "approvals_center": "/api/approvals",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
