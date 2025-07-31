import json
from typing import Dict, Literal
from uuid import UUID
from pydantic import BaseModel, Field, HttpUrl
from syft_core import Client

from .config import get_settings


class ShopifySource(BaseModel):
    type: Literal["shopify"] = Field(default="shopify")
    store_url: HttpUrl
    pat: str


type SourcesConfig = Dict[UUID, ShopifySource]


def find_source(dataset_uid: UUID | str):
    if isinstance(dataset_uid, str):
        dataset_uid = UUID(dataset_uid)
    sources = load_sources()

    return sources.get(dataset_uid, None)


def get_sources_config_path():
    syftbox_client = Client.load()
    app_settings = get_settings()

    sources_config_path = (
        syftbox_client.workspace.data_dir
        / "private"
        / app_settings.app_name
        / "dataset-sources.json"
    )

    return sources_config_path


def load_sources() -> SourcesConfig:
    sources_config_path = get_sources_config_path()

    if not sources_config_path.is_file():
        return {}

    with open(sources_config_path) as f:
        raw_data = json.load(f)

    sources = {}
    for uid, source_data in raw_data.items():
        sources[UUID(uid)] = ShopifySource(**source_data)

    return sources


def save_sources(sources: SourcesConfig):
    sources_config_path = get_sources_config_path()

    if not sources_config_path.is_file():
        sources_config_path.parent.mkdir(parents=True, exist_ok=True)

    serializable_sources = {}
    for uid, source in sources.items():
        serializable_sources[str(uid)] = source.model_dump(mode="json")

    with open(sources_config_path, "w") as f:
        json.dump(serializable_sources, f, indent=2)


def add_dataset_source(uid: UUID, source: ShopifySource):
    sources = load_sources()
    sources[uid] = source
    save_sources(sources)
