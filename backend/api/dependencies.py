from fastapi import HTTPException
from loguru import logger
from syft_core import Client


async def get_syftbox_client() -> Client:
    """Dependency for getting the SyftBox client"""
    try:
        return Client.load()
    except Exception as e:
        logger.error(f"Failed to load SyftBox client: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to initialize SyftBox client"
        )
