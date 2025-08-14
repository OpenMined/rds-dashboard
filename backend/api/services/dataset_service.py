import tempfile
import webbrowser
from pathlib import Path
from typing import Iterator, Literal, Optional

import requests
from fastapi import HTTPException, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from loguru import logger
from syft_core import Client as SyftBoxClient
from syft_core.url import SyftBoxURL
from syft_rds import init_session
from syft_rds.client.exceptions import ItemNotFoundError
from syft_datasets import SyftDatasetManager

from ...models import Dataset as DatasetModel
from ...models import ListDatasetsResponse
from ...sources import find_source
from ...utils import get_auto_approve_list


class DatasetService:
    """Service class for dataset-related operations."""

    def __init__(self, syftbox_client: SyftBoxClient):
        self.syftbox_client = syftbox_client
        self.rds_client = init_session(syftbox_client.email)
        self.dataset_manager = SyftDatasetManager(syftbox_client)

    async def list_datasets(self) -> ListDatasetsResponse:
        """List all datasets with proper formatting."""
        datasets = [
            DatasetModel.model_validate(dataset)
            for dataset in self.dataset_manager.get_all()
        ]

        # Process datasets to fix temporary issues with RDS
        for dataset in datasets:
            # private_file_path = next(dataset.private_dir.iterdir(), None)
            # dataset.private = SyftBoxURL.from_path(
            #     private_file_path, self.syftbox_client.workspace
            # )

            # mock_file_path = next(dataset.mock_dir.iterdir(), None)
            # dataset.mock = SyftBoxURL.from_path(
            #     mock_file_path, self.syftbox_client.workspace
            # )

            dataset.source = find_source(dataset.uid)

        return ListDatasetsResponse(datasets=datasets)

    async def create_dataset(
        self,
        dataset_file: UploadFile,
        name: str,
        description: str,
        mock_dataset_file: Optional[UploadFile] = None,
    ) -> DatasetModel:
        """Create a new dataset from uploaded file."""
        try:
            # Validate file type
            if not dataset_file.content_type:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid file type for {dataset_file.filename}",
                )

            with tempfile.TemporaryDirectory() as temp_dir:
                # Save the private dataset to a temporary directory
                private_path = Path(temp_dir) / "real"
                private_path.mkdir(parents=True, exist_ok=True)
                private_dataset_path = private_path / dataset_file.filename
                private_dataset_path.write_bytes(await dataset_file.read())
                logger.debug(
                    f"Uploaded dataset temporarily saved to: {private_dataset_path}"
                )

                # Save the mock dataset to a temporary directory
                mock_path = Path(temp_dir) / "mock"
                mock_path.mkdir(parents=True, exist_ok=True)

                if mock_dataset_file:
                    mock_dataset_path = mock_path / mock_dataset_file.filename
                    mock_dataset_path.write_bytes(await mock_dataset_file.read())
                    logger.debug(f"Uploaded mock dataset saved to: {mock_dataset_path}")
                else:
                    # Fall back to downloading a mock dataset
                    # NOTE: this is a temporary solution until we can automatically generate it
                    mock_dataset_path = mock_path / dataset_file.filename
                    await self._download_mock_dataset(mock_dataset_path)

                # Create a dummy readme file
                dummy_readme_path = Path(temp_dir) / "dummy_readme.md"
                dummy_readme_path.touch()

                dataset = self.dataset_manager.create(
                    name=name,
                    summary=description,
                    private_path=private_path,
                    mock_path=mock_path,
                    readme_path=dummy_readme_path,
                )

                logger.debug(f"Dataset created: {dataset}")
                return DatasetModel.model_validate(dataset)

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error creating dataset: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    # async def update_dataset(self, dataset_update: DatasetUpdate) -> DatasetModel:
    #     return self.rds_client.dataset.update(dataset_update)

    async def delete_dataset(self, dataset_name: str) -> JSONResponse:
        """Delete a dataset by name."""
        try:
            self.dataset_manager.delete(dataset_name, require_confirmation=False)

            logger.debug(f"Dataset {dataset_name} deleted successfully")
            return JSONResponse(
                content={"message": f"Dataset {dataset_name} deleted successfully"},
                status_code=200,
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting dataset {dataset_name}: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def download_private_file(self, dataset_uuid: str) -> StreamingResponse:
        """Download the private file for a dataset."""
        try:
            dataset = self.rds_client.dataset.get(uid=dataset_uuid)
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

            def iterfile() -> Iterator[bytes]:
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
            logger.error(
                f"Error downloading private file for dataset {dataset_uuid}: {e}"
            )
            raise HTTPException(status_code=500, detail=str(e))

    async def _download_mock_dataset(self, mock_dataset_path: Path) -> None:
        """Download mock dataset from GitHub (temporary solution)."""
        # TODO: Replace with auto-generated mock dataset
        github_csv_url = "https://raw.githubusercontent.com/OpenMined/datasets/refs/heads/main/enclave/organic-coop/data/part_1/crop_stock_mock_1.csv"
        try:
            response = requests.get(github_csv_url)
            response.raise_for_status()
            mock_dataset_path.write_bytes(response.content)
            logger.debug(f"Mock dataset downloaded and saved to: {mock_dataset_path}")
        except Exception as e:
            logger.error(f"Failed to download mock dataset: {e}")
            raise HTTPException(
                status_code=400,
                detail=f"Failed to download mock dataset from GitHub: {e}",
            )

    async def open_local_directory(
        self, dataset_uid: str, which: Literal["private", "mock"] = "private"
    ):
        dataset = self.rds_client.dataset.get(uid=dataset_uid)
        if not dataset:
            raise ItemNotFoundError(f"Dataset with uid {dataset_uid} does not exist")

        path = dataset.private_path
        if which == "mock":
            path = dataset.mock_path

        webbrowser.open(f"file://{path}")
