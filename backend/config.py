from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    app_version: str = "0.1.0"
    app_name: str = "organic-coop"
    debug: bool = True

    # Client settings
    config_path: Optional[str] = None

    # File upload settings
    max_upload_size: int = 10 * 1024 * 1024  # 10MB
    allowed_file_types: list[str] = ["text/csv", "application/json", "text/plain"]

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
