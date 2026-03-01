"""Step 6: AI Foundry Agent-Based Reasoning with tools."""

import json
import logging
import re
import time
from pathlib import Path
from typing import Annotated, Any, Callable

from pydantic import BaseModel, Field

from agent_framework import tool
from agent_framework.azure import AzureOpenAIChatClient

from idp_workflow.config import (
    AZURE_OPENAI_KEY,
    AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_CHAT_DEPLOYMENT_NAME,
    AZURE_OPENAI_API_VERSION,
)

logger = logging.getLogger(__name__)


class ValidationResult(BaseModel):
    """Result of applying a validation rule."""

    rule_name: str = Field(description="Name of the validation rule")
    passed: bool = Field(description="Whether the validation passed")
    severity: str = Field(default="warning", description="error, warning, or info")
    message: str = Field(default="", description="Validation result message")
    field: str | None = Field(default=None, description="Field involved in validation")
    actual_value: Any = Field(default=None, description="Actual value found")


class ReasoningSummary(BaseModel):
    """Final reasoning summary output."""

    document_type: str = Field(description="Primary document classification")

    # Validation summary
    total_validations: int = Field(default=0, description="Total validations run")
    passed_validations: int = Field(default=0, description="Validations that passed")
    failed_validations: int = Field(default=0, description="Validations that failed")
    validation_results: list[ValidationResult] = Field(default_factory=list)

    # Field consolidation
    total_fields: int = Field(default=0, description="Total fields extracted")
    matching_fields: int = Field(
        default=0, description="Fields that match between extractors"
    )
    fields_needing_review: list[str] = Field(default_factory=list)
    consolidated_fields: dict[str, Any] = Field(
        default_factory=dict, description="Final field values"
    )

    # Human review
    human_approved: bool = Field(default=False, description="Whether human approved")
    human_feedback: str = Field(default="", description="Human reviewer feedback")

    # AI reasoning
    ai_summary: str = Field(default="", description="AI-generated summary")
    recommendations: list[str] = Field(
        default_factory=list, description="AI recommendations"
    )
    confidence_score: float = Field(default=0.0, ge=0.0, le=1.0)

    processing_time_ms: float = Field(default=0.0)


class ToolContext:
    """Shared context for tool execution."""

    def __init__(
        self,
        domain_id: str,
        azure_data: dict[str, Any],
        dspy_data: dict[str, Any],
        comparison_result: dict[str, Any],
        human_approved: bool,
        human_feedback: str,
        on_tool_event: "Callable[[str, str, str, dict | None], None] | None" = None,
    ):
        self.domain_id = domain_id
        self.azure_data = azure_data
        self.dspy_data = dspy_data
        self.comparison_result = comparison_result
        self.human_approved = human_approved
        self.human_feedback = human_feedback
        self.validation_rules = self._load_rules()
        self.consolidated = {}
        self._on_tool_event = on_tool_event

    def emit_tool_call(
        self,
        tool_name: str,
        description: str,
        params: dict | None = None,
    ) -> None:
        """Emit a tool_call event for real-time display."""
        if self._on_tool_event:
            self._on_tool_event(
                "tool_call",
                tool_name,
                description,
                params,
            )

    def emit_tool_result(
        self,
        tool_name: str,
        summary: str,
        result_data: dict | None = None,
    ) -> None:
        """Emit a tool_result event for real-time display."""
        if self._on_tool_event:
            self._on_tool_event(
                "tool_result",
                tool_name,
                summary,
                result_data,
            )

    def _load_rules(self) -> list[dict]:
        """Load validation rules from domain directory."""
        root_dir = Path(__file__).parent.parent
        domain_dir = root_dir / "domains" / self.domain_id

        if not domain_dir.exists():
            domain_dir = (
                root_dir / "reference" / "workflow" / "domains" / self.domain_id
            )

        rules_path = domain_dir / "validation_rules.json"

        if not rules_path.exists():
            logger.warning(f"No validation rules found at {rules_path}")
            return []

        with open(rules_path, "r") as f:
            return json.load(f)


# Global context - set before agent execution
_tool_context: ToolContext | None = None


def set_tool_context(context: ToolContext) -> None:
    """Set the global tool context."""
    global _tool_context
    _tool_context = context


