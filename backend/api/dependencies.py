from fastapi import HTTPException, Request
from loguru import logger
from syft_core import Client
from syft_rds import RDSClient

from .client_factory import create_rds_client


async def get_syftbox_client() -> Client:
    """Dependency for getting the SyftBox client"""
    try:
        return Client.load()
    except Exception as e:
        logger.error(f"Failed to load SyftBox client: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to initialize SyftBox client"
        )


async def get_rds_client(request: Request) -> RDSClient:
    """Dependency for getting the cached RDS client"""
    if hasattr(request.app.state, "rds_client") and request.app.state.rds_client:
        return request.app.state.rds_client

    try:
        return create_rds_client()
    except Exception as e:
        logger.error(f"Failed to initialize RDS client: {e}")
        raise HTTPException(status_code=500, detail="Failed to initialize RDS client")
