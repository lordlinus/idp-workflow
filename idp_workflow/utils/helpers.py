"""
Helper functions for the IDP workflow.
"""

import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def resolve_pdf_path(pdf_path: str) -> str:
    """Resolve a pdf_path to a local file path, downloading from blob if needed.

    Logic:
    - Starts with '/' or exists locally → return as-is (local dev)
    - Starts with http(s):// → return as-is (URL)
    - Otherwise → treat as blob name in 'documents' container, download to temp

    Returns:
        Local file path or URL suitable for Document Intelligence / Azure CU.
    """
    # Local file path (absolute or existing)
    if pdf_path.startswith("/") or Path(pdf_path).exists():
        return pdf_path

    # URL
    if pdf_path.startswith(("http://", "https://")):
        return pdf_path

    # Blob path within 'documents' container
    storage_account_name = os.environ.get("AZURE_STORAGE_ACCOUNT_NAME", "")
    if not storage_account_name:
        raise FileNotFoundError(
            f"pdf_path '{pdf_path}' looks like a blob path but "
            "AZURE_STORAGE_ACCOUNT_NAME is not set"
        )

    from azure.storage.blob import BlobServiceClient
    from azure.identity import DefaultAzureCredential

    account_url = f"https://{storage_account_name}.blob.core.windows.net"
    blob_service = BlobServiceClient(
        account_url=account_url, credential=DefaultAzureCredential()
    )
    blob_client = blob_service.get_blob_client("documents", pdf_path)

    # Download to a temp directory, preserving original filename
    tmp_dir = os.path.join(tempfile.gettempdir(), "idp_blobs")
    os.makedirs(tmp_dir, exist_ok=True)
    local_path = os.path.join(tmp_dir, Path(pdf_path).name)

    logger.info(f"Downloading blob '{pdf_path}' → {local_path}")
    with open(local_path, "wb") as f:
        download_stream = blob_client.download_blob()
        download_stream.readinto(f)

    return local_path


def parse_human_approval(raw: Any) -> dict:
    """Parse human approval event data.

    Expects a dict with 'approved', 'feedback', 'reviewer', and optionally
    'field_selections' and 'accepted_values' keys.

    Args:
        raw: Approval data from external event (dict or JSON string)

    Returns:
        Dictionary with approval data

    Raises:
        ValueError: If input is not a valid dict or JSON string
    """
    if isinstance(raw, dict):
        return raw

    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return parsed
            raise ValueError(f"Parsed JSON is not a dict: {type(parsed)}")
        except json.JSONDecodeError as e:
            logger.error(f"Invalid HITL approval JSON: {raw}")
            raise ValueError(f"HITL approval must be valid JSON: {e}") from e

    logger.error(f"Invalid HITL approval type: {type(raw)}")
    raise ValueError(f"HITL approval must be dict or JSON string, got {type(raw)}")
