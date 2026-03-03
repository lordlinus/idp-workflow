# Copilot Skill — Azure Durable Functions + Next.js Pipeline Pattern

## Template Variables

Replace these placeholders when adapting for a new project:

| Variable | Description | Example (IDP) |
|----------|-------------|---------------|
| `{project_name}` | Python package (snake_case) | `idp_workflow` |
| `{project_display_name}` | Human-readable name | `IDP Workflow` |
| `{route_prefix}` | API route namespace | `idp` |
| `{hub_name}` | SignalR hub name (hardcoded string) | `idpworkflow` |
| `{task_hub_name}` | Durable Task hub (via env var) | `idpworkflow` |
| `{orchestration_name}` | Orchestrator function name | `idp_workflow_orchestration` |
| `{error_prefix}` | Base error class name | `IDP` (→ `IDPError`) |
| `{hitl_event_name}` | External event constant | `HumanReviewDecision` |
| `{connection_string_setting}` | SignalR env var name | `AzureSignalRConnectionString` |
| `{azd_project_name}` | `azure.yaml` name field | `idp-workflow` |

## When to Use

- Building a multi-step workflow or pipeline backend on Azure Functions
- Need real-time step-by-step progress in a web UI (via SignalR)
- Processing pipelines with parallel execution, HITL approval gates, or AI reasoning steps
- Domain-driven projects where adding a new domain = adding config files (no code changes)
- Any Azure Durable Functions + Next.js full-stack project

---

## Project Structure

```
├── function_app.py                    # Entry point — 5 modular registration calls
├── host.json                          # DTS, OpenTelemetry, extension bundles
├── requirements.txt                   # Python dependencies
├── azure.yaml                         # AZD multi-service config
├── local.settings.json                # Local dev config (gitignored)
├── local.settings.example.json        # Template for local.settings.json
├── infra/                             # Bicep infrastructure-as-code
│   ├── main.bicep                     # Subscription-scoped entry point
│   ├── core.bicep                     # All Azure resources
│   └── main.parameters.json           # Parameter defaults
├── hooks/
│   └── postdeploy.sh                  # Post-provision setup
│
├── {project_name}/                    # Python package (snake_case)
│   ├── __init__.py
│   ├── config.py                      # Environment variable config (hardcoded hub name)
│   ├── constants.py                   # Step registry + orchestration/HITL constants
│   ├── errors.py                      # Typed error hierarchy
│   ├── models.py                      # Pydantic data contracts + dataclasses
│   ├── activities/
│   │   ├── __init__.py                # Exports register_activities()
│   │   ├── activities.py              # Activity functions (one per step)
│   │   ├── utils.py                   # ActivityContext helper
│   │   └── signalr.py                 # SignalR notification activity (separate registration)
│   ├── orchestration/
│   │   ├── __init__.py                # Exports register_orchestration()
│   │   └── orchestration.py           # Durable orchestrator
│   ├── api/
│   │   ├── __init__.py                # Exports register_http_endpoints(), register_signalr_endpoints()
│   │   └── endpoints.py               # HTTP + SignalR negotiate endpoints
│   ├── steps/                         # Step logic classes (one file per step)
│   │   ├── step_01_*.py
│   │   ├── step_02_*.py
│   │   └── ...
│   ├── domains/                        # [Optional] Domain-driven config
│   │   ├── domain_loader.py            # LRU-cached Pydantic loader
│   │   ├── {domain_a}/
│   │   │   ├── config.json
│   │   │   ├── classification_categories.json
│   │   │   ├── extraction_schema.json
│   │   │   └── validation_rules.json
│   │   └── {domain_b}/
│   │       └── ...
│   ├── tools/                          # [Optional] Shared AI/SDK utilities
│   │   ├── llm_factory.py             # LLM provider abstraction
│   │   └── ...
│   └── utils/                          # General helpers
│       ├── helpers.py                  # Input resolution, parsing
│       └── signalr_rest_client.py      # Direct SignalR REST (bypasses orchestrator)
│
├── frontend/                          # Next.js dashboard
│   └── src/
│       ├── app/                       # Next.js App Router
│       │   ├── layout.tsx             # Root layout + providers
│       │   ├── page.tsx               # Upload ↔ Execution state machine
│       │   └── providers.tsx          # QueryClient provider
│       ├── types/
│       │   └── index.ts               # All TypeScript types (single source)
│       ├── lib/
│       │   ├── stepConfig.ts          # Step UI config (single source of truth)
│       │   ├── apiClient.ts           # Axios API singleton + userId generation
│       │   ├── signalrClient.ts       # SignalR real-time client + syncWorkflowStatus
│       │   ├── queryKeys.ts           # React Query hooks
│       │   ├── formatting.ts          # Field value + confidence display
│       │   └── utils.ts              # Duration, status, domain helpers
│       ├── store/                     # Zustand stores (Immer middleware)
│       │   ├── workflowStore.ts       # Steps, HITL, progress, selected step
│       │   ├── eventsStore.ts         # SignalR event log
│       │   ├── reasoningStore.ts      # Streaming AI chunks
│       │   └── uiStore.ts            # Connection, toasts, modal
│       └── components/
│           ├── FileUploadArea.tsx
│           ├── WorkflowDiagram.tsx
│           ├── DetailPanel.tsx
│           ├── HITLReviewPanel.tsx
│           ├── DocumentViewer.tsx
│           ├── ConnectionIndicator.tsx
│           ├── Toast.tsx
│           └── detail/                # Step output sub-components
│               ├── StepOutputRenderer.tsx
│               ├── StepOutputView.tsx
│               ├── ReasoningOutput.tsx
│               ├── ValidationRulesPanel.tsx
│               ├── ExtractionSchemaView.tsx
│               ├── CompletionDashboard.tsx
│               ├── DefaultView.tsx
│               ├── ValueDisplay.tsx
│               └── index.ts
```

---

## Backend Patterns — Core

These patterns apply to every project using this template.

### 1. Entry Point — 5 Modular Registration Calls

