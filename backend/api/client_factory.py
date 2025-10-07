"""Factory functions for creating application clients."""

from loguru import logger
from syft_core import Client as SyftBoxClient
from syft_rds import init_session, RDSClient


def create_rds_client() -> RDSClient:
    """
    Create and initialize an RDS client.

    Returns:
        RDSClient: The initialized RDS client

    Raises:
        Exception: If client initialization fails
    """
    syftbox_client = SyftBoxClient.load()

    logger.info(
        f"Starting client with email: {syftbox_client.email}. \n"
        f"Config path: {syftbox_client.config_path} \n"
        f"Workspace dir: {syftbox_client.workspace.data_dir} \n"
    )

    rds_client = init_session(host=syftbox_client.email, syftbox_client=syftbox_client)

    logger.debug(
        f"Initialized RDS client for {syftbox_client.email}. Is admin: {rds_client.is_admin}"
    )

    return rds_client
