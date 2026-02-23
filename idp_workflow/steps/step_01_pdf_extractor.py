"""Step 1: PDF Markdown Extraction using Azure Document Intelligence.

Connects via APIM using subscription key auth (api-key header).
"""

import logging
from pathlib import Path
from typing import Any

from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import (
    AnalyzeDocumentRequest,
    AnalyzeResult,
    DocumentContentFormat,
)
from azure.core.credentials import AzureKeyCredential
from azure.core.pipeline.policies import SansIOHTTPPolicy

from idp_workflow.models import PDFContent, Step01Output

logger = logging.getLogger(__name__)


class APIMKeyPolicy(SansIOHTTPPolicy):
    """Inject the APIM subscription key as 'api-key' header on every request."""

    def __init__(self, api_key: str):
        self._api_key = api_key

    def on_request(self, request):
        request.http_request.headers["api-key"] = self._api_key


class PDFMarkdownExtractor:
    """Extract markdown content from PDF using Azure Document Intelligence."""

    def __init__(self, endpoint: str, api_key: str):
        """Initialize the PDF extractor."""
        if not endpoint or not api_key:
            raise ValueError(
                "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and "
                "AZURE_DOCUMENT_INTELLIGENCE_KEY must be set"
            )
        self.endpoint = endpoint
        self.api_key = api_key
        self.client = DocumentIntelligenceClient(
            endpoint=endpoint,
            credential=AzureKeyCredential(api_key),
            per_call_policies=[APIMKeyPolicy(api_key)],
        )

    async def extract(self, pdf_path: str) -> tuple[PDFContent, Step01Output]:
        """Extract markdown content from PDF."""
        logger.info(f"Starting PDF extraction for: {pdf_path}")

        # Determine if input is URL or local file
        if pdf_path.startswith(("http://", "https://")):
            logger.debug(f"Analyzing remote PDF from URL: {pdf_path}")
            poller = self.client.begin_analyze_document(
                "prebuilt-layout",
                AnalyzeDocumentRequest(url_source=pdf_path),
                output_content_format=DocumentContentFormat.MARKDOWN,
            )
        else:
            logger.debug(f"PDF path is a local file: {pdf_path}")
            file_path = Path(pdf_path)
            if not file_path.exists():
                raise FileNotFoundError(f"PDF file not found: {pdf_path}")

            logger.debug(f"Analyzing local PDF file: {pdf_path}")
            with open(file_path, "rb") as f:
                poller = self.client.begin_analyze_document(
                    "prebuilt-layout",
                    body=f,
                    content_type="application/pdf",
                    output_content_format=DocumentContentFormat.MARKDOWN,
                )

        result: AnalyzeResult = poller.result()

        # Extract page-level content
        if result.pages:
            total_pages = len(result.pages)
            pages = [f"# Page {i}\n\n" for i in range(1, total_pages + 1)]
        else:
            pages = [result.content] if result.content else []
            total_pages = 1

        full_text = result.content or ""

        # Split by page breaks if available
        if total_pages > 1 and "<!-- PageBreak -->" in full_text:
            pages = full_text.split("<!-- PageBreak -->")
        elif total_pages > 1:
            pages = [full_text]
            total_pages = 1

        content = PDFContent(
            file_path=pdf_path,
            pages=pages,
            total_pages=total_pages,
            full_text=full_text,
        )

        output = Step01Output(
            total_pages=content.total_pages,
            characters=len(content.full_text),
            file_path=pdf_path,
            preview=content.full_text,
        )

        logger.info(
            f"PDF extraction complete: {content.total_pages} page(s), "
            f"{len(content.full_text):,} characters"
        )

        return content, output
