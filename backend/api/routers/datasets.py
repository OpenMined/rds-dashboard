import traceback
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from loguru import logger
from pydantic import BaseModel, Field, HttpUrl
from syft_core import Client as SyftBoxClient
from syft_rds.models.models import DatasetUpdate
from syft_rds.client.exceptions import DatasetExistsError

from backend.dev import debug_delay

from ..dependencies import get_syftbox_client
from ..services.dataset_service import DatasetService
from ..services.shopify_service import ShopifyService
from ...models import ListDatasetsResponse, Dataset as DatasetModel


router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.get(
    "",
    summary="List all datasets",
    description="Retrieve a list of all available datasets on the system",
    response_model=ListDatasetsResponse,
)
async def get_datasets(
    syftbox_client: SyftBoxClient = Depends(get_syftbox_client),
) -> ListDatasetsResponse:
    """Get all datasets available in the system."""
    service = DatasetService(syftbox_client)
    return await service.list_datasets()


@router.post(
    "/create-from-file",
    status_code=201,
    summary="Create a new dataset",
    description="Create a new dataset with a dataset file, name, and description",
    response_model=DatasetModel,
)
async def dataset_create_from_file(
    dataset: UploadFile = File(..., description="The dataset file to upload"),
    name: str = Form(
        ..., min_length=1, max_length=100, description="The name of the dataset"
    ),
    description: str = Form(
        ...,
        max_length=350,
        description="Brief description of the dataset",
    ),
    syftbox_client: SyftBoxClient = Depends(get_syftbox_client),
) -> DatasetModel:
    """Create a new dataset from an uploaded file."""
    service = DatasetService(syftbox_client)
    return await service.create_dataset(dataset, name, description)


class ImportShopifyRequestBody(BaseModel):
    """Request body for adding a dataset from Shopify."""

    url: HttpUrl
    name: str = Field(min_length=1)
    pat: str = Field(min_length=1)
    description: Optional[str] = None


@router.post(
    "/import-from-shopify",
    status_code=201,
    summary="Add a dataset from Shopify",
    response_model=DatasetModel,
)
async def dataset_import_from_shopify(
    data: ImportShopifyRequestBody,
    syftbox_client: SyftBoxClient = Depends(get_syftbox_client),
) -> DatasetModel:
    """Create a dataset by importing data from a Shopify store."""
    try:
        shopify_service = ShopifyService(syftbox_client)
        return await shopify_service.create_dataset_from_shopify(
            url=str(data.url),
            name=data.name,
            pat=data.pat,
            description=data.description,
        )
    except HTTPException:
        raise
    except Exception as e:
        tb_str = traceback.format_exc()
        logger.error(f"Error creating Shopify dataset: {e}\n{tb_str}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put(
    "/sync-shopify-dataset/{dataset_uid}",
    summary="Sync a dataset imported from Shopify",
)
async def dataset_sync_shopify(
    dataset_uid: str,
    syftbox_client: SyftBoxClient = Depends(get_syftbox_client),
):
    """Sync an existing dataset with its Shopify source."""
    shopify_service = ShopifyService(syftbox_client)
    dataset = await shopify_service.sync_dataset(dataset_uid)
    return {"dataset": dataset}


class UpdateDatasetRequestBody(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


@router.put(
    "/update/{dataset_uid}",
    summary="Update a dataset",
    description="Update an existing dataset by its name",
)
async def update_dataset(
    dataset_uid: str,
    data: UpdateDatasetRequestBody,
    syftbox_client: SyftBoxClient = Depends(get_syftbox_client),
):
    service = DatasetService(syftbox_client)
    try:
        return await service.update_dataset(
            DatasetUpdate(uid=dataset_uid, name=data.name, summary=data.description)
        )
    except DatasetExistsError:
        raise HTTPException(
            status_code=409,
            detail={
                "type": "FormFieldError",
                "loc": "name",
                "message": "A dataset with this name already exists",
            },
        )
    except Exception as e:
        logger.error(type(e), e)
        raise HTTPException(status_code=500, detail=f"Couldn't update the dataset: {e}")


@router.delete(
    "/{dataset_name}",
    summary="Delete a dataset",
    description="Delete a dataset by its name",
)
async def delete_dataset(
    dataset_name: str,
    syftbox_client: SyftBoxClient = Depends(get_syftbox_client),
) -> JSONResponse:
    """Delete a dataset by name."""
    service = DatasetService(syftbox_client)
    return await service.delete_dataset(dataset_name)


@router.get(
    "/{dataset_uuid}/private",
    summary="Download dataset private file",
    description="Download the private file for a specific dataset using its UUID",
)
async def download_dataset_private(
    dataset_uuid: str,
    syftbox_client: SyftBoxClient = Depends(get_syftbox_client),
) -> StreamingResponse:
    """Download the private file of a dataset."""
    service = DatasetService(syftbox_client)
    return await service.download_private_file(dataset_uuid)


@router.get("/open-local-directory/{dataset_uid}")
async def open_local_directory(
    dataset_uid: str,
    syftbox_client: SyftBoxClient = Depends(get_syftbox_client),
):
    service = DatasetService(syftbox_client)
    await service.open_local_directory(dataset_uid)
    return {"message": f"Opened local directory for dataset {dataset_uid}"}
