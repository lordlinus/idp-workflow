"""Step 2: Document Classification using DSPy."""

import asyncio
import json
import logging
from pathlib import Path
from typing import Optional

import dspy
from pydantic import BaseModel, Field

from idp_workflow.models import (
    PDFContent,
    DocumentCategory,
    ClassificationResult,
    DocumentClassificationOutput,
    Step02Output,
)

logger = logging.getLogger(__name__)

# Default concurrency limit for classification
DEFAULT_MAX_CONCURRENT_PAGES = 5


class DocumentClassificationSignature(dspy.Signature):
    """Classify document page into predefined categories based on content."""

    page_content: str = dspy.InputField(desc="Markdown content of the document page")
    available_categories: str = dspy.InputField(
        desc="Available classification categories"
    )
    classification: DocumentClassificationOutput = dspy.OutputField(
        desc="Classification result"
    )


class DocumentClassifier(dspy.Module):
    """DSPy module for document classification."""

    def __init__(
        self,
        categories_json_path: Path | None = None,
        categories: list[dict] | None = None,
    ):
        """Initialize classifier with category definitions.

        Args:
            categories_json_path: Path to classification_categories.json file
            categories: Inline list of category dicts (overrides file path)
        """
        super().__init__()
        self.classify = dspy.ChainOfThought(DocumentClassificationSignature)

        if categories is not None:
            self.categories = categories
        elif categories_json_path is not None:
            with open(categories_json_path, "r") as f:
                self.categories = json.load(f)
        else:
            raise ValueError("Either categories_json_path or categories must be provided")

        self.categories_desc = self._format_categories()

    def _format_categories(self) -> str:
        """Format categories for LLM context."""
        formatted = []
        for cat in self.categories:
            keywords = ", ".join(cat.get("pattern_keywords", [])[:10])
            description = cat.get("description/Note", cat.get("description", ""))
            formatted.append(f"- {cat['name']}: {description}\n  Keywords: {keywords}")
        return "\n".join(formatted)

    def forward(self, page_content: str) -> DocumentClassificationOutput:
        """Classify a page."""
        result = self.classify(
            page_content=page_content, available_categories=self.categories_desc
        )
        return result.classification


class DocumentClassificationExecutor:
    """Document classifier using DSPy with concurrent page processing."""

    def __init__(
        self,
        lm: dspy.LM,
        categories_path: Path | None = None,
        categories: list[dict] | None = None,
        max_concurrent: int = DEFAULT_MAX_CONCURRENT_PAGES,
    ):
        """Initialize classifier.

        Args:
            lm: Configured DSPy language model
            categories_path: Path to classification_categories.json
            categories: Inline list of category dicts (overrides file path)
            max_concurrent: Max concurrent page classification tasks
        """
        self._max_concurrent = max_concurrent
        self.lm = lm
        self.classifier = DocumentClassifier(
            categories_json_path=categories_path,
            categories=categories,
        )

    def _classify_page_sync(self, page_content: str) -> DocumentClassificationOutput:
        """Synchronous classification wrapper with dspy.context()."""
        with dspy.context(lm=self.lm):
            return self.classifier(page_content=page_content)  # type: ignore

    async def _classify_page(
        self,
        page_idx: int,
        page_content: str,
        semaphore: asyncio.Semaphore,
    ) -> DocumentCategory:
        """Classify a single page with semaphore-limited concurrency."""
        async with semaphore:
            # Run DSPy classification in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            classification = await loop.run_in_executor(
                None,
                lambda: self._classify_page_sync(page_content),
            )

            return DocumentCategory(
                category=classification.category,
                confidence=classification.confidence,
                detected_fields=classification.detected_fields,
                page_number=page_idx,
            )

    async def classify(
        self,
        content: PDFContent,
        max_pages: int = 50,
    ) -> tuple[ClassificationResult, Step02Output]:
        """Classify each page of the document concurrently."""
        logger.info(
            f"Starting classification for {len(content.pages)} page(s) "
            f"(max: {max_pages})"
        )

        # Limit pages to process
        pages_to_process = content.pages[:max_pages]
        if len(content.pages) > max_pages:
            logger.warning(
                f"Limiting to {max_pages} pages " f"(document has {len(content.pages)})"
            )

        semaphore = asyncio.Semaphore(self._max_concurrent)

        # Create tasks for all pages
        tasks = [
            self._classify_page(page_idx, page_content, semaphore)
            for page_idx, page_content in enumerate(pages_to_process)
        ]

        # Run all classifications concurrently (limited by semaphore)
        categories = await asyncio.gather(*tasks)

        result = ClassificationResult(pdf_content=content, categories=list(categories))

        # Prepare output for UI/tracking
        classification_data = [
            {
                "page": c.page_number + 1,
                "category": c.category,
                "confidence": round(c.confidence, 2),
                "detected_fields": c.detected_fields[:5] if c.detected_fields else [],
            }
            for c in categories
        ]

        primary_category = result.primary_category
        output = Step02Output(
            pages_classified=len(classification_data),
            classifications=classification_data,
            primary_category=(
                primary_category.category if primary_category else "Unknown"
            ),
            primary_confidence=(
                round(primary_category.confidence, 2) if primary_category else 0.0
            ),
        )

        logger.info(
            f"Classification complete: {len(classification_data)} page(s) classified. "
            f"Primary: {output.primary_category} ({output.primary_confidence})"
        )

        return result, output
