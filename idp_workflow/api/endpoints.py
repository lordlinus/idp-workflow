"""HTTP and SignalR endpoints for the IDP workflow."""

import json
import logging
import os
import uuid
from datetime import datetime
from typing import Optional

import azure.functions as func
from pydantic import ValidationError
from azure.durable_functions import DurableOrchestrationClient
from azure.storage.blob import BlobServiceClient
from azure.identity import DefaultAzureCredential

from idp_workflow.constants import (
    WORKFLOW_ORCHESTRATION,
    HITL_REVIEW_EVENT,
)
from idp_workflow.models import WorkflowInitInput, HumanReviewResponse
from idp_workflow.domains.domain_loader import load_domain_config

logger = logging.getLogger(__name__)


# ============================================================================
# HTTP ENDPOINTS
# ============================================================================


def register_http_endpoints(app):
    """Register all HTTP endpoints with the Azure Functions app."""

    @app.route(route="idp/domains/{domain_id}/config", methods=["GET"])
    async def http_get_domain_config(req: func.HttpRequest) -> func.HttpResponse:
        """Retrieve domain configuration including classification categories, extraction schema, and validation rules."""
        try:
            domain_id = req.route_params.get("domain_id")
            if not domain_id:
                return func.HttpResponse(
                    body=json.dumps({"error": "domain_id is required"}),
                    status_code=400,
                    mimetype="application/json",
                )

            # Load domain configuration
            domain_config = load_domain_config(domain_id)

            # Prepare response with domain configuration
            response_data = {
                "domain_id": domain_config.domain_id,
                "display_name": domain_config.display_name,
                "description": domain_config.description,
                "icon": domain_config.icon,
                "classification_categories": domain_config.get_classification_categories(),
                "extraction_schema": domain_config.extraction_schema,
                "validation_rules": [
                    rule.model_dump() for rule in domain_config.validation_rules
                ],
                "document_types": [
                    {
                        "name": doc_type.name,
                        "description": doc_type.description,
                        "pattern_keywords": doc_type.pattern_keywords,
                        "required": doc_type.required,
                        "extraction_priority": doc_type.extraction_priority,
                    }
                    for doc_type in domain_config.document_types
                ],
                "stp_confidence_threshold": domain_config.stp_confidence_threshold,
                "require_human_review_categories": domain_config.require_human_review_categories,
                "max_processing_pages": domain_config.max_processing_pages,
                "settings": domain_config.settings,
            }

            logger.info(f"Domain configuration retrieved for: {domain_id}")

            return func.HttpResponse(
                body=json.dumps(response_data),
                status_code=200,
                mimetype="application/json",
            )

        except FileNotFoundError as e:
            return func.HttpResponse(
                body=json.dumps({"error": f"Domain not found: {str(e)}"}),
                status_code=404,
                mimetype="application/json",
            )
        except Exception as e:
            logger.error(f"Error retrieving domain configuration: {e}")
            return func.HttpResponse(
                body=json.dumps(
                    {"error": f"Failed to retrieve domain configuration: {str(e)}"}
                ),
                status_code=500,
                mimetype="application/json",
            )

    @app.route(route="idp/upload", methods=["POST"])
    async def http_upload_pdf(req: func.HttpRequest) -> func.HttpResponse:
        """Upload PDF file to Azure Blob Storage or local filesystem."""
        try:
            # Get file from multipart form
            if "file" not in req.files:
                return func.HttpResponse(
                    body=json.dumps({"error": "No file provided"}),
                    status_code=400,
                    mimetype="application/json",
                )

            file = req.files["file"]
            file_data = file.read()

            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            file_id = str(uuid.uuid4())[:8]
            safe_filename = f"{timestamp}_{file_id}_{file.filename}"

            storage_account_name = os.environ.get("AZURE_STORAGE_ACCOUNT_NAME", "")
            use_local = not storage_account_name

            if use_local:
                # Local development: save to filesystem
                from pathlib import Path

                upload_dir = Path(
                    os.environ.get("LOCAL_UPLOAD_DIR", "/tmp/idp_uploads")
                )
                upload_dir.mkdir(parents=True, exist_ok=True)
                local_path = str(upload_dir / safe_filename)
                with open(local_path, "wb") as f:
                    f.write(file_data)

                logger.info(f"PDF saved locally: {local_path} ({len(file_data)} bytes)")

                return func.HttpResponse(
                    body=json.dumps(
                        {
                            "blobPath": local_path,
                            "blobUri": f"file://{local_path}",
                            "fileName": file.filename,
                        }
                    ),
                    status_code=200,
                    mimetype="application/json",
                )
            else:
                # Azure: upload to Blob Storage
                account_url = f"https://{storage_account_name}.blob.core.windows.net"
                blob_service_client = BlobServiceClient(
                    account_url=account_url, credential=DefaultAzureCredential()
                )
                container_client = blob_service_client.get_container_client("documents")
                try:
                    container_client.create_container()
                except Exception:
                    pass  # container already exists

                blob_name = f"uploads/{safe_filename}"
                container_client.upload_blob(blob_name, file_data, overwrite=True)

                account_name = blob_service_client.account_name
                blob_uri = f"https://{account_name}.blob.core.windows.net/documents/{blob_name}"

                logger.info(
                    f"PDF uploaded to blob: {blob_name} ({len(file_data)} bytes)"
                )

                return func.HttpResponse(
                    body=json.dumps(
                        {
                            "blobPath": blob_name,
                            "blobUri": blob_uri,
                            "fileName": file.filename,
                        }
                    ),
                    status_code=200,
                    mimetype="application/json",
                )

        except Exception as e:
            logger.error(f"Error uploading file: {e}")
            return func.HttpResponse(
                body=json.dumps({"error": f"Failed to upload file: {str(e)}"}),
                status_code=500,
                mimetype="application/json",
            )

    @app.route(route="idp/demo/{domain_id}", methods=["POST"])
    async def http_use_demo_document(req: func.HttpRequest) -> func.HttpResponse:
        """Use a demo document for the specified domain from sample_documents folder.

        Returns the local file path directly for local development.
        The PDF extractor already supports local file paths.
        """
        try:
            domain_id = req.route_params.get("domain_id")
            if not domain_id:
                return func.HttpResponse(
                    body=json.dumps({"error": "domain_id is required"}),
                    status_code=400,
                    mimetype="application/json",
                )

            # Map domain to sample document filename
            demo_files = {
                "home_loan": "home_loan_zava.pdf",
                "insurance_claims": "insurance_claims_zava.pdf",
                "small_business_lending": "small_business_lending_zava.pdf",
                "trade_finance": "trade_finance_zava.pdf",
            }

            if domain_id not in demo_files:
                return func.HttpResponse(
                    body=json.dumps(
                        {"error": f"No demo document for domain: {domain_id}"}
                    ),
                    status_code=404,
                    mimetype="application/json",
                )

            # Get the sample document path (absolute path for local file processing)
            import pathlib

            project_root = pathlib.Path(__file__).parent.parent.parent
            sample_path = project_root / "sample_documents" / demo_files[domain_id]

            if not sample_path.exists():
                return func.HttpResponse(
                    body=json.dumps(
                        {"error": f"Demo document not found: {demo_files[domain_id]}"}
                    ),
                    status_code=404,
                    mimetype="application/json",
                )

            # Return the local file path - the PDF extractor supports local paths
            local_path = str(sample_path.absolute())
            logger.info(f"Using demo document: {local_path}")

            return func.HttpResponse(
                body=json.dumps(
                    {
                        "blobPath": local_path,
                        "blobUri": f"file://{local_path}",
                        "fileName": demo_files[domain_id],
                        "domain_id": domain_id,
                    }
                ),
                status_code=200,
                mimetype="application/json",
            )

        except Exception as e:
            logger.error(f"Error using demo document: {e}")
            return func.HttpResponse(
                body=json.dumps({"error": f"Failed to use demo document: {str(e)}"}),
                status_code=500,
                mimetype="application/json",
            )

    @app.route(route="idp/workflow/{instanceId}/status", methods=["GET"])
    @app.durable_client_input(client_name="client")
    async def http_get_workflow_status(
        req: func.HttpRequest,
        client: DurableOrchestrationClient,
    ) -> func.HttpResponse:
        """Get current workflow status including completed step outputs.

        Used by the frontend to sync state after SignalR subscription,
        catching any events that fired before the client connected.
        """
        instance_id = req.route_params.get("instanceId")
        if not instance_id:
            return func.HttpResponse(
                body=json.dumps({"error": "Missing instanceId"}),
                status_code=400,
                mimetype="application/json",
            )

        try:
            status = await client.get_status(instance_id, show_input=False)
            if not status or not status.instance_id:
                return func.HttpResponse(
                    body=json.dumps({"error": "Workflow not found"}),
                    status_code=404,
                    mimetype="application/json",
                )

            return func.HttpResponse(
                body=json.dumps(
                    {
                        "instanceId": status.instance_id,
                        "runtimeStatus": str(status.runtime_status),
                        "customStatus": status.custom_status,
                        "output": status.output,
                        "createdTime": (
                            status.created_time.isoformat()
                            if status.created_time
                            else None
                        ),
                        "lastUpdatedTime": (
                            status.last_updated_time.isoformat()
                            if status.last_updated_time
                            else None
                        ),
                    }
                ),
                status_code=200,
                mimetype="application/json",
            )

        except Exception as e:
            logger.error(f"Error getting workflow status: {e}")
            return func.HttpResponse(
                body=json.dumps({"error": f"Failed to get status: {str(e)}"}),
                status_code=500,
                mimetype="application/json",
            )

    @app.route(route="idp/start", methods=["POST"])
    @app.durable_client_input(client_name="client")
    async def http_start_workflow(
        req: func.HttpRequest,
        client: DurableOrchestrationClient,
    ) -> func.HttpResponse:
        """Start the IDP workflow."""
        try:
            body = req.get_json()

            pdf_path = body.get("pdf_path")
            if not pdf_path:
                return func.HttpResponse(
                    body=json.dumps({"error": "pdf_path is required"}),
                    status_code=400,
                    mimetype="application/json",
                )

            request_id = str(uuid.uuid4())

            # Use domain_id consistently
            domain_id = body.get("domain_id", "insurance_claims")

            # Get user_id from header for SignalR user-targeted messaging
            user_id = req.headers.get("x-user-id", "")

            workflow_input = WorkflowInitInput(
                pdf_path=pdf_path,
                domain_id=domain_id,
                max_pages=body.get("max_pages", 50),
                request_id=request_id,
                user_id=user_id,
                options=body.get("options", {}),
                custom_extraction_schema=body.get("custom_extraction_schema"),
                custom_classification_categories=body.get(
                    "custom_classification_categories"
                ),
            )

            instance_id = await client.start_new(
                orchestration_function_name=WORKFLOW_ORCHESTRATION,
                client_input=workflow_input.model_dump(),
            )

            logger.info(f"[{request_id}] Workflow started: {instance_id}")

            return func.HttpResponse(
                body=json.dumps(
                    {
                        "message": "IDP Workflow started",
                        "instanceId": instance_id,
                        "request_id": request_id,
                    }
                ),
                status_code=202,
                mimetype="application/json",
            )

        except ValidationError as e:
            return func.HttpResponse(
                body=json.dumps({"error": f"Invalid input: {str(e)}"}),
                status_code=400,
                mimetype="application/json",
            )
        except Exception as e:
            logger.error(f"Error starting workflow: {e}")
            return func.HttpResponse(
                body=json.dumps({"error": f"Failed to start workflow: {str(e)}"}),
                status_code=500,
                mimetype="application/json",
            )

    @app.route(route="idp/validate-schema", methods=["POST"])
    async def http_validate_schema(req: func.HttpRequest) -> func.HttpResponse:
        """Validate a custom extraction schema without starting a workflow."""
        try:
            body = req.get_json()
            schema = body.get("schema")
            if not schema:
                return func.HttpResponse(
                    body=json.dumps(
                        {"error": "Request body must contain 'schema' object"}
                    ),
                    status_code=400,
                    mimetype="application/json",
                )

            from idp_workflow.tools.dspy_utils import validate_extraction_schema

            errors = validate_extraction_schema(schema)

            if errors:
                return func.HttpResponse(
                    body=json.dumps({"valid": False, "errors": errors}),
                    status_code=422,
                    mimetype="application/json",
                )

            # Return field summary on success
            fields = schema.get("fieldSchema", {}).get("fields", {})
            field_summary = [
                {
                    "name": name,
                    "type": defn.get("type", "string"),
                    "description": defn.get("description", ""),
                }
                for name, defn in fields.items()
            ]

            return func.HttpResponse(
                body=json.dumps(
                    {
                        "valid": True,
                        "fields": field_summary,
                        "field_count": len(field_summary),
                    }
                ),
                status_code=200,
                mimetype="application/json",
            )

        except Exception as e:
            logger.error(f"Error validating schema: {e}")
            return func.HttpResponse(
                body=json.dumps({"error": f"Failed to validate schema: {str(e)}"}),
                status_code=500,
                mimetype="application/json",
            )

    @app.route(route="idp/llm-providers", methods=["GET"])
    async def http_get_llm_providers(req: func.HttpRequest) -> func.HttpResponse:
        """List available LLM providers and their configuration."""
        try:
            from idp_workflow.tools.llm_factory import get_available_providers

            providers = get_available_providers()
            return func.HttpResponse(
                body=json.dumps({"providers": providers}),
                status_code=200,
                mimetype="application/json",
            )
        except Exception as e:
            return func.HttpResponse(
                body=json.dumps({"error": str(e)}),
                status_code=500,
                mimetype="application/json",
            )

    @app.route(route="idp/hitl/review/{instanceId}", methods=["POST"])
    @app.durable_client_input(client_name="client")
    async def http_submit_human_review(
        req: func.HttpRequest,
        client: DurableOrchestrationClient,
    ) -> func.HttpResponse:
        """Submit human review decision with field selections."""
        instance_id = req.route_params.get("instanceId")
        if not instance_id:
            return func.HttpResponse(
                body=json.dumps({"error": "Missing instanceId"}),
                status_code=400,
                mimetype="application/json",
            )

        try:
            body = req.get_json()

            # Build field selections from detailed input if provided
            field_selections = []
            for fs in body.get("field_selections", []):
                from idp_workflow.models import FieldSelection

                field_selections.append(
                    FieldSelection(
                        field_name=fs.get("field_name", ""),
                        selected_source=fs.get("selected_source", ""),
                        selected_value=fs.get("selected_value"),
                        azure_value=fs.get("azure_value"),
                        dspy_value=fs.get("dspy_value"),
                        notes=fs.get("notes", ""),
                    )
                )

            approval = HumanReviewResponse(
                approved=body.get("approved", False),
                feedback=body.get("feedback", ""),
                reviewer=body.get("reviewer", "unknown"),
                field_selections=field_selections,
                accepted_values=body.get("accepted_values", {}),
                default_source=body.get("default_source", "comparison"),
            )

            await client.raise_event(
                instance_id=instance_id,
                event_name=HITL_REVIEW_EVENT,
                event_data=approval.model_dump(),
            )

            logger.info(
                f"Human review submitted for {instance_id}: "
                f"approved={approval.approved}, "
                f"accepted_values={len(approval.accepted_values)} fields, "
                f"field_selections={len(approval.field_selections)}"
            )

            return func.HttpResponse(
                body=json.dumps(
                    {
                        "message": "Review decision recorded",
                        "approved": approval.approved,
                        "accepted_fields_count": len(approval.accepted_values),
                        "field_selections_count": len(approval.field_selections),
                    }
                ),
                status_code=200,
                mimetype="application/json",
            )

        except ValidationError as e:
            return func.HttpResponse(
                body=json.dumps({"error": f"Invalid review data: {str(e)}"}),
                status_code=400,
                mimetype="application/json",
            )
        except Exception as e:
            logger.error(f"Error submitting review: {e}")
            return func.HttpResponse(
                body=json.dumps({"error": f"Failed to submit review: {str(e)}"}),
                status_code=500,
                mimetype="application/json",
            )


# ============================================================================
# SIGNALR ENDPOINTS
# ============================================================================


def register_signalr_endpoints(app):
    """Register SignalR endpoints with the Azure Functions app."""

    @app.route(
        route="idp/negotiate",
        methods=["POST", "GET"],
        auth_level=func.AuthLevel.ANONYMOUS,
    )
    @app.generic_input_binding(
        arg_name="connectionInfo",
        type="signalRConnectionInfo",
        hub_name="idpworkflow",
        connection_string_setting="AzureSignalRConnectionString",
        user_id="{headers.x-user-id}",
    )
    async def negotiate(
        req: func.HttpRequest,
        connectionInfo: str,
    ) -> func.HttpResponse:
        """Negotiate SignalR connection for clients (user-targeted)."""
        return func.HttpResponse(
            body=connectionInfo,
            status_code=200,
            mimetype="application/json",
        )
