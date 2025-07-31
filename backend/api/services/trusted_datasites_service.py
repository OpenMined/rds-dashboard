# backend/api/services/auto_approve_service.py
from typing import List

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from filelock import FileLock
from loguru import logger
from syft_core import Client as SyftBoxClient
from syft_rds import init_session
from syft_rds.models.models import DatasetUpdate

from ...models import ListAutoApproveResponse
from ...utils import (
    get_auto_approve_file_path,
    get_auto_approve_list,
    save_auto_approve_list,
)


class TrustedDatasitesService:
    """Service class for auto-approval operations."""

    def __init__(self, syftbox_client: SyftBoxClient):
        self.syftbox_client = syftbox_client
        self.rds_client = init_session(syftbox_client.email)

    async def set_auto_approved_datasites(self, datasites: List[str]) -> JSONResponse:
        """Set the list of auto-approved datasites."""
        # Create a lock file for thread safety
        lock_file_path = get_auto_approve_file_path(self.syftbox_client).with_suffix(
            ".lock"
        )
        file_lock = FileLock(str(lock_file_path))

        try:
            with file_lock:
                # Clean the email list
                datasites = [
                    datasite.strip() for datasite in datasites if datasite.strip()
                ]

                # Save the new auto-approve list
                save_auto_approve_list(self.syftbox_client, datasites)

                # Update all existing datasets with the new auto-approve list
                await self._update_datasets_auto_approval(datasites)

                logger.debug(f"Updated auto-approve list with {len(datasites)} emails")
                return JSONResponse(
                    content={
                        "message": f"Auto-approve list updated with {len(datasites)} emails"
                    },
                    status_code=200,
                )

        except Exception as e:
            logger.error(f"Error in auto-approve operation: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_auto_approved_datasites(self) -> ListAutoApproveResponse:
        """Get the current list of auto-approved datasites."""
        try:
            auto_approved_datasites = get_auto_approve_list(self.syftbox_client)
            return ListAutoApproveResponse(datasites=auto_approved_datasites)
        except Exception as e:
            logger.error(f"Error getting auto-approve list: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def _update_datasets_auto_approval(self, datasites: List[str]) -> None:
        """Update all datasets with new auto-approval list."""
        datasets = self.rds_client.dataset.get_all()

        for dataset in datasets:
            try:
                updated_dataset = self.rds_client.dataset.update(
                    DatasetUpdate(
                        uid=dataset.uid,
                        auto_approval=datasites,
                    )
                )
                logger.debug(
                    f"Updated dataset {updated_dataset.name} with "
                    f"auto-approval for {len(datasites)} datasites"
                )
            except Exception as e:
                logger.error(
                    f"Failed to update dataset {dataset.name} "
                    f"with auto-approval: {e}"
                )