The `function_app.py` file creates the app and delegates all registration to modules. There are **five** registration calls — note that `register_signalr_activity` is separate from `register_activities` and takes hub/connection config:

```python
"""Entry point. Registers orchestration, activities, HTTP + SignalR endpoints."""

import azure.functions as func
import azure.durable_functions as df

from {project_name}.config import SIGNALR_HUB_NAME, SIGNALR_CONNECTION_SETTING
from {project_name}.activities import register_activities
from {project_name}.activities.signalr import register_signalr_activity
from {project_name}.orchestration import register_orchestration
from {project_name}.api import register_http_endpoints, register_signalr_endpoints

app = df.DFApp(http_auth_level=func.AuthLevel.ANONYMOUS)

register_activities(app)
register_orchestration(app)
register_http_endpoints(app)
register_signalr_endpoints(app)
register_signalr_activity(app, SIGNALR_HUB_NAME, SIGNALR_CONNECTION_SETTING)
```

Each `register_*()` function accepts the `app` object and decorates its functions onto it.

### 2. Step Registry — Single Source of Truth

All pipeline steps are defined once in `constants.py` using a `NamedTuple`. The file also defines the orchestration function name constant and the HITL event name constant:

```python
from typing import NamedTuple

class StepInfo(NamedTuple):
    step_id: str          # "step_01_pdf_extraction"
    display_name: str     # "PDF to Markdown"
    step_number: int      # 1 (parallel steps share the same number)
    activity_name: str    # "activity_step_01_pdf_extraction" (empty string for non-activity steps)

STEPS: tuple[StepInfo, ...] = (
    StepInfo("step_01_name", "Display Name", 1, "activity_step_01_name"),
    StepInfo("step_02_name", "Display Name", 2, "activity_step_02_name"),
    # Parallel steps share the same step_number:
    StepInfo("step_03_01_variant_a", "Variant A", 3, "activity_step_03_01_variant_a"),
    StepInfo("step_03_02_variant_b", "Variant B", 3, "activity_step_03_02_variant_b"),
    # Non-activity steps (e.g., HITL) have empty activity_name:
    StepInfo("step_05_human_review", "Human Review", 5, ""),
    # ...
)

# Derived lookup: step_id → (display_name, step_number)
STEP_META: dict[str, tuple[str, int]] = {
    s.step_id: (s.display_name, s.step_number) for s in STEPS
}

# Backward-compatible individual constants (widely imported)
STEP1_NAME = "step_01_name"
STEP2_NAME = "step_02_name"
# ...

# Orchestration and HITL constants
WORKFLOW_ORCHESTRATION = "{orchestration_name}"
HITL_REVIEW_EVENT = "{hitl_event_name}"
```

**Naming convention:** Step IDs follow `step_{NN}_{action}` (zero-padded). Activity names follow `activity_step_{NN}_{action}`.

### 3. Typed Error Hierarchy

All errors inherit from a base class that carries `request_id` and `step_name` for distributed tracing:

```python
class {ErrorPrefix}Error(Exception):
    """Base exception for all workflow errors."""
    def __init__(self, message: str, request_id: str | None = None, step_name: str | None = None):
        self.request_id = request_id
        self.step_name = step_name
        prefix = f"[{request_id}] " if request_id else ""
        step = f"{step_name}: " if step_name else ""
        super().__init__(f"{prefix}{step}{message}")

class ExtractionError({ErrorPrefix}Error): pass
class ClassificationError({ErrorPrefix}Error): pass
class ComparisonError({ErrorPrefix}Error): pass
class ReasoningError({ErrorPrefix}Error): pass
class ConfigurationError({ErrorPrefix}Error): pass
```

**Rule:** Never raise bare `Exception` from activities. Always use a typed error with `request_id` and `step_name`.

### 4. ActivityContext — Boilerplate Manager

Every activity function uses `ActivityContext` for standardized request tracking, timing, and logging. **Note:** `ActivityContext` has no `result()` method — activities construct their return dicts manually.

```python
class ActivityContext:
    """Handles request_id extraction, timing, structured logging."""
    def __init__(self, request_dict: dict, step_label: str):
        self.request_id: str = request_dict.get("request_id") or "unknown"
        self.step_label = step_label
        self.start_time = time.time()

    @property
    def elapsed_ms(self) -> int:
        """Milliseconds elapsed since context creation."""
        return round((time.time() - self.start_time) * 1000)

    def log(self, message: str, level: str = "info") -> None:
        getattr(logger, level)(f"[{self.request_id}] {message}")

    def log_start(self, detail: str = "") -> None:
        msg = f"Starting {self.step_label}"
        if detail:
            msg += f": {detail}"
        self.log(msg)

    def log_complete(self, detail: str = "") -> None:
        msg = f"{self.step_label} complete"
        if detail:
            msg += f": {detail}"
        self.log(msg)

    def log_error(self, error: BaseException | None = None) -> None:
        """Log the current exception. Call from an except block."""
        import sys
        exc = error or sys.exc_info()[1]
        self.log(f"{self.step_label} failed: {exc}", level="error")
```

### 5. Activity Function Pattern

Every activity follows this structure. **Important:** the `input_name` parameter varies per activity (e.g., `"extract_request"`, `"classify_request"`, `"compare_request"`, `"reasoning_request"`) — it is NOT always `"request_name"`.

The return dict is manually constructed — there is no `ctx.result()` helper. Step output serialization varies: some steps use `step_output.model_dump()`, others manually build the dict.

```python
def register_activities(app):
    @app.activity_trigger(input_name="extract_request")  # input_name varies per activity
    async def activity_step_XX_name(extract_request: dict) -> dict:
        ctx = ActivityContext(extract_request, "Step label")
        try:
            # Lazy imports (avoid cold-start overhead)
            from {project_name}.steps.step_XX_name import StepClass

            ctx.log_start("optional detail")

            # Instantiate step class, call async method
            executor = StepClass(...)
            result, step_output = await executor.method(...)

            ctx.log_complete(f"summary in {ctx.elapsed_ms}ms")

            # Build return dict manually — serialization style varies per step
            step_output_dict = step_output.model_dump()  # Or manually build dict
            step_output_dict["processing_time_ms"] = ctx.elapsed_ms

            return {
                "result_key": result.model_dump(),  # Or manual dict
                "step_output": step_output_dict,
            }
        except Exception as e:
            ctx.log_error(e)
            raise TypedError(str(e), request_id=ctx.request_id, step_name="step_XX") from e
```

