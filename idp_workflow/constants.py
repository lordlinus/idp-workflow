"""Constants for the IDP workflow."""

# Step names
STEP1_PDF_EXTRACTION = "step_01_pdf_extraction"
STEP2_CLASSIFICATION = "step_02_classification"
STEP3_AZURE_EXTRACTION = "step_03_01_azure_extraction"
STEP3_DSPY_EXTRACTION = "step_03_02_dspy_extraction"
STEP4_COMPARISON = "step_04_comparison"
STEP5_HUMAN_REVIEW = "step_05_human_review"
STEP6_REASONING_AGENT = "step_06_reasoning_agent"

WORKFLOW_ORCHESTRATION = "idp_workflow_orchestration"
HITL_REVIEW_EVENT = "HumanReviewDecision"
