"""Step 3: Data Extraction (Azure Content Understanding and DSPy)."""

import asyncio
import json
import logging
import time
from pathlib import Path
from typing import Any

import dspy
from pydantic import BaseModel

from idp_workflow.config import (
    COGNITIVE_SERVICES_ENDPOINT,
    COGNITIVE_SERVICES_KEY,
    AZURE_AI_CU_API_VERSION,
    AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_KEY,
    AZURE_OPENAI_CHAT_DEPLOYMENT_NAME,
    AZURE_OPENAI_API_VERSION,
    DOMAINS_DIR,
)
from idp_workflow.models import ExtractionResult
from idp_workflow.tools import (
    AzureContentUnderstandingClient,
    calculate_confidence_scores,
    create_extraction_model_from_schema,
    create_extraction_model_from_dict,
    create_extraction_signature,
)

logger = logging.getLogger(__name__)


class AzureExtractor:
    """Azure Content Understanding extractor - takes PDF directly."""

    def __init__(
        self,
        domain_id: str,
        schema_path: Path | None = None,
        schema_dict: dict | None = None,
    ):
        """Initialize Azure extractor.

        Args:
            domain_id: Domain identifier for loading default schema
            schema_path: Explicit path to schema file (overrides domain default)
            schema_dict: Ad-hoc schema dict (overrides both domain default and schema_path)
        """
        self.domain_id = domain_id
        self._schema_dict = None

        if schema_dict is not None:
            # Ad-hoc schema: use hash-based analyzer ID to avoid collisions
            import hashlib
            schema_hash = hashlib.sha256(
                json.dumps(schema_dict, sort_keys=True).encode()
            ).hexdigest()[:12]
            self.analyzer_id = f"analyzer_adhoc_{schema_hash}"
            self._schema_dict = schema_dict
            self.schema_path = None
        else:
            # Domain-based: derive analyzer ID from domain
            self.analyzer_id = f"analyzer_{domain_id.replace('-', '_')}"

            if schema_path is None:
                domain_dir = DOMAINS_DIR / domain_id
                schema_path = domain_dir / "extraction_schema.json"
                if not schema_path.exists():
                    raise FileNotFoundError(
                        f"Extraction schema not found for domain '{domain_id}' at {schema_path}"
                    )

            self.schema_path = Path(schema_path)

        # Initialize Azure Content Understanding client
        self.client = AzureContentUnderstandingClient(
            endpoint=COGNITIVE_SERVICES_ENDPOINT,
            api_version=AZURE_AI_CU_API_VERSION,
            subscription_key=COGNITIVE_SERVICES_KEY,
            x_ms_useragent="maf-idp-workflow",
        )

        self._analyzer_ready = False

    async def extract(
        self, pdf_path: str, max_pages: int = 50
    ) -> tuple[ExtractionResult, dict[str, Any]]:
        """Extract structured data from PDF using Azure Content Understanding."""
        start_time = time.time()

        logger.info(f"Azure extractor: Processing PDF {pdf_path}")

        # Ensure analyzer is ready (creates if needed)
        if not self._analyzer_ready:
            await self._ensure_analyzer_ready()

        # Analyze document directly with Azure CU
        analysis_result = await asyncio.to_thread(self._analyze_document, pdf_path)

        # Extract fields from the analysis result
        extracted_data, confidence_scores = self._extract_fields_from_result(
            analysis_result
        )

        processing_time_ms = (time.time() - start_time) * 1000

        # Get page count from analysis result
        result_data = analysis_result.get("result", {})
        contents = result_data.get("contents", [])
        pages_processed = 0
        if contents:
            # Get end page number from last content block
            last_content = contents[-1] if contents else {}
            pages_processed = last_content.get("endPageNumber", 1)

        # Limit to max_pages
        pages_processed = min(pages_processed, max_pages)

        page_extraction = {
            "page_number": -1,  # -1 indicates full document extraction
            "category": "full_document",
            "extracted_data": extracted_data,
            "confidence_scores": confidence_scores,
        }

        result = ExtractionResult(
            source="azure",
            page_extractions=[page_extraction],
            total_pages_processed=pages_processed,
            processing_time_ms=processing_time_ms,
        )

        # Prepare output for UI
        step_output = {
            "pages_processed": pages_processed,
            "processing_time_ms": round(processing_time_ms),
            "extracted_data": extracted_data,
            "analyzer_id": self.analyzer_id,
        }

        logger.info(
            f"Azure extraction complete: {pages_processed} page(s) in {processing_time_ms:.0f}ms"
        )

        return result, step_output

    def _analyze_document(self, file_path: str) -> dict:
        """Analyze document using Azure Content Understanding."""
        response = self.client.begin_analyze(
            analyzer_id=self.analyzer_id, file_location=file_path
        )
        result = self.client.poll_result(response, timeout_seconds=600)
        return result

    async def _ensure_analyzer_ready(self) -> None:
        """Ensure the domain-specific analyzer exists, create if needed."""
        # Check if analyzer already exists
        try:
            existing = await asyncio.to_thread(
                self.client.get_analyzer_detail_by_id, self.analyzer_id
            )
            if existing:
                logger.info(f"Analyzer {self.analyzer_id} already exists")
                self._analyzer_ready = True
                return
        except Exception as e:
            logger.info(f"Analyzer {self.analyzer_id} not found, will create: {e}")

        # Load schema from dict or file
        if self._schema_dict is not None:
            analyzer_template = self._schema_dict
            logger.info(f"Using ad-hoc schema for analyzer: {self.analyzer_id}")
        elif self.schema_path and self.schema_path.exists():
            logger.info(f"Loading analyzer schema from: {self.schema_path}")
            with open(self.schema_path, "r") as f:
                analyzer_template = json.load(f)
        else:
            raise FileNotFoundError(
                f"No schema available for analyzer {self.analyzer_id}. "
                f"Provide schema_dict or ensure schema file exists."
            )

        # Create analyzer
        logger.info(f"Creating analyzer: {self.analyzer_id}")
        response = await asyncio.to_thread(
            self.client.begin_create_analyzer,
            analyzer_id=self.analyzer_id,
            analyzer_template=analyzer_template,
        )

        # Wait for creation to complete
        await asyncio.to_thread(self.client.poll_result, response, timeout_seconds=120)

        # Verify
        await asyncio.sleep(2)
        verify = await asyncio.to_thread(
            self.client.get_analyzer_detail_by_id, self.analyzer_id
        )
        if not verify:
            raise RuntimeError(
                f"Analyzer {self.analyzer_id} created but verification failed"
            )

        logger.info(f"Analyzer {self.analyzer_id} created successfully")
        self._analyzer_ready = True

    def _extract_fields_from_result(self, analysis_result: dict) -> tuple[dict, dict]:
        """Extract all fields and confidence scores from Azure CU result."""
        extracted_fields = {}
        confidence_scores = {}

        result = analysis_result.get("result", {})
        contents = result.get("contents", [])

        if not contents:
            return extracted_fields, confidence_scores

        # Combine fields from all content blocks
        for content in contents:
            for field_name, field_value in content.get("fields", {}).items():
                field_type = field_value.get("type")

                if field_type == "string":
                    extracted_fields[field_name] = field_value.get("valueString", "")
                elif field_type == "number":
                    extracted_fields[field_name] = field_value.get("valueNumber", 0.0)
                elif field_type == "date":
                    extracted_fields[field_name] = field_value.get("valueDate", "")
                elif field_type == "array":
                    extracted_fields[field_name] = self._extract_array_field(
                        field_value
                    )
                elif field_type == "object":
                    extracted_fields[field_name] = field_value.get("valueObject", {})

                confidence = field_value.get("confidence")
                if confidence is not None:
                    confidence_scores[field_name] = confidence

        return extracted_fields, confidence_scores

    def _extract_array_field(self, field_value: dict) -> list:
        """Extract array field values."""
        items = []
        for item in field_value.get("valueArray", []):
            if item.get("type") == "object":
                obj_dict = {}
                for key, val in item.get("valueObject", {}).items():
                    if val.get("type") == "string":
                        obj_dict[key] = val.get("valueString", "")
                    elif val.get("type") == "number":
                        obj_dict[key] = val.get("valueNumber", 0.0)
                    elif val.get("type") == "date":
                        obj_dict[key] = val.get("valueDate", "")
                items.append(obj_dict)
            else:
                items.append(item.get("valueString") or item.get("valueNumber"))
        return items