**Key patterns:**
- Lazy imports inside the activity to reduce cold-start time
- Step logic lives in `steps/` classes, not in the activity itself
- Returns dict with both raw result and UI-ready `step_output`
- Always chains `from e` to preserve the original traceback

### 6. Orchestrator Pattern

The orchestrator is a generator function that uses a `_execute_step()` helper for standardized broadcast → activity → broadcast flow:

```python
def _broadcast(context, user_id, event, data):
    """Send a SignalR notification via the notify_user activity."""
    return context.call_activity("notify_user", {
        "user_id": user_id, "instance_id": context.instance_id,
        "event": event, "data": data,
    })

def _generate_output_preview(step_output: dict, step_name: str) -> str:
    """Generate a text preview from step output, switching on step_name."""
    if not step_output:
        return ""
    # Step-specific preview generation (switch on step_name)
    # Falls back to: json.dumps(step_output)[:200]
    ...

def _execute_step(context, user_id, request_id, step_name, activity_name, activity_input,
                  step_output_key="step_output", enrich_output=None):
    """Generator: broadcast stepStarted → call activity → broadcast stepCompleted/stepFailed.

    Use ``yield from`` in the orchestrator to delegate all yields.

    Args:
        step_output_key: Key to extract step output from activity result.
            Use None to treat the entire result as the step output.
        enrich_output: Optional callable(result, step_output) -> step_output
            to transform step output before broadcasting completion.
    """
    dn, sn = STEP_META.get(step_name, (step_name, 0))
    context.set_custom_status(f"[{request_id}] Step {sn}: {dn}")

    yield _broadcast(context, user_id, "stepStarted", {
        "stepName": step_name, "displayName": dn, "stepNumber": sn, "status": "in_progress",
    })

    try:
        result = yield context.call_activity(activity_name, activity_input)
        step_output = (
            result if step_output_key is None
            else result.get(step_output_key, {})
        )
        if enrich_output is not None:
            step_output = enrich_output(result, step_output)

        yield _broadcast(context, user_id, "stepCompleted", {
            "stepName": step_name, "displayName": dn, "stepNumber": sn,
            "status": "completed", "durationMs": step_output.get("processing_time_ms", 0),
            "outputPreview": _generate_output_preview(step_output, step_name),
            "outputData": step_output,
        })
        return result
    except Exception as e:
        error_msg = str(e)
        context.set_custom_status(f"[{request_id}] Step {sn} FAILED: {error_msg}")

        yield _broadcast(context, user_id, "stepFailed", {
            "stepName": step_name, "displayName": dn, "stepNumber": sn,
            "status": "failed", "errorMessage": error_msg,
            "errorType": type(e).__name__,  # Includes Python exception type
        })
        raise
```

**Usage in the orchestrator:**
```python
@app.orchestration_trigger(context_name="context")
def {orchestration_name}(context: DurableOrchestrationContext):
    input_data = context.get_input()
    workflow_input = WorkflowInitInput.model_validate(input_data)
    request_id = workflow_input.request_id
    user_id = workflow_input.user_id

    # Standard step
    step1_result = yield from _execute_step(
        context, user_id, request_id,
        STEP1_NAME, "activity_step_01_name",
        {"request_id": request_id, "data": data},
    )

    # Step with step_output_key=None (entire result IS the output)
    step2_result = yield from _execute_step(
        context, user_id, request_id,
        STEP2_NAME, "activity_step_02_name",
        {...},
        step_output_key=None,
    )

    # Step with enrich_output callback
    def _enrich(result, step_output):
        step_output["extra"] = result.get("extra_key", "")
        return step_output

    step6_result = yield from _execute_step(
        context, user_id, request_id,
        STEP6_NAME, "activity_step_06_name",
        {...},
        enrich_output=_enrich,
    )

    # Broadcast workflow completed
    yield _broadcast(context, user_id, "workflowCompleted", {
        "summary": {...}, "resultUrl": f"/runtime/webhooks/durabletask/instances/{context.instance_id}",
    })

    return final_result
```

### 7. Parallel Execution Pattern

For concurrent steps, broadcast `stepStarted` for each before launching, use `context.task_all()`, then broadcast individual `stepCompleted` events:

```python
# Broadcast started for both
yield _broadcast(context, user_id, "stepStarted", {"stepName": STEP_A, ...})
yield _broadcast(context, user_id, "stepStarted", {"stepName": STEP_B, ...})

# Launch in parallel
task_a = context.call_activity("activity_a", input_a)
task_b = context.call_activity("activity_b", input_b)
results = yield context.task_all([task_a, task_b])

# Broadcast completed individually
yield _broadcast(context, user_id, "stepCompleted", {"stepName": STEP_A, ...})
yield _broadcast(context, user_id, "stepCompleted", {"stepName": STEP_B, ...})
```

### 8. Pydantic Models

Data contracts are layered:
- **Dataclasses** for mutable internal data (e.g., `PDFContent`)
- **Pydantic BaseModel** for API contracts and step outputs (`Step01Output`, `Step02Output`, etc.)
- **Workflow input**: Pydantic model (`WorkflowInitInput`) with optional overrides (`options` dict, `custom_extraction_schema`, `custom_classification_categories`)
- Use `model_dump()` for serialization in activities (some steps use it, others manually build dicts — be consistent in new code)

### 9. Config — Environment Variables

All configuration is via environment variables. The SignalR hub name and connection setting name are **hardcoded strings** in `config.py`, not pulled from env vars:

```python
import os
from pathlib import Path

# Service endpoints — from env vars with empty defaults
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = os.getenv("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", "")
AZURE_DOCUMENT_INTELLIGENCE_KEY = os.getenv("AZURE_DOCUMENT_INTELLIGENCE_KEY", "")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_KEY = os.getenv("AZURE_OPENAI_KEY", "")
AZURE_OPENAI_CHAT_DEPLOYMENT_NAME = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT_NAME", "gpt-4.1")

# SignalR — hardcoded, not from env vars
SIGNALR_HUB_NAME = "{hub_name}"
SIGNALR_CONNECTION_SETTING = "{connection_string_setting}"

# Orchestration
HITL_TIMEOUT_HOURS = int(os.getenv("HITL_TIMEOUT_HOURS", "24"))

# Domains
DOMAINS_DIR = Path(__file__).parent / "domains"
```

### 10. SignalR Notification Activity

The `notify_user` activity is registered separately via `register_signalr_activity()`. It uses a generic output binding and sends user-targeted messages:

```python
def register_signalr_activity(app, hub_name: str, connection_setting: str):
    @app.activity_trigger(input_name="payload")
    @app.generic_output_binding(
        arg_name="signalRMessages",
        type="signalR",
        hub_name=hub_name,
        connection_string_setting=connection_setting,
    )
    def notify_user(payload: dict, signalRMessages) -> dict:
        user_id = payload.get("user_id", "")
        instance_id = payload.get("instance_id", "")
        event = payload.get("event", "unknown")
        data = payload.get("data", {})

        message = {
            "userId": user_id,
            "target": event,
            "arguments": [{
                "event": event,
                "instanceId": instance_id,
                "timestamp": datetime.utcnow().isoformat(),
                "data": data,
            }],
        }
        signalRMessages.set(json.dumps([message]))
        return {"sent": True, "event": event, "user_id": user_id}
```

### 11. SignalR Real-Time Messaging

User-targeted messaging pattern (no groups, no subscribe/unsubscribe):

1. Frontend generates a session-scoped `userId` via `'user-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36)` (stored in sessionStorage)
2. Sends `x-user-id` header on negotiate and start-workflow requests
3. SignalR negotiate binding uses `user_id="{headers.x-user-id}"` to tie the token
4. Orchestrator broadcasts via `_broadcast()` → `notify_user` activity with SignalR output binding
5. All events include `instanceId` and `timestamp`

**SignalR events (camelCase):**

| Event | Source | Description |
|-------|--------|-------------|
| `stepStarted` | Orchestrator | Step is beginning |
| `stepCompleted` | Orchestrator | Step finished successfully |
| `stepFailed` | Orchestrator | Step failed (includes `errorType: type(e).__name__`) |
| `stepProgress` | Activity (REST) | Intermediate progress from within an activity |
| `hitlWaiting` | Orchestrator | HITL gate active, awaiting human decision |
| `hitlApproved` | Orchestrator | Human approved |
| `hitlRejected` | Orchestrator | Human rejected |
| `reasoningChunk` | Activity (REST) | Streaming AI reasoning chunk |
| `workflowCompleted` | Orchestrator | All steps finished |
| `workflowFailed` | Orchestrator | Workflow-level failure |

---

## Backend Patterns — Optional

Enable these per-project based on requirements.

### HITL Gate Pattern

Uses `wait_for_external_event()` with a timer race. **Important:** Cancel the timer when the approval event wins to avoid leaked timers:

```python
HITL_REVIEW_EVENT = "{hitl_event_name}"  # Defined in constants.py

# Broadcast HITL waiting with comparison data for the review UI
yield _broadcast(context, user_id, "hitlWaiting", {
    "fieldsForReview": [...],
    "timeoutSeconds": HITL_TIMEOUT_HOURS * 3600,
    "comparisonSummary": {...},
    "fieldComparisons": [...],
    "reviewUrl": f"/api/{route_prefix}/hitl/review/{context.instance_id}",
})

approval_task = context.wait_for_external_event(HITL_REVIEW_EVENT)
timeout_task = context.create_timer(
    context.current_utc_datetime + timedelta(hours=HITL_TIMEOUT_HOURS)
)

winner = yield context.task_any([approval_task, timeout_task])

if winner == approval_task:
    # Cancel timer to avoid leaked timers (per MS docs)
    if not timeout_task.is_completed:
        timeout_task.cancel()

    human_response = parse_human_approval(approval_task.result)
    if human_response.get("approved", False):
        yield _broadcast(context, user_id, "hitlApproved", {...})
    else:
        yield _broadcast(context, user_id, "hitlRejected", {...})
else:
    raise TimeoutError(f"Human review timeout for request {request_id}")
```

The `parse_human_approval()` helper in `utils/helpers.py` handles both dict and JSON string inputs.

### SignalR REST Client Pattern (Direct Streaming from Activities)

Activities can push real-time messages **directly** to SignalR Service via REST API, bypassing the orchestrator (which is suspended while the activity runs). This is essential for streaming reasoning chunks and intermediate progress.

```python
class SignalRRestClient:
    """Send messages directly to Azure SignalR Service via REST API."""

    def __init__(self, hub_name=None, connection_string=None):
        conn_str = connection_string or os.getenv(SIGNALR_CONNECTION_SETTING, "")
        self.hub_name = hub_name or SIGNALR_HUB_NAME
        self.endpoint, self._access_key = _parse_connection_string(conn_str)
        self._session = requests.Session()

    def send_to_user(self, user_id: str, target: str, arguments: list) -> None:
        """Send a SignalR message to a specific user. Non-fatal on failure."""
        url = f"{self.endpoint}/api/v1/hubs/{self.hub_name}/users/{user_id}"
        # JWT audience MUST equal the full HTTP request URL
        try:
            resp = self._session.post(url, json={"target": target, "arguments": arguments},
                headers={"Authorization": self._get_auth_header(url)}, timeout=5)
            resp.raise_for_status()
        except requests.RequestException as exc:
            logger.warning(f"SignalR REST send failed: {exc}")  # Non-fatal

    def send_reasoning_chunk(self, user_id, instance_id, chunk_type, content, chunk_index, metadata=None):
        """Convenience: send a reasoningChunk event."""
        ...

    def send_step_progress(self, user_id, instance_id, step_name, message, progress=None, detail=None, sub_step=None):
        """Send intermediate step progress update."""
        ...
```

