# backend/api/services/dataset_service.py
from pathlib import Path
import tempfile
from typing import Iterator, Literal, Optional
import webbrowser

from fastapi import HTTPException, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from loguru import logger
import requests
from syft_core import Client as SyftBoxClient
from syft_core.url import SyftBoxURL
from syft_rds import init_session
from syft_rds.models.models import DatasetUpdate
from syft_rds.client.exceptions import DatasetNotFoundError

from ...models import ListDatasetsResponse, Dataset as DatasetModel
from ...sources import find_source
from ...utils import get_auto_approve_list


class DatasetService:
    """Service class for dataset-related operations."""

    def __init__(self, syftbox_client: SyftBoxClient):
        self.syftbox_client = syftbox_client
        self.rds_client = init_session(syftbox_client.email)

    async def list_datasets(self) -> ListDatasetsResponse:
        """List all datasets with proper formatting."""
        datasets = [
            DatasetModel.model_validate(dataset)
            for dataset in self.rds_client.dataset.get_all()
        ]

        # Process datasets to fix temporary issues with RDS
        for dataset in datasets:
            private_file_path = next(dataset.private_path.iterdir(), None)
            dataset.private = SyftBoxURL.from_path(
                private_file_path, self.syftbox_client.workspace
            )

            mock_file_path = next(dataset.mock_path.iterdir(), None)
            dataset.mock = SyftBoxURL.from_path(
                mock_file_path, self.syftbox_client.workspace
            )

            dataset.readme = None
            dataset.private_size = (
                private_file_path.stat().st_size if private_file_path else "1 B"
            )
            dataset.mock_size = (
                mock_file_path.stat().st_size if mock_file_path else "1 B"
            )
            dataset.source = find_source(dataset.uid)

        return ListDatasetsResponse(datasets=datasets)

    async def create_dataset(
        self,
        dataset_files: list[UploadFile],
        name: str,
        description: str,
        mock_dataset_files: Optional[list[UploadFile]] = None,
    ) -> DatasetModel:
        """Create a new dataset from uploaded file."""
        try:
            # Validate that we have at least one file
            if not dataset_files:
                raise HTTPException(
                    status_code=400,
                    detail="No dataset files provided",
                )

            with tempfile.TemporaryDirectory() as temp_dir:
                # Save real dataset files preserving directory structure
                real_path = Path(temp_dir) / "real"
                real_path.mkdir(parents=True, exist_ok=True)

                for f in dataset_files:
                    # Get the relative path from the filename (includes directory structure)
                    file_path = f.filename
                    # Create full path
                    full_path = real_path / file_path
                    # Create parent directories if needed
                    full_path.parent.mkdir(parents=True, exist_ok=True)
                    # Write file content
                    full_path.write_bytes(await f.read())
                    logger.debug(f"Saved file: {full_path}")

                # Create mock dataset
                mock_path = Path(temp_dir) / "mock"
                mock_path.mkdir(parents=True, exist_ok=True)

                if mock_dataset_files:
                    # Save mock dataset files preserving directory structure
                    for f in mock_dataset_files:
                        # Get the relative path from the filename
                        file_path = f.filename
                        # Create full path
                        full_path = mock_path / file_path
                        # Create parent directories if needed
                        full_path.parent.mkdir(parents=True, exist_ok=True)
                        # Write file content
                        full_path.write_bytes(await f.read())
                        logger.debug(f"Saved mock file: {full_path}")
                else:
                    # Fall back to downloading mock data (temporary solution)
                    # Use the first dataset file's name
                    first_file_name = Path(dataset_files[0].filename).name
                    mock_dataset_path = mock_path / first_file_name
                    await self._download_mock_dataset(mock_dataset_path)

                # Create dummy description file (temporary fix for RDS bug)
                dummy_description_path = Path(temp_dir) / "dummy_description.txt"
                dummy_description_path.touch()

                # Create dataset in RDS
                dataset = self.rds_client.dataset.create(
                    name=name,
                    summary=description,
                    path=real_path,
                    mock_path=mock_path,
                    description_path=dummy_description_path,
                    auto_approval=get_auto_approve_list(self.syftbox_client),
                )

                logger.debug(f"Dataset created: {dataset}")
                return DatasetModel.model_validate(dataset)

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error creating dataset: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def update_dataset(self, dataset_update: DatasetUpdate) -> DatasetModel:
        return self.rds_client.dataset.update(dataset_update)

    async def delete_dataset(self, dataset_name: str) -> JSONResponse:
        """Delete a dataset by name."""
        try:
            delete_res = self.rds_client.dataset.delete(dataset_name)
            if not delete_res:
                raise HTTPException(
                    status_code=404, detail=f"Unable to delete dataset '{dataset_name}'"
                )

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
            raise DatasetNotFoundError(f"Dataset with uid {dataset_uid} does not exist")

        path = dataset.private_path
        if which == "mock":
            path = dataset.mock_path

        webbrowser.open(f"file://{path}")
