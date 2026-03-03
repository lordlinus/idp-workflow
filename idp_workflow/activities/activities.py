"""Activity functions for the IDP workflow."""

import logging

from idp_workflow.activities.utils import ActivityContext
from idp_workflow.errors import (
    ClassificationError,
    ComparisonError,
    ExtractionError,
    ReasoningError,
)
from idp_workflow.models import PDFContent

logger = logging.getLogger(__name__)


def _create_signalr_client():
    """Try to create a SignalR REST client; return None on failure."""
    try:
        from idp_workflow.utils.signalr_rest_client import SignalRRestClient
        return SignalRRestClient()
    except Exception as exc:
        logger.warning(f"Could not init SignalR REST client: {exc}")
        return None


def register_activities(app):
    """Register all activity functions with the Azure Functions app."""

    @app.activity_trigger(input_name="extract_request")
    async def activity_step_01_pdf_extraction(extract_request: dict) -> dict:
        """Extract PDF to markdown."""
        ctx = ActivityContext(extract_request, "PDF extraction")
        try:
            from idp_workflow.config import (
                AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
                AZURE_DOCUMENT_INTELLIGENCE_KEY,
            )
            from idp_workflow.steps.step_01_pdf_extractor import PDFMarkdownExtractor
            from idp_workflow.utils.helpers import resolve_pdf_path

            pdf_path = extract_request.get("pdf_path")

            # Resolve blob paths to local temp files
            pdf_path = resolve_pdf_path(pdf_path)

            ctx.log_start(str(pdf_path))

            extractor = PDFMarkdownExtractor(
                endpoint=AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
                api_key=AZURE_DOCUMENT_INTELLIGENCE_KEY,
            )

            pdf_content, step_output = await extractor.extract(pdf_path)  # type: ignore

            ctx.log_complete(
                f"{step_output.total_pages} pages in {ctx.elapsed_ms}ms"
            )

            step_output_dict = step_output.model_dump()
            step_output_dict["processing_time_ms"] = ctx.elapsed_ms

            return {
                "pdf_content": {
                    "file_path": pdf_content.file_path,
                    "total_pages": pdf_content.total_pages,
                    "pages": pdf_content.pages,
                    "full_text": pdf_content.full_text,
                    "characters": len(pdf_content.full_text),
                    "pages_count": len(pdf_content.pages),
                },
                "step_output": step_output_dict,
            }
        except Exception as e:
            ctx.log_error(e)
            raise ExtractionError(
                str(e),
                request_id=ctx.request_id,
                step_name="step_01_pdf_extraction",
            ) from e

    @app.activity_trigger(input_name="classify_request")
    async def activity_step_02_classification(classify_request: dict) -> dict:
        """Classify document pages."""
        ctx = ActivityContext(classify_request, "Classification")
        try:
            from idp_workflow.config import DOMAINS_DIR
            from idp_workflow.constants import STEP2_CLASSIFICATION
            from idp_workflow.steps.step_02_classifier import (
                DocumentClassificationExecutor,
            )
            from idp_workflow.tools.llm_factory import create_dspy_lm

            user_id = classify_request.get("user_id", "")
            instance_id = classify_request.get("instance_id", "")
            max_pages = classify_request.get("max_pages", 50)
            options = classify_request.get("options", {})
            custom_categories = classify_request.get("custom_classification_categories")

            ctx.log_start()

            # Build streaming progress callback
            on_progress = None
            if user_id and instance_id:
                signalr = _create_signalr_client()
                if signalr:
                    def _on_cls_progress(page_idx: int, total: int, category: str, confidence: float) -> None:
                        signalr.send_step_progress(
                            user_id=user_id,
                            instance_id=instance_id,
                            step_name=STEP2_CLASSIFICATION,
                            message=f"Page {page_idx + 1}/{total}: {category}",
                            progress=round((page_idx + 1) / total * 100),
                            detail=f"{confidence:.0%} confidence",
                            sub_step=f"page_{page_idx + 1}",
                        )
                    on_progress = _on_cls_progress

            pdf_content_dict = classify_request.get("pdf_content", {})
            pdf_content = PDFContent(
                file_path=pdf_content_dict.get("file_path", ""),
                pages=pdf_content_dict.get("pages", []),
                total_pages=pdf_content_dict.get("total_pages", 1),
                full_text=pdf_content_dict.get("full_text", ""),
            )

            lm = create_dspy_lm(options)

            # Use custom categories if provided, otherwise load from domain
            if custom_categories:
                classifier = DocumentClassificationExecutor(
                    categories=custom_categories,
                    lm=lm,
                    on_progress=on_progress,
                )
            else:
                categories_path = DOMAINS_DIR / classify_request.get(
                    "domain_id", "insurance_claims"
                )
                categories_path = categories_path / "classification_categories.json"
                classifier = DocumentClassificationExecutor(
                    categories_path=categories_path,
                    lm=lm,
                    on_progress=on_progress,
                )

            classification_result, step_output = await classifier.classify(
                pdf_content, max_pages=max_pages
            )

            ctx.log_complete(
                f"{step_output.pages_classified} pages classified in {ctx.elapsed_ms}ms"
            )

            return {
                "classification_result": {
                    "pdf_content": {
                        "file_path": classification_result.pdf_content.file_path,
                        "pages": classification_result.pdf_content.pages,
                        "total_pages": classification_result.pdf_content.total_pages,
                        "full_text": classification_result.pdf_content.full_text,
                    },
                    "categories": [
                        {
                            "category": cat.category,
                            "confidence": cat.confidence,
                            "detected_fields": cat.detected_fields,
                            "page_number": cat.page_number,
                        }
                        for cat in classification_result.categories
                    ],
                },
                "classifications": step_output.model_dump(),
                "primary_category": step_output.primary_category,
                "processing_time_ms": ctx.elapsed_ms,
            }
        except Exception as e:
            ctx.log_error(e)
            raise ClassificationError(
                str(e),
                request_id=ctx.request_id,
                step_name="step_02_classification",
            ) from e

    @app.activity_trigger(input_name="extract_request")
    async def activity_step_03_01_azure_extraction(extract_request: dict) -> dict:
        """Extract data using Azure Content Understanding."""
        ctx = ActivityContext(extract_request, "Azure CU extraction")
        try:
            from idp_workflow.constants import STEP3_AZURE_EXTRACTION
            from idp_workflow.steps.step_03_extractors import AzureExtractor
            from idp_workflow.utils.helpers import resolve_pdf_path

            user_id = extract_request.get("user_id", "")
            instance_id = extract_request.get("instance_id", "")
            domain_id = extract_request.get("domain_id", "insurance_claims")
            max_pages = extract_request.get("max_pages", 50)
            pdf_path = extract_request.get("pdf_path")
            custom_schema = extract_request.get("custom_extraction_schema")

            if not pdf_path:
                raise ValueError("pdf_path is required for Azure extraction")

            # Resolve blob paths to local temp files
            pdf_path = resolve_pdf_path(pdf_path)

            ctx.log_start(f"from PDF: {pdf_path}")

            # Build streaming progress callback
            on_progress = None
            if user_id and instance_id:
                signalr = _create_signalr_client()
                if signalr:
                    def _on_azure_progress(message: str, detail: str | None = None) -> None:
                        signalr.send_step_progress(
                            user_id=user_id,
                            instance_id=instance_id,
                            step_name=STEP3_AZURE_EXTRACTION,
                            message=message,
                            detail=detail,
                        )
                    on_progress = _on_azure_progress

            extractor = AzureExtractor(
                domain_id=domain_id,
                schema_dict=custom_schema,
                on_progress=on_progress,
            )
            extraction_result, step_output = await extractor.extract(
                pdf_path=pdf_path, max_pages=max_pages
            )

            ctx.log_complete(
                f"{extraction_result.total_pages_processed} pages"
            )

            # Notify frontend immediately (don't wait for task_all in orchestrator)
            if user_id and instance_id:
                signalr_client = _create_signalr_client()
                if signalr_client:
                    from idp_workflow.constants import STEP_META
                    dn, sn = STEP_META.get(STEP3_AZURE_EXTRACTION, ("Azure CU Extraction", 3))
                    signalr_client.send_step_completed(
                        user_id=user_id,
                        instance_id=instance_id,
                        step_name=STEP3_AZURE_EXTRACTION,
                        display_name=dn,
                        step_number=sn,
                        duration_ms=ctx.elapsed_ms,
                        output_preview=f"Azure: {extraction_result.total_pages_processed} pages processed",
                        output_data=step_output,
                    )

            return {
                "extraction_result": extraction_result.model_dump(),
                "step_output": step_output,
            }
        except Exception as e:
            ctx.log_error(e)
            raise ExtractionError(
                str(e),
                request_id=ctx.request_id,
                step_name="step_03_01_azure_extraction",
            ) from e

    @app.activity_trigger(input_name="extract_request")
    async def activity_step_03_02_dspy_extraction(extract_request: dict) -> dict:
        """Extract data using DSPy."""
        ctx = ActivityContext(extract_request, "DSPy extraction")
        try:
            from idp_workflow.constants import STEP3_DSPY_EXTRACTION
            from idp_workflow.steps.step_03_extractors import DSPyExtractor
            from idp_workflow.tools.llm_factory import create_dspy_lm
            from idp_workflow.utils.checkbox_enricher import (
                enrich_markdown_with_checkbox_context,
            )

            user_id = extract_request.get("user_id", "")
            instance_id = extract_request.get("instance_id", "")
            domain_id = extract_request.get("domain_id", "insurance_claims")
            full_text = extract_request.get("full_text", "")
            total_pages = extract_request.get("total_pages", 0)
            options = extract_request.get("options", {})
            custom_schema = extract_request.get("custom_extraction_schema")
            pdf_path = extract_request.get("pdf_path", "")

            if not full_text:
                raise ValueError("full_text is required for DSPy extraction")

            # Enrich markdown with checkbox context if ☐/☒ symbols are present.
            # DI's markdown serialization separates checkbox symbols from their
            # question text in multi-column form layouts. The enricher appends
            # an interpretation guide so the LLM can associate checkboxes with
            # questions correctly.
            full_text = enrich_markdown_with_checkbox_context(full_text)

            # Convert PDF pages to images for multimodal extraction
            page_images: list[str] | None = None
            if pdf_path:
                try:
                    from idp_workflow.tools.image_utils import pdf_to_base64_images
                    page_images = pdf_to_base64_images(pdf_path)
                    logger.info(f"Converted {len(page_images)} page(s) to images for multimodal DSPy")
                except Exception as img_err:
                    logger.warning(f"Could not convert PDF to images, falling back to text-only: {img_err}")
                    page_images = None

            mode = "multimodal" if page_images else "text-only"
            ctx.log_start(f"{mode}, {len(full_text)} chars")

            # Build streaming progress callback
            on_progress = None
            if user_id and instance_id:
                signalr = _create_signalr_client()
                if signalr:
                    def _on_dspy_progress(message: str, detail: str | None = None) -> None:
                        signalr.send_step_progress(
                            user_id=user_id,
                            instance_id=instance_id,
                            step_name=STEP3_DSPY_EXTRACTION,
                            message=message,
                            detail=detail,
                        )
                    on_progress = _on_dspy_progress

            lm = create_dspy_lm(options)

            extractor = DSPyExtractor(
                domain_id=domain_id,
                lm=lm,
                schema_dict=custom_schema,
                on_progress=on_progress,
            )
            extraction_result, step_output = await extractor.extract(
                full_text=full_text,
                total_pages=total_pages,
                page_images=page_images,
            )

            ctx.log_complete(
                f"{extraction_result.total_pages_processed} pages"
            )

            # Notify frontend immediately (don't wait for task_all in orchestrator)
            if user_id and instance_id:
                signalr_client = _create_signalr_client()
                if signalr_client:
                    from idp_workflow.constants import STEP_META
                    dn, sn = STEP_META.get(STEP3_DSPY_EXTRACTION, ("DSPy Extraction", 3))
                    signalr_client.send_step_completed(
                        user_id=user_id,
                        instance_id=instance_id,
                        step_name=STEP3_DSPY_EXTRACTION,
                        display_name=dn,
                        step_number=sn,
                        duration_ms=ctx.elapsed_ms,
                        output_preview=f"DSPy: {extraction_result.total_pages_processed} pages processed",
                        output_data=step_output,
                    )

            return {
                "extraction_result": extraction_result.model_dump(),
                "step_output": step_output,
            }
        except Exception as e:
            ctx.log_error(e)
            raise ExtractionError(
                str(e),
                request_id=ctx.request_id,
                step_name="step_03_02_dspy_extraction",
            ) from e

    @app.activity_trigger(input_name="compare_request")
    async def activity_step_04_comparison(compare_request: dict) -> dict:
        """Compare Azure and DSPy extraction results."""
        ctx = ActivityContext(compare_request, "Comparison")
        try:
            from idp_workflow.steps.step_04_comparator import ExtractionComparator

            azure_data = compare_request.get("azure_data", {})
            dspy_data = compare_request.get("dspy_data", {})
            document_context = compare_request.get(
                "document_context", "Insurance Claim"
            )

            ctx.log_start(
                f"Azure has {len(azure_data)} fields, DSPy has {len(dspy_data)} fields"
            )

            comparator = ExtractionComparator()
            comparison_result = comparator.compare(
                azure_data=azure_data,
                dspy_data=dspy_data,
                document_context=document_context,
            )

            ctx.log_complete(
                f"{comparison_result.matching_fields}/{comparison_result.total_fields} matching "
                f"({comparison_result.match_percentage}%), "
                f"{len(comparison_result.fields_needing_review)} need review"
            )

            step_output = {
                "total_fields": comparison_result.total_fields,
                "matching_fields": comparison_result.matching_fields,
                "differing_fields": comparison_result.differing_fields,
                "match_percentage": comparison_result.match_percentage,
                "requires_human_review": comparison_result.requires_human_review,
                "fields_needing_review": comparison_result.fields_needing_review,
                "processing_time_ms": comparison_result.processing_time_ms,
            }

            return {
                "comparison_result": comparison_result.model_dump(),
                "step_output": step_output,
            }
        except Exception as e:
            ctx.log_error(e)
            raise ComparisonError(
                str(e),
                request_id=ctx.request_id,
                step_name="step_04_comparison",
            ) from e

    @app.activity_trigger(input_name="reasoning_request")
    async def activity_step_06_reasoning_agent(reasoning_request: dict) -> dict:
        """Generate reasoning summary using AI Foundry Agent with tools."""
        ctx = ActivityContext(reasoning_request, "Agent reasoning")
        try:
            from idp_workflow.steps.step_06_reasoning_agent import AgentReasoningEngine
            from idp_workflow.utils.signalr_rest_client import SignalRRestClient

            instance_id = reasoning_request.get("instance_id")
            user_id = reasoning_request.get("user_id", "")
            domain_id = reasoning_request.get("domain_id", "insurance_claims")
            document_type = reasoning_request.get("document_type", "Unknown")
            azure_data = reasoning_request.get("azure_data", {})
            dspy_data = reasoning_request.get("dspy_data", {})
            comparison_result = reasoning_request.get("comparison_result", {})
            human_approved = reasoning_request.get("human_approved", False)
            human_feedback = reasoning_request.get("human_feedback", "")
            accepted_values = reasoning_request.get("accepted_values", {})
            default_source = reasoning_request.get("default_source", "comparison")

            ctx.log_start(
                f"with Azure: {len(azure_data)} fields, DSPy: {len(dspy_data)} fields, "
                f"Human-accepted: {len(accepted_values)} fields"
            )

            # Build a real-time SignalR callback so chunks stream to the
            # frontend while the activity is still running.
            on_chunk = None
            if user_id and instance_id:
                try:
                    signalr = SignalRRestClient()

                    def _send_chunk(
                        chunk_type: str, content: str, metadata: dict | None = None
                    ) -> None:
                        signalr.send_reasoning_chunk(
                            user_id=user_id,
                            instance_id=instance_id,
                            chunk_type=chunk_type,
                            content=content,
                            chunk_index=(metadata or {}).get("chunkIndex", 0),
                            metadata=metadata,
                        )

                    on_chunk = _send_chunk
                    ctx.log(
                        f"SignalR direct streaming enabled for user {user_id}"
                    )
                except Exception as exc:
                    ctx.log(
                        f"Could not init SignalR REST client, "
                        f"falling back to non-streaming: {exc}",
                        level="warning",
                    )

            engine = AgentReasoningEngine(
                domain_id=domain_id,
                instance_id=instance_id,
                on_chunk=on_chunk,
            )
            summary = await engine.generate_summary(
                document_type=document_type,
                azure_data=azure_data,
                dspy_data=dspy_data,
                comparison_result=comparison_result,
                human_approved=human_approved,
                human_feedback=human_feedback,
                accepted_values=accepted_values,
                default_source=default_source,
            )

            ctx.log_complete(
                f"{summary.passed_validations}/{summary.total_validations} validations passed, "
                f"confidence: {summary.confidence_score:.2f}"
            )

            step_output = {
                "total_validations": summary.total_validations,
                "passed_validations": summary.passed_validations,
                "failed_validations": summary.failed_validations,
                "total_fields": summary.total_fields,
                "matching_fields": summary.matching_fields,
                "confidence_score": summary.confidence_score,
                "human_approved": summary.human_approved,
                "recommendations_count": len(summary.recommendations),
                "processing_time_ms": summary.processing_time_ms,
                "engine": "agent_framework",  # Indicate this used Agent Framework
            }

            return {
                "reasoning_result": summary.model_dump(),
                "step_output": step_output,
            }
        except Exception as e:
            ctx.log_error(e)
            raise ReasoningError(
                str(e),
                request_id=ctx.request_id,
                step_name="step_06_reasoning_agent",
            ) from e