**Key:** Errors are non-fatal — the workflow continues even if a UI notification fails.

### `on_progress` Callback Pattern

Activities create progress callbacks passed to step classes for real-time sub-step updates:

```python
# Inside an activity function
on_progress = None
if user_id and instance_id:
    signalr = _create_signalr_client()  # Returns None on failure
    if signalr:
        def _on_progress(page_idx: int, total: int, category: str, confidence: float) -> None:
            signalr.send_step_progress(
                user_id=user_id, instance_id=instance_id,
                step_name=STEP_NAME,
                message=f"Page {page_idx + 1}/{total}: {category}",
                progress=round((page_idx + 1) / total * 100),
                detail=f"{confidence:.0%} confidence",
                sub_step=f"page_{page_idx + 1}",
            )
        on_progress = _on_progress

executor = StepClass(..., on_progress=on_progress)
```

The `_create_signalr_client()` helper at the top of `activities.py` wraps `SignalRRestClient()` in a try/except and returns `None` on failure.

### Input Resolution Pattern

The `resolve_pdf_path()` helper in `utils/helpers.py` transparently handles local paths, URLs, and blob storage paths:

```python
def resolve_pdf_path(pdf_path: str) -> str:
    """Resolve to local file path, downloading from blob if needed.
    - Starts with '/' or exists locally → return as-is
    - Starts with http(s):// → return as-is
    - Otherwise → treat as blob name, download to temp dir
    """
```

### Domain-Driven Configuration (Optional)

Each domain is a folder with JSON config files. Adding a new domain requires **no code changes**:

```
domains/
├── domain_loader.py          # LRU-cached Pydantic loader
├── {domain_a}/
│   ├── config.json
│   ├── classification_categories.json
│   ├── extraction_schema.json
│   └── validation_rules.json
└── {domain_b}/
    └── ...
```

The loader uses `@lru_cache` and returns typed Pydantic models:

```python
@lru_cache(maxsize=16)
def _load_domain_config_cached(domain_id: str) -> DomainConfig:
    domain_dir = DOMAINS_DIR / domain_id
    # Load config.json, classification_categories.json, extraction_schema.json
    # Optionally load validation_rules.json
    return DomainConfig(...)

def load_domain_config(domain_id: str) -> DomainConfig:
    return _load_domain_config_cached(domain_id)

def get_available_domains() -> list[dict[str, str]]:
    """Returns list of dicts with id, name, description, icon."""
    return list(_get_available_domains_cached())
```

**Note:** `get_available_domains()` returns `list[dict[str, str]]` (with `id`, `name`, `description`, `icon` keys), not `list[str]`.

### LLM Factory Pattern (Optional)

Provider abstraction for DSPy LLM instances supporting multiple backends:

```python
SUPPORTED_PROVIDERS = {"azure_openai", "claude", "azure_ai_models"}

def create_dspy_lm(options: dict | None = None) -> dspy.LM:
    """Create configured dspy.LM based on provider settings.
    Resolution: options["llm_provider"] → LLM_PROVIDER env var → "azure_openai"
    """

def get_available_providers() -> list[dict[str, Any]]:
    """Return metadata about available LLM providers for API responses."""
```

### Async Patterns

- Blocking SDK calls wrapped with `loop.run_in_executor()`
- Concurrent page processing uses `asyncio.Semaphore` (default limit: 5)
- DSPy calls use `with dspy.context(lm=self.lm):` for LM scoping

---

## Frontend Patterns

### 1. Types — Single Source of Truth

All TypeScript types live in `types/index.ts`. Generate `StepName` and `DomainId` literal unions from config:

```typescript
export type StepName =
  | 'step_01_pdf_extraction'
  | 'step_02_classification'
  | ...;  // Generate from STEP_CONFIGS

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed';
// NOTE: Uses 'running', NOT 'in_progress'

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting' | 'error';

export type DomainId = 'home_loan' | 'insurance_claims' | ...;
// Generate from available domains

export type SignalREventType =
  | 'stepStarted' | 'stepCompleted' | 'stepFailed' | 'stepProgress'
  | 'hitlWaiting' | 'hitlApproved' | 'hitlRejected'
  | 'reasoningChunk' | 'workflowCompleted' | 'workflowFailed';
```

### 2. Step Config — Single Source of Truth

All step UI metadata lives in `lib/stepConfig.ts`. **Never hardcode step names, icons, or display order in components.**

```typescript
export interface StepConfig {
  name: StepName;
  number: number;           // Parallel steps share the same number
  displayName: string;      // Short label for diagram
  fullDisplayName: string;  // Longer label for detail views
  description: string;
  icon: string;
}

const STEP_CONFIGS: StepConfig[] = [
  { name: 'step_01_...', number: 1, displayName: 'Short', fullDisplayName: 'Full Name', description: '...', icon: '📄' },
  // Parallel steps share number:
  { name: 'step_03_01_...', number: 3, displayName: 'A', ... },
  { name: 'step_03_02_...', number: 3, displayName: 'B', ... },
  // ...
];

// All derived exports:
export const STEP_ORDER: StepName[] = STEP_CONFIGS.map((s) => s.name);
export const STEP_DISPLAY_NAMES: Record<string, string> = Object.fromEntries(
  STEP_CONFIGS.map((s) => [s.name, s.fullDisplayName])
);
export const STEP_INFO: Record<string, { displayName: string; description: string; icon: string }> = ...;
export const STEP_NUM_TO_NAMES: Record<number, StepName[]> = ...;  // For catch-up sync
export const PIPELINE_ROWS = ...;  // For workflow diagram layout
```

