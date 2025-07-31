from typing import List

from fastapi import APIRouter, Body, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from syft_core import Client as SyftBoxClient

from ..dependencies import get_syftbox_client
from ..services.trusted_datasites_service import TrustedDatasitesService
from ...models import ListAutoApproveResponse


router = APIRouter(prefix="/trusted-datasites", tags=["trusted-datasites"])


@router.get(
    "",
    summary="Get the auto-approve list",
    response_model=ListAutoApproveResponse,
    description="Retrieve the list of datasites that are auto-approved",
)
async def get_auto_approved_datasites(
    syftbox_client: SyftBoxClient = Depends(get_syftbox_client),
) -> ListAutoApproveResponse:
    """Get the current list of auto-approved datasites."""
    service = TrustedDatasitesService(syftbox_client)
    return await service.get_auto_approved_datasites()


class SetTrustedDatasitesBody(BaseModel):
    datasites: List[str] = Body(
        ..., description="List of emails to be marked as trusted."
    )


@router.post(
    "",
    summary="Sets the auto-approve list",
    description="Sets the list of emails that are auto-approved. This will replace the existing list.",
)
async def set_auto_approved_datasites(
    data: SetTrustedDatasitesBody,
    syftbox_client: SyftBoxClient = Depends(get_syftbox_client),
) -> JSONResponse:
    """Update the auto-approve list with new emails."""
    service = TrustedDatasitesService(syftbox_client)
    return await service.set_auto_approved_datasites(data.datasites)
