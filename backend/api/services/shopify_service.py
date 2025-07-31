from pathlib import Path
import tempfile
import traceback
from typing import Optional

from fastapi import HTTPException
from loguru import logger
import requests
from syft_core import Client as SyftBoxClient
from syft_rds import init_session
from syft_rds.models.models import DatasetUpdate

from ...lib.shopify import shopify_json_to_dataframe
from ...models import Dataset as DatasetModel
from ...sources import ShopifySource, add_dataset_source, find_source
from ...utils import get_auto_approve_list


class ShopifyService:
    """Service class for Shopify-related operations."""

    def __init__(self, syftbox_client: SyftBoxClient):
        self.syftbox_client = syftbox_client
        self.rds_client = init_session(syftbox_client.email)

    async def create_dataset_from_shopify(
        self, url: str, name: str, pat: str, description: Optional[str] = None
    ) -> DatasetModel:
        """Create a dataset by importing data from Shopify."""

        # check if dataset name already exists
        for dataset in self.rds_client.datasets:
            if dataset.name == name:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "type": "FormFieldError",
                        "loc": "name",
                        "message": "A dataset with this name already exists",
                    },
                )

        # Download data from Shopify
        products_json = await self._fetch_shopify_products(url, pat)
        dataset_df = shopify_json_to_dataframe(products_json)

        with tempfile.TemporaryDirectory() as temp_dir:
            # Save real dataset
            real_path = Path(temp_dir) / "real"
            real_path.mkdir(parents=True, exist_ok=True)
            real_dataset_path = real_path / "shopify.csv"
            real_dataset_path.write_text(dataset_df.to_csv())
            logger.debug(f"Shopify dataset temporarily saved to: {real_dataset_path}")

            # Create mock dataset
            mock_path = Path(temp_dir) / "mock"
            mock_path.mkdir(parents=True, exist_ok=True)
            mock_dataset_path = mock_path / "shopify.csv"
            await self._download_mock_dataset(mock_dataset_path)

            # Create dummy description file
            dummy_description_path = Path(temp_dir) / "dummy_description.txt"
            dummy_description_path.touch()

            # Create dataset
            dataset = self.rds_client.dataset.create(
                name=name,
                summary=description or f"Shopify data from {url}",
                path=real_path,
                mock_path=mock_path,
                description_path=dummy_description_path,
                auto_approval=get_auto_approve_list(self.syftbox_client),
            )

            logger.debug(f"Shopify dataset created: {dataset}")

            # Store Shopify source information
            add_dataset_source(str(dataset.uid), ShopifySource(store_url=url, pat=pat))

            return DatasetModel.model_validate(dataset)

    async def sync_dataset(self, dataset_uid: str) -> dict:
        """Sync a Shopify datset with the most recent store data."""
        try:
            source = find_source(dataset_uid)
            if not source or not isinstance(source, ShopifySource):
                raise HTTPException(
                    status_code=400,
                    detail="Dataset does not have associated Shopify source info",
                )

            # Fetch latest data from Shopify
            products_json = await self._fetch_shopify_products(
                source.store_url, source.pat
            )
            dataset_df = shopify_json_to_dataframe(products_json)

            with tempfile.TemporaryDirectory() as temp_dir:
                real_path = Path(temp_dir) / "real"
                real_path.mkdir(parents=True, exist_ok=True)
                real_dataset_path = real_path / "shopify.csv"
                real_dataset_path.write_text(dataset_df.to_csv())

                # Update the dataset

                self.rds_client.dataset.update(
                    DatasetUpdate(uid=dataset_uid, path=str(real_path)),
                )

                return {"message": f"Dataset {dataset_uid} synced successfully"}

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error syncing Shopify dataset: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def _fetch_shopify_products(self, store_url: str, pat: str) -> dict:
        """Fetch products from Shopify API."""
        headers = {
            "X-Shopify-Access-Token": pat,
            "Content-Type": "application/json",
        }

        try:
            response = requests.get(
                f"{store_url}/admin/api/2024-01/products.json", headers=headers
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"Failed to fetch Shopify products: {e}")
            raise HTTPException(
                status_code=400, detail=f"Failed to fetch data from Shopify: {str(e)}"
            )

    async def _download_mock_dataset(self, mock_dataset_path: Path) -> None:
        """Download mock dataset from GitHub."""
        github_csv_url = "https://raw.githubusercontent.com/OpenMined/datasets/refs/heads/main/enclave/organic-coop/data/part_1/crop_stock_mock_1.csv"
        try:
            response = requests.get(github_csv_url)
            response.raise_for_status()
            mock_dataset_path.write_bytes(response.content)
            logger.debug(f"Mock dataset downloaded to: {mock_dataset_path}")
        except Exception as e:
            logger.error(f"Failed to download mock dataset: {e}")
            raise HTTPException(
                status_code=400,
                detail=f"Failed to download mock dataset: {e}",
            )