### 3. State Management — Zustand + Immer

Four focused stores, each with a single responsibility:

```typescript
// workflowStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';

enableMapSet();

const initialState = {
  instanceId: null,
  status: 'idle' as const,
  steps: new Map<StepName, Step>(),
  stepProgress: new Map<StepName, StepProgressData>(),
  hitlWaiting: null,
  hitlStatus: null,
  // ...
};

export const useWorkflowStore = create<WorkflowState>()(
  immer((set) => ({
    ...initialState,

    updateStep: (stepName, updates) => {
      set((state) => {
        const existing = state.steps.get(stepName);
        if (existing) Object.assign(existing, updates);
        else state.steps.set(stepName, { name: stepName, number: ..., ...updates });
      });
    },

    reset: () => set(() => ({ ...initialState })),
  }))
);
```

**Store responsibilities:**
- `workflowStore` — Steps (Map), HITL state, step progress, selected step, document metadata
- `eventsStore` — SignalR event log (last 100 events, indexed by type)
- `reasoningStore` — Streaming AI reasoning chunks (deduplicates by chunk type)
- `uiStore` — Connection status, toasts, modal visibility

**Conventions:**
- Use `Map<StepName, Step>` for step collections (fast lookup)
- Immer middleware enables mutable-style updates that produce immutable state
- `enableMapSet()` called once for Map/Set support
- Each store exports a single `use*Store` hook
- `initialState` object separate from the store for clean `reset()`

### 4. API Client — Singleton with User Targeting

The API client creates a persistent user ID for SignalR targeting. The ID format is `'user-' + random + timestamp` (NOT `crypto.randomUUID()`):

```typescript
function getUserId(): string {
  if (typeof window === 'undefined') return '';
  let userId = sessionStorage.getItem('userId');
  if (!userId) {
    userId = 'user-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    sessionStorage.setItem('userId', userId);
  }
  return userId;
}

class APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({ baseURL: API_BASE_URL });
  }

  async startWorkflow(request: StartWorkflowRequest): Promise<StartWorkflowResponse> {
    const response = await this.client.post('/idp/start', request, {
      headers: { 'x-user-id': getUserId() },
    });
    return response.data;
  }

  async negotiate(): Promise<{ url: string; accessToken: string }> {
    const response = await this.client.post('/idp/negotiate', null, {
      headers: { 'x-user-id': getUserId() },
    });
    return response.data;
  }
}

export const apiClient = new APIClient();
```

### 5. SignalR Client — Token-Based Auth with Auto-Reconnect

The SignalR client uses `accessTokenFactory` from the negotiate response (NOT headers). Connection is established via a class singleton:

```typescript
class SignalRClient {
  private connection: signalR.HubConnection | null = null;

  async connect(): Promise<void> {
    const { url, accessToken } = await apiClient.negotiate();

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(url, { accessTokenFactory: () => accessToken })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.attachEventHandlers();
    await this.connection.start();
  }

  private attachEventHandlers(): void {
    // All event handlers update Zustand stores directly
    this.connection.on('stepStarted', (arg) => {
      useWorkflowStore.getState().updateStep(arg.data.stepName, { status: 'running' });
      useWorkflowStore.getState().setCurrentStep(arg.data.stepNumber);
    });

    this.connection.on('stepFailed', (arg) => {
      useWorkflowStore.getState().updateStep(arg.data.stepName, {
        status: 'failed', error: arg.data.errorMessage,
      });
      useWorkflowStore.getState().setStatus('failed');
    });

    // workflowFailed handler:
    this.connection.on('workflowFailed', (arg) => {
      useWorkflowStore.getState().setStatus('failed');
    });

    // ... handlers for all SignalR events
  }
}

export const signalRClient = new SignalRClient();
```

### 6. Catch-Up Sync Mechanism

`syncWorkflowStatus()` parses `customStatus` to infer step completion on reconnect:

```typescript
async function syncWorkflowStatus(instanceId: string): Promise<void> {
  const status = await apiClient.getWorkflowStatus(instanceId);
  const customStatus = status.customStatus || '';

  // Format: "[request_id] Step N: description"
  const stepMatch = customStatus.match(/Step (\d+)/);
  const currentStepNum = stepMatch ? parseInt(stepMatch[1]) : 0;

  // Mark steps before current as completed
  for (let n = 1; n < currentStepNum; n++) {
    const names = STEP_NUM_TO_NAMES[n] || [];
    for (const name of names) {
      store.updateStep(name, { status: 'completed', displayName: STEP_DISPLAY_NAMES[name] });
    }
  }

  // Mark current step as running
  for (const name of (STEP_NUM_TO_NAMES[currentStepNum] || [])) {
    store.updateStep(name, { status: 'running' });
  }
}

export function useSignalR() {
  return {
    connect: () => signalRClient.connect(),
    disconnect: () => signalRClient.disconnect(),
    syncStatus: (instanceId: string) => syncWorkflowStatus(instanceId),
  };
}
```

### 7. React Query Hooks

Thin wrappers around the API client. Hooks do **not** use custom `staleTime`/`gcTime` — they rely on defaults:

```typescript
export function useStartWorkflow() {
  return useMutation({
    mutationFn: async (request: StartWorkflowRequest) => apiClient.startWorkflow(request),
  });
}

export function useLLMProviders() {
  return useQuery<LLMProvidersResponse>({
    queryKey: queryKeys.llmProviders,
    queryFn: () => apiClient.getLLMProviders(),
  });
}

export function useSubmitHITLReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ instanceId, review }) => apiClient.submitHITLReview(instanceId, review),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.all }),
  });
}
```

### 8. Data Flow

```
User Action → React Component
  ↓ (mutation)
React Query / apiClient
  ↓ (response)
Zustand Store (immer)
  ↓ (subscription)
UI re-renders

Backend Orchestrator → _broadcast() → notify_user activity → SignalR output binding
  ↓ (WebSocket)
signalrClient event handler
  ↓ (direct store update)
Zustand Store (immer)
  ↓ (subscription)
UI re-renders

Backend Activity → SignalRRestClient.send_to_user() → SignalR REST API
  ↓ (WebSocket, bypasses orchestrator)
signalrClient event handler (stepProgress, reasoningChunk)
  ↓ (direct store update)
Zustand Store (immer)
```

