#!/bin/bash
# Upload sample documents to Azure Blob Storage after deployment.
# Uses the logged-in Azure CLI identity (no shared keys).

set -euo pipefail

echo "==> Uploading sample documents to blob storage..."

# azd env get-value may print errors to stdout, so validate the result
STORAGE_ACCOUNT_NAME=""
if RAW=$(azd env get-value AZURE_STORAGE_ACCOUNT_NAME 2>/dev/null); then
  # Validate it looks like a storage account name (lowercase alphanumeric, 3-24 chars)
  if [[ "$RAW" =~ ^[a-z0-9]{3,24}$ ]]; then
    STORAGE_ACCOUNT_NAME="$RAW"
  fi
fi

if [ -z "$STORAGE_ACCOUNT_NAME" ]; then
  echo "AZURE_STORAGE_ACCOUNT_NAME not found in azd env. Run 'azd provision' first."
  echo "Skipping sample document upload."
  exit 0
fi

CONTAINER_NAME="documents"
BLOB_PREFIX="sample-documents"
SOURCE_DIR="./sample_documents"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "No sample_documents/ directory found, skipping."
  exit 0
fi

ACCOUNT_URL="https://${STORAGE_ACCOUNT_NAME}.blob.core.windows.net"

# Ensure the container exists
echo "Ensuring container '$CONTAINER_NAME' exists..."
az storage container create \
  --name "$CONTAINER_NAME" \
  --account-name "$STORAGE_ACCOUNT_NAME" \
  --auth-mode login \
  --only-show-errors 2>/dev/null || true

# Upload all PDFs (overwrite if they exist)
echo "Uploading sample documents to ${ACCOUNT_URL}/${CONTAINER_NAME}/${BLOB_PREFIX}/..."
az storage blob upload-batch \
  --source "$SOURCE_DIR" \
  --destination "$CONTAINER_NAME" \
  --destination-path "$BLOB_PREFIX" \
  --account-name "$STORAGE_ACCOUNT_NAME" \
  --auth-mode login \
  --overwrite \
  --only-show-errors

echo "==> Sample documents uploaded successfully."
