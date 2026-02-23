# IDP Agents & Reasoning Guide

This document explains how the Intelligent Document Processing (IDP) workflow in this repo uses the Agent Framework on Azure Functions, how to call the HTTP surface, what the agent sees, and what responses look like. It reflects the current implementation in the IDP durable orchestration and the Step 6 agent-based reasoning stage.

---

## What the workflow does

- Durable orchestration chains 6 steps: PDF extraction → classification → concurrent Azure CU + DSPy extraction → comparison → human review (HITL) → agent-led reasoning and consolidation.
- SignalR is used for real-time step updates, HITL prompts, and reasoning chunks; HTTP polling endpoints exist for fallback/rehydration.
- The agent (Step 6) runs in the `activity_step_06_reasoning_agent` activity and is defined in the Agent Framework-based code in [idp_workflow/step_06_reasoning_agent.py](idp_workflow/step_06_reasoning_agent.py).

### Workflow map (matches orchestration)

| # | Step | Activity name | What happens | Output shape |
|---|------|---------------|--------------|---------------|
| 1 | `step_01_pdf_extraction` | `activity_step_01_pdf_extraction` | PDF → markdown text | Step01Output: counts + preview |
| 2 | `step_02_classification` | `activity_step_02_classification` | Page/domain classification | Step02Output: categories + confidence |
| 3a | `step_03_01_azure_extraction` | `activity_step_03_01_azure_extraction` | Azure Content Understanding extraction | ExtractionResult + step output |
| 3b | `step_03_02_dspy_extraction` | `activity_step_03_02_dspy_extraction` | DSPy LLM extraction | ExtractionResult + step output |
| 4 | `step_04_comparison` | `activity_step_04_comparison` | Field-by-field comparison | Step04Output |
| 5 | `step_05_human_review` | external event `HITL_REVIEW_EVENT` | Waits for reviewer decision/values | HumanReviewResponse |
| 6 | `step_06_reasoning_agent` | `activity_step_06_reasoning_agent` | Agent tools consolidate, validate, summarize | Step06Output + ReasoningSummary |

---

## HTTP surface

### Start workflow

- **Endpoint:** `POST /api/idp/start`
- **Body:**

  ```json
  {
    "pdf_path": "/abs/path/or/blob.pdf",
    "domain_id": "insurance_claims",
    "max_pages": 50
  }
  ```

- **Response (202):**

  ```json
  {
    "message": "IDP Workflow started",
    "instanceId": "8a5f4cde0e6e4f44b55f8e54cf12abcd",
    "request_id": "fd2d2c74-8b9f-41f8-8d21-1e3c1c8d1b55"
  }
  ```

### Submit HITL review

- **Endpoint:** `POST /api/idp/hitl/review/{instanceId}`
- **Body:**

  ```json
  {
    "approved": true,
    "feedback": "Looks good",
    "reviewer": "reviewer@example.com",
    "accepted_values": {"patientName": "John Doe"},
    "default_source": "comparison",
    "field_selections": [
      {
        "field_name": "patientName",
        "selected_source": "azure",
        "selected_value": "John Doe",
        "azure_value": "John Doe",
        "dspy_value": "John M. Doe",
        "notes": "Matched ID"
      }
    ]
  }
  ```

- The orchestration resumes when this event is raised.

### SignalR (real-time)

- **Negotiate:** `POST/GET /api/idp/negotiate` → `{ url, accessToken }`
- **Subscribe:** `POST /api/idp/subscribe/{instanceId}` with header `x-signalr-connection-id`
- **Unsubscribe:** `POST /api/idp/unsubscribe/{instanceId}` with the same header
- Group name format: `workflow-{instanceId}`

---

## Real-time events you will see

Event targets emitted via SignalR:

- `stepStarted`, `stepCompleted`, `stepFailed`
- `hitlWaiting`, `hitlApproved`, `hitlRejected`
- `reasoningChunk` (streamed chunks from Step 6)
- `workflowCompleted`

`reasoningChunk` payload shape:

```json
{
  "target": "reasoningChunk",
  "arguments": [{
    "event": "reasoningChunk",
    "instanceId": "8a5f4cde0e6e4f44b55f8e54cf12abcd",
    "timestamp": "2024-01-05T10:00:35Z",
    "data": {
      "chunkType": "confidence",
      "content": "🎯 Confidence Score: 92.0%",
      "chunkIndex": 2,
      "metadata": {"score": 0.92}
    }
  }]
}
```

---

## Agent (Step 6) internals

Defined in [idp_workflow/step_06_reasoning_agent.py](idp_workflow/step_06_reasoning_agent.py). The activity `activity_step_06_reasoning_agent` receives:

- `document_type`: primary category from classification
- `azure_data`, `dspy_data`: raw extraction outputs
- `comparison_result`: field-by-field comparison
- `accepted_values`, `default_source`: reviewer-approved values
- `human_approved`, `human_feedback`
- `domain_id`, `request_id`, `instance_id`

The agent is built with `AzureOpenAIChatClient` + `ai_function` tools. Tools available to the agent:

