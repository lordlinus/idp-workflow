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
from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions

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
                body=json.dumps({"error": f"Failed to retrieve domain configuration: {str(e)}"}),
                status_code=500,
                mimetype="application/json",
            )

    @app.route(route="idp/upload", methods=["POST"])
    async def http_upload_pdf(req: func.HttpRequest) -> func.HttpResponse:
        """Upload PDF file to Azure Blob Storage."""
        try:
            # Get file from multipart form
            if 'file' not in req.files:
                return func.HttpResponse(
                    body=json.dumps({"error": "No file provided"}),
                    status_code=400,
                    mimetype="application/json",
                )

            file = req.files['file']
            
            # Get Azure Storage connection string from environment
            conn_string = os.environ.get('AzureWebJobsStorage')
            if not conn_string:
                logger.error("AzureWebJobsStorage connection string not configured")
                return func.HttpResponse(
                    body=json.dumps({"error": "Storage not configured"}),
                    status_code=500,
                    mimetype="application/json",
                )

            # Initialize blob service client
            blob_service_client = BlobServiceClient.from_connection_string(conn_string)
            container_client = blob_service_client.get_container_client('documents')

            # Generate unique blob name
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            file_id = str(uuid.uuid4())[:8]
            blob_name = f"uploads/{timestamp}_{file_id}_{file.filename}"

            # Upload blob
            file_data = file.read()
            blob_client = container_client.upload_blob(blob_name, file_data, overwrite=True)

            # Build blob URI
            account_name = blob_service_client.account_name
            blob_uri = f"https://{account_name}.blob.core.windows.net/documents/{blob_name}"

            logger.info(f"PDF uploaded: {blob_name} ({len(file_data)} bytes)")

            return func.HttpResponse(
                body=json.dumps({
                    "blobPath": blob_name,
                    "blobUri": blob_uri,
                    "fileName": file.filename,
                }),
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
                    body=json.dumps({"error": f"No demo document for domain: {domain_id}"}),
                    status_code=404,
                    mimetype="application/json",
                )

            # Get the sample document path (absolute path for local file processing)
            import pathlib
            project_root = pathlib.Path(__file__).parent.parent.parent
            sample_path = project_root / "sample_documents" / demo_files[domain_id]

            if not sample_path.exists():
                return func.HttpResponse(
                    body=json.dumps({"error": f"Demo document not found: {demo_files[domain_id]}"}),
                    status_code=404,
                    mimetype="application/json",
                )

            # Return the local file path - the PDF extractor supports local paths
            local_path = str(sample_path.absolute())
            logger.info(f"Using demo document: {local_path}")

            return func.HttpResponse(
                body=json.dumps({
                    "blobPath": local_path,
                    "blobUri": f"file://{local_path}",
                    "fileName": demo_files[domain_id],
                    "domain_id": domain_id,
                }),
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

    @app.route(route="idp/history", methods=["GET"])
    async def http_get_history(req: func.HttpRequest) -> func.HttpResponse:
        """Get workflow history - simplified version without Durable Functions query.
        
        Note: For full history functionality, you would need to store instance IDs
        in a separate database or use the Durable Functions REST API directly.
        For demo purposes, this returns an empty list with a message.
        """
        try:
            # For demo purposes, return empty history
            # In production, you could:
            # 1. Store instance IDs in a separate database/table
            # 2. Use the Durable Functions REST API directly
            # 3. Track instances in Azure Table Storage
            
            return func.HttpResponse(
                body=json.dumps({
                    "instances": [],
                    "nextPageLink": None,
                    "message": "History feature requires additional setup. Use the Instance ID from workflow start response to track workflows."
                }),
                status_code=200,
                mimetype="application/json",
            )

        except Exception as e:
            logger.error(f"Error retrieving history: {e}")
            return func.HttpResponse(
                body=json.dumps({"error": f"Failed to retrieve history: {str(e)}"}),
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

            workflow_input = WorkflowInitInput(
                pdf_path=pdf_path,
                domain_id=domain_id,
                max_pages=body.get("max_pages", 50),
                request_id=request_id,
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
    )
    async def negotiate(
        req: func.HttpRequest,
        connectionInfo: str,
    ) -> func.HttpResponse:
        """Negotiate SignalR connection for clients."""
        return func.HttpResponse(
            body=connectionInfo,
            status_code=200,
            mimetype="application/json",
        )

    @app.route(
        route="idp/subscribe/{instanceId}",
        methods=["POST"],
        auth_level=func.AuthLevel.ANONYMOUS,
    )
    @app.generic_output_binding(
        arg_name="signalRGroupActions",
        type="signalR",
        hub_name="idpworkflow",
        connection_string_setting="AzureSignalRConnectionString",
    )
    async def subscribe_to_workflow(
        req: func.HttpRequest,
        signalRGroupActions: func.Out[str],
    ) -> func.HttpResponse:
        """Subscribe a client to workflow updates."""
        instance_id = req.route_params.get("instanceId")
        connection_id = req.headers.get("x-signalr-connection-id")

        if not instance_id:
            return func.HttpResponse(
                body=json.dumps({"error": "instanceId required"}),
                status_code=400,
                mimetype="application/json",
            )

        if not connection_id:
            return func.HttpResponse(
                body=json.dumps({"error": "x-signalr-connection-id header required"}),
                status_code=400,
                mimetype="application/json",
            )

        group_name = f"workflow-{instance_id}"

        # Add connection to group
        group_action = json.dumps(
            {
                "connectionId": connection_id,
                "groupName": group_name,
                "action": "add",
            }
        )
        signalRGroupActions.set(group_action)

        logger.info(f"Client {connection_id} subscribed to {group_name}")

        return func.HttpResponse(
            body=json.dumps(
                {
                    "message": "Subscribed to workflow updates",
                    "instanceId": instance_id,
                    "group": group_name,
                }
            ),
            status_code=200,
            mimetype="application/json",
        )

    @app.route(
        route="idp/unsubscribe/{instanceId}",
        methods=["POST"],
        auth_level=func.AuthLevel.ANONYMOUS,
    )
    @app.generic_output_binding(
        arg_name="signalRGroupActions",
        type="signalR",
        hub_name="idpworkflow",
        connection_string_setting="AzureSignalRConnectionString",
    )
    async def unsubscribe_from_workflow(
        req: func.HttpRequest,
        signalRGroupActions: func.Out[str],
    ) -> func.HttpResponse:
        """Unsubscribe a client from a workflow's updates."""
        instance_id = req.route_params.get("instanceId")
        connection_id = req.headers.get("x-signalr-connection-id")

        if not instance_id or not connection_id:
            return func.HttpResponse(
                body=json.dumps({"error": "instanceId and connection-id required"}),
                status_code=400,
                mimetype="application/json",
            )

        group_name = f"workflow-{instance_id}"

        group_action = json.dumps(
            {
                "connectionId": connection_id,
                "groupName": group_name,
                "action": "remove",
            }
        )
        signalRGroupActions.set(group_action)

        return func.HttpResponse(
            body=json.dumps(
                {
                    "message": "Unsubscribed from workflow updates",
                    "instanceId": instance_id,
                }
            ),
            status_code=200,
            mimetype="application/json",
        )



