import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from pydantic import BaseModel

from backend.lib.html_static_files import HTMLStaticFiles

from .api import api_router
from .api.client_factory import create_rds_client
from .config import get_settings


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup/shutdown"""
    # Startup
    try:
        # Initialize RDS client once during startup and store in app state
        app.state.rds_client = create_rds_client()
        api_port = os.environ.get("API_PORT", "unknown")
        logger.info(f"API Port: {api_port}")
    except Exception as e:
        logger.warning(f"Failed to initialize RDS client during startup: {e}")
        logger.info("Client will be loaded on first request")

    yield

    # Shutdown logic
    if hasattr(app.state, "rds_client") and app.state.rds_client:
        try:
            app.state.rds_client.close()
            logger.info("RDS client closed")
        except Exception as e:
            logger.debug(f"Error closing RDS client: {e}")


app = FastAPI(
    title="Syft RDS Dashboard",
    description="Dashboard for managing Syft remote data science datasets and jobs",
    version=get_settings().app_version,
    debug=get_settings().debug,
    lifespan=lifespan,
    responses={
        500: {"model": ErrorResponse, "description": "Internal Server Error"},
        400: {"model": ErrorResponse, "description": "Bad Request"},
    },
)

# CORS configuration
# In dev mode: frontend is on API_PORT - 5000
# In production: frontend is served on same port as API
API_PORT = int(os.environ.get("API_PORT") or "8000")

if get_settings().debug:
    # Dev mode: calculate frontend port from backend port
    FRONTEND_PORT = API_PORT - 5000
    logger.debug(f"Debug mode: Allowing CORS from frontend on port {FRONTEND_PORT}")
    allow_origins = [
        f"http://localhost:{FRONTEND_PORT}",
        f"http://127.0.0.1:{FRONTEND_PORT}",
    ]
else:
    # Production: frontend served on same port as API
    allow_origins = [f"http://localhost:{API_PORT}", f"http://127.0.0.1:{API_PORT}"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

# Serve static frontend files in production mode
# In development, the frontend runs as a separate Next.js dev server
if not get_settings().debug:
    app.mount(
        "/", HTMLStaticFiles(directory="frontend/out", html=True, check_dir=False)
    )