| Tool | Purpose |
|------|---------|
| `get_validation_rules` | Load domain-specific validation rules from `domains/{domain_id}/validation_rules.json` |
| `run_validation_check(field_name, field_value)` | Apply per-field validation logic (thresholds, patterns) |
| `get_azure_extraction` / `get_dspy_extraction` | Return extracted fields from each extractor |
| `get_comparison_analysis` | Return comparison counts and per-field analyses |
| `get_human_review_status` | Report HITL approval status and feedback |
| `consolidate_field_value(field_name, recommended_value, source, confidence)` | Record consolidated values for the final result |
| `get_policy_guidelines(document_type)` | Surface domain policies (SLA, required docs, thresholds) |

Outputs produced:

- `ReasoningSummary` (AI summary, recommendations, consolidated fields, validation results, confidence)
- `Step06Output` (counts/metrics for UI + engine flag `agent_framework`)
- Streaming `reasoningChunk` messages with validation summary, field matching, confidence, summary text, and a final sentinel chunk.

---

## End-to-end response example (final orchestration result)

```json
{
  "request_id": "fd2d2c74-8b9f-41f8-8d21-1e3c1c8d1b55",
  "steps": {
    "step_01_pdf_extraction": {
      "total_pages": 12,
      "characters": 28450,
      "file_path": "/tmp/invoice.pdf",
      "preview": "12 pages, 28k chars"
    },
    "step_02_classification": {
      "pages_classified": 12,
      "classifications": [{"page": 0, "category": "Medical_Invoice", "confidence": 0.95}],
      "primary_category": "Medical_Invoice",
      "primary_confidence": 0.95
    },
    "step_03_01_azure_extraction": {
      "extracted_data": {"patientName": "John Doe", "totalAmount": 1500.0},
      "processing_time_ms": 8200,
      "total_pages_processed": 12
    },
    "step_03_02_dspy_extraction": {
      "extracted_data": {"patientName": "John M. Doe", "totalAmount": 1500.5},
      "processing_time_ms": 9600,
      "total_pages_processed": 12
    },
    "step_04_comparison": {
      "total_fields": 12,
      "matching_fields": 9,
      "differing_fields": 3,
      "match_percentage": 75.0,
      "requires_human_review": true,
      "fields_needing_review": ["patientName", "totalAmount", "policyNumber"],
      "field_comparisons": [
        {"field_name": "patientName", "azure_value": "John Doe", "dspy_value": "John M. Doe", "match": false, "needs_review": true},
        {"field_name": "totalAmount", "azure_value": 1500.0, "dspy_value": 1500.5, "match": false, "needs_review": true}
      ],
      "processing_time_ms": 430
    },
    "step_06_reasoning_agent": {
      "total_validations": 3,
      "passed_validations": 3,
      "failed_validations": 0,
      "total_fields": 12,
      "matching_fields": 10,
      "confidence_score": 0.92,
      "human_approved": true,
      "recommendations_count": 2,
      "engine": "agent_framework",
      "processing_time_ms": 2100
    }
  },
  "summary": {
    "document_type": "Medical_Invoice",
    "ai_summary": "Invoice appears valid; charges align to policy coverage with no anomalies detected.",
    "recommendations": [
      "Auto-approve under $2,000 threshold.",
      "Flag for audit if additional attachments are missing."
    ],
    "confidence_score": 0.92,
    "reasoning_engine": "agent"
  },
  "validation": {
    "total": 3,
    "passed": 3,
    "failed": 0
  },
  "consolidated_fields": {
    "patientName": {"value": "John Doe", "source": "azure", "confidence": 0.88},
    "totalAmount": {"value": 1500.0, "source": "manual", "confidence": 0.9}
  },
  "comparison_summary": {
    "total_fields": 12,
    "matching_fields": 9,
    "match_percentage": 75.0,
    "requires_human_review": true,
    "fields_needing_review": ["patientName", "totalAmount", "policyNumber"]
  },
  "human_reviewer": "reviewer@example.com",
  "review_feedback": "Verified against claim form",
  "created_at": "2024-01-05T10:00:21Z"
}
```

---

## Quick integration checklist

1. Negotiate SignalR, connect, and register handlers for `stepStarted`, `stepCompleted`, `hitlWaiting`, `reasoningChunk`, `workflowCompleted` before starting a run.
2. Start the workflow via `POST /api/idp/start`; store `instanceId` and `request_id`.
3. Call `POST /api/idp/subscribe/{instanceId}` (with `x-signalr-connection-id`) to join the group.
4. When `hitlWaiting` arrives, GET `/api/idp/workflow/{instanceId}/hitl` for full comparison data, render the field selection UI, and POST the review to `/api/idp/hitl/review/{instanceId}`.
5. Stream `reasoningChunk` events until you see `chunkType: final`; for reconnect, pull `/api/idp/reasoning/{instanceId}/history`.
6. On `workflowCompleted`, fetch the final payload from your listener or rehydrate with the polling endpoints if needed.

For implementation details, see the orchestration in [idp_workflow/orchestration.py](idp_workflow/orchestration.py) and the HTTP/SignalR bindings in [idp_workflow/endpoints.py](idp_workflow/endpoints.py).