class DocumentExtractor(dspy.Module):
    """DSPy module for document field extraction."""

    def __init__(self, extraction_model: type[BaseModel]) -> None:
        super().__init__()
        signature = create_extraction_signature(extraction_model)
        self.extract = dspy.ChainOfThought(signature)
        self._extraction_model = extraction_model

    def forward(self, document_text: str) -> BaseModel:
        """Extract structured data from document text."""
        result = self.extract(document_text=document_text)

        # Access the typed output - DSPy returns it as the field name
        extracted = result.extracted_data

        # Ensure we return a proper Pydantic model instance
        if isinstance(extracted, self._extraction_model):
            return extracted
        elif isinstance(extracted, dict):
            return self._extraction_model(**extracted)
        else:
            # Return default if unexpected type
            return self._extraction_model()


class DSPyExtractor:
    """Extract document fields with DSPy using domain-specific schema."""

    def __init__(
        self,
        domain_id: str,
        lm: dspy.LM,
        schema_path: str | Path | None = None,
        schema_dict: dict | None = None,
    ):
        """Initialize DSPy extractor.

        Args:
            domain_id: Domain identifier for loading default schema
            lm: Configured DSPy language model
            schema_path: Explicit path to schema file (overrides domain default)
            schema_dict: Ad-hoc schema dict (overrides both domain default and schema_path)
        """
        self.domain_id = domain_id
        self.lm = lm

        if schema_dict is not None:
            # Ad-hoc schema: create model from dict directly
            logger.info("Loading DSPy extraction schema from ad-hoc dict")
            self.extraction_model = create_extraction_model_from_dict(schema_dict)
            self.schema_path = None
        else:
            # Load schema from file
            if schema_path is None:
                domain_dir = DOMAINS_DIR / domain_id
                schema_path = domain_dir / "extraction_schema.json"
                if not schema_path.exists():
                    raise FileNotFoundError(
                        f"Extraction schema not found for domain '{domain_id}' at {schema_path}"
                    )

            self.schema_path = Path(schema_path)
            logger.info(f"Loading DSPy extraction schema from: {self.schema_path}")
            self.extraction_model = create_extraction_model_from_schema(self.schema_path)

        # Create extractor module
        self.extractor = DocumentExtractor(extraction_model=self.extraction_model)

    def _extract_sync(self, document_text: str) -> BaseModel:
        """Synchronous extraction wrapper that sets up dspy.context().

        This runs in a thread pool, so we need to set up dspy.context() here.
        """
        with dspy.context(lm=self.lm):
            return self.extractor(document_text=document_text)  # type: ignore

    async def extract(
        self,
        full_text: str,
        total_pages: int = 0,
    ) -> tuple[ExtractionResult, dict[str, Any]]:
        """Extract fields from document markdown using DSPy."""
        start_time = time.time()

        if not full_text or not full_text.strip():
            logger.warning("DSPy extractor: Empty document text provided")
            result = ExtractionResult(
                source="dspy",
                page_extractions=[],
                total_pages_processed=0,
                processing_time_ms=0.0,
            )
            return result, {"error": "Empty document text"}

        logger.info(f"DSPy extractor: Processing {len(full_text)} characters")

        # Extract from the full document text
        try:
            loop = asyncio.get_event_loop()
            extracted_model = await loop.run_in_executor(
                None,
                lambda: self._extract_sync(full_text),
            )
            extracted_data = extracted_model.model_dump()
            confidence_scores = calculate_confidence_scores(extracted_model)
            extraction_error = None
        except Exception as e:
            logger.error(f"DSPy extraction error: {e}")
            extracted_data = self.extraction_model().model_dump()
            confidence_scores = {k: 0.0 for k in extracted_data.keys()}
            extraction_error = str(e)

        processing_time_ms = (time.time() - start_time) * 1000

        # Build single extraction result for the whole document
        page_extraction = {
            "page_number": -1,  # -1 indicates full document extraction
            "category": "full_document",
            "extracted_data": extracted_data,
            "confidence_scores": confidence_scores,
        }
        if extraction_error:
            page_extraction["error"] = extraction_error

        result = ExtractionResult(
            source="dspy",
            page_extractions=[page_extraction],
            total_pages_processed=total_pages,
            processing_time_ms=processing_time_ms,
        )

        # Prepare output for UI
        step_output = {
            "pages_processed": total_pages,
            "processing_time_ms": round(processing_time_ms),
            "extracted_data": extracted_data,
            "schema_path": str(self.schema_path),
        }
        if extraction_error:
            step_output["error"] = extraction_error

        logger.info(
            f"DSPy extraction complete: {total_pages} page(s) in {processing_time_ms:.0f}ms"
        )

        return result, step_output
