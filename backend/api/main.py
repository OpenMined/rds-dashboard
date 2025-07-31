from typing import Dict
from fastapi import APIRouter
from .routers import datasets, jobs, trusted_datasites


v1_router = APIRouter(prefix="/v1")

v1_router.include_router(datasets.router)
v1_router.include_router(jobs.router)
v1_router.include_router(trusted_datasites.router)

api_router = APIRouter(prefix="/api")
api_router.include_router(v1_router)


@api_router.get(
    "/health",
    summary="Health check endpoint",
    description="Check if the API is running properly",
    response_model=Dict[str, str],
    tags=["health"],
)
async def health_check() -> Dict[str, str]:
    return {"status": "healthy"}


__all__ = ["api_router"]
