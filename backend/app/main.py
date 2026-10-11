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
from app.routers.products import router as products_router
from app.routers.customers import router as customers_router
from app.routers.suppliers import router as suppliers_router
from app.routers.batches import router as batches_router
from app.routers.dispatches import router as dispatches_router
from app.routers.purchase_orders import router as purchase_orders_router
from app.routers.recalls import router as recalls_router
from app.routers.temperature_logs import router as temperature_logs_router
from app.routers.analytics import router as analytics_router
from app.routers.alerts import router as alerts_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database is created and seeded upon server start
    seed_database()
    try:
        import sys
        from pathlib import Path
        backend_dir = Path(__file__).resolve().parent.parent
        if str(backend_dir / "scripts") not in sys.path:
            sys.path.insert(0, str(backend_dir / "scripts"))
        from import_datasets import import_all_datasets
        from app.database import SessionLocal
        from app.db_models import Dispatch
        db = SessionLocal()
        try:
            if db.query(Dispatch).count() < 1000:
                import_all_datasets(db)
        finally:
            db.close()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Dataset auto-sync on startup: {e}")
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
app.include_router(products_router)
app.include_router(customers_router)
app.include_router(suppliers_router)
app.include_router(batches_router)
app.include_router(dispatches_router)
app.include_router(purchase_orders_router)
app.include_router(recalls_router)
app.include_router(temperature_logs_router)
app.include_router(analytics_router)
app.include_router(alerts_router)


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
