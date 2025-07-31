# Standard library imports
from pathlib import Path
import tempfile
import webbrowser
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field, HttpUrl
import requests
import traceback

# Third-party imports
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    Body,
)
from loguru import logger
from syft_core import Client
from syft_core.url import SyftBoxURL
from syft_rds import init_session
from syft_rds.models.models import DatasetUpdate
from filelock import FileLock
from typing import List, Optional

from backend.dev import debug_delay

from .lib.shopify import shopify_json_to_dataframe
from .sources import ShopifySource, add_dataset_source, find_source


# Local imports
from .models import ListDatasetsResponse, ListJobsResponse, Dataset as DatasetModel
from .models import ListAutoApproveResponse
from .utils import (
    get_auto_approve_list,
    get_auto_approve_file_path,
    save_auto_approve_list,
)


# Dependency for getting client
async def get_client() -> Client:
    try:
        return Client.load()
    except Exception as e:
        logger.error(f"Failed to load client: {e}")
        raise HTTPException(status_code=500, detail="Failed to initialize client")


v1_router = APIRouter(prefix="/v1", dependencies=[Depends(get_client)])

# --------------- Dataset Endpoints ---------------


@v1_router.get(
    "/datasets",
    tags=["datasets"],
    summary="List all datasets",
    description="Retrieve a list of all available datasets on the system",
)
async def get_datasets(
    client: Client = Depends(get_client),
) -> ListDatasetsResponse:
    datasite_client = init_session(client.email)
    datasets = [
        DatasetModel.model_validate(dataset)
        for dataset in datasite_client.dataset.get_all()
    ]
    # TODO: temporary fix - rds' .dataset.create() doesn't take individual files as private and mock inputs
    # Also a None readme is not allowed. So manually fixing them here.
    for dataset in datasets:
        private_file_path = next(dataset.private_path.iterdir(), None)
        dataset.private = SyftBoxURL.from_path(private_file_path, client.workspace)
        mock_file_path = next(dataset.mock_path.iterdir(), None)
        dataset.mock = SyftBoxURL.from_path(mock_file_path, client.workspace)
        dataset.readme = None
        dataset.private_size = (
            private_file_path.stat().st_size if private_file_path else "1 B"
        )
        dataset.mock_size = mock_file_path.stat().st_size if mock_file_path else "1 B"
        dataset.source = find_source(dataset.uid)

    return {"datasets": datasets}


@v1_router.post(
    "/datasets",
    tags=["datasets"],
    status_code=201,
    summary="Create a new dataset",
    description="Create a new dataset with a dataset file, name, and description",
)
async def create_dataset(
    dataset: UploadFile = File(..., description="The dataset file to upload"),
    name: str = Form(
        ..., min_length=1, max_length=100, description="The name of the dataset"
    ),
    description: str = Form(
        ...,
        max_length=350,
        description="Brief description of the dataset",
    ),
    client: Client = Depends(get_client),
) -> DatasetModel:
    try:
        datasite_client = init_session(client.email)

        # Validate file types if needed
        if not dataset.content_type:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type for {dataset.filename}",
            )

        # Save uploaded files
        with tempfile.TemporaryDirectory() as temp_dir:
            real_path = Path(temp_dir) / "real"
            real_path.mkdir(parents=True, exist_ok=True)
            real_dataset_path = real_path / f"{dataset.filename}"
            real_dataset_path.write_bytes(dataset.file.read())
            logger.debug(f"Uploaded dataset temporarily saved to: {real_dataset_path}")

            # TODO auto-generate mock dataset
            mock_path = Path(temp_dir) / "mock"
            mock_path.mkdir(parents=True, exist_ok=True)
            mock_dataset_path = mock_path / f"{dataset.filename}"

            # Hardcoded GitHub raw CSV URL
            github_csv_url = "https://raw.githubusercontent.com/OpenMined/datasets/refs/heads/main/enclave/organic-coop/data/part_1/crop_stock_mock_1.csv"
            try:
                response = requests.get(github_csv_url)
                response.raise_for_status()
                mock_dataset_path.write_bytes(response.content)
                logger.debug(
                    f"Mock dataset downloaded and saved to: {mock_dataset_path}"
                )
            except Exception as e:
                logger.error(f"Failed to download mock dataset: {e}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to download mock dataset from GitHub: {e}",
                )

            # TODO fix None bug in syft_rds/client/local_stores/dataset.py:274 (if not Path(description_path).exists())
            dummy_description_path = Path(temp_dir) / "dummy_description.txt"
            dummy_description_path.touch()

            dataset = datasite_client.dataset.create(
                name=name,
                summary=description,
                path=real_path,
                mock_path=mock_path,
                description_path=dummy_description_path,
                auto_approval=get_auto_approve_list(client),
            )
            logger.debug(f"Dataset created: {dataset}")
            return dataset
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating dataset: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class AddShopifyRequestBody(BaseModel):
    url: HttpUrl
    name: str = Field(min_length=1)
    pat: str = Field(min_length=1)
    description: Optional[str]


