"""Azure Blob Storage helpers — upload/download raw bytes."""

import os

from azure.storage.blob import BlobServiceClient


def get_client() -> BlobServiceClient:
    conn_str = os.getenv("AzureWebJobsStorage")
    if not conn_str:
        raise ValueError("AzureWebJobsStorage not set")
    return BlobServiceClient.from_connection_string(conn_str)


def upload(container: str, blob_name: str, data: bytes) -> None:
    get_client().get_container_client(container).upload_blob(blob_name, data, overwrite=True)


def download(container: str, blob_name: str) -> bytes:
    return get_client().get_container_client(container).get_blob_client(blob_name).download_blob().readall()
