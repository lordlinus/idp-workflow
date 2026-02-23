# IDP Skills & Implementation Guide

This document captures the patterns, approaches, and reusable skills used in this Intelligent Document Processing (IDP) project. Use this as a reference to implement similar workflows in other projects.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Azure Functions Setup](#azure-functions-setup)
3. [PDF Extraction with Azure Document Intelligence](#pdf-extraction-with-azure-document-intelligence)
4. [DSPy Classification](#dspy-classification)
5. [Data Models](#data-models)
6. [Azure Content Understanding Extraction](#azure-content-understanding-extraction)
7. [Domain Configuration](#domain-configuration)
8. [Durable Orchestration Pattern](#durable-orchestration-pattern)
9. [Dependencies](#dependencies)

---

## Architecture Overview

The workflow follows a 6-step durable orchestration pattern:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        IDP Workflow Pipeline                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────────────┐   │
│  │   Step 1    │──▶│   Step 2    │──▶│         Step 3              │   │
│  │ PDF→Markdown│   │Classification│   │  ┌────────┐  ┌──────────┐  │   │
│  │ (Doc Intel) │   │   (DSPy)    │   │  │ Azure  │  │  DSPy    │  │   │
│  └─────────────┘   └─────────────┘   │  │  CU    │  │ Extract  │  │   │
│                                       │  └───┬────┘  └────┬─────┘  │   │
│                                       │      └─────┬──────┘        │   │
│                                       └────────────┼───────────────┘   │
│                                                    ▼                   │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                   │
│  │   Step 6    │◀──│   Step 5    │◀──│   Step 4    │                   │
│  │  Reasoning  │   │   HITL      │   │ Comparison  │                   │
│  │   Agent     │   │  Review     │   │             │                   │
│  └─────────────┘   └─────────────┘   └─────────────┘                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Technologies:**
- **Azure Functions** with Durable Functions for orchestration
- **Azure Document Intelligence** for PDF → Markdown extraction
- **Azure Content Understanding** for structured field extraction
- **DSPy** for LLM-based classification and extraction
- **Agent Framework** for reasoning and consolidation

---

## Azure Functions Setup

### Entry Point (`function_app.py`)

```python
from agent_framework.azure import AgentFunctionApp

# Import registration functions
from idp_workflow.activities import register_activities
from idp_workflow.orchestration import register_orchestration
from idp_workflow.api import (
    register_http_endpoints,
    register_signalr_endpoints,
    register_signalr_activities,
)

# Create the Azure Functions app
app = AgentFunctionApp(
    agents=[],  # Agents registered separately if needed
    enable_health_check=True,
    enable_http_endpoints=False,  # Custom HTTP endpoints
)

# Register all components
register_activities(app)
register_orchestration(app)
register_http_endpoints(app)
register_signalr_endpoints(app)
register_signalr_activities(app)
```

### Activity Function Pattern

```python
def register_activities(app):
    """Register all activity functions with the Azure Functions app."""

    @app.activity_trigger(input_name="extract_request")
    async def activity_step_01_pdf_extraction(extract_request: dict) -> dict:
        """Extract PDF to markdown."""
        # Activity implementation
        pdf_path = extract_request.get("pdf_path")
        request_id = extract_request.get("request_id")
        
        # Process and return results
        return {
            "pdf_content": {...},
            "step_output": {...},
        }
```

### Configuration (`config.py`)

```python
from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Azure Document Intelligence
    azure_document_intelligence_endpoint: str
    azure_document_intelligence_key: str

    # Azure Content Understanding
    cognitive_services_endpoint: str
    cognitive_services_key: str
    azure_ai_cu_api_version: str = "2024-12-01-preview"

    # Azure OpenAI
    azure_openai_endpoint: str
    azure_openai_key: str
    azure_openai_chat_deployment_name: str = "gpt-4.1"
    azure_openai_api_version: str = "2025-01-01-preview"

    @property
    def domains_dir(self) -> Path:
        """Get path to domains directory."""
        return Path(__file__).parent / "domains"

    class Config:
        env_file = ".env"
        case_sensitive = False

_settings = None

def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
```

---

## PDF Extraction with Azure Document Intelligence

### Approach

Uses Azure Document Intelligence's `prebuilt-layout` model to convert PDF documents to Markdown format, preserving structure and enabling downstream LLM processing.

### Implementation (`step_01_pdf_extractor.py`)

```python
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import (
    AnalyzeDocumentRequest,
    AnalyzeResult,
    DocumentContentFormat,
)
from azure.core.credentials import AzureKeyCredential

class PDFMarkdownExtractor:
    """Extract markdown content from PDF using Azure Document Intelligence."""

    def __init__(self, endpoint: str, api_key: str):
        self.client = DocumentIntelligenceClient(
            endpoint=endpoint, 
            credential=AzureKeyCredential(api_key)
        )

    async def extract(self, pdf_path: str) -> tuple[PDFContent, Step01Output]:
        """Extract markdown content from PDF."""
        
        # Handle URL or local file
        if pdf_path.startswith(("http://", "https://")):
            poller = self.client.begin_analyze_document(
                "prebuilt-layout",
                AnalyzeDocumentRequest(url_source=pdf_path),
                output_content_format=DocumentContentFormat.MARKDOWN,
            )
        else:
            with open(pdf_path, "rb") as f:
                poller = self.client.begin_analyze_document(
                    "prebuilt-layout",
                    body=f,
                    content_type="application/pdf",
                    output_content_format=DocumentContentFormat.MARKDOWN,
                )

        result: AnalyzeResult = poller.result()
        
        # Extract page-level content
        full_text = result.content or ""
        
        # Split by page breaks if available
        if "<!-- PageBreak -->" in full_text:
            pages = full_text.split("<!-- PageBreak -->")
        else:
            pages = [full_text]

        return PDFContent(
            file_path=pdf_path,
            pages=pages,
            total_pages=len(pages),
            full_text=full_text,
        ), Step01Output(...)
```

### Key Points

- Uses `prebuilt-layout` model for structure preservation
- Outputs Markdown format (`DocumentContentFormat.MARKDOWN`)
- Supports both URL and local file inputs
- Page breaks marked with `<!-- PageBreak -->` in output

---

## DSPy Classification

### Approach

Uses DSPy with Chain-of-Thought prompting to classify document pages into predefined categories. Categories are loaded from domain-specific JSON configuration.

### DSPy Signature Definition

```python
import dspy
from pydantic import BaseModel, Field

class DocumentClassificationOutput(BaseModel):
    """Structured classification output from DSPy."""
    category: str = Field(description="Document category name")
    confidence: float = Field(
        description="Classification confidence 0-1", ge=0.0, le=1.0
    )
    reasoning: str = Field(description="Brief explanation for classification")
    detected_fields: list[str] = Field(description="Key fields/keywords detected")


class DocumentClassificationSignature(dspy.Signature):
    """Classify document page into predefined categories based on content."""

    page_content: str = dspy.InputField(desc="Markdown content of the document page")
    available_categories: str = dspy.InputField(
        desc="Available classification categories"
    )
    classification: DocumentClassificationOutput = dspy.OutputField(
        desc="Classification result"
    )
```

### DSPy Module Implementation

```python
class DocumentClassifier(dspy.Module):
    """DSPy module for document classification."""

    def __init__(self, categories_json_path: Path):
        super().__init__()
        self.classify = dspy.ChainOfThought(DocumentClassificationSignature)
        with open(categories_json_path, "r") as f:
            self.categories = json.load(f)
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
        result = self.classify(
            page_content=page_content, 
            available_categories=self.categories_desc
        )
        return result.classification
```

### Concurrent Page Classification

```python
class DocumentClassificationExecutor:
    """Document classifier with concurrent page processing."""

    def __init__(self, categories_path: Path, lm: dspy.LM, max_concurrent: int = 5):
        self._max_concurrent = max_concurrent
        self.lm = lm
        self.classifier = DocumentClassifier(categories_json_path=categories_path)

    def _classify_page_sync(self, page_content: str) -> DocumentClassificationOutput:
        """Synchronous classification wrapper with dspy.context()."""
        with dspy.context(lm=self.lm):
            return self.classifier(page_content=page_content)

    async def _classify_page(
        self, page_idx: int, page_content: str, semaphore: asyncio.Semaphore
    ) -> DocumentCategory:
        """Classify a single page with semaphore-limited concurrency."""
        async with semaphore:
            loop = asyncio.get_event_loop()
            classification = await loop.run_in_executor(
                None, lambda: self._classify_page_sync(page_content)
            )
            return DocumentCategory(
                category=classification.category,
                confidence=classification.confidence,
                detected_fields=classification.detected_fields,
                page_number=page_idx,
            )

    async def classify(self, content: PDFContent, max_pages: int = 50):
        """Classify each page concurrently."""
        semaphore = asyncio.Semaphore(self._max_concurrent)
        
        tasks = [
            self._classify_page(idx, page, semaphore)
            for idx, page in enumerate(content.pages[:max_pages])
        ]
        
        categories = await asyncio.gather(*tasks)
        return ClassificationResult(pdf_content=content, categories=list(categories))
```

### DSPy LM Configuration

```python
import dspy

lm = dspy.LM(
    model=f"azure/{settings.azure_openai_chat_deployment_name}",
    api_base=settings.azure_openai_endpoint,
    api_key=settings.azure_openai_key,
    api_version=settings.azure_openai_api_version,
)
```

---

## Data Models

### Core Pydantic Models

```python
from dataclasses import dataclass
from typing import Any, Optional
from pydantic import BaseModel, Field


# Step 1: PDF Content
@dataclass
class PDFContent:
    """Extracted content from a PDF document."""
    file_path: str
    pages: list[str]
    total_pages: int
    full_text: str


class Step01Output(BaseModel):
    """Output from PDF extraction step."""
    total_pages: int
    characters: int
    file_path: str
    preview: str


# Step 2: Classification
@dataclass
class DocumentCategory:
    """Classification result for a single page."""
    category: str
    confidence: float
    detected_fields: list[str]
    page_number: int = 0


@dataclass
class ClassificationResult:
    """Complete classification output with PDF content."""
    pdf_content: PDFContent
    categories: list[DocumentCategory]

    @property
    def primary_category(self) -> Optional[DocumentCategory]:
        return max(self.categories, key=lambda c: c.confidence) if self.categories else None


class Step02Output(BaseModel):
    """Output from classification step."""
    pages_classified: int
    classifications: list[dict]
    primary_category: str
    primary_confidence: float


# Step 3: Extraction
class ExtractionResult(BaseModel):
    """Results from field extraction (Azure or DSPy)."""
    source: str = Field(description="Extraction source: 'azure' or 'dspy'")
    page_extractions: list[dict[str, Any]] = Field(default_factory=list)
    total_pages_processed: int = 0
    processing_time_ms: float = 0.0


# Step 4: Comparison
class FieldComparison(BaseModel):
    """Per-field comparison between Azure and DSPy extraction."""
    field_name: str
    azure_value: Any = None
    dspy_value: Any = None
    match: bool
    confidence: float = Field(ge=0.0, le=1.0)
    needs_review: bool
    comparison_notes: str = ""


class Step04Output(BaseModel):
    """Output from extraction comparison."""
    total_fields: int
    matching_fields: int
    differing_fields: int
    match_percentage: float
    requires_human_review: bool = False
    fields_needing_review: list[str] = Field(default_factory=list)
    field_comparisons: list[FieldComparison] = Field(default_factory=list)
    processing_time_ms: float = 0.0


# Human Review (HITL)
class FieldSelection(BaseModel):
    """A single field selection made by the human reviewer."""
    field_name: str
    selected_source: str  # 'azure', 'dspy', 'manual', or 'comparison'
    selected_value: Any
    azure_value: Any = None
    dspy_value: Any = None
    notes: str = ""


class HumanReviewResponse(BaseModel):
    """Human reviewer's response with final accepted values."""
    approved: bool
    feedback: str = ""
    reviewer: str = ""
    field_selections: list[FieldSelection] = Field(default_factory=list)
    accepted_values: dict[str, Any] = Field(default_factory=dict)
    default_source: str = "comparison"


# Workflow Management
class WorkflowInitInput(BaseModel):
    """Input to start the IDP workflow."""
    pdf_path: str
    domain_id: str = "insurance_claims"
    max_pages: int = 50
    request_id: str
    options: dict[str, Any] = Field(default_factory=dict)
```

---

## Azure Content Understanding Extraction

### Approach

Uses Azure Content Understanding (CU) service to extract structured fields directly from PDF documents using domain-specific analyzers.

### Client Implementation

```python
class AzureContentUnderstandingClient:
    """Client for Azure Content Understanding service."""

    def __init__(
        self,
        endpoint: str,
        api_version: str,
        subscription_key: str = None,
        token_provider: callable = None,
        x_ms_useragent: str = "cu-sample-code",
    ):
        self._endpoint = endpoint.rstrip("/")
        self._api_version = api_version
        self._headers = self._get_headers(subscription_key, token, x_ms_useragent)

    def begin_analyze(self, analyzer_id: str, file_location: str) -> Response:
        """Start document analysis."""
        # Implementation details...

    def poll_result(self, response: Response, timeout_seconds: int = 180) -> dict:
        """Poll for analysis completion."""
        # Implementation details...

    def begin_create_analyzer(self, analyzer_id: str, analyzer_template: dict) -> Response:
        """Create a new analyzer from schema template."""
        # Implementation details...
```

### Extractor Implementation

```python
class AzureExtractor:
    """Azure Content Understanding extractor."""

    def __init__(self, domain_id: str, schema_path: Path = None):
        self.domain_id = domain_id
        self.analyzer_id = f"analyzer_{domain_id.replace('-', '_')}"
        
        # Load extraction schema
        if schema_path is None:
            schema_path = settings.domains_dir / domain_id / "extraction_schema.json"
        self.schema_path = schema_path
        
        # Initialize client
        self.client = AzureContentUnderstandingClient(
            endpoint=settings.cognitive_services_endpoint,
            api_version=settings.azure_ai_cu_api_version,
            subscription_key=settings.cognitive_services_key,
        )

    async def extract(self, pdf_path: str, max_pages: int = 50):
        """Extract structured data from PDF."""
        
        # Ensure analyzer exists
        await self._ensure_analyzer_ready()
        
        # Analyze document
        analysis_result = await asyncio.to_thread(
            self._analyze_document, pdf_path
        )
        
        # Extract fields
        extracted_data, confidence_scores = self._extract_fields_from_result(
            analysis_result
        )
        
        return ExtractionResult(
            source="azure",
            page_extractions=[{
                "page_number": -1,  # Full document
                "extracted_data": extracted_data,
                "confidence_scores": confidence_scores,
            }],
            ...
        )
```

---

## Domain Configuration

### Directory Structure

```
idp_workflow/domains/
├── insurance_claims/
│   ├── classification_categories.json
│   ├── extraction_schema.json
│   ├── validation_rules.json
│   └── config.json
├── home_loan/
│   └── ...
├── trade_finance/
│   └── ...
└── small_business_lending/
    └── ...
```

### Classification Categories (`classification_categories.json`)

```json
[
  {
    "name": "Insurance_Claim_Form",
    "description/Note": "Page describing the claim form...",
    "pattern_keywords": [
      "Prudential",
      "PruShield",
      "Pre and Post-Hospitalisation Benefit Claim",
      ...
    ],
    "required": true,
    "extraction_priority": 2
  },
  {
    "name": "Hospital_Admission_Details",
    "description/Note": "Page specifying hospital admission...",
    "pattern_keywords": [
      "Hospital Admission",
      "Day Surgery",
      ...
    ],
    "required": false,
    "extraction_priority": 1
  }
]
```

### Extraction Schema (`extraction_schema.json`)

```json
{
  "scenario": "document",
  "description": "Extract critical fields from documents",
  "config": {
    "returnDetails": true,
    "enableOcr": true,
    "enableLayout": true,
    "estimateFieldSourceAndConfidence": true
  },
  "fieldSchema": {
    "fields": {
      "patientName": {
        "type": "string",
        "method": "extract",
        "description": "Patient or claimant full legal name",
        "category": "Patient Identity"
      },
      "billDate": {
        "type": "date",
        "method": "extract",
        "description": "Date invoice was issued by provider"
      },
      "totalAmount": {
        "type": "number",
        "method": "extract",
        "description": "Total amount charged"
      }
    }
  }
}
```

---

## Durable Orchestration Pattern

### Orchestration Function

```python
from azure.durable_functions import DurableOrchestrationContext

def register_orchestration(app):
    @app.orchestration_trigger(context_name="context")
    def idp_workflow_orchestration(context: DurableOrchestrationContext):
        """Main IDP workflow orchestration."""
        
        # Get and validate input
        input_data = context.get_input()
        workflow_input = WorkflowInitInput.model_validate(input_data)
        
        # Step 1: PDF Extraction
        context.set_custom_status("Step 1: Extracting PDF")
        step1_result = yield context.call_activity(
            "activity_step_01_pdf_extraction",
            {"pdf_path": workflow_input.pdf_path, "request_id": workflow_input.request_id}
        )
        
        # Step 2: Classification
        context.set_custom_status("Step 2: Classification")
        step2_result = yield context.call_activity(
            "activity_step_02_classification",
            {"pdf_content": step1_result["pdf_content"], ...}
        )
        
        # Step 3: Concurrent Extraction (Azure CU + DSPy)
        context.set_custom_status("Step 3: Data Extraction")
        azure_task = context.call_activity("activity_step_03_01_azure_extraction", {...})
        dspy_task = context.call_activity("activity_step_03_02_dspy_extraction", {...})
        [azure_result, dspy_result] = yield context.task_all([azure_task, dspy_task])
        
        # Step 4: Comparison
        step4_result = yield context.call_activity("activity_step_04_comparison", {...})
        
        # Step 5: Human Review (HITL with timeout)
        if step4_result["requires_human_review"]:
            hitl_event = context.wait_for_external_event("HITL_REVIEW_EVENT")
            timeout = context.create_timer(
                context.current_utc_datetime + timedelta(hours=24)
            )
            winner = yield context.task_any([hitl_event, timeout])
            # Handle response...
        
        # Step 6: Reasoning Agent
        step6_result = yield context.call_activity(
            "activity_step_06_reasoning_agent", {...}
        )
        
        return final_output
```

### Key Patterns

1. **Activity Calls**: Use `yield context.call_activity(...)` for async execution
2. **Concurrent Tasks**: Use `context.task_all([...])` for parallel execution
3. **External Events**: Use `context.wait_for_external_event(...)` for HITL
4. **Timeouts**: Use `context.create_timer(...)` with `task_any` for timeouts
5. **SignalR Broadcasting**: Call activity to broadcast progress updates

---

## Dependencies

### `requirements.txt`

```
azure-functions
azure-functions-durable
agent-framework-azurefunctions
azure-identity
azure-ai-documentintelligence
dspy
pydantic
pydantic-settings
azure-storage-blob
requests
azure-monitor-opentelemetry
opentelemetry-api
opentelemetry-sdk
opentelemetry-exporter-otlp
opentelemetry-instrumentation-logging
```

### Key Package Versions

| Package | Purpose |
|---------|---------|
| `azure-functions` | Azure Functions runtime |
| `azure-functions-durable` | Durable orchestration |
| `agent-framework-azurefunctions` | Agent Framework integration |
| `azure-ai-documentintelligence` | PDF to Markdown extraction |
| `dspy` | LLM-based classification and extraction |
| `pydantic` / `pydantic-settings` | Data models and configuration |

---

## Quick Start Checklist for New Projects

1. **Set up Azure Functions project structure**
   - Create `function_app.py` with `AgentFunctionApp`
   - Create `idp_workflow/` package with submodules

2. **Configure environment variables**
   - Azure Document Intelligence endpoint/key
   - Azure Content Understanding endpoint/key
   - Azure OpenAI endpoint/key/deployment

3. **Define domain configuration**
   - Create `domains/{domain_id}/` directory
   - Add `classification_categories.json`
   - Add `extraction_schema.json`

4. **Implement step modules**
   - PDF extractor using Document Intelligence
   - Classifier using DSPy
   - Extractor using Azure CU and/or DSPy

5. **Create data models**
   - Input/output models for each step
   - Workflow state models

6. **Set up orchestration**
   - Register activities and orchestration
   - Implement SignalR for real-time updates

7. **Add HTTP endpoints**
   - Start workflow endpoint
   - Status/polling endpoints
   - HITL review endpoint

---

## References

- [Azure Document Intelligence Documentation](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/)
- [Azure Content Understanding Documentation](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/)
- [Azure Durable Functions](https://learn.microsoft.com/en-us/azure/azure-functions/durable/)
- [DSPy Documentation](https://dspy-docs.vercel.app/)
- [Agent Framework for Azure Functions](https://github.com/microsoft/agent-framework)