### 9. Component Structure

```
page.tsx                    # Two-page state machine: 'upload' ↔ 'execution'
├── FileUploadArea          # Upload + demo selection + schema customization
├── WorkflowDiagram         # Pipeline visualization with step statuses
├── DetailPanel             # Context-aware output rendering
│   └── detail/
│       ├── StepOutputRenderer   # Switch on step type
│       ├── StepOutputView       # Generic step output
│       ├── ReasoningOutput      # Streaming AI output (NOT "ReasoningPanel")
│       ├── ValidationRulesPanel
│       ├── ExtractionSchemaView
│       ├── CompletionDashboard
│       ├── DefaultView
│       └── ValueDisplay
├── HITLReviewPanel         # Human review modal with field conflict resolution
├── DocumentViewer          # PDF viewer
├── ConnectionIndicator     # SignalR status badge
└── Toast                   # Toast notifications
```

### 10. Formatting Utilities

Two utility files with shared display helpers:

**`lib/formatting.ts`** — Field values and confidence:
```typescript
export function formatFieldValue(value: unknown): string { /* handles objects, arrays, nulls */ }
export function getConfidenceColor(confidence: number, options?): string { /* 0.8+ green, 0.6+ amber, red */ }
```

**`lib/utils.ts`** — Duration, status, domain config:
```typescript
export function formatDuration(ms: number): string { ... }
export function getStatusColor(status: StepStatus): string { ... }
export function getStatusIcon(status: StepStatus): string { ... }
export const DOMAIN_CONFIG: Record<DomainId, { label: string; icon: string; description: string }> = { ... };
```

---

## Infrastructure & Configuration

### `host.json` Configuration

```json
{
  "version": "2.0",
  "telemetryMode": "OpenTelemetry",
  "logging": {
    "applicationInsights": {
      "samplingSettings": { "isEnabled": true, "excludedTypes": "Request" }
    }
  },
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle.Preview",
    "version": "[4.29.0, 5.0.0)"
  },
  "extensions": {
    "durableTask": {
      "hubName": "%TASKHUB_NAME%",
      "storageProvider": {
        "type": "azureManaged",
        "connectionStringName": "DurableTaskSchedulerConnection"
      },
      "tracing": { "distributedTracingEnabled": true, "version": "V2" }
    }
  }
}
```

**Key details:**
- `hubName` references env var `%TASKHUB_NAME%` (NOT hardcoded)
- Storage provider is `azureManaged` (Durable Task Scheduler), not Azure Storage tables
- OpenTelemetry mode enabled for distributed tracing
- Extension bundle is Preview (required for DTS)

### Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FUNCTIONS_WORKER_RUNTIME` | Yes | — | Must be `python` |
| `AzureWebJobsStorage` | Yes | — | `UseDevelopmentStorage=true` for local |
| `TASKHUB_NAME` | Yes | — | Durable Task hub name (e.g., `{task_hub_name}`) |
| `DurableTaskSchedulerConnection` | Yes | — | DTS connection string |
| `AzureSignalRConnectionString` | Yes | — | SignalR Service connection string |
| `AZURE_OPENAI_ENDPOINT` | Yes | `""` | Azure OpenAI endpoint URL |
| `AZURE_OPENAI_KEY` | Yes | `""` | Azure OpenAI API key |
| `AZURE_OPENAI_CHAT_DEPLOYMENT_NAME` | No | `gpt-4.1` | Chat model deployment |
| `AZURE_OPENAI_REASONING_DEPLOYMENT_NAME` | No | `o3-mini` | Reasoning model deployment |
| `AZURE_OPENAI_API_VERSION` | No | `2025-01-01-preview` | API version |
| `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` | For PDF | `""` | Document Intelligence endpoint |
| `AZURE_DOCUMENT_INTELLIGENCE_KEY` | For PDF | `""` | Document Intelligence key |
| `COGNITIVE_SERVICES_ENDPOINT` | For CU | `""` | Azure Content Understanding endpoint |
| `COGNITIVE_SERVICES_KEY` | For CU | `""` | Azure Content Understanding key |
| `AZURE_AI_CU_API_VERSION` | No | `2025-11-01` | CU API version |
| `HITL_TIMEOUT_HOURS` | No | `24` | HITL gate timeout |
| `AZURE_STORAGE_ACCOUNT_NAME` | Azure only | `""` | Blob storage account (empty = local dev) |
| `ANTHROPIC_API_KEY` | For Claude | — | Anthropic API key |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-20250514` | Claude model name |
| `AZURE_AI_MODELS_ENDPOINT` | For AI Models | — | Azure AI Model Catalog endpoint |
| `AZURE_AI_MODELS_KEY` | For AI Models | — | Azure AI Model Catalog key |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | No | — | App Insights (optional) |

### Local Development Setup

1. Copy `local.settings.example.json` → `local.settings.json` and fill in values
2. Start Azurite for local storage: `azurite --silent`
3. Start DTS emulator: connection string uses `Endpoint=http://localhost:8080;TaskHub={task_hub_name};Authentication=None`
4. Install dependencies: `pip install -r requirements.txt`
5. Run backend: `func start`
6. Run frontend: `cd frontend && npm install && npm run dev`

### OpenTelemetry Dependencies

The `requirements.txt` includes OTel packages for distributed tracing:
```
azure-monitor-opentelemetry
opentelemetry-api
opentelemetry-sdk
opentelemetry-exporter-otlp
opentelemetry-instrumentation-logging
```

### AZD Multi-Service Config