@v1_router.post(
    "/datasets/add-from-shopify",
    status_code=201,
    tags=["datasets"],
    summary="Add a dataset from Shopify",
)
async def add_dataset_from_shopify(
    data: AddShopifyRequestBody,
    client: Client = Depends(get_client),
):
    try:
        datasite_client = init_session(client.email)

        # download data from Shopify
        headers = {
            "X-Shopify-Access-Token": data.pat,
            "Content-Type": "application/json",
        }

        response = requests.get(
            f"{data.url}/admin/api/2024-01/products.json", headers=headers
        )

        products_json = response.json()

        dataset_df = shopify_json_to_dataframe(products_json)

        # Save uploaded files
        with tempfile.TemporaryDirectory() as temp_dir:
            real_path = Path(temp_dir) / "real"
            real_path.mkdir(parents=True, exist_ok=True)
            real_dataset_path = real_path / f"shopify.csv"
            real_dataset_path.write_text(dataset_df.to_csv())
            logger.debug(f"Uploaded dataset temporarily saved to: {real_dataset_path}")

            # TODO auto-generate mock dataset
            mock_path = Path(temp_dir) / "mock"
            mock_path.mkdir(parents=True, exist_ok=True)
            mock_dataset_path = mock_path / f"shopify.csv"

            # Hardcoded GitHub raw CSV URL
            github_csv_url = "https://raw.githubusercontent.com/OpenMined/datasets/refs/heads/main/enclave/organic-coop/data/part_1/crop_stock_mock_1.csv"
            try:
                response = requests.get(github_csv_url)
                response.raise_for_status()
                mock_dataset_path.write_bytes(response.content)
                logger.debug(
                    f"Mock dataset downloaded and saved to: {mock_dataset_path}"
                )
            except Exception as e:
                logger.error(f"Failed to download mock dataset: {e}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to download mock dataset from GitHub: {e}",
                )

            # TODO fix None bug in syft_rds/client/local_stores/dataset.py:274 (if not Path(description_path).exists())
            dummy_description_path = Path(temp_dir) / "dummy_description.txt"
            dummy_description_path.touch()

            dataset = datasite_client.dataset.create(
                name=data.name,
                summary=data.description,
                path=real_path,
                mock_path=mock_path,
                description_path=dummy_description_path,
                auto_approval=get_auto_approve_list(client),
            )
            logger.debug(f"Dataset created: {dataset}")

            add_dataset_source(
                str(dataset.uid), ShopifySource(store_url=data.url, pat=data.pat)
            )

            return dataset
    except HTTPException:
        raise
    except Exception as e:
        tb_str = traceback.format_exc()
        logger.error(f"Error creating dataset: {e}\n{tb_str}")
        raise HTTPException(status_code=500, detail=str(e))


class SyncShopifyRequestBody(BaseModel):
    uid: str


@v1_router.post(
    "/datasets/sync-shopify-dataset",
    tags=["datasets"],
    summary="Sync a dataset imported from Shopify",
)
async def sync_shopify_dataset(
    data: SyncShopifyRequestBody,
    client: Client = Depends(get_client),
):
    datasite_client = init_session(client.email)
    source = find_source(data.uid)
    if not source:
        raise HTTPException(
            status_code=500,
            detail="Tried to sync dataset without associated source info",
        )

    # download data from Shopify
    headers = {
        "X-Shopify-Access-Token": source.pat,
        "Content-Type": "application/json",
    }

    response = requests.get(
        f"{source.store_url}/admin/api/2024-01/products.json", headers=headers
    )

    products_json = response.json()

    dataset_df = shopify_json_to_dataframe(products_json)

    with tempfile.TemporaryDirectory() as temp_dir:
        real_path = Path(temp_dir) / "real"
        real_path.mkdir(parents=True, exist_ok=True)
        real_dataset_path = real_path / f"shopify.csv"
        real_dataset_path.write_text(dataset_df.to_csv())
        logger.debug(f"Uploaded dataset temporarily saved to: {real_dataset_path}")

        dataset = datasite_client.dataset.update(DatasetUpdate(uid=data.uid))
        logger.debug(f"Dataset synced: {dataset}")


@v1_router.put(
    "/datasets/{dataset_name}",
    tags=["datasets"],
    summary="Update a dataset",
    description="Update an existing dataset by its name",
)
async def update_dataset(
    dataset_name: str,
):
    pass


