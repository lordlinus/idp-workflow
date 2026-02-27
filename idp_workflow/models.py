"""Data models for the IDP workflow."""

from dataclasses import dataclass, field
from typing import Any, Optional
from pydantic import BaseModel, Field


# ============================================================================
# STEP 1: PDF Content Extraction
# ============================================================================


@dataclass
class PDFContent:
    """Extracted content from a PDF document."""

    file_path: str
    pages: list[str]
    total_pages: int
    full_text: str


# Step01Output defined below with other step outputs


# ============================================================================
# STEP 3: Data Extraction
# ============================================================================


class ExtractionResult(BaseModel):
    """Results from field extraction (Azure or DSPy)."""

    source: str = Field(description="Extraction source: 'azure' or 'dspy'")
    page_extractions: list[dict[str, Any]] = Field(default_factory=list)
    total_pages_processed: int = 0
    processing_time_ms: float = 0.0


class Step03Output(BaseModel):
    """Output from Step 3 for UI display."""

    azure_pages_processed: int = 0
    azure_processing_time_ms: float = 0.0
    azure_sample_data: dict[str, Any] = Field(default_factory=dict)

    dspy_pages_processed: int = 0
    dspy_processing_time_ms: float = 0.0
    dspy_sample_data: dict[str, Any] = Field(default_factory=dict)

    extraction_method: str = "concurrent"  # 'azure', 'dspy', or 'concurrent'


# ============================================================================
# STEP 2: Document Classification
# ============================================================================


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
        """Get the category with highest confidence."""
        return (
            max(self.categories, key=lambda c: c.confidence)
            if self.categories
            else None
        )


# ============================================================================
# Orchestration Input/Output Models (for Azure Functions)
# ============================================================================


class WorkflowInitInput(BaseModel):
    """Input to start the IDP workflow."""

    pdf_path: str = Field(description="Path or URL to the PDF document")
    domain_id: str = Field(
        default="insurance_claims", description="Domain configuration"
    )
    max_pages: int = Field(default=50, description="Maximum pages to process")
    request_id: str = Field(description="Unique request identifier for tracking")
    user_id: str = Field(
        default="", description="User ID for SignalR user-targeted messaging"
    )
    options: dict[str, Any] = Field(
        default_factory=dict,
        description="Additional workflow options (e.g., reasoning_engine, llm_provider, llm_model)",
    )
    custom_extraction_schema: Optional[dict[str, Any]] = Field(
        default=None,
        description="Ad-hoc extraction schema (overrides domain schema). Must contain fieldSchema.fields.",
    )
    custom_classification_categories: Optional[list[dict[str, Any]]] = Field(
        default=None,
        description="Ad-hoc classification categories (overrides domain categories).",
    )


# ============================================================================
# Step Outputs (for HITL and state management)
# ============================================================================


class Step01Output(BaseModel):
    """Output from PDF extraction step."""

    total_pages: int
    characters: int
    file_path: str
    preview: str


class Step02Output(BaseModel):
    """Output from classification step."""

    pages_classified: int
    classifications: list[dict]  # List of {page, category, confidence, detected_fields}
    primary_category: str
    primary_confidence: float


class DocumentClassificationOutput(BaseModel):
    """Structured classification output from DSPy."""

    category: str = Field(description="Document category name")
    confidence: float = Field(
        description="Classification confidence 0-1", ge=0.0, le=1.0
    )
    reasoning: str = Field(description="Brief explanation for classification")
    detected_fields: list[str] = Field(description="Key fields/keywords detected")


# ============================================================================
# Human Review (HITL) Models
# ============================================================================


class FieldSelection(BaseModel):
    """A single field selection made by the human reviewer."""

    field_name: str = Field(description="Name of the field")
    selected_source: str = Field(
        description="Source of selected value: 'azure', 'dspy', 'manual', or 'comparison'"
    )
    selected_value: Any = Field(
        description="The final value selected/entered by reviewer"
    )
    azure_value: Any = Field(
        default=None, description="Original Azure extraction value"
    )
    dspy_value: Any = Field(default=None, description="Original DSPy extraction value")
    notes: str = Field(default="", description="Optional reviewer notes for this field")


class HumanReviewRequest(BaseModel):
    """Request payload sent to human reviewer."""

    request_id: str
    current_step: str
    comparison_data: dict
    azure_extraction: dict = Field(default_factory=dict)
    dspy_extraction: dict = Field(default_factory=dict)
    fields_requiring_review: list[str] = Field(default_factory=list)
    prompt: str = "Please review the extraction comparison and select final values."


class HumanReviewResponse(BaseModel):
    """Human reviewer's response with final accepted values."""

    approved: bool = Field(description="Whether the document processing is approved")
    feedback: str = Field(default="")
    reviewer: str = Field(default="")
    field_selections: list[FieldSelection] = Field(default_factory=list)
    accepted_values: dict[str, Any] = Field(default_factory=dict)
    default_source: str = Field(default="comparison")


# ============================================================================
# Step 4: Extraction Comparison Models
# ============================================================================


class FieldComparison(BaseModel):
    """Per-field comparison between Azure and DSPy extraction."""

    field_name: str = Field(description="Name of the field")
    azure_value: Any = Field(default=None, description="Value extracted by Azure")
    dspy_value: Any = Field(default=None, description="Value extracted by DSPy")
    match: bool = Field(description="Whether values match")
    confidence: float = Field(
        description="Confidence in comparison (0-1)", ge=0.0, le=1.0
    )
    needs_review: bool = Field(description="Requires human review")
    comparison_notes: str = Field(default="", description="Notes on the comparison")


class Step04Output(BaseModel):
    """Output from Step 4 (Extraction Comparison) for UI display and HITL."""

    total_fields: int = Field(description="Total number of fields compared")
    matching_fields: int = Field(description="Number of matching fields")
    differing_fields: int = Field(description="Number of differing fields")
    match_percentage: float = Field(description="Percentage of matching fields (0-100)")
    requires_human_review: bool = Field(
        default=False, description="Whether human review is needed"
    )
    fields_needing_review: list[str] = Field(
        default_factory=list, description="List of field names requiring review"
    )
    field_comparisons: list[FieldComparison] = Field(
        default_factory=list, description="Detailed per-field comparisons"
    )
    processing_time_ms: float = Field(
        default=0.0, description="Time taken for comparison in milliseconds"
    )


class Step06Output(BaseModel):
    """Output from Step 6 (Reasoning & Summary) for UI display."""

    total_validations: int = Field(default=0, description="Total validations executed")
    passed_validations: int = Field(
        default=0, description="Number of passed validations"
    )
    failed_validations: int = Field(
        default=0, description="Number of failed validations"
    )
    total_fields: int = Field(default=0, description="Total fields consolidated")
    matching_fields: int = Field(
        default=0, description="Fields matching between Azure and DSPy"
    )
    confidence_score: float = Field(
        default=0.0, description="Overall confidence score 0-1"
    )
    human_approved: bool = Field(default=False, description="Whether human approved")
    recommendations_count: int = Field(
        default=0, description="Number of recommendations provided"
    )
    processing_time_ms: float = Field(
        default=0.0, description="Time taken for reasoning in milliseconds"
    )
    engine: str = Field(
        default="dspy", description="Reasoning engine used: 'dspy' or 'agent_framework'"
    )
