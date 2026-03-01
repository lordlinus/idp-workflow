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
- **`idp_workflow/constants.py`** — Step registry. `STEPS` tuple of `StepInfo` namedtuples is the single source of truth for step IDs, display names, numbers, and activity names. `STEP_META` dict derives from it. Individual constants (`STEP1_PDF_EXTRACTION`, etc.) kept for backward compat.
- **`idp_workflow/errors.py`** — Typed error hierarchy. `IDPError` base → `ExtractionError`, `ClassificationError`, `ComparisonError`, `ReasoningError`, `ConfigurationError`. All carry `request_id` and `step_name`.
- **`idp_workflow/orchestration/`** — Durable orchestrator. Uses `_execute_step()` helper for standardized broadcast→activity→broadcast flow, `yield context.task_all(...)` for parallel execution, and `wait_for_external_event()` with timer race for the HITL gate.
- **`idp_workflow/activities/activities.py`** — Activity functions (one per step). Each uses `ActivityContext` for request_id extraction, timing, and structured logging.
- **`idp_workflow/activities/utils.py`** — `ActivityContext` helper class. Standardizes request_id extraction, elapsed time measurement, structured logging (`log_start`/`log_complete`/`log_error`), and result formatting.
- **`idp_workflow/steps/`** — Step logic classes (`PDFMarkdownExtractor`, `DocumentClassifier`, `AzureExtractor`, `DSPyExtractor`, etc.). Each exposes an `async` method returning `(PydanticModel, step_output_dict)`.
- **`idp_workflow/api/endpoints.py`** — HTTP + SignalR endpoints. Uses `@app.durable_client_input()` for orchestration control.
- **`idp_workflow/domains/`** — Domain-specific configs (e.g., `insurance_claims/`, `home_loan/`). Each domain has `config.json`, `classification_categories.json`, `extraction_schema.json`, and optional `validation_rules.json`. Loaded via `domain_loader.py` with LRU caching.
- **`idp_workflow/tools/`** — Shared AI utilities: `AzureContentUnderstandingClient` (REST wrapper), DSPy helpers for dynamic Pydantic model generation from extraction schemas.

### Frontend Layers

- **State**: Four Zustand stores with Immer middleware — `workflowStore` (steps, HITL state), `eventsStore` (SignalR event log), `reasoningStore` (streaming chunks), `uiStore` (connection, toasts).
- **Step config**: `lib/stepConfig.ts` — single source of truth for all step UI metadata (display names, order, numbers, icons, descriptions, pipeline layout). Exports `STEP_CONFIGS`, `STEP_ORDER`, `STEP_DISPLAY_NAMES`, `STEP_INFO`, `PIPELINE_ROWS`.
- **Shared utilities**: `lib/formatting.ts` — `formatFieldValue()` and `getConfidenceColor()` extracted from components.
- **API**: `apiClient.ts` (Axios singleton) and `signalrClient.ts` (auto-reconnect with exponential backoff).
- **Components**: `FileUploadArea`, `WorkflowDiagram` (Reaflow visualization), `HITLReviewPanel`, `ReasoningPanel`, `detail/` (split `DetailPanel` → container + 8 focused sub-components: `StepOutputRenderer`, `StepOutputView`, `ReasoningOutput`, `ValidationRulesPanel`, `ExtractionSchemaView`, `CompletionDashboard`, `DefaultView`, `ValueDisplay`).
- **Data fetching**: React Query hooks (`useUploadPDF`, `useStartWorkflow`, `useDemoDocument`).

## Key Conventions

### Activity function pattern

Every activity uses `ActivityContext` from `idp_workflow/activities/utils.py`:

```python
@app.activity_trigger(input_name="request_name")
async def activity_step_XX_name(request_dict: dict) -> dict:
    ctx = ActivityContext(request_dict, "step_XX_name")
    ctx.log_start()
    try:
        # Instantiate step class, call async method
        result, step_output = await executor.method(...)
        ctx.log_complete()
        return ctx.result(extraction_result=result.model_dump(), step_output=step_output)
    except Exception as e:
        ctx.log_error(e)
        raise ExtractionError(str(e), request_id=ctx.request_id, step_name="step_XX") from e
```

### Step registration

The `STEPS` tuple of `StepInfo` namedtuples in `idp_workflow/constants.py` is the single source of truth. When adding a step, add it to `STEPS` first — `STEP_META` derives automatically. Individual constants (`STEP1_PDF_EXTRACTION`, etc.) still exist for backward compat.

### Error handling

Use typed errors from `idp_workflow/errors.py`. Hierarchy: `IDPError` → `ExtractionError`, `ClassificationError`, `ComparisonError`, `ReasoningError`, `ConfigurationError`. Always pass `request_id` and `step_name`. Never raise bare `Exception` from activities.

### Orchestrator step pattern

Standard steps use `_execute_step()` generator helper which wraps broadcast→activity→broadcast:

```python
step1_result = yield from _execute_step(
    context, user_id, request_id,
    STEP1_PDF_EXTRACTION, "activity_step_01_pdf_extraction",
    {"request_id": request_id, "pdf_path": pdf_path}
)
```

Step 3 (parallel Azure CU + DSPy) uses custom logic with `context.task_all()`.

### Frontend step config

All step UI metadata lives in `frontend/src/lib/stepConfig.ts`. Never hardcode step names, icons, or display order in components — import from `stepConfig.ts`.

### SignalR user-targeted messaging

The orchestrator broadcasts state changes via a `_broadcast(context, user_id, event, data)` helper that calls a `notify_user` activity with a SignalR output binding. Messages are targeted to specific users via `userId` (not groups). The frontend generates a session-scoped `userId`, sends it as an `x-user-id` header on negotiate and start-workflow requests. The negotiate binding uses `user_id="{headers.x-user-id}"` to tie the SignalR token to that user. No subscribe/unsubscribe endpoints are needed. All events include `instanceId` and `timestamp`.

### Domain-driven extraction

Extraction schemas live in `idp_workflow/domains/{domain_id}/extraction_schema.json`. The DSPy extractor dynamically generates Pydantic models from these schemas at runtime using `create_extraction_model_from_schema()`. Adding a new domain only requires creating a new folder with the four config JSON files.

### Async patterns

- Blocking DSPy/Azure SDK calls are wrapped with `loop.run_in_executor()`.
- Concurrent page processing uses `asyncio.Semaphore` (default limit: 5).
- DSPy calls use `with dspy.context(lm=self.lm):` for LM scoping.

### Pydantic models

All data contracts are in `idp_workflow/models.py`. Step output models (`Step01Output`, `Step02Output`, etc.) are separate from internal domain models (`ExtractionResult`, `ClassificationResult`). Use `model_dump()` for serialization in activities.

### Config

All configuration is via environment variables (see `idp_workflow/config.py`). Key services: Azure OpenAI, Document Intelligence, Cognitive Services (Content Understanding), SignalR, Blob Storage. The SignalR hub name is `"idpworkflow"`.

## Adding a New Step

### Backend
1. **`idp_workflow/constants.py`** — Add `StepInfo` entry to `STEPS` tuple and a backward-compat constant.
2. **`idp_workflow/steps/step_XX_name.py`** — Implement step logic class with async method returning `(PydanticModel, step_output_dict)`.
3. **`idp_workflow/activities/activities.py`** — Add activity function using `ActivityContext` pattern above.
4. **`idp_workflow/orchestration/orchestration.py`** — Wire step via `yield from _execute_step(...)`.

### Frontend
5. **`frontend/src/lib/stepConfig.ts`** — Add entry to `STEP_CONFIGS` with display name, icon, description.
6. **`frontend/src/components/detail/StepOutputRenderer.tsx`** — Add output renderer case for the new step.