```yaml
# azure.yaml
name: {azd_project_name}
hooks:
  postdeploy:
    shell: sh
    run: ./hooks/postdeploy.sh
services:
  api:
    project: .
    language: python
    host: function
  frontend:
    project: frontend
    language: js
    host: staticwebapp
    dist: out                    # Relative to project (frontend/), NOT "frontend/out"
    hooks:
      prebuild:
        shell: sh
        run: npm install
```

**Note:** `dist: out` is relative to the `project` path (`frontend/`), so the actual path is `frontend/out`.

### Deployment Workflow

1. `azd auth login`
2. `azd up` — Provisions infrastructure (Bicep) + deploys both services
3. `hooks/postdeploy.sh` runs automatically after deploy (e.g., switches Network Security Perimeter from Learning to Enforced mode)

For code-only redeployment: `azd deploy`

### Bicep Infrastructure

- **Subscription-scoped deployment** with resource group creation
- **Managed identity** for passwordless auth (Function App → Storage, DTS)
- **RBAC loops** for assigning multiple storage roles in a single Bicep loop
- **Network Security Perimeter** deployed in Learning mode, switched to Enforced by postdeploy hook
- **Application Insights + Log Analytics** for observability
- **Durable Task Scheduler** for orchestration state (not Azure Storage tables)

---

## API Endpoints Reference

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/{route_prefix}/start` | Start workflow (requires `x-user-id` header) |
| POST | `/api/{route_prefix}/upload` | Upload PDF to blob/local |
| POST | `/api/{route_prefix}/demo/{domain_id}` | Use demo document |
| GET | `/api/{route_prefix}/document?path=` | Serve PDF (blob or local) |
| GET | `/api/{route_prefix}/workflow/{instanceId}/status` | Get workflow status |
| POST | `/api/{route_prefix}/hitl/review/{instanceId}` | Submit HITL decision |
| GET | `/api/{route_prefix}/domains/{domain_id}/config` | Get domain config |
| POST | `/api/{route_prefix}/validate-schema` | Validate extraction schema |
| GET | `/api/{route_prefix}/llm-providers` | List available LLM providers |
| POST/GET | `/api/{route_prefix}/negotiate` | SignalR negotiate (requires `x-user-id` header) |

---

## Adding a New Step

### Backend

1. **`constants.py`** — Add `StepInfo` to `STEPS` tuple + backward-compat constant
2. **`steps/step_XX_name.py`** — Implement step class with async method returning `(PydanticModel, step_output_dict)`
3. **`models.py`** — Add `StepXXOutput` Pydantic model for UI output
4. **`activities/activities.py`** — Add activity function using `ActivityContext` pattern (choose appropriate `input_name`)
5. **`orchestration/orchestration.py`** — Wire via `yield from _execute_step(...)` and add case to `_generate_output_preview()`

### Frontend

6. **`types/index.ts`** — Add to `StepName` union type
7. **`lib/stepConfig.ts`** — Add entry to `STEP_CONFIGS`
8. **`components/detail/StepOutputRenderer.tsx`** — Add output renderer case

---

## Testing Strategy

- **Backend:** No Python test suite or linter configured. API testing via `tests/demo.http` (VS Code REST Client) or curl against local `func start`.
- **Frontend:** `npm run lint` (ESLint) and `npm run type-check` (TypeScript strict mode). No unit test runner configured.
- **Integration:** Manual end-to-end testing against local or deployed Azure resources.

---

## Common Pitfalls

1. **Forgetting `register_signalr_activity()`** — The 5th registration call is easy to miss. Without it, `notify_user` activity is unregistered and all broadcasts fail silently.
2. **SignalR hub name mismatch** — The hub name is hardcoded in `config.py` and must match the negotiate binding in `endpoints.py` and the SignalR Service configuration.
3. **Timer leaks in HITL** — Always cancel the timeout timer when the approval event wins: `timeout_task.cancel()`.
4. **`input_name` collisions** — Each activity's `input_name` must be unique within its registration scope. Don't reuse the same name.
5. **`step_output` key assumptions** — Not all activities return output under a `"step_output"` key. Use `step_output_key=None` when the entire result is the output.
6. **SignalR REST client failures** — They are intentionally non-fatal. Don't wrap them in error-handling that could crash the activity.
7. **Frontend `StepStatus` values** — Use `'running'`, NOT `'in_progress'`. The backend broadcasts `"in_progress"` but the frontend normalizes to `'running'`.
8. **`model_dump()` inconsistency** — Some steps use `step_output.model_dump()`, others build dicts manually. Prefer `model_dump()` in new code.

---

## Key Conventions Summary

| Aspect | Convention |
|--------|-----------|
| Step IDs | `step_{NN}_{action}` (zero-padded) |
| Activity names | `activity_step_{NN}_{action}` |
| Activity `input_name` | Varies per activity (e.g., `extract_request`, `classify_request`) |
| API routes | `/api/{route_prefix}/{resource}` namespace |
| Request tracking | `request_id` (UUID) propagated across all steps |
| Error messages | `[{request_id}] {step}: {message}` |
| SignalR events | camelCase (`stepStarted`, `hitlWaiting`, `workflowCompleted`, `workflowFailed`) |
| SignalR hub name | Hardcoded string in `config.py`, not env var |
| Step outputs | `Step*Output` Pydantic models (or manual dicts) |
| Frontend state | Zustand + Immer, Map for collections, 4 focused stores |
| Frontend status | `'running'` (not `'in_progress'`) |
| Config | Environment variables with sensible defaults |
| Domain config | JSON files per domain, LRU-cached Pydantic loader |
| Imports in activities | Lazy (inside function body) to reduce cold-start |
| Python types | Use `str | None` (not `Optional[str]`), Pydantic BaseModel for contracts |
| TypeScript types | Single `types/index.ts`, union types for enums |
| Step UI metadata | Single source of truth in `stepConfig.ts`, derive everything else |
| Registration calls | 5 calls: activities, orchestration, http, signalr endpoints, signalr activity |
| Orchestration name | Constant `WORKFLOW_ORCHESTRATION` in `constants.py` |
| HITL event name | Constant `HITL_REVIEW_EVENT` in `constants.py` |
