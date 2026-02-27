"""Main orchestration function for the IDP workflow."""

import json
import logging
from datetime import timedelta

from pydantic import ValidationError
from azure.durable_functions import DurableOrchestrationContext

from idp_workflow.constants import (
    STEP1_PDF_EXTRACTION,
    STEP2_CLASSIFICATION,
    STEP3_AZURE_EXTRACTION,
    STEP3_DSPY_EXTRACTION,
    STEP4_COMPARISON,
    STEP5_HUMAN_REVIEW,
    STEP6_REASONING_AGENT,
    HITL_REVIEW_EVENT,
)
from idp_workflow.config import HITL_TIMEOUT_HOURS
from idp_workflow.models import WorkflowInitInput, Step03Output
from idp_workflow.utils.helpers import parse_human_approval

logger = logging.getLogger(__name__)

# Step display metadata (inlined from old utils/signalr.py)
_STEP_META = {
    "step_01_pdf_extraction": ("PDF to Markdown", 1),
    "step_02_classification": ("Document Classification", 2),
    "step_03_01_azure_extraction": ("Azure CU Extraction", 3),
    "step_03_02_dspy_extraction": ("DSPy Extraction", 3),
    "step_04_comparison": ("Extraction Comparison", 4),
    "step_05_human_review": ("Human Review", 5),
    "step_06_reasoning_agent": ("Reasoning (Agent)", 6),
}


def _step_display(step_name: str):
    """Return (display_name, step_number) for a step."""
    return _STEP_META.get(step_name, (step_name, 0))


def _broadcast(context: DurableOrchestrationContext, user_id: str, event: str, data: dict):
    """Send a SignalR notification via the notify_user activity."""
    return context.call_activity("notify_user", {
        "user_id": user_id,
        "instance_id": context.instance_id,
        "event": event,
        "data": data,
    })


def _generate_output_preview(step_output: dict, step_name: str) -> str:
    """Generate a text preview from step output.

    Args:
        step_output: The Step*Output dict
        step_name: The step identifier for context

    Returns:
        Text summary suitable for output_preview field
    """
    if not step_output:
        return ""

    # Step-specific preview generation
    if step_name == "step_01_pdf_extraction":
        return f"{step_output.get('total_pages', 0)} pages, {step_output.get('characters', 0):,} characters"
    elif step_name == "step_02_classification":
        return f"Category: {step_output.get('primary_category', 'Unknown')} ({step_output.get('primary_confidence', 0):.1%})"
    elif step_name == "step_03_01_azure_extraction":
        return f"Azure: {step_output.get('azure_pages_processed', 0)} pages processed"
    elif step_name == "step_03_02_dspy_extraction":
        return f"DSPy: {step_output.get('dspy_pages_processed', 0)} pages processed"
    elif step_name == "step_04_comparison":
        return f"Match: {step_output.get('match_percentage', 0):.1f}% ({step_output.get('matching_fields', 0)}/{step_output.get('total_fields', 0)} fields)"
    elif step_name == "step_06_reasoning_agent":
        return f"Confidence: {step_output.get('confidence_score', 0):.2f}, Validations: {step_output.get('passed_validations', 0)}/{step_output.get('total_validations', 0)}"
    else:
        # Generic preview
        return json.dumps(step_output)[:200] if step_output else ""


