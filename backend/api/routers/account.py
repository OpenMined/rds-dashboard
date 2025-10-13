"""Router for account/client information endpoints."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from syft_rds import RDSClient

from ..dependencies import get_rds_client


router = APIRouter(prefix="/account", tags=["account"])


class AccountInfoResponse(BaseModel):
    """Response model for account information."""

    email: str
    is_admin: bool
    host_datasite_url: str


@router.get(
    "",
    summary="Get account information",
    response_model=AccountInfoResponse,
    description="Retrieve the current account's email and admin status",
)
async def get_account_info(
    rds_client: RDSClient = Depends(get_rds_client),
) -> AccountInfoResponse:
    """Get the current account information."""
    return AccountInfoResponse(
        email=rds_client.email,
        is_admin=rds_client.is_admin,
        host_datasite_url=rds_client.host_datasite_url,
    )
