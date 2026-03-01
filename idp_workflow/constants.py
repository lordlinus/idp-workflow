"""Constants for the IDP workflow."""

from typing import NamedTuple


class StepInfo(NamedTuple):
    """Metadata for a single pipeline step."""

    step_id: str
    display_name: str
    step_number: int
    activity_name: str


# ── Single source of truth for every pipeline step ──────────────────────
STEPS: tuple[StepInfo, ...] = (
    StepInfo("step_01_pdf_extraction", "PDF to Markdown", 1, "activity_step_01_pdf_extraction"),
    StepInfo("step_02_classification", "Document Classification", 2, "activity_step_02_classification"),
    StepInfo("step_03_01_azure_extraction", "Azure CU Extraction", 3, "activity_step_03_01_azure_extraction"),
    StepInfo("step_03_02_dspy_extraction", "DSPy Extraction", 3, "activity_step_03_02_dspy_extraction"),
    StepInfo("step_04_comparison", "Extraction Comparison", 4, "activity_step_04_comparison"),
    StepInfo("step_05_human_review", "Human Review", 5, ""),
    StepInfo("step_06_reasoning_agent", "Reasoning (Agent)", 6, "activity_step_06_reasoning_agent"),
)

# Lookup: step_id → (display_name, step_number)  — used by the orchestrator
STEP_META: dict[str, tuple[str, int]] = {
    s.step_id: (s.display_name, s.step_number) for s in STEPS
}

# ── Backward-compatible individual constants (widely imported) ──────────
STEP1_PDF_EXTRACTION = "step_01_pdf_extraction"
STEP2_CLASSIFICATION = "step_02_classification"
STEP3_AZURE_EXTRACTION = "step_03_01_azure_extraction"
STEP3_DSPY_EXTRACTION = "step_03_02_dspy_extraction"
STEP4_COMPARISON = "step_04_comparison"
STEP5_HUMAN_REVIEW = "step_05_human_review"
STEP6_REASONING_AGENT = "step_06_reasoning_agent"

WORKFLOW_ORCHESTRATION = "idp_workflow_orchestration"
HITL_REVIEW_EVENT = "HumanReviewDecision"