def register_orchestration(app):
    """Register the orchestration function with the Azure Functions app."""

    @app.orchestration_trigger(context_name="context")
    def idp_workflow_orchestration(context: DurableOrchestrationContext):
        """Main IDP workflow orchestration (PDF -> Classification -> Extraction -> HITL -> Reasoning)."""
        # Get input
        input_data = context.get_input()
        if not input_data:
            raise ValueError("Workflow input required")

        try:
            workflow_input = WorkflowInitInput.model_validate(input_data)
        except ValidationError as e:
            raise ValueError(f"Invalid workflow input: {e}")

        request_id = workflow_input.request_id
        domain_id = workflow_input.domain_id
        pdf_path = workflow_input.pdf_path
        max_pages = workflow_input.max_pages
        user_id = workflow_input.user_id
        options = workflow_input.options
        custom_extraction_schema = workflow_input.custom_extraction_schema
        custom_classification_categories = workflow_input.custom_classification_categories

        # Initialize state and output container
        context.set_custom_status(f"[{request_id}] Initializing workflow")

        # Store outputs from each step
        step1_output = None
        step2_output = None

        # ====================================================================
        # STEP 1: PDF EXTRACTION
        # ====================================================================
        context.set_custom_status(f"[{request_id}] Step 1: Extracting PDF to markdown")

        try:
            # Broadcast step started via SignalR
            dn, sn = _step_display(STEP1_PDF_EXTRACTION)
            yield _broadcast(context, user_id, "stepStarted", {
                "stepName": STEP1_PDF_EXTRACTION,
                "displayName": dn,
                "stepNumber": sn,
                "status": "in_progress",
            })

            step1_result = yield context.call_activity(
                "activity_step_01_pdf_extraction",
                {
                    "pdf_path": pdf_path,
                    "request_id": request_id,
                },
            )

            pdf_content_info = step1_result.get("pdf_content", {})
            step1_output = step1_result.get("step_output", {})

            logger.info(f"[{request_id}] Step 1 completed: {pdf_content_info}")

            # Broadcast step completed via SignalR

            dn, sn = _step_display(STEP1_PDF_EXTRACTION)
            yield _broadcast(context, user_id, "stepCompleted", {
                "stepName": STEP1_PDF_EXTRACTION,
                "displayName": dn,
                "stepNumber": sn,
                "status": "completed",
                "durationMs": step1_output.get("processing_time_ms", 0),
                "outputPreview": _generate_output_preview(step1_output, STEP1_PDF_EXTRACTION),
                "outputData": step1_output,
            })

        except Exception as e:
            error_msg = str(e)
            context.set_custom_status(f"[{request_id}] Step 1 FAILED: {error_msg}")
            
            # Broadcast step failure via SignalR
            dn, sn = _step_display(STEP1_PDF_EXTRACTION)
            yield _broadcast(context, user_id, "stepFailed", {
                "stepName": STEP1_PDF_EXTRACTION,
                "displayName": dn,
                "stepNumber": sn,
                "status": "failed",
                "errorMessage": error_msg,
                "errorType": type(e).__name__,
            })
            raise

        # ====================================================================
        # STEP 2: CLASSIFICATION
        # ====================================================================
        context.set_custom_status(f"[{request_id}] Step 2: Classifying document pages")

        try:
            # Broadcast step started via SignalR
            dn, sn = _step_display(STEP2_CLASSIFICATION)
            yield _broadcast(context, user_id, "stepStarted", {
                "stepName": STEP2_CLASSIFICATION,
                "displayName": dn,
                "stepNumber": sn,
                "status": "in_progress",
            })

            step2_result = yield context.call_activity(
                "activity_step_02_classification",
                {
                    "pdf_content": pdf_content_info,
                    "domain_id": domain_id,
                    "request_id": request_id,
                    "max_pages": max_pages,
                    "options": options,
                    "custom_classification_categories": custom_classification_categories,
                },
            )

            primary_category = step2_result.get("primary_category", "Unknown")

            logger.info(
                f"[{request_id}] Step 2 completed: Primary category: {primary_category}"
            )

            step2_output = step2_result

            # Broadcast step completed via SignalR

            dn, sn = _step_display(STEP2_CLASSIFICATION)
            yield _broadcast(context, user_id, "stepCompleted", {
                "stepName": STEP2_CLASSIFICATION,
                "displayName": dn,
                "stepNumber": sn,
                "status": "completed",
                "durationMs": step2_output.get("processing_time_ms", 0),
                "outputPreview": _generate_output_preview(step2_output, STEP2_CLASSIFICATION),
                "outputData": step2_output,
            })

        except Exception as e:
            error_msg = str(e)
            context.set_custom_status(f"[{request_id}] Step 2 FAILED: {error_msg}")
            
            # Broadcast step failure via SignalR
            dn, sn = _step_display(STEP2_CLASSIFICATION)
            yield _broadcast(context, user_id, "stepFailed", {
                "stepName": STEP2_CLASSIFICATION,
                "displayName": dn,
                "stepNumber": sn,
                "status": "failed",
                "errorMessage": error_msg,
                "errorType": type(e).__name__,
            })
            raise

        # ====================================================================
        # STEP 3: CONCURRENT DATA EXTRACTION (Azure + DSPy)
        # ====================================================================
        context.set_custom_status(
            f"[{request_id}] Step 3: Extracting data (concurrent)"
        )

        # Broadcast step started via SignalR (Azure extraction)
        dn, sn = _step_display(STEP3_AZURE_EXTRACTION)
        yield _broadcast(context, user_id, "stepStarted", {
            "stepName": STEP3_AZURE_EXTRACTION,
            "displayName": dn,
            "stepNumber": sn,
            "status": "in_progress",
        })

        # Broadcast step started via SignalR (DSPy extraction - concurrent)
        dn, sn = _step_display(STEP3_DSPY_EXTRACTION)
        yield _broadcast(context, user_id, "stepStarted", {
            "stepName": STEP3_DSPY_EXTRACTION,
            "displayName": dn,
            "stepNumber": sn,
            "status": "in_progress",
        })

        try:
            # Azure CU takes the PDF directly
            azure_extraction_input = {
                "pdf_path": pdf_path,
                "domain_id": domain_id,
                "max_pages": max_pages,
                "request_id": request_id,
                "custom_extraction_schema": custom_extraction_schema,
            }

            # DSPy takes Step 1's full_text (markdown)
            dspy_extraction_input = {
                "full_text": pdf_content_info.get("full_text", ""),
                "total_pages": pdf_content_info.get("total_pages", 0),
                "domain_id": domain_id,
                "request_id": request_id,
                "options": options,
                "custom_extraction_schema": custom_extraction_schema,
            }

            # Create tasks for both extractors (they run in parallel)
            azure_task = context.call_activity(
                "activity_step_03_01_azure_extraction", azure_extraction_input
            )
            dspy_task = context.call_activity(
                "activity_step_03_02_dspy_extraction", dspy_extraction_input
            )

            # Execute both in parallel using task_all
            extraction_results = yield context.task_all([azure_task, dspy_task])

            azure_result = extraction_results[0]
            dspy_result = extraction_results[1]

            azure_extraction = azure_result.get("extraction_result", {})
            azure_output = azure_result.get("step_output", {})

            dspy_extraction = dspy_result.get("extraction_result", {})
            dspy_output = dspy_result.get("step_output", {})

            logger.info(
                f"[{request_id}] Step 3 completed: "
                f"Azure processed {azure_extraction.get('total_pages_processed', 0)} pages, "
                f"DSPy processed {dspy_extraction.get('total_pages_processed', 0)} pages"
            )

            step3_output = Step03Output(
                azure_pages_processed=azure_extraction.get("total_pages_processed", 0),
                azure_processing_time_ms=azure_extraction.get(
                    "processing_time_ms", 0.0
                ),
                azure_sample_data=azure_output.get("extracted_data", {}),
                dspy_pages_processed=dspy_extraction.get("total_pages_processed", 0),
                dspy_processing_time_ms=dspy_extraction.get("processing_time_ms", 0.0),
                dspy_sample_data=dspy_output.get("extracted_data", {}),
                extraction_method="concurrent",
            )

            # Broadcast Azure extraction completed via SignalR

            dn, sn = _step_display(STEP3_AZURE_EXTRACTION)
            yield _broadcast(context, user_id, "stepCompleted", {
                "stepName": STEP3_AZURE_EXTRACTION,
                "displayName": dn,
                "stepNumber": sn,
                "status": "completed",
                "durationMs": azure_extraction.get("processing_time_ms", 0),
                "outputPreview": _generate_output_preview(azure_output, STEP3_AZURE_EXTRACTION),
                "outputData": azure_output,
            })

            # Broadcast DSPy extraction completed via SignalR

            dn, sn = _step_display(STEP3_DSPY_EXTRACTION)
            yield _broadcast(context, user_id, "stepCompleted", {
                "stepName": STEP3_DSPY_EXTRACTION,
                "displayName": dn,
                "stepNumber": sn,
                "status": "completed",
                "durationMs": dspy_extraction.get("processing_time_ms", 0),
                "outputPreview": _generate_output_preview(dspy_output, STEP3_DSPY_EXTRACTION),
                "outputData": dspy_output,
            })

        except Exception as e:
            error_msg = str(e)
            context.set_custom_status(f"[{request_id}] Step 3 FAILED: {error_msg}")
            
            # Broadcast step failure via SignalR (for both extraction tasks)
            dn, sn = _step_display(STEP3_AZURE_EXTRACTION)
            yield _broadcast(context, user_id, "stepFailed", {
                "stepName": STEP3_AZURE_EXTRACTION,
                "displayName": dn,
                "stepNumber": sn,
                "status": "failed",
                "errorMessage": error_msg,
                "errorType": type(e).__name__,
            })
            raise

        # ====================================================================
        # STEP 4: COMPARISON (Azure vs DSPy)
        # ====================================================================
        context.set_custom_status(
            f"[{request_id}] Step 4: Comparing extraction results"
        )

        # Broadcast step started via SignalR
        dn, sn = _step_display(STEP4_COMPARISON)
        yield _broadcast(context, user_id, "stepStarted", {
            "stepName": STEP4_COMPARISON,
            "displayName": dn,
            "stepNumber": sn,
            "status": "in_progress",
        })

        try:
            comparison_result = yield context.call_activity(
                "activity_step_04_comparison",
                {
                    "azure_data": azure_output.get("extracted_data", {}),
                    "dspy_data": dspy_output.get("extracted_data", {}),
                    "document_context": primary_category,
                    "request_id": request_id,
                },
            )

            comparison_data = comparison_result.get("comparison_result", {})
            step4_output = comparison_result.get("step_output", {})

            logger.info(
                f"[{request_id}] Step 4 completed: "
                f"{step4_output.get('matching_fields', 0)}/{step4_output.get('total_fields', 0)} matching"
            )

            # Broadcast step completed via SignalR

            dn, sn = _step_display(STEP4_COMPARISON)
            yield _broadcast(context, user_id, "stepCompleted", {
                "stepName": STEP4_COMPARISON,
                "displayName": dn,
                "stepNumber": sn,
                "status": "completed",
                "durationMs": step4_output.get("processing_time_ms", 0),
                "outputPreview": _generate_output_preview(step4_output, STEP4_COMPARISON),
                "outputData": step4_output,
            })

        except Exception as e:
            error_msg = str(e)
            context.set_custom_status(f"[{request_id}] Step 4 FAILED: {error_msg}")
            
            # Broadcast step failure via SignalR
            dn, sn = _step_display(STEP4_COMPARISON)
            yield _broadcast(context, user_id, "stepFailed", {
                "stepName": STEP4_COMPARISON,
                "displayName": dn,
                "stepNumber": sn,
                "status": "failed",
                "errorMessage": error_msg,
                "errorType": type(e).__name__,
            })
            raise

        # ====================================================================
        # STEP 5: HUMAN REVIEW (HITL)
        # ====================================================================
        context.set_custom_status(f"[{request_id}] Step 5: Waiting for human review")

        hitl_start_time = context.current_utc_datetime

        # Broadcast step started via SignalR
        dn, sn = _step_display(STEP5_HUMAN_REVIEW)
        yield _broadcast(context, user_id, "stepStarted", {
            "stepName": STEP5_HUMAN_REVIEW,
            "displayName": dn,
            "stepNumber": sn,
            "status": "in_progress",
        })

        # Broadcast HITL waiting via SignalR
        # Include full comparison data for frontend review UI
        comparison_summary = {
            "totalFields": step4_output.get("total_fields", 0),
            "matchingFields": step4_output.get("matching_fields", 0),
            "differingFields": step4_output.get("differing_fields", 0),
            "matchPercentage": step4_output.get("match_percentage", 0.0),
            "requiresHumanReview": step4_output.get("requires_human_review", False),
        }

        # Convert field_analyses to the format expected by the message builder
        # Note: field_analyses is in comparison_data (the full comparison_result), not step4_output
        # Map FieldComparisonAnalysis fields to the camelCase format expected by frontend
        field_comparisons = []
        for fc in comparison_data.get("field_analyses", []):
            field_comparisons.append(
                {
                    "fieldName": fc.get("field_name"),
                    "azureValue": fc.get("azure_value"),
                    "dspyValue": fc.get("dspy_value"),
                    "match": fc.get("are_semantically_equal", False),
                    "confidence": fc.get("confidence_score", 0.0),
                    "needsReview": fc.get("requires_human_review", False),
                    "comparisonNotes": fc.get("reasoning", ""),
                    "recommendedValue": fc.get("recommended_value"),
                }
            )

        yield _broadcast(context, user_id, "hitlWaiting", {
            "fieldsForReview": step4_output.get("fields_needing_review", []),
            "timeoutSeconds": HITL_TIMEOUT_HOURS * 3600,
            "comparisonSummary": comparison_summary,
            "fieldComparisons": field_comparisons,
            "reviewUrl": f"/api/idp/hitl/review/{context.instance_id}",
        })

        approval_task = context.wait_for_external_event(HITL_REVIEW_EVENT)
        timeout_task = context.create_timer(
            context.current_utc_datetime + timedelta(hours=HITL_TIMEOUT_HOURS)
        )

        winner = yield context.task_any([approval_task, timeout_task])

        if winner == approval_task:
            # Cancel the timer - important per MS docs
            if not timeout_task.is_completed:
                timeout_task.cancel()  # type: ignore

            human_response = parse_human_approval(approval_task.result)

            if human_response.get("approved", False):
                context.set_custom_status(
                    f"[{request_id}] HITL: Approved by {human_response.get('reviewer', 'unknown')}"
                )

                # Broadcast HITL approved via SignalR
                yield _broadcast(context, user_id, "hitlApproved", {
                    "reviewer": human_response.get("reviewer", "unknown"),
                    "feedback": human_response.get("feedback", ""),
                })

                logger.info(f"[{request_id}] HITL: Content approved")
            else:
                context.set_custom_status(f"[{request_id}] HITL: Changes requested")

                # Broadcast HITL rejected via SignalR
                yield _broadcast(context, user_id, "hitlRejected", {
                    "reviewer": human_response.get("reviewer", "unknown"),
                    "feedback": human_response.get("feedback", ""),
                })

                logger.info(
                    f"[{request_id}] HITL: Changes requested - "
                    f"Feedback: {human_response.get('feedback', '')}"
                )
        else:
            context.set_custom_status(
                f"[{request_id}] HITL: TIMEOUT after {HITL_TIMEOUT_HOURS} hours"
            )
            raise TimeoutError(f"Human review timeout for request {request_id}")

        # Broadcast step 5 completed via SignalR
        dn, sn = _step_display(STEP5_HUMAN_REVIEW)
        yield _broadcast(context, user_id, "stepCompleted", {
            "stepName": STEP5_HUMAN_REVIEW,
            "displayName": dn,
            "stepNumber": sn,
            "status": "completed",
            "durationMs": int((context.current_utc_datetime - hitl_start_time).total_seconds() * 1000),
            "outputPreview": f"{'Approved' if human_response.get('approved') else 'Rejected'} by {human_response.get('reviewer', 'unknown')}",
            "outputData": {
                "approved": human_response.get("approved", False),
                "reviewer": human_response.get("reviewer", "unknown"),
                "feedback": human_response.get("feedback", ""),
                "accepted_values_count": len(human_response.get("accepted_values", {})),
                "field_selections_count": len(human_response.get("field_selections", [])),
            },
        })

        # ====================================================================
        # STEP 6: REASONING AND SUMMARY (AI Foundry Agent with Tools)
        # ====================================================================

        # Broadcast step started via SignalR
        dn, sn = _step_display(STEP6_REASONING_AGENT)
        yield _broadcast(context, user_id, "stepStarted", {
            "stepName": STEP6_REASONING_AGENT,
            "displayName": dn,
            "stepNumber": sn,
            "status": "in_progress",
        })

        try:
            reasoning_result = yield context.call_activity(
                "activity_step_06_reasoning_agent",
                {
                    "document_type": primary_category,
                    "azure_data": azure_output.get("extracted_data", {}),
                    "dspy_data": dspy_output.get("extracted_data", {}),
                    "comparison_result": comparison_data,
                    "human_approved": human_response.get("approved", False),
                    "human_feedback": human_response.get("feedback", ""),
                    # NEW: Pass human-accepted values for final consolidation
                    "accepted_values": human_response.get("accepted_values", {}),
                    "default_source": human_response.get(
                        "default_source", "comparison"
                    ),
                    "domain_id": domain_id,
                    "request_id": request_id,
                    # For streaming support
                    "instance_id": context.instance_id,
                },
            )

            reasoning_data = reasoning_result.get("reasoning_result", {})
            step6_output = reasoning_result.get("step_output", {})
            # Include AI summary and recommendations for frontend display
            step6_output["ai_summary"] = reasoning_data.get("ai_summary", "")
            step6_output["recommendations"] = reasoning_data.get("recommendations", [])

            logger.info(
                f"[{request_id}] Step 6 completed: "
                f"confidence={step6_output.get('confidence_score', 0):.2f}"
            )

            # Broadcast reasoning chunks for real-time updates
            chunk_index = 0

            # Chunk 1: Validations summary
            if step6_output.get("total_validations", 0) > 0:
                yield _broadcast(context, user_id, "reasoningChunk", {
                    "chunkType": "validation_summary",
                    "content": f"✓ Validation Results: {step6_output.get('passed_validations', 0)}/{step6_output.get('total_validations', 0)} passed",
                    "chunkIndex": chunk_index,
                    "metadata": {
                        "passed": step6_output.get("passed_validations", 0),
                        "total": step6_output.get("total_validations", 0),
                    },
                })
                chunk_index += 1

            # Chunk 2: Field matching summary
            if step6_output.get("total_fields", 0) > 0:
                matching_pct = (
                    step6_output.get("matching_fields", 0)
                    / step6_output.get("total_fields", 1)
                ) * 100
                yield _broadcast(context, user_id, "reasoningChunk", {
                    "chunkType": "field_matching",
                    "content": f"📊 Field Matching: {step6_output.get('matching_fields', 0)}/{step6_output.get('total_fields', 0)} fields match ({matching_pct:.1f}%)",
                    "chunkIndex": chunk_index,
                    "metadata": {
                        "matching": step6_output.get("matching_fields", 0),
                        "total": step6_output.get("total_fields", 0),
                        "percentage": matching_pct,
                    },
                })
                chunk_index += 1

            # Chunk 3: Confidence score
            yield _broadcast(context, user_id, "reasoningChunk", {
                "chunkType": "confidence",
                "content": f"🎯 Confidence Score: {step6_output.get('confidence_score', 0):.2%}",
                "chunkIndex": chunk_index,
                "metadata": {
                    "score": step6_output.get("confidence_score", 0),
                },
            })
            chunk_index += 1

            # Chunk 4: AI Summary and recommendations (if available)
            if reasoning_data.get("ai_summary"):
                yield _broadcast(context, user_id, "reasoningChunk", {
                    "chunkType": "summary",
                    "content": reasoning_data.get("ai_summary", ""),
                    "chunkIndex": chunk_index,
                    "metadata": {
                        "recommendation_count": len(reasoning_data.get("recommendations", [])),
                    },
                })
                chunk_index += 1

            # Chunk 5: Final result
            yield _broadcast(context, user_id, "reasoningChunk", {
                "chunkType": "final",
                "content": "✅ Reasoning analysis complete",
                "chunkIndex": chunk_index,
                "metadata": {
                    "is_final": True,
                },
            })

            # Broadcast step completed via SignalR

            dn, sn = _step_display(STEP6_REASONING_AGENT)
            yield _broadcast(context, user_id, "stepCompleted", {
                "stepName": STEP6_REASONING_AGENT,
                "displayName": dn,
                "stepNumber": sn,
                "status": "completed",
                "durationMs": step6_output.get("processing_time_ms", 0),
                "outputPreview": _generate_output_preview(step6_output, STEP6_REASONING_AGENT),
                "outputData": step6_output,
            })

        except Exception as e:
            error_msg = str(e)
            context.set_custom_status(f"[{request_id}] Step 6 FAILED: {error_msg}")
            
            # Broadcast step failure via SignalR
            dn, sn = _step_display(STEP6_REASONING_AGENT)
            yield _broadcast(context, user_id, "stepFailed", {
                "stepName": STEP6_REASONING_AGENT,
                "displayName": dn,
                "stepNumber": sn,
                "status": "failed",
                "errorMessage": error_msg,
                "errorType": type(e).__name__,
            })
            raise

        # ====================================================================
        # RETURN FINAL OUTPUT
        # ====================================================================
        context.set_custom_status(f"[{request_id}] Workflow complete")

        # Prepare final result
        final_result = {
            "request_id": request_id,
            "steps": {
                STEP1_PDF_EXTRACTION: step1_output,
                STEP2_CLASSIFICATION: step2_output,
                STEP3_AZURE_EXTRACTION: azure_output,
                STEP3_DSPY_EXTRACTION: dspy_output,
                STEP4_COMPARISON: step4_output,
                STEP6_REASONING_AGENT: step6_output,
            },
            "summary": {
                "document_type": reasoning_data.get("document_type", primary_category),
                "ai_summary": reasoning_data.get("ai_summary", ""),
                "recommendations": reasoning_data.get("recommendations", []),
                "confidence_score": reasoning_data.get("confidence_score", 0),
                "reasoning_engine": "agent",
            },
            "validation": {
                "total": step6_output.get("total_validations", 0),
                "passed": step6_output.get("passed_validations", 0),
                "failed": step6_output.get("failed_validations", 0),
            },
            "consolidated_fields": reasoning_data.get("consolidated_fields", {}),
            "comparison_summary": {
                "total_fields": step4_output.get("total_fields", 0),
                "matching_fields": step4_output.get("matching_fields", 0),
                "match_percentage": step4_output.get("match_percentage", 0),
                "requires_human_review": step4_output.get(
                    "requires_human_review", False
                ),
                "fields_needing_review": step4_output.get("fields_needing_review", []),
            },
            "human_reviewer": human_response.get("reviewer"),
            "review_feedback": human_response.get("feedback"),
            "created_at": context.current_utc_datetime.isoformat(),
        }

        # Broadcast workflow completed via SignalR
        yield _broadcast(context, user_id, "workflowCompleted", {
            "summary": {
                "document_type": reasoning_data.get("document_type", primary_category),
                "confidence_score": reasoning_data.get("confidence_score", 0),
                "total_fields": step4_output.get("total_fields", 0),
                "matching_fields": step4_output.get("matching_fields", 0),
            },
            "resultUrl": f"/runtime/webhooks/durabletask/instances/{context.instance_id}",
        })

        return final_result
