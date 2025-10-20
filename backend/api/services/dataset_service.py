# backend/api/services/dataset_service.py
from pathlib import Path
import tempfile
from typing import Iterator, Literal, Optional

from fastapi import HTTPException, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from loguru import logger
import requests
from syft_core.url import SyftBoxURL
from syft_rds.models import DatasetUpdate
from syft_rds import RDSClient

from ...models import ListDatasetsResponse, Dataset as DatasetModel
from ...sources import find_source
from ...utils import get_auto_approve_list


# Security and resource limits
MAX_PREVIEW_SIZE = 1024 * 1024  # 1MB per file
MAX_TOTAL_SIZE = 50 * 1024 * 1024  # 50MB total
MAX_FILE_COUNT = 1000  # Maximum number of files


class DatasetService:
    """Service class for dataset-related operations."""

    def __init__(self, rds_client: RDSClient):
        self.rds_client = rds_client
        self.syftbox_client = rds_client._syftbox_client

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
                    # Strip the top-level folder name but preserve subdirectories
                    # since when we upload the dataset, the dataset name is the top-level folder
                    # e.g., "diabetes/part01/train.csv" -> "part01/train.csv"
                    file_path = Path(f.filename)
                    relative_path = (
                        Path(*file_path.parts[1:])
                        if len(file_path.parts) > 1
                        else file_path
                    )

                    # Create full path
                    full_path = real_path / relative_path
                    # Create parent directories if needed
                    full_path.parent.mkdir(parents=True, exist_ok=True)
                    # Write file content
                    full_path.write_bytes(await f.read())
                    logger.debug(f"Saved file: {full_path}")

                # Create mock dataset
                mock_path = Path(temp_dir) / "mock"
                mock_path.mkdir(parents=True, exist_ok=True)

                if mock_dataset_files:
                    # Save mock dataset files, stripping top-level folder
                    for f in mock_dataset_files:
                        file_path = Path(f.filename)
                        relative_path = (
                            Path(*file_path.parts[1:])
                            if len(file_path.parts) > 1
                            else file_path
                        )
                        # Create full path
                        full_path = mock_path / relative_path
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

                # Create README.md with description if provided
                readme_path = Path(temp_dir) / "README.md"
                if description:
                    readme_path.write_text(description)
                else:
                    readme_path.touch()  # Create empty README.md

                # Create dataset in RDS
                dataset = self.rds_client.dataset.create(
                    name=name,
                    summary=description,
                    path=real_path,
                    mock_path=mock_path,
                    description_path=readme_path,
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

    def _format_file_size(self, size_bytes: int) -> str:
        """Format file size with appropriate units consistently."""
        MB = 1024 * 1024
        KB = 1024

        if size_bytes >= MB:
            return f"{size_bytes / MB:.2f} MB"
        elif size_bytes >= KB:
            return f"{size_bytes / KB:.2f} KB"
        return f"{size_bytes} B"

    async def get_dataset_files(
        self, dataset_uid: str, dataset_type: Literal["private", "mock"] = "private"
    ) -> dict[str, dict[str, str]]:
        """Get the dataset files and their contents (for previewable files)."""
        try:
            dataset = self.rds_client.dataset.get(uid=dataset_uid)
            if not dataset:
                raise HTTPException(
                    status_code=404,
                    detail=f"Dataset with UID '{dataset_uid}' not found",
                )

            data_path = (
                dataset.private_path if dataset_type == "private" else dataset.mock_path
            )
            files = {}

            if not data_path.exists():
                logger.warning(f"Dataset directory does not exist: {data_path}")
                return {
                    "data_dir": str(data_path),
                    "files": {},
                    "dataset_type": dataset_type,
                }

            # Resolve paths for security validation
            data_path_resolved = data_path.resolve()

            # File extensions that can be previewed as text
            previewable_extensions = {
                ".txt",
                ".csv",
                ".json",
                ".md",
                ".py",
                ".yml",
                ".yaml",
                ".xml",
                ".log",
                ".tsv",
            }

            total_size = 0
            file_count = 0

            # Read all files (directories will be automatically created by frontend tree builder)
            for file_path in data_path.rglob("*"):
                # Skip directories - frontend will build tree from file paths
                if file_path.is_dir():
                    continue

                # Security: Validate file is within dataset directory (prevent path traversal)
                try:
                    file_path.resolve().relative_to(data_path_resolved)
                except ValueError:
                    logger.warning(f"Path traversal attempt detected: {file_path}")
                    continue

                # Check file count limit
                file_count += 1
                if file_count > MAX_FILE_COUNT:
                    logger.warning(
                        f"File count limit ({MAX_FILE_COUNT}) exceeded for dataset {dataset_uid}"
                    )
                    files["_limit_exceeded"] = (
                        f"[Dataset contains too many files. Only first {MAX_FILE_COUNT} files shown]"
                    )
                    break

                relative_path = file_path.relative_to(data_path)
                file_size = file_path.stat().st_size

                # Handle files
                # Check if file is previewable
                if file_path.suffix.lower() in previewable_extensions:
                    # Check file size
                    if file_size > MAX_PREVIEW_SIZE:
                        files[str(relative_path)] = (
                            f"[File too large to preview: {self._format_file_size(file_size)}]"
                        )
                        continue

                    # Check total size limit
                    if total_size + file_size > MAX_TOTAL_SIZE:
                        files[str(relative_path)] = (
                            "[Total preview size limit exceeded]"
                        )
                        continue

                    try:
                        # Try to read as text with explicit UTF-8 encoding
                        content = file_path.read_text(
                            encoding="utf-8", errors="replace"
                        )
                        files[str(relative_path)] = content
                        total_size += file_size
                    except UnicodeDecodeError:
                        files[str(relative_path)] = "[Unable to decode file as UTF-8]"
                        logger.debug(f"Unicode decode error for {file_path}")
                    except Exception as e:
                        # If reading fails, show error
                        files[str(relative_path)] = f"[Error reading file: {str(e)}]"
                        logger.debug(f"Error reading {file_path}: {e}")
                else:
                    # For non-previewable files, show metadata
                    files[str(relative_path)] = (
                        f"[Binary file: {self._format_file_size(file_size)}]"
                    )

            return {
                "data_dir": str(data_path),
                "files": files,
                "dataset_type": dataset_type,
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting dataset files: {e}")
            raise HTTPException(status_code=500, detail=str(e))