def get_tool_context() -> ToolContext:
    """Get the global tool context."""
    if _tool_context is None:
        raise RuntimeError("Tool context not initialized")
    return _tool_context


@tool
def get_validation_rules() -> dict[str, Any]:
    """
    Get the validation rules for the current document domain.
    Returns the rules that should be applied to validate extracted data.
    This simulates accessing a rules/policy management system.
    """
    ctx = get_tool_context()
    logger.info(f"🔧 [TOOL CALLED] get_validation_rules(domain={ctx.domain_id})")
    ctx.emit_tool_call("get_validation_rules", f"Loading validation rules for {ctx.domain_id}", {"domain": ctx.domain_id})

    rules = ctx.validation_rules
    result = {
        "domain": ctx.domain_id,
        "rule_count": len(rules),
        "rules": [
            {
                "name": r.get("name"),
                "type": r.get("rule_type"),
                "severity": r.get("severity", "warning"),
                "description": r.get("description", ""),
            }
            for r in rules
        ],
    }
    logger.info(f"✓ [TOOL RESULT] Found {len(rules)} validation rules")
    ctx.emit_tool_result("get_validation_rules", f"Found {len(rules)} validation rules", {"ruleCount": len(rules)})
    return result


@tool
def run_validation_check(
    field_name: Annotated[str, Field(description="The field name to validate")],
    field_value: Annotated[str, Field(description="The value to validate")],
) -> dict[str, Any]:
    """
    Run validation checks on a specific field value.
    This simulates accessing a validation/compliance system.
    Returns validation results for the given field.
    """
    ctx = get_tool_context()
    logger.info(
        f"🔧 [TOOL CALLED] run_validation_check(field={field_name}, value={field_value})"
    )
    ctx.emit_tool_call("run_validation_check", f"Validating {field_name}", {"field": field_name, "value": str(field_value)[:50]})

    results = []

    for rule in ctx.validation_rules:
        rule_type = rule.get("rule_type", "")
        params = rule.get("parameters", {})

        # Check if this rule applies to this field
        if rule_type == "threshold":
            if params.get("field") == field_name:
                try:
                    actual = float(field_value)
                    threshold = params.get("value", 0)
                    operator = params.get("operator", "greater_than")

                    if operator == "greater_than":
                        triggered = actual > threshold
                    else:
                        triggered = actual < threshold

                    results.append(
                        {
                            "rule_name": rule.get("name"),
                            "passed": not triggered,
                            "message": f"Value {actual} {'exceeds' if triggered else 'within'} threshold {threshold}",
                        }
                    )
                except ValueError:
                    results.append(
                        {
                            "rule_name": rule.get("name"),
                            "passed": True,
                            "message": "Non-numeric value, skipped threshold check",
                        }
                    )

        elif rule_type == "format_validation":
            if params.get("field") == field_name:
                pattern = params.get("pattern", "")
                clean_value = str(field_value).strip().rstrip(")(][}{")

                try:
                    matched = bool(re.match(pattern, clean_value))
                    results.append(
                        {
                            "rule_name": rule.get("name"),
                            "passed": matched,
                            "message": f"Format {'valid' if matched else 'invalid'}: {clean_value}",
                        }
                    )
                except re.error:
                    pass

    result = {
        "field_name": field_name,
        "validation_count": len(results),
        "results": (
            results
            if results
            else [
                {
                    "rule_name": "no_rules",
                    "passed": True,
                    "message": "No specific rules for this field",
                }
            ]
        ),
    }
    logger.info(f"✓ [TOOL RESULT] {len(results)} validations run")
    passed = sum(1 for r in (results or []) if r.get("passed", True))
    ctx.emit_tool_result("run_validation_check", f"{field_name}: {len(results)} checks, {passed} passed", {"field": field_name, "checks": len(results), "passed": passed})
    return result


@tool
def get_azure_extraction() -> dict[str, Any]:
    """
    Get the extracted data from Azure Content Understanding.
    This represents the structured extraction using Azure AI services.
    """
    ctx = get_tool_context()
    logger.info("🔧 [TOOL CALLED] get_azure_extraction()")
    ctx.emit_tool_call("get_azure_extraction", "Retrieving Azure CU extraction results")

    result = {
        "source": "Azure Content Understanding",
        "field_count": len(ctx.azure_data),
        "fields": ctx.azure_data,
    }
    logger.info(f"✓ [TOOL RESULT] Retrieved {len(ctx.azure_data)} fields")
    ctx.emit_tool_result("get_azure_extraction", f"Retrieved {len(ctx.azure_data)} fields", {"fieldCount": len(ctx.azure_data)})
    return result


