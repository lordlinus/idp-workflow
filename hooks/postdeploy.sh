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

# ── Tighten NSP to Enforced mode now that documents are uploaded ─────────────
echo "==> Locking down storage network access..."

RESOURCE_GROUP=""
if RAW_RG=$(azd env get-value AZURE_RESOURCE_GROUP 2>/dev/null); then
  RESOURCE_GROUP="$RAW_RG"
fi

if [ -z "$RESOURCE_GROUP" ]; then
  echo "AZURE_RESOURCE_GROUP not found. Skipping NSP enforcement."
  exit 0
fi

# Find the NSP resource and switch association to Enforced mode
NSP_NAME=$(az network perimeter list -g "$RESOURCE_GROUP" --query "[0].name" -o tsv 2>/dev/null || true)

if [ -n "$NSP_NAME" ]; then
  echo "Switching NSP '$NSP_NAME' association to Enforced mode..."
  az network perimeter association update \
    --perimeter-name "$NSP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --name "assoc-storage" \
    --access-mode "Enforced" \
    --only-show-errors 2>/dev/null || echo "Warning: Could not enforce NSP. You may need to do this manually in the portal."

  # Also lock down public network access on the storage account
  echo "Setting storage account publicNetworkAccess to SecuredByPerimeter..."
  az storage account update \
    --name "$STORAGE_ACCOUNT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --public-network-access SecuredByPerimeter \
    --only-show-errors 2>/dev/null || echo "Warning: Could not update publicNetworkAccess."

  echo "==> Storage network access locked down (NSP Enforced)."
else
  echo "No NSP found in resource group. Skipping enforcement."
fi

# ── Grant current user access to Durable Task Scheduler dashboard ────────────
echo "==> Granting DTS dashboard access to current user..."

CURRENT_USER_ID=$(az ad signed-in-user show --query "id" -o tsv 2>/dev/null || true)

if [ -n "$CURRENT_USER_ID" ]; then
  # Find the DTS scheduler in the resource group
  DTS_NAME=$(az durabletask scheduler list -g "$RESOURCE_GROUP" --query "[0].name" -o tsv 2>/dev/null || true)

  if [ -n "$DTS_NAME" ]; then
    DTS_SCOPE="/subscriptions/$(az account show --query id -o tsv)/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.DurableTask/schedulers/${DTS_NAME}"

    echo "Assigning 'Durable Task Data Contributor' to current user on scheduler '$DTS_NAME'..."
    az role assignment create \
      --assignee "$CURRENT_USER_ID" \
      --role "Durable Task Data Contributor" \
      --scope "$DTS_SCOPE" \
      --only-show-errors 2>/dev/null || echo "Warning: Role assignment may already exist or failed. Check the portal."

    echo "==> DTS dashboard access granted. Visit https://dashboard.durabletask.io/ to view orchestrations."
  else
    echo "No DTS scheduler found in resource group. Skipping dashboard access."
  fi
else
  echo "Could not determine current user. Skipping dashboard access grant."
fi
