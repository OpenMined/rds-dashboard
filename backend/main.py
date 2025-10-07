import os
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from pydantic import BaseModel
from syft_core import Client as SyftBoxClient

from backend.lib.html_static_files import HTMLStaticFiles

from .api import api_router
from .config import get_settings


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup/shutdown"""
    # Startup
    try:
        syftbox_client = SyftBoxClient.load()
        logger.info(
            f"Starting client with email: {syftbox_client.email}. \n"
            f"Config path: {syftbox_client.config_path} \n"
            f"Workspace dir: {syftbox_client.workspace.data_dir}"
        )
    except Exception as e:
        logger.warning(f"Failed to load SyftBox client during startup: {e}")
        logger.info("Client will be loaded on first request")

    yield

    # Shutdown logic (if needed)


app = FastAPI(
    title="Farming Coop SyftBox App",
    description="API for managing farming cooperative datasets and jobs",
    version=get_settings().app_version,
    debug=get_settings().debug,
    lifespan=lifespan,
    responses={
        500: {"model": ErrorResponse, "description": "Internal Server Error"},
        400: {"model": ErrorResponse, "description": "Bad Request"},
    },
)

API_PORT = os.environ.get("API_PORT") or "8000"
allow_origins = [f"http://localhost:{API_PORT}", f"http://127.0.0.1:{API_PORT}"]

if get_settings().debug:
    allow_origins.append("http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.mount("/", HTMLStaticFiles(directory="frontend/out", html=True, check_dir=False))
