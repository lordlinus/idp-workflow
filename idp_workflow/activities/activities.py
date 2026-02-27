"""Activity functions for the IDP workflow."""

import logging

from idp_workflow.models import PDFContent

logger = logging.getLogger(__name__)


def register_activities(app):
    """Register all activity functions with the Azure Functions app."""

    @app.activity_trigger(input_name="extract_request")
    async def activity_step_01_pdf_extraction(extract_request: dict) -> dict:
        """Extract PDF to markdown."""
        try:
            from idp_workflow.config import (
                AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
                AZURE_DOCUMENT_INTELLIGENCE_KEY,
            )
            from idp_workflow.steps.step_01_pdf_extractor import PDFMarkdownExtractor

            pdf_path = extract_request.get("pdf_path")
            request_id = extract_request.get("request_id")

            logger.info(f"[{request_id}] Starting PDF extraction: {pdf_path}")

            extractor = PDFMarkdownExtractor(
                endpoint=AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
                api_key=AZURE_DOCUMENT_INTELLIGENCE_KEY,
            )

            pdf_content, step_output = await extractor.extract(pdf_path)  # type: ignore

            logger.info(
                f"[{request_id}] PDF extraction complete: {step_output.total_pages} pages"
            )

            return {
                "pdf_content": {
                    "file_path": pdf_content.file_path,
                    "total_pages": pdf_content.total_pages,
                    "pages": pdf_content.pages,
                    "full_text": pdf_content.full_text,
                    "characters": len(pdf_content.full_text),
                    "pages_count": len(pdf_content.pages),
                },
                "step_output": step_output.model_dump(),
            }
        except Exception as e:
            logger.error(
                f"[{extract_request.get('request_id')}] PDF extraction failed: {e}"
            )
            raise

    @app.activity_trigger(input_name="classify_request")
    async def activity_step_02_classification(classify_request: dict) -> dict:
        """Classify document pages."""
        try:
            from idp_workflow.config import DOMAINS_DIR
            from idp_workflow.steps.step_02_classifier import DocumentClassificationExecutor
            from idp_workflow.tools.llm_factory import create_dspy_lm

            request_id = classify_request.get("request_id")
            max_pages = classify_request.get("max_pages", 50)
            options = classify_request.get("options", {})
            custom_categories = classify_request.get("custom_classification_categories")

            logger.info(f"[{request_id}] Starting document classification")

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
                )
            else:
                categories_path = DOMAINS_DIR / classify_request.get(
                    "domain_id", "insurance_claims"
                )
                categories_path = categories_path / "classification_categories.json"
                classifier = DocumentClassificationExecutor(
                    categories_path=categories_path,
                    lm=lm,
                )

            classification_result, step_output = await classifier.classify(
                pdf_content, max_pages=max_pages
            )

            logger.info(
                f"[{request_id}] Classification complete: "
                f"{step_output.pages_classified} pages classified"
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
            }
        except Exception as e:
            logger.error(
                f"[{classify_request.get('request_id')}] Classification failed: {e}"
            )
            raise

    @app.activity_trigger(input_name="extract_request")
    async def activity_step_03_01_azure_extraction(extract_request: dict) -> dict:
        """Extract data using Azure Content Understanding."""
        try:
            from idp_workflow.steps.step_03_extractors import AzureExtractor

            request_id = extract_request.get("request_id")
            domain_id = extract_request.get("domain_id", "insurance_claims")
            max_pages = extract_request.get("max_pages", 50)
            pdf_path = extract_request.get("pdf_path")
            custom_schema = extract_request.get("custom_extraction_schema")

            if not pdf_path:
                raise ValueError("pdf_path is required for Azure extraction")

            logger.info(
                f"[{request_id}] Starting Azure CU extraction from PDF: {pdf_path}"
            )

            extractor = AzureExtractor(
                domain_id=domain_id,
                schema_dict=custom_schema,
            )
            extraction_result, step_output = await extractor.extract(
                pdf_path=pdf_path, max_pages=max_pages
            )

            logger.info(
                f"[{request_id}] Azure extraction complete: "
                f"{extraction_result.total_pages_processed} pages"
            )

            return {
                "extraction_result": extraction_result.model_dump(),
                "step_output": step_output,
            }
        except Exception as e:
            logger.error(
                f"[{extract_request.get('request_id')}] Azure extraction failed: {e}"
            )
            raise

    @app.activity_trigger(input_name="extract_request")
    async def activity_step_03_02_dspy_extraction(extract_request: dict) -> dict:
        """Extract data using DSPy."""
        try:
            from idp_workflow.steps.step_03_extractors import DSPyExtractor
            from idp_workflow.tools.llm_factory import create_dspy_lm

            request_id = extract_request.get("request_id")
            domain_id = extract_request.get("domain_id", "insurance_claims")
            full_text = extract_request.get("full_text", "")
            total_pages = extract_request.get("total_pages", 0)
            options = extract_request.get("options", {})
            custom_schema = extract_request.get("custom_extraction_schema")

            if not full_text:
                raise ValueError("full_text is required for DSPy extraction")

            logger.info(
                f"[{request_id}] Starting DSPy extraction from {len(full_text)} chars"
            )

            lm = create_dspy_lm(options)

            extractor = DSPyExtractor(
                domain_id=domain_id,
                lm=lm,
                schema_dict=custom_schema,
            )
            extraction_result, step_output = await extractor.extract(
                full_text=full_text, total_pages=total_pages
            )

            logger.info(
                f"[{request_id}] DSPy extraction complete: "
                f"{extraction_result.total_pages_processed} pages"
            )

            return {
                "extraction_result": extraction_result.model_dump(),
                "step_output": step_output,
            }
        except Exception as e:
            logger.error(
                f"[{extract_request.get('request_id')}] DSPy extraction failed: {e}"
            )
            raise

    @app.activity_trigger(input_name="compare_request")
    async def activity_step_04_comparison(compare_request: dict) -> dict:
        """Compare Azure and DSPy extraction results."""
        try:
            from idp_workflow.steps.step_04_comparator import ExtractionComparator

            request_id = compare_request.get("request_id")
            azure_data = compare_request.get("azure_data", {})
            dspy_data = compare_request.get("dspy_data", {})
            document_context = compare_request.get(
                "document_context", "Insurance Claim"
            )

            logger.info(
                f"[{request_id}] Starting comparison: "
                f"Azure has {len(azure_data)} fields, DSPy has {len(dspy_data)} fields"
            )

            comparator = ExtractionComparator()
            comparison_result = comparator.compare(
                azure_data=azure_data,
                dspy_data=dspy_data,
                document_context=document_context,
            )

            logger.info(
                f"[{request_id}] Comparison complete: "
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
            logger.error(
                f"[{compare_request.get('request_id')}] Comparison failed: {e}"
            )
            raise

    @app.activity_trigger(input_name="reasoning_request")
    async def activity_step_06_reasoning_agent(reasoning_request: dict) -> dict:
        """Generate reasoning summary using AI Foundry Agent with tools."""
        try:
            from idp_workflow.steps.step_06_reasoning_agent import AgentReasoningEngine

            request_id = reasoning_request.get("request_id")
            instance_id = reasoning_request.get("instance_id")
            domain_id = reasoning_request.get("domain_id", "insurance_claims")
            document_type = reasoning_request.get("document_type", "Unknown")
            azure_data = reasoning_request.get("azure_data", {})
            dspy_data = reasoning_request.get("dspy_data", {})
            comparison_result = reasoning_request.get("comparison_result", {})
            human_approved = reasoning_request.get("human_approved", False)
            human_feedback = reasoning_request.get("human_feedback", "")
            accepted_values = reasoning_request.get("accepted_values", {})
            default_source = reasoning_request.get("default_source", "comparison")

            logger.info(
                f"[{request_id}] Starting Agent-based reasoning with "
                f"Azure: {len(azure_data)} fields, DSPy: {len(dspy_data)} fields, "
                f"Human-accepted: {len(accepted_values)} fields"
            )

            engine = AgentReasoningEngine(domain_id=domain_id, instance_id=instance_id)
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

            logger.info(
                f"[{request_id}] Agent reasoning complete: "
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
            logger.error(
                f"[{reasoning_request.get('request_id')}] Agent reasoning failed: {e}"
            )
            raise