@v1_router.delete(
    "/datasets/{dataset_name}",
    tags=["datasets"],
    summary="Delete a dataset",
    description="Delete a dataset by its name",
)
async def delete_dataset(
    dataset_name: str,
    client: Client = Depends(get_client),
) -> JSONResponse:
    try:
        datasite_client = init_session(client.email)
        delete_res = datasite_client.dataset.delete(dataset_name)
        if not delete_res:
            raise HTTPException(
                status_code=404, detail=f"Unable to delete dataset '{dataset_name}'"
            )
        logger.debug(f"Dataset {dataset_name} deleted successfully")
        return JSONResponse(
            content={"message": f"Dataset {dataset_name} deleted successfully"},
            status_code=200,
        )
    except Exception as e:
        logger.error(f"Error deleting dataset {dataset_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@v1_router.get(
    "/datasets/{dataset_uuid}/private",
    tags=["datasets"],
    summary="Download dataset private file",
    description="Download the private file for a specific dataset using its UUID",
)
async def download_dataset_private(
    dataset_uuid: str,
    client: Client = Depends(get_client),
) -> StreamingResponse:
    try:
        datasite_client = init_session(client.email)
        dataset = datasite_client.dataset.get(uid=dataset_uuid)
        if not dataset:
            raise HTTPException(
                status_code=404,
                detail=f"Dataset with UUID '{dataset_uuid}' not found",
            )

        dataset = DatasetModel.model_validate(dataset)
        private_file_path = next(dataset.private_path.iterdir(), None)
        if not private_file_path or not private_file_path.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Private file not found for dataset '{dataset_uuid}'",
            )

        def iterfile():
            with open(private_file_path, "rb") as file:
                yield from file

        extension = private_file_path.suffix
        filename = f"{dataset.name}{extension}"

        return StreamingResponse(
            iterfile(),
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading private file for dataset {dataset_uuid}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------------------------

# --------------- Job Endpoints ---------------


@v1_router.get(
    "/jobs",
    tags=["jobs"],
    summary="List all jobs",
    description="Retrieve a list of all jobs in the system",
)
async def list_jobs(
    client: Client = Depends(get_client),
) -> ListJobsResponse:
    try:
        datasite_client = init_session(client.email)
        jobs = datasite_client.jobs.get_all()
        return ListJobsResponse(jobs=jobs)
    except Exception as e:
        logger.error(f"Error listing jobs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@v1_router.get("/jobs/open-code/{job_uid}")
async def open_job_code(job_uid: str, client: Client = Depends(get_client)):
    datasite_client = init_session(client.email)
    job = datasite_client.jobs.get(uid=job_uid)
    webbrowser.open(f"file://{job.user_code.local_dir}")
    return


# ---------------------------------------------------------------

# -------------------- Auto-approve Endpoints --------------------


@v1_router.post(
    "/auto-approved-datasites",
    tags=["auto-approve"],
    summary="Sets the auto-approve list",
    description="Sets the list of emails that are auto-approved. This will replace the existing list.",
)
async def set_auto_approved_datasites(
    client: Client = Depends(get_client),
    datasites: List[str] = Body(..., description="List of emails to auto-approve"),
) -> JSONResponse:
    # Create a lock file path based on the auto-approve file path

    lock_file_path = get_auto_approve_file_path(client).with_suffix(".lock")
    file_lock = FileLock(str(lock_file_path))

    try:
        # Acquire the lock before modifying the file
        with file_lock:
            # Clean the email list (remove empty strings and whitespace)
            datasites = [datasite.strip() for datasite in datasites if datasite.strip()]

            # Update the auto-approve file with the new list
            save_auto_approve_list(client, datasites)

            # Update datasets with the new auto-approve list
            datasite_client = init_session(client.email)
            datasets = datasite_client.dataset.get_all()
            for dataset in datasets:
                updated_dataset = datasite_client.dataset.update(
                    DatasetUpdate(
                        uid=dataset.uid,
                        auto_approval=datasites,
                    )
                )
                logger.debug(
                    f"Updated dataset {updated_dataset.name} with auto-approval for {datasites}"
                )

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


@v1_router.get(
    "/auto-approved-datasites",
    tags=["auto-approve"],
    summary="Get the auto-approve list",
    response_model=ListAutoApproveResponse,
    description="Retrieve the list of datasites that are auto-approved",
)
async def get_auto_approved_datasites(
    client: Client = Depends(get_client),
) -> ListAutoApproveResponse:
    """
    Get the list of datasites that are auto-approved.
    """
    auto_approved_datasites = get_auto_approve_list(client)
    return ListAutoApproveResponse(datasites=auto_approved_datasites)


# ------------------------------------------------

api_router = APIRouter(prefix="/api")
api_router.include_router(v1_router)


# Add health check endpoint
@api_router.get(
    "/health",
    summary="Health check endpoint",
    description="Check if the API is running properly",
)
async def health_check() -> dict[str, str]:
    return {"status": "healthy"}