@tool
def get_dspy_extraction() -> dict[str, Any]:
    """
    Get the extracted data from DSPy LLM extraction.
    This represents the AI/LLM-based extraction results.
    """
    ctx = get_tool_context()
    logger.info("🔧 [TOOL CALLED] get_dspy_extraction()")
    ctx.emit_tool_call("get_dspy_extraction", "Retrieving DSPy LLM extraction results")

    result = {
        "source": "DSPy LLM Extraction",
        "field_count": len(ctx.dspy_data),
        "fields": ctx.dspy_data,
    }
    logger.info(f"✓ [TOOL RESULT] Retrieved {len(ctx.dspy_data)} fields")
    ctx.emit_tool_result("get_dspy_extraction", f"Retrieved {len(ctx.dspy_data)} fields", {"fieldCount": len(ctx.dspy_data)})
    return result


@tool
def get_comparison_analysis() -> dict[str, Any]:
    """
    Get the comparison analysis between Azure and DSPy extractions.
    Shows which fields match, differ, and recommendations for each.
    """
    ctx = get_tool_context()
    logger.info("🔧 [TOOL CALLED] get_comparison_analysis()")
    ctx.emit_tool_call("get_comparison_analysis", "Comparing Azure vs DSPy results")

    result = {
        "total_fields": ctx.comparison_result.get("total_fields", 0),
        "matching_fields": ctx.comparison_result.get("matching_fields", 0),
        "differing_fields": ctx.comparison_result.get("differing_fields", 0),
        "match_percentage": ctx.comparison_result.get("match_percentage", 0),
        "fields_needing_review": ctx.comparison_result.get("fields_needing_review", []),
        "field_analyses": ctx.comparison_result.get("field_analyses", []),
    }
    logger.info(
        f"✓ [TOOL RESULT] {result['matching_fields']}/{result['total_fields']} fields match"
    )
    ctx.emit_tool_result("get_comparison_analysis", f"{result['matching_fields']}/{result['total_fields']} fields match ({result['match_percentage']}%)", {"matching": result['matching_fields'], "total": result['total_fields'], "percentage": result['match_percentage']})
    return result


@tool
def get_human_review_status() -> dict[str, Any]:
    """
    Get the human review status and feedback.
    This represents the HITL (Human-In-The-Loop) decision.
    """
    ctx = get_tool_context()
    logger.info("🔧 [TOOL CALLED] get_human_review_status()")
    ctx.emit_tool_call("get_human_review_status", "Checking human review decision")

    result = {
        "approved": ctx.human_approved,
        "feedback": ctx.human_feedback or "No feedback provided",
        "review_completed": True,
    }
    logger.info(f"✓ [TOOL RESULT] Human approved: {ctx.human_approved}")
    ctx.emit_tool_result("get_human_review_status", f"Human {'approved' if ctx.human_approved else 'rejected'}", {"approved": ctx.human_approved})
    return result


@tool
def consolidate_field_value(
    field_name: Annotated[str, Field(description="The field name to consolidate")],
    recommended_value: Annotated[
        str, Field(description="The recommended final value for this field")
    ],
    source: Annotated[
        str,
        Field(
            description="Source of the value: 'azure', 'dspy', 'comparison', or 'manual'"
        ),
    ],
    confidence: Annotated[
        float, Field(description="Confidence score 0.0-1.0 for this value")
    ],
) -> dict[str, Any]:
    """
    Store a consolidated field value after analysis.
    Use this to record the final recommended value for each field.
    """
    ctx = get_tool_context()
    logger.info(
        f"🔧 [TOOL CALLED] consolidate_field_value(field={field_name}, value={recommended_value}, source={source})"
    )
    ctx.emit_tool_call("consolidate_field_value", f"Consolidating {field_name}", {"field": field_name, "source": source, "confidence": confidence})

    ctx.consolidated[field_name] = {
        "value": recommended_value,
        "source": source,
        "confidence": confidence,
    }

    result = {
        "field_name": field_name,
        "value": recommended_value,
        "source": source,
        "confidence": confidence,
        "stored": True,
    }
    logger.info(f"✓ [TOOL RESULT] Consolidated {field_name}")
    ctx.emit_tool_result("consolidate_field_value", f"Consolidated {field_name} (source: {source})", {"field": field_name, "value": str(recommended_value)[:50], "source": source})
    return result


