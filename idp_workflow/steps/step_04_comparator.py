"""Step 4: Comparison of Azure and DSPy extraction results."""

import json
import logging
import time
from typing import Any

import dspy
from pydantic import BaseModel, Field

from idp_workflow.config import (
    AZURE_OPENAI_CHAT_DEPLOYMENT_NAME,
    AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_API_VERSION,
    AZURE_OPENAI_KEY,
)

logger = logging.getLogger(__name__)


class FieldComparisonAnalysis(BaseModel):
    """Analysis of a field comparison between extraction methods."""

    field_name: str = Field(description="Field name")
    azure_value: Any = Field(description="Value from Azure CU")
    dspy_value: Any = Field(description="Value from DSPy")
    are_semantically_equal: bool = Field(
        description="Whether values mean the same thing despite different format"
    )
    confidence_score: float = Field(
        ge=0.0, le=1.0, description="Confidence in the analysis"
    )
    recommended_value: Any = Field(description="Preferred value to use")
    reasoning: str = Field(description="Brief explanation")
    requires_human_review: bool = Field(description="Whether human input is needed")


class ComparisonResult(BaseModel):
    """Result of comparing Azure and DSPy extractions."""

    total_fields: int = Field(default=0, description="Total fields compared")
    matching_fields: int = Field(default=0, description="Fields with identical values")
    differing_fields: int = Field(default=0, description="Fields with different values")
    match_percentage: float = Field(
        default=0.0, description="Percentage of matching fields"
    )

    field_analyses: list[dict] = Field(
        default_factory=list, description="Analysis for each field"
    )
    azure_only_fields: list[str] = Field(
        default_factory=list, description="Fields only in Azure"
    )
    dspy_only_fields: list[str] = Field(
        default_factory=list, description="Fields only in DSPy"
    )

    requires_human_review: bool = Field(
        default=False, description="Whether any field needs review"
    )
    fields_needing_review: list[str] = Field(
        default_factory=list, description="Fields flagged for review"
    )

    processing_time_ms: float = Field(
        default=0.0, description="Comparison processing time"
    )


class BatchFieldComparisonSignature(dspy.Signature):
    """Compare multiple differing fields in a single LLM call."""

    differing_fields: str = dspy.InputField(
        desc="JSON list of {field_name, azure_value, dspy_value}"
    )
    document_context: str = dspy.InputField(desc="Document type for context")
    analyses: list[FieldComparisonAnalysis] = dspy.OutputField(
        desc="Analysis for each field"
    )


class BatchFieldComparator(dspy.Module):
    """Compare all differing fields in a single LLM call instead of N calls."""

    def __init__(self) -> None:
        super().__init__()
        self.compare = dspy.ChainOfThought(BatchFieldComparisonSignature)

    def forward(
        self, differing_fields: list[dict], document_context: str
    ) -> list[FieldComparisonAnalysis]:
        if not differing_fields:
            return []

        result = self.compare(
            differing_fields=json.dumps(differing_fields),
            document_context=document_context,
        )
        return result.analyses


def create_matching_field_analysis(
    field_name: str, value: Any
) -> FieldComparisonAnalysis:
    """Create analysis for a field where Azure and DSPy agree."""
    return FieldComparisonAnalysis(
        field_name=field_name,
        azure_value=value,
        dspy_value=value,
        are_semantically_equal=True,
        confidence_score=1.0,
        recommended_value=value,
        reasoning="Both methods extracted identical value",
        requires_human_review=False,
    )


