"""
Line Rangers Bot - Main Application Entry Point
"""
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from loguru import logger
import sys

from app.api.v1 import endpoints_router, websocket_router, license_router, admin_license_router, auth_router
from app.api.v1.remote import router as remote_router
from app.api.v1.workflow import router as workflow_router
from app.api.v1.template_set import router as template_set_router, mode_config_router
from app.config import API_HOST, API_PORT
from app.core.database import init_db
from app.services.auth_service import get_auth_service

# Import models to ensure tables are created
from app.models.workflow_template_set import WorkflowTemplateSet, ModeConfiguration

# Configure Loguru
logger.remove()
logger.add(sys.stderr, level="INFO", format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{message}</cyan>")

# Create FastAPI app
app = FastAPI(
    title="Line Rangers Bot",
    description="Web-controlled automation bot for Line Rangers",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for ngrok access
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(endpoints_router)
app.include_router(websocket_router)
app.include_router(license_router)
app.include_router(admin_license_router)
app.include_router(auth_router)
app.include_router(remote_router)
app.include_router(workflow_router)
app.include_router(template_set_router)
app.include_router(mode_config_router)

# Serve static files (frontend)
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/")
async def root():
    """Serve the main dashboard."""
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"message": "Line Rangers Bot API", "docs": "/docs"}


@app.on_event("startup")
async def startup():
    # Initialize database
    await init_db()
    logger.info("📦 Database initialized")
    
    # Ensure default admin exists
    auth_service = get_auth_service()
    await auth_service.ensure_admin_exists()
    
    logger.info("🚀 Line Rangers Bot Server Starting...")
    logger.info(f"📡 API: http://{API_HOST}:{API_PORT}")
    logger.info(f"📖 Docs: http://{API_HOST}:{API_PORT}/docs")


@app.on_event("shutdown")
async def shutdown():
    logger.info("👋 Server shutting down...")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=API_HOST, port=API_PORT, reload=True)