@tool
def get_policy_guidelines(
    document_type: Annotated[
        str, Field(description="The type of document being processed")
    ],
) -> dict[str, Any]:
    """
    Get policy guidelines for processing this type of document.
    This simulates accessing a policy/rules management system.
    """
    ctx = get_tool_context()
    logger.info(
        f"🔧 [TOOL CALLED] get_policy_guidelines(document_type={document_type})"
    )
    ctx.emit_tool_call("get_policy_guidelines", f"Loading policy for {document_type}", {"documentType": document_type})

    # Simulated policy guidelines based on document type
    guidelines = {
        "Insurance Claim": {
            "verification_required": ["patient_nric", "invoice_amount", "claim_form"],
            "auto_approve_threshold": 1000.0,
            "escalation_threshold": 10000.0,
            "required_documents": ["claim_form", "invoice", "medical_report"],
            "sla_days": 5,
        },
        "Home Loan": {
            "verification_required": [
                "applicant_nric",
                "income_verification",
                "property_value",
            ],
            "auto_approve_threshold": 100000.0,
            "escalation_threshold": 1000000.0,
            "required_documents": [
                "application_form",
                "income_proof",
                "property_documents",
            ],
            "sla_days": 14,
        },
        "Trade Finance": {
            "verification_required": ["invoice_number", "amount", "beneficiary"],
            "auto_approve_threshold": 50000.0,
            "escalation_threshold": 500000.0,
            "required_documents": ["invoice", "bill_of_lading", "letter_of_credit"],
            "sla_days": 3,
        },
    }

    result = guidelines.get(
        document_type,
        {
            "verification_required": [],
            "auto_approve_threshold": 0,
            "escalation_threshold": 0,
            "required_documents": [],
            "sla_days": 7,
        },
    )
    result["document_type"] = document_type

    logger.info(f"✓ [TOOL RESULT] Retrieved policy for {document_type}")
    ctx.emit_tool_result("get_policy_guidelines", f"Retrieved policy for {document_type}", {"documentType": document_type})
    return result


# ============================================================================
# REASONING AGENT
# ============================================================================


REASONING_AGENT_INSTRUCTIONS = """You are an intelligent document processing assistant responsible for producing a final reasoning summary for processed documents.

Your job is to:
1. Use the available tools to gather information about the document processing
2. Check validation rules and run validations on key fields
3. Compare Azure and DSPy extractions to find discrepancies
4. Consider the human reviewer's decision and feedback
5. Consolidate field values with the best recommendations
6. Produce a comprehensive summary with recommendations

Available tools:
- get_validation_rules: Get domain validation rules
- run_validation_check: Validate specific field values
- get_azure_extraction: Get Azure Content Understanding results
- get_dspy_extraction: Get DSPy LLM extraction results
- get_comparison_analysis: Get comparison between extractors
- get_human_review_status: Get human approval and feedback
- consolidate_field_value: Store recommended field values
- get_policy_guidelines: Get policy rules for document type

IMPORTANT: Always use the tools to gather information before making conclusions.
Use the consolidate_field_value tool for each field you want to include in the final output.

When you have gathered all information, provide:
1. A summary of the document processing
2. Key findings from validation and comparison
3. Your recommendations for next steps
4. An overall confidence score (0.0-1.0)
"""