def normalize_value(value: Any) -> str:
    """Normalize a value for comparison (strip whitespace, lowercase strings)."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip().lower()
    if isinstance(value, (int, float)):
        return str(value)
    return str(value).strip().lower()


class ExtractionComparator:
    """Compare Azure CU and DSPy extraction results."""

    def __init__(self, lm: dspy.LM | None = None):
        """Initialize comparator."""
        if lm is None:
            self.lm = dspy.LM(
                model=f"azure/{AZURE_OPENAI_CHAT_DEPLOYMENT_NAME}",
                api_base=AZURE_OPENAI_ENDPOINT,
                api_version=AZURE_OPENAI_API_VERSION,
                api_key=AZURE_OPENAI_KEY,
                temperature=0.0,
            )
        else:
            self.lm = lm

        self.batch_comparator = BatchFieldComparator()

    def compare(
        self,
        azure_data: dict[str, Any],
        dspy_data: dict[str, Any],
        document_context: str = "Insurance Claim",
    ) -> ComparisonResult:
        """Compare extraction results from Azure CU and DSPy."""
        start_time = time.time()

        azure_keys = set(azure_data.keys())
        dspy_keys = set(dspy_data.keys())
        common_keys = azure_keys & dspy_keys

        # Step 1: Simple string comparison (no LLM needed)
        matching_fields = []
        differing_fields = []
        differing_field_data = []

        for key in common_keys:
            azure_val = azure_data[key]
            dspy_val = dspy_data[key]

            azure_normalized = normalize_value(azure_val)
            dspy_normalized = normalize_value(dspy_val)

            if azure_normalized == dspy_normalized:
                matching_fields.append(key)
            else:
                differing_fields.append(key)
                differing_field_data.append(
                    {
                        "field_name": key,
                        "azure_value": azure_val,
                        "dspy_value": dspy_val,
                    }
                )

        # Step 2: Build field analyses
        field_analyses = []

        # Add matching fields (no LLM needed)
        for key in matching_fields:
            analysis = create_matching_field_analysis(key, azure_data[key])
            field_analyses.append(analysis.model_dump())

        # Step 3: Batch analyze differing fields (1 LLM call instead of N)
        fields_needing_review = []

        if differing_field_data:
            logger.info(
                f"Analyzing {len(differing_field_data)} differing fields with LLM"
            )

            with dspy.context(lm=self.lm):
                try:
                    diff_analyses = self.batch_comparator(
                        differing_fields=differing_field_data,
                        document_context=document_context,
                    )
                    for analysis in diff_analyses:
                        field_analyses.append(analysis.model_dump())
                        if analysis.requires_human_review:
                            fields_needing_review.append(analysis.field_name)
                except Exception as e:
                    logger.error(f"LLM analysis failed: {e}")
                    # Fallback: mark differing fields as needing review
                    for field_data in differing_field_data:
                        field_name = field_data["field_name"]
                        fields_needing_review.append(field_name)
                        field_analyses.append(
                            {
                                "field_name": field_name,
                                "azure_value": field_data["azure_value"],
                                "dspy_value": field_data["dspy_value"],
                                "are_semantically_equal": False,
                                "confidence_score": 0.5,
                                "recommended_value": field_data["azure_value"],
                                "reasoning": f"LLM analysis failed ({e}), defaulting to Azure",
                                "requires_human_review": True,
                            }
                        )

        processing_time_ms = (time.time() - start_time) * 1000

        total_fields = len(common_keys)
        match_percentage = (
            (len(matching_fields) / total_fields * 100) if total_fields > 0 else 0
        )

        result = ComparisonResult(
            total_fields=total_fields,
            matching_fields=len(matching_fields),
            differing_fields=len(differing_fields),
            match_percentage=round(match_percentage, 1),
            field_analyses=field_analyses,
            azure_only_fields=list(azure_keys - dspy_keys),
            dspy_only_fields=list(dspy_keys - azure_keys),
            requires_human_review=len(fields_needing_review) > 0,
            fields_needing_review=fields_needing_review,
            processing_time_ms=round(processing_time_ms),
        )

        logger.info(
            f"Comparison complete: {len(matching_fields)}/{total_fields} matching "
            f"({match_percentage:.1f}%), {len(fields_needing_review)} need review"
        )

        return result
