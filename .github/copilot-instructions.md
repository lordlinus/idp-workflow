# Copilot Instructions — IDP Workflow

## Build & Run

### Backend (Azure Functions, Python 3.13+)

```bash
# Install dependencies
pip install -r requirements.txt

# Run locally (requires Azure Functions Core Tools v4)
func start
```

### Frontend (Next.js, in `frontend/`)

```bash
cd frontend
npm install
npm run dev          # Dev server on :3000
npm run build        # Production build
npm run lint         # ESLint
npm run type-check   # TypeScript strict check
```

There is no Python test suite or linter configured for the backend. API testing is done via `tests/demo.http` (VS Code REST Client) or curl.

## Architecture

This is an **Azure Durable Functions** orchestration that processes documents through a 6-step pipeline with real-time UI updates via SignalR.

### Pipeline Flow

```
HTTP POST /api/idp/start
  → Orchestrator (idp_workflow/orchestration/orchestration.py)
    → Step 1: PDF Extraction (Azure Document Intelligence → Markdown)
    → Step 2: Classification (DSPy ChainOfThought)
    → Step 3: Data Extraction (Azure CU + DSPy, run concurrently)
    → Step 4: Comparison (Azure vs DSPy field-by-field)
    → Step 5: Human Review (HITL gate — waits for external event or timeout)
    → Step 6: AI Reasoning Agent (validation, summary, recommendations)
  → Final result returned
```

Each step broadcasts `stepStarted` → `stepCompleted`/`stepFailed` events via SignalR so the frontend can update in real-time.

### Backend Layers

- **`function_app.py`** — Entry point. Registers activities, orchestration, HTTP endpoints, and SignalR via modular `register_*()` functions.
- **`idp_workflow/orchestration/`** — Durable orchestrator. Uses `yield context.call_activity(...)` for each step and `yield context.task_all(...)` for parallel execution. The HITL gate uses `wait_for_external_event()` with a timer race (`task_any`).
- **`idp_workflow/activities/activities.py`** — Activity functions (one per step). Each is `async`, returns `{"extraction_result": ..., "step_output": ...}` — raw data for downstream steps + a UI-friendly summary dict.
- **`idp_workflow/steps/`** — Step logic classes (`PDFMarkdownExtractor`, `DocumentClassifier`, `AzureExtractor`, `DSPyExtractor`, etc.). Each exposes an `async` method returning `(PydanticModel, step_output_dict)`.
- **`idp_workflow/api/endpoints.py`** — HTTP + SignalR endpoints. Uses `@app.durable_client_input()` for orchestration control.
- **`idp_workflow/domains/`** — Domain-specific configs (e.g., `insurance_claims/`, `home_loan/`). Each domain has `config.json`, `classification_categories.json`, `extraction_schema.json`, and optional `validation_rules.json`. Loaded via `domain_loader.py` with LRU caching.
- **`idp_workflow/tools/`** — Shared AI utilities: `AzureContentUnderstandingClient` (REST wrapper), DSPy helpers for dynamic Pydantic model generation from extraction schemas.

### Frontend Layers

- **State**: Four Zustand stores with Immer middleware — `workflowStore` (steps, HITL state), `eventsStore` (SignalR event log), `reasoningStore` (streaming chunks), `uiStore` (connection, toasts).
- **API**: `apiClient.ts` (Axios singleton) and `signalrClient.ts` (auto-reconnect with exponential backoff).
- **Components**: `FileUploadArea`, `WorkflowDiagram` (Reaflow visualization), `HITLReviewPanel`, `ReasoningPanel`, `DetailPanel`.
- **Data fetching**: React Query hooks (`useUploadPDF`, `useStartWorkflow`, `useDemoDocument`).

## Key Conventions

### Activity function pattern

Every activity follows this structure:

```python
@app.activity_trigger(input_name="request_name")
async def activity_step_XX_name(request_dict: dict) -> dict:
    request_id = request_dict.get("request_id")
    # Instantiate step class, call async method
    result, step_output = await executor.method(...)
    return {
        "extraction_result": result.model_dump(),
        "step_output": step_output,
    }
```

### SignalR user-targeted messaging

The orchestrator broadcasts state changes via a `_broadcast(context, user_id, event, data)` helper that calls a `notify_user` activity with a SignalR output binding. Messages are targeted to specific users via `userId` (not groups). The frontend generates a session-scoped `userId`, sends it as an `x-user-id` header on negotiate and start-workflow requests. The negotiate binding uses `user_id="{headers.x-user-id}"` to tie the SignalR token to that user. No subscribe/unsubscribe endpoints are needed. All events include `instanceId` and `timestamp`.

### Domain-driven extraction

Extraction schemas live in `idp_workflow/domains/{domain_id}/extraction_schema.json`. The DSPy extractor dynamically generates Pydantic models from these schemas at runtime using `create_extraction_model_from_schema()`. Adding a new domain only requires creating a new folder with the four config JSON files.

### Step name constants

Step names are defined in `idp_workflow/constants.py` (e.g., `STEP1_PDF_EXTRACTION`, `STEP3_AZURE_EXTRACTION`). Always reference these constants — never hardcode step name strings.

### Async patterns

- Blocking DSPy/Azure SDK calls are wrapped with `loop.run_in_executor()`.
- Concurrent page processing uses `asyncio.Semaphore` (default limit: 5).
- DSPy calls use `with dspy.context(lm=self.lm):` for LM scoping.

### Pydantic models

All data contracts are in `idp_workflow/models.py`. Step output models (`Step01Output`, `Step02Output`, etc.) are separate from internal domain models (`ExtractionResult`, `ClassificationResult`). Use `model_dump()` for serialization in activities.

### Config

All configuration is via environment variables (see `idp_workflow/config.py`). Key services: Azure OpenAI, Document Intelligence, Cognitive Services (Content Understanding), SignalR, Blob Storage. The SignalR hub name is `"idpworkflow"`.