class AgentReasoningEngine:
    """AI Foundry Agent-based reasoning engine with tools."""

    def __init__(
        self,
        domain_id: str,
        instance_id: str | None = None,
        on_chunk: "Callable[[str, str, dict | None], None] | None" = None,
    ):
        """Initialize the reasoning agent with tools.

        Args:
            domain_id: Domain identifier for rules loading
            instance_id: Workflow instance ID for streaming support
            on_chunk: Optional callback(chunk_type, content, metadata) for
                      real-time SignalR delivery.  When *None* the engine
                      falls back to debug logging only.
        """
        self.domain_id = domain_id
        self.instance_id = instance_id
        self._on_chunk = on_chunk
        self._chunk_index = 0
        self.chat_client = AzureOpenAIChatClient(
            api_key=AZURE_OPENAI_KEY,
            endpoint=AZURE_OPENAI_ENDPOINT,
            deployment_name=AZURE_OPENAI_CHAT_DEPLOYMENT_NAME,
            api_version=AZURE_OPENAI_API_VERSION,
        )

        # Create agent with tools
        self.agent = self.chat_client.as_agent(
            name="ReasoningAgent",
            instructions=REASONING_AGENT_INSTRUCTIONS,
            tools=[
                get_validation_rules,
                run_validation_check,
                get_azure_extraction,
                get_dspy_extraction,
                get_comparison_analysis,
                get_human_review_status,
                consolidate_field_value,
                get_policy_guidelines,
            ],
        )

        logger.info(f"Created ReasoningAgent with 8 tools for domain: {domain_id}")

    async def generate_summary(
        self,
        document_type: str,
        azure_data: dict[str, Any],
        dspy_data: dict[str, Any],
        comparison_result: dict[str, Any],
        human_approved: bool,
        human_feedback: str,
        accepted_values: dict[str, Any] | None = None,
        default_source: str = "comparison",
    ) -> ReasoningSummary:
        """Generate comprehensive reasoning summary using the agent.

        Args:
            document_type: Primary document classification
            azure_data: Extracted data from Azure CU
            dspy_data: Extracted data from DSPy
            comparison_result: Result from Step 4 comparison
            human_approved: Whether human approved the results
            human_feedback: Feedback from human reviewer
            accepted_values: Human-selected final values from HITL review
            default_source: Fallback source for unreviewed fields

        Returns:
            ReasoningSummary with all consolidated information
        """
        start_time = time.time()

        # Pre-consolidate with human-accepted values
        pre_consolidated = self._consolidate_with_accepted(
            azure_data,
            dspy_data,
            comparison_result,
            accepted_values or {},
            default_source,
        )

        # Set up tool context with human-accepted values
        # Build a tool-event callback that emits tool_call/tool_result chunks
        def _on_tool_event(
            event_type: str, tool_name: str, description: str, data: dict | None = None
        ) -> None:
            self._emit_chunk(
                event_type,  # "tool_call" or "tool_result"
                description,
                {"toolName": tool_name, **(data or {})},
            )

        context = ToolContext(
            domain_id=self.domain_id,
            azure_data=azure_data,
            dspy_data=dspy_data,
            comparison_result=comparison_result,
            human_approved=human_approved,
            human_feedback=human_feedback,
            on_tool_event=_on_tool_event,
        )
        # Pre-populate consolidated with human-accepted values
        context.consolidated = {
            k: {"value": v, "source": "human_accepted"}
            for k, v in pre_consolidated.items()
        }
        set_tool_context(context)

        # Prepare the prompt for the agent
        has_accepted = bool(accepted_values)
        prompt = f"""Please analyze the document processing results for this {document_type} document.

The document has been processed through:
1. Azure Content Understanding extraction
2. DSPy LLM extraction
3. Comparison analysis
4. Human review (approved: {human_approved})
{f'5. Human-accepted values: {len(accepted_values)} fields selected by reviewer' if has_accepted else ''}

Please use the available tools to:
1. Get and review the validation rules
2. Check key field validations on the {'human-accepted' if has_accepted else 'consolidated'} values
3. Compare Azure vs DSPy extractions
4. Review human feedback: "{human_feedback or 'No feedback'}"
5. Get policy guidelines for this document type

{'Note: The human reviewer has already selected final values for some fields.' if has_accepted else ''}

Then provide a comprehensive summary with your findings and recommendations."""

        try:
            # Run the agent with real-time streaming
            ai_summary_parts = []
            chunk_count = 0

            async for update in self.agent.run(prompt, stream=True):
                # Stream each response chunk in real-time to frontend
                if update.text:
                    ai_summary_parts.append(update.text)
                    chunk_count += 1
                    # Send as "summary" type so the frontend renders it in
                    # the summary card, progressively growing.
                    self._emit_chunk(
                        "summary",
                        "".join(ai_summary_parts),
                        {
                            "isStreaming": True,
                            "streamChunk": chunk_count,
                            "totalLength": sum(len(p) for p in ai_summary_parts),
                        },
                    )
                    logger.debug(
                        f"Streamed LLM chunk {chunk_count}: {len(update.text)} chars"
                    )

            ai_summary = "".join(ai_summary_parts)
            logger.info(
                f"LLM streaming complete: {chunk_count} chunks, {len(ai_summary)} total chars"
            )

            # Extract validation results from context
            validation_results = self._run_all_validations(context)
            passed = [v for v in validation_results if v.passed]
            failed = [v for v in validation_results if not v.passed]

            # Use consolidated fields from context (set by agent via tools)
            consolidated = context.consolidated

            # If agent didn't consolidate fields, use defaults
            if not consolidated:
                consolidated = self._default_consolidation(
                    azure_data, dspy_data, comparison_result
                )
            else:
                # Convert to simple values
                consolidated = {k: v.get("value", v) for k, v in consolidated.items()}

            # Calculate confidence score
            confidence = self._calculate_confidence(
                len(passed), len(failed), human_approved, comparison_result
            )

            # Extract recommendations (no streaming needed here — they come
            # from parsing the already-streamed AI summary text).
            recommendations = self._extract_recommendations(ai_summary)

            # ── Emit structured summary chunks ──
            # These use the chunk types the frontend already knows how to render.

            # Validation summary
            self._emit_chunk(
                "validation_summary",
                f"✓ Validation Results: {len(passed)}/{len(validation_results)} passed",
                {
                    "passed": len(passed),
                    "total": len(validation_results),
                },
            )

            # Field matching
            total_fields = comparison_result.get("total_fields", 0)
            matching_fields = comparison_result.get("matching_fields", 0)
            if total_fields > 0:
                matching_pct = (matching_fields / total_fields) * 100
                self._emit_chunk(
                    "field_matching",
                    f"📊 Field Matching: {matching_fields}/{total_fields} fields match ({matching_pct:.1f}%)",
                    {
                        "matching": matching_fields,
                        "total": total_fields,
                        "percentage": matching_pct,
                    },
                )

            # Confidence
            self._emit_chunk(
                "confidence",
                f"🎯 Confidence Score: {confidence:.2%}",
                {"score": confidence},
            )

        except Exception as e:
            logger.error(f"Agent reasoning failed: {e}", exc_info=True)
            self._emit_chunk("error", f"Reasoning failed: {str(e)}")
            ai_summary = f"Document processing analysis failed: {str(e)}"
            validation_results = []
            passed = []
            failed = []
            consolidated = self._default_consolidation(
                azure_data, dspy_data, comparison_result
            )
            confidence = 0.5
            recommendations = [
                "Review document processing manually",
                "Check system logs for errors",
            ]

        processing_time_ms = (time.time() - start_time) * 1000

        # Emit final streaming chunk (tells frontend streaming is done)
        self._emit_chunk(
            "final",
            "✅ Reasoning analysis complete",
            {"is_final": True},
        )

        return ReasoningSummary(
            document_type=document_type,
            total_validations=len(validation_results),
            passed_validations=len(passed),
            failed_validations=len(failed),
            validation_results=validation_results,
            total_fields=comparison_result.get("total_fields", len(consolidated)),
            matching_fields=comparison_result.get("matching_fields", 0),
            fields_needing_review=comparison_result.get("fields_needing_review", []),
            consolidated_fields=consolidated,
            human_approved=human_approved,
            human_feedback=human_feedback,
            ai_summary=ai_summary,
            recommendations=recommendations,
            confidence_score=confidence,
            processing_time_ms=round(processing_time_ms),
        )

    def _emit_chunk(
        self, chunk_type: str, content: str, metadata: dict | None = None
    ) -> None:
        """Emit a reasoning chunk for real-time display.

        If an *on_chunk* callback was supplied (typically backed by the
        SignalR REST client), the chunk is pushed to the frontend
        immediately.  Otherwise we just debug-log.

        Args:
            chunk_type: Type of chunk (system, user, assistant, tool_call,
                        validation, error, final)
            content: The content to display
            metadata: Optional additional metadata
        """
        meta = {**(metadata or {}), "chunkIndex": self._chunk_index}
        self._chunk_index += 1

        if self._on_chunk is not None:
            try:
                self._on_chunk(chunk_type, content, meta)
            except Exception as exc:
                logger.warning(f"on_chunk callback failed: {exc}")

        logger.debug(f"Reasoning chunk [{chunk_type}]: {content[:80]}...")

    def _run_all_validations(self, context: ToolContext) -> list[ValidationResult]:
        """Run all validations on consolidated data."""
        results = []

        # Merge all fields for validation
        all_fields = {**context.azure_data, **context.dspy_data, **context.consolidated}

        for rule in context.validation_rules:
            result = self._apply_validation_rule(rule, all_fields)
            results.append(result)

        return results

    def _apply_validation_rule(self, rule: dict, data: dict) -> ValidationResult:
        """Apply a single validation rule."""
        rule_name = rule.get("name", "unknown")
        rule_type = rule.get("rule_type", "")
        params = rule.get("parameters", {})
        severity = rule.get("severity", "warning")

        try:
            if rule_type == "required_document":
                return ValidationResult(
                    rule_name=rule_name,
                    passed=True,
                    severity=severity,
                    message=f"Document type validated: {params.get('document_type')}",
                )

            elif rule_type == "threshold":
                field = params.get("field", "")
                operator = params.get("operator", "greater_than")
                threshold = params.get("value", 0)

                actual_value = data.get(field)
                if actual_value is None:
                    return ValidationResult(
                        rule_name=rule_name,
                        passed=True,
                        severity="info",
                        message=f"Field '{field}' not found",
                        field=field,
                    )

                try:
                    actual_float = float(actual_value)
                    if operator == "greater_than":
                        triggered = actual_float > threshold
                    else:
                        triggered = actual_float < threshold

                    return ValidationResult(
                        rule_name=rule_name,
                        passed=not triggered,
                        severity=severity,
                        message=f"{'Flagged' if triggered else 'OK'}: {field}={actual_float} (threshold: {threshold})",
                        field=field,
                        actual_value=actual_float,
                    )
                except ValueError:
                    return ValidationResult(
                        rule_name=rule_name,
                        passed=True,
                        severity="info",
                        message=f"Non-numeric value for {field}",
                        field=field,
                    )

            elif rule_type == "format_validation":
                field = params.get("field", "")
                pattern = params.get("pattern", "")
                value = data.get(field, "")

                if not value:
                    return ValidationResult(
                        rule_name=rule_name,
                        passed=True,
                        severity="info",
                        message=f"Field '{field}' not found",
                        field=field,
                    )

                clean_value = str(value).strip().rstrip(")(][}{")
                matched = bool(re.match(pattern, clean_value))

                return ValidationResult(
                    rule_name=rule_name,
                    passed=matched,
                    severity=severity,
                    message=f"{'Valid' if matched else 'Invalid'} format: {clean_value}",
                    field=field,
                    actual_value=clean_value,
                )

            else:
                return ValidationResult(
                    rule_name=rule_name,
                    passed=True,
                    severity="info",
                    message=f"Unknown rule type: {rule_type}",
                )

        except Exception as e:
            return ValidationResult(
                rule_name=rule_name,
                passed=True,
                severity="info",
                message=f"Rule error: {str(e)}",
            )

    def _default_consolidation(
        self,
        azure_data: dict[str, Any],
        dspy_data: dict[str, Any],
        comparison_result: dict[str, Any],
    ) -> dict[str, Any]:
        """Default consolidation logic if agent doesn't consolidate."""
        consolidated = {}

        field_analyses = comparison_result.get("field_analyses", [])
        analysis_map = {fa.get("field_name"): fa for fa in field_analyses}

        all_fields = set(azure_data.keys()) | set(dspy_data.keys())

        for field in all_fields:
            if field in analysis_map:
                analysis = analysis_map[field]
                consolidated[field] = analysis.get(
                    "recommended_value", azure_data.get(field)
                )
            elif field in azure_data:
                consolidated[field] = azure_data[field]
            else:
                consolidated[field] = dspy_data[field]

        return consolidated

    def _consolidate_with_accepted(
        self,
        azure_data: dict[str, Any],
        dspy_data: dict[str, Any],
        comparison_result: dict[str, Any],
        accepted_values: dict[str, Any],
        default_source: str = "comparison",
    ) -> dict[str, Any]:
        """Consolidate fields prioritizing human-accepted values.

        Priority order:
        1. Human-accepted values (from HITL review)
        2. For unreviewed fields, use default_source strategy
        """
        consolidated = {}

        field_analyses = comparison_result.get("field_analyses", [])
        analysis_map = {fa.get("field_name"): fa for fa in field_analyses}

        all_fields = (
            set(azure_data.keys()) | set(dspy_data.keys()) | set(accepted_values.keys())
        )

        for field in all_fields:
            # Priority 1: Human-accepted value
            if field in accepted_values:
                consolidated[field] = accepted_values[field]
            # Priority 2: Use default_source strategy
            elif default_source == "azure" and field in azure_data:
                consolidated[field] = azure_data[field]
            elif default_source == "dspy" and field in dspy_data:
                consolidated[field] = dspy_data[field]
            elif field in analysis_map:
                analysis = analysis_map[field]
                consolidated[field] = analysis.get(
                    "recommended_value", azure_data.get(field)
                )
            elif field in azure_data:
                consolidated[field] = azure_data[field]
            else:
                consolidated[field] = dspy_data[field]

        return consolidated

    def _calculate_confidence(
        self,
        passed: int,
        failed: int,
        human_approved: bool,
        comparison_result: dict[str, Any],
    ) -> float:
        """Calculate overall confidence score."""
        # Base score
        if passed + failed > 0:
            validation_score = passed / (passed + failed)
        else:
            validation_score = 0.8

        # Match score
        total = comparison_result.get("total_fields", 1)
        matching = comparison_result.get("matching_fields", 0)
        match_score = matching / total if total > 0 else 0.5

        # Human approval bonus
        human_bonus = 0.2 if human_approved else 0

        # Weighted average
        confidence = (validation_score * 0.3) + (match_score * 0.3) + human_bonus + 0.2

        return min(1.0, max(0.0, confidence))

    def _extract_recommendations_streaming(self, ai_summary: str) -> list[str]:
        """Extract recommendations from AI summary and emit each as a streaming chunk."""
        recommendations = []

        lines = ai_summary.split("\n")
        in_recommendations = False

        for line in lines:
            line = line.strip()
            lower = line.lower()

            if "recommendation" in lower or "suggest" in lower or "next step" in lower:
                in_recommendations = True
                # Emit section header
                self._emit_chunk(
                    "recommendations_section",
                    "Recommendations:",
                    {"sectionStart": True},
                )
                continue

            if in_recommendations and line.startswith(
                ("-", "•", "*", "1", "2", "3", "4", "5")
            ):
                clean = line.lstrip("-•*0123456789. ")
                if clean:
                    recommendations.append(clean)
                    # Emit each recommendation as it's extracted
                    recommendation_index = len(recommendations) - 1
                    self._emit_chunk(
                        "recommendation",
                        clean,
                        {
                            "index": recommendation_index,
                            "total": None,  # Updated later when complete
                        },
                    )
                    logger.debug(
                        f"Extracted recommendation {recommendation_index}: {clean}"
                    )

        if not recommendations:
            recommendations = [
                "Review validation results",
                "Verify consolidated field values",
            ]
            # Emit default recommendations
            for i, rec in enumerate(recommendations):
                self._emit_chunk(
                    "recommendation",
                    rec,
                    {"index": i, "total": len(recommendations), "isDefault": True},
                )

        recommendations = recommendations[:5]  # Limit to 5 recommendations

        # Emit completion of recommendations section
        self._emit_chunk(
            "recommendations_complete",
            f"Extracted {len(recommendations)} recommendations",
            {
                "totalRecommendations": len(recommendations),
                "sectionEnd": True,
            },
        )

        return recommendations

    def _extract_recommendations(self, ai_summary: str) -> list[str]:
        """Legacy method - extract recommendations from AI summary without streaming."""
        recommendations = []

        lines = ai_summary.split("\n")
        in_recommendations = False

        for line in lines:
            line = line.strip()
            lower = line.lower()

            if "recommendation" in lower or "suggest" in lower or "next step" in lower:
                in_recommendations = True
                continue

            if in_recommendations and line.startswith(
                ("-", "•", "*", "1", "2", "3", "4", "5")
            ):
                clean = line.lstrip("-•*0123456789. ")
                if clean:
                    recommendations.append(clean)

        if not recommendations:
            recommendations = [
                "Review validation results",
                "Verify consolidated field values",
            ]

        return recommendations[:5]  # Limit to 5 recommendations
