# From Manual Document Processing to AI-Orchestrated Intelligence
## Building an IDP Pipeline with Azure Durable Functions, DSPy, and Real-Time AI Reasoning

**TL;DR:** A document that takes 30–45 minutes of manual processing — handled in under 2 minutes. AI does the heavy lifting, a human makes the judgment call, and there's a complete audit trail for compliance. Adding a new document type? Four JSON files. Zero code changes.

**[GitHub Repository →](https://github.com/lordlinus/idp-workflow)**

---

## The Problem

Think about what happens when a loan application, an insurance claim, or a trade finance document arrives at an organisation. Someone opens it, reads it, manually types fields into a system, compares it against business rules, and escalates for approval. That process touches multiple people, takes hours or days, and the accuracy depends entirely on how carefully it's done.

Organisations have tried to automate parts of this before — OCR tools, templated extraction, rule-based routing. But these approaches are brittle. They break when the document format changes, and they can't reason about what they're reading.

The typical "solution" falls into one of two camps:

1. **Manual processing.** Humans read, classify, and key in data. Accurate but slow, expensive, and impossible to scale.
2. **Single-model extraction.** Throw an OCR/AI model at the document, trust the output, push to downstream systems. Fast but fragile — no validation, no human checkpoint, no confidence scoring.

What's missing is the middle ground: an **orchestrated, multi-model pipeline** with built-in quality gates, real-time visibility, and the flexibility to handle any document type without rewriting code.

That's what IDP Workflow is — a six-step AI-orchestrated pipeline that processes documents end to end, from a raw PDF to structured, validated data, with human oversight built in. This isn't automation replacing people. It's AI doing the heavy lifting and humans making the final call.

---

## Architecture at a Glance

```
POST /api/idp/start
 → Step 1  PDF Extraction        (Azure Document Intelligence → Markdown)
 → Step 2  Classification        (DSPy ChainOfThought)
 → Step 3  Data Extraction       (Azure CU + DSPy LLM, in parallel)
 → Step 4  Comparison            (field-by-field diff)
 → Step 5  Human Review          (HITL gate — approve / reject / edit)
 → Step 6  AI Reasoning Agent    (validation, consolidation, recommendations)
 → Final structured result
```

The backend is **Azure Durable Functions** (Python) on **Flex Consumption** — customers only pay for what they use, and it scales automatically. The frontend is a **Next.js** dashboard with **SignalR** real-time updates and a **Reaflow** workflow visualization. Every step broadcasts `stepStarted` → `stepCompleted` / `stepFailed` events so the UI updates as work progresses.

The pattern applies wherever organisations receive high volumes of unstructured documents that need to be classified, data-extracted, validated, and approved.

![Pipeline Diagram](../frontend/public/pipeline-diagram.png)

---

## The Six Steps, Explained

### Step 1: PDF → Markdown

We use **Azure Document Intelligence** with the `prebuilt-layout` model to convert uploaded PDFs into structured Markdown — preserving tables, headings, and reading order. Markdown turns out to be a much better intermediate representation for LLMs than raw text or HTML.

```python
class PDFMarkdownExtractor:
    async def extract(self, pdf_path: str) -> tuple[PDFContent, Step01Output]:
        poller = self.client.begin_analyze_document(
            "prebuilt-layout",
            analyze_request=AnalyzeDocumentRequest(url_source=pdf_path),
            output_content_format=DocumentContentFormat.MARKDOWN,
        )
        result: AnalyzeResult = poller.result()
        # Split into per-page Markdown chunks...
```

**Output:** Per-page Markdown content, total page count, and character stats.

### Step 2: Document Classification (DSPy)

Rather than hard-coding classification rules, we use **[DSPy](https://dspy.ai)** with `ChainOfThought` prompting. DSPy lets us define classification as a *signature* — a declarative input/output contract — and the framework handles prompt optimization.

```python
class DocumentClassificationSignature(dspy.Signature):
    """Classify document page into predefined categories."""
    page_content: str = dspy.InputField(desc="Markdown content of the document page")
    available_categories: str = dspy.InputField(desc="Available categories")
    classification: DocumentClassificationOutput = dspy.OutputField()
```

Categories are loaded from a domain-specific `classification_categories.json`. Adding new categories means editing a JSON file, not code.

Critically, classification is **per-page, not per-document**. A multi-page loan application might contain a loan form on page 1, income verification on page 2, and a property valuation on page 3 — each classified independently with its own confidence score and detected field indicators. This means multi-section documents are handled correctly downstream.

**Why DSPy?** It gives us structured, typed outputs via Pydantic models, automatic prompt optimization, and clean separation between the *what* (signature) and the *how* (ChainOfThought, Predict, etc.).

### Step 3: Dual-Model Extraction (Run in Parallel)

This is where things get interesting. We run **two independent extractors in parallel**:

- **Azure Content Understanding (CU):** A specialized Azure service that takes the raw PDF and applies a domain-specific schema to extract structured fields.
- **DSPy LLM Extractor:** Uses the Markdown from Step 1 with a dynamically generated Pydantic model (built from the domain's `extraction_schema.json`) to extract the same fields via an LLM. The LLM provider is **selectable at runtime** — Azure OpenAI, Claude, or open-weight models deployed on Azure (Qwen, DeepSeek, Llama, Phi, and more from the Azure AI Model Catalog).

```python
# In the orchestrator — fire both tasks at once
azure_task = context.call_activity("activity_step_03_01_azure_extraction", input)
dspy_task = context.call_activity("activity_step_03_02_dspy_extraction", input)
results = yield context.task_all([azure_task, dspy_task])
```

Both extractors use the same domain-specific schema but approach the problem differently. Running two models gives us a **natural cross-check**: if both extractors agree on a field value, confidence is high. If they disagree, we know exactly where to focus human attention — not the entire document, just the specific fields that need it.

### Multi-Provider LLM Support

The DSPy extraction and classification steps aren't locked to a single model provider. From the dashboard, users can choose between:

- **Azure OpenAI** — GPT-4.1, o3-mini (default)
- **Claude** — Anthropic's Claude models
- **Azure AI Models** — Open-weight models deployed on Azure via the [Azure AI Model Catalog](https://ai.azure.com/explore/models): Qwen 2.5 72B, DeepSeek V3/R1, Llama 3.3 70B, Phi-4, and more

The third option is key: instead of routing through a third-party service, you deploy open-weight models **directly on Azure** as serverless API endpoints through Azure AI Foundry. These endpoints expose an OpenAI-compatible API, so DSPy talks to them the same way it talks to GPT-4.1 — just with a different `api_base`. You get the model diversity of the open-weight ecosystem with Azure's enterprise security, compliance, and network isolation.

A factory pattern in the backend resolves the selected provider and model at runtime, so switching from Azure OpenAI to Qwen on Azure AI is a single dropdown change — no config edits, no redeployment. This makes it easy to benchmark different models against the same extraction schema and compare quality.

### Step 4: Field-by-Field Comparison

The comparator aligns the outputs of both extractors and produces a diff report: matching fields, mismatches, fields found by only one extractor, and a calculated match percentage. This feeds directly into the human review step.

**Output:** `"Match: 87.5% (14/16 fields)"`

### Step 5: Human-in-the-Loop (HITL) Gate

The pipeline **pauses** and waits for a human decision. The Durable Functions orchestrator uses `wait_for_external_event()` with a configurable timeout (default: 24 hours) implemented as a timer race:

```python
review_event = context.wait_for_external_event(HITL_REVIEW_EVENT)
timeout = context.create_timer(
    context.current_utc_datetime + timedelta(hours=HITL_TIMEOUT_HOURS)
)
winner = yield context.task_any([review_event, timeout])
```

The frontend shows a side-by-side comparison panel where reviewers can see both values for each disputed field — pick Azure's value, the LLM's value, or type in a correction. They can add notes explaining their decision, then approve or reject. If nobody responds within the timeout, it auto-escalates (configurable behavior).

The orchestrator doesn't poll. It doesn't check a queue. The moment the reviewer submits their decision, the pipeline resumes automatically — using Durable Functions' native external event pattern.

### Step 6: AI Reasoning Agent

The final step uses an **AI agent with tool-calling** to perform structured validation, consolidate field values, and generate a confidence score. This isn't just a prompt — it's an agent backed by the [Microsoft Agent Framework](https://github.com/microsoft/agent-framework) with purpose-built tools:

- `validate_fields` — runs domain-specific validation rules (data types, ranges, cross-field logic)
- `consolidate_extractions` — merges Azure CU + DSPy outputs using confidence-weighted selection
- `generate_summary` — produces a natural-language summary with recommendations

The reasoning step can use standard models or reasoning-optimised models like **o3** or **o3-mini** for higher-stakes validation. The agent streams its reasoning process to the frontend in real time — validation results, confidence scoring, and recommendations all appear as they're generated.

---

## Domain-Driven Design: Zero-Code Extensibility

One of the most powerful design choices: **adding a new document type requires zero code changes.** Each domain is a folder under `idp_workflow/domains/` with four JSON files:

```
idp_workflow/domains/insurance_claims/
├── config.json                    # Domain metadata, thresholds, settings
├── classification_categories.json # Page-level classification taxonomy
├── extraction_schema.json         # Field definitions (used by both extractors)
└── validation_rules.json          # Business rules for the reasoning agent
```

The `extraction_schema.json` is particularly interesting — it's consumed by both the Azure CU service (which builds an analyzer from it) and the DSPy extractor (which dynamically generates a Pydantic model at runtime):

```python
def create_extraction_model_from_schema(schema: dict) -> type[BaseModel]:
    """Dynamically create a Pydantic model from an extraction schema JSON."""
    # Maps schema field definitions → Pydantic field annotations
    # Supports nested objects, arrays, enums, and optional fields
```

We currently ship four domains out of the box: **insurance claims**, **home loans**, **small business lending**, and **trade finance**.

---

## See It In Action: Processing a Home Loan Application

To make this concrete, here's what happens when you process a multi-page home loan PDF — personal details, financial tables, and mixed content.

1. **Upload & Extract.** The document hits the dashboard and Step 1 kicks off. Azure Document Intelligence converts all pages to structured Markdown, preserving tables and layout. You can preview the Markdown right in the detail panel.

2. **Per-Page Classification.** Step 2 classifies each page independently: Page 1 is a Loan Application Form, Page 2 is Income Verification, Page 3 is a Property Valuation. Each has its own confidence score and detected fields listed.

3. **Dual Extraction.** Azure CU and the DSPy LLM extractor run simultaneously. You can watch both progress bars in the dashboard.

4. **Comparison.** The system finds 16 fields total. 14 match between the two extractors. Two fields differ — the annual income figure and the loan term. Those are highlighted for review.

5. **Human Review.** The reviewer sees both values side by side for each disputed field, picks the correct value (or types a correction), adds a note, and approves. The moment they submit, the pipeline resumes — no polling.

6. **AI Reasoning.** The agent validates against home loan business rules: loan-to-value ratio, income-to-repayment ratio, document completeness. Validation results stream in real time. Final output: **92% confidence**, 11 out of 12 validations passed. The AI flags a minor discrepancy in employment dates and recommends approval with a condition to verify employment tenure.

**Result:** A document that would take 30–45 minutes of manual processing, handled in under 2 minutes — with complete traceability. Every step, every decision, timestamped in the event log.

---

## Real-Time Frontend with SignalR

Every orchestration step broadcasts events through **Azure SignalR Service**, targeted to the specific user who started the workflow:

```python
def _broadcast(context, user_id, event, data):
    return context.call_activity("notify_user", {
        "user_id": user_id,
        "instance_id": context.instance_id,
        "event": event,
        "data": data,
    })
```

The frontend generates a session-scoped `userId`, passes it via the `x-user-id` header during SignalR negotiation, and receives only its own workflow events. No Pub/Sub subscriptions to manage.

The **Next.js** frontend uses:

- **Zustand + Immer** for state management (4 stores: workflow, events, reasoning, UI)
- **Reaflow** for the animated pipeline visualization
- **React Query** for data fetching
- **Tailwind CSS** for styling

The result is a dashboard where you can upload a document and watch each pipeline step execute in real time.

---

## Infrastructure: Production-Ready from Day One

The entire stack deploys with a single command using **Azure Developer CLI (azd)**:

```bash
azd up
```

What gets provisioned:

| Resource | Purpose |
|----------|---------|
| Azure Functions (Flex Consumption) | Backend API + orchestration |
| Azure Static Web App | Next.js frontend |
| Durable Task Scheduler | Orchestration state management |
| Storage Account | Document blob storage |
| Application Insights | Monitoring and diagnostics |
| Network Security Perimeter | Storage network lockdown |

Infrastructure is defined in **Bicep** with:

- Parameterized configuration (memory, max instances, retention)
- RBAC role assignments via a consolidated loop
- Two-region deployment (Functions + SWA have different region availability)
- Network Security Perimeter deployed in Learning mode, switched to Enforced post-deploy

---

## Key Engineering Decisions

### Why Durable Functions?

Orchestrating a multi-step pipeline with parallel execution, external event gates, timeouts, and retry logic is exactly what Durable Functions was designed for. The orchestrator is a Python generator function — each `yield` is a checkpoint that survives process restarts:

```python
def idp_workflow_orchestration(context: DurableOrchestrationContext):
    step1 = yield from _execute_step(context, ...)  # PDF extraction
    step2 = yield from _execute_step(context, ...)  # Classification
    results = yield context.task_all([azure_task, dspy_task])  # Parallel extraction
    # ... HITL gate, reasoning agent, etc.
```

No external queue management. No state database. No workflow engine to operate.

### Why Dual Extraction?

Running two independent models on the same document gives us:

- **Cross-validation** — agreement between models is a strong confidence signal
- **Coverage** — one model might extract fields the other misses
- **Auditability** — human reviewers can see both outputs side by side
- **Graceful degradation** — if one service is down, the other still produces results

### Why DSPy over Raw Prompts?

DSPy provides:

- **Typed I/O** — Pydantic models as signatures, not string parsing
- **Composability** — `ChainOfThought`, `Predict`, `ReAct` are interchangeable modules
- **Prompt optimization** — once you have labeled examples, DSPy can auto-tune prompts
- **LM scoping** — `with dspy.context(lm=self.lm):` isolates model configuration per call

---

## Getting Started

```bash
# Clone
git clone https://github.com/lordlinus/idp-workflow.git
cd idp-workflow

# DTS Emulator (requires Docker)
docker run -d -p 8080:8080 -p 8082:8082 \
  -e DTS_TASK_HUB_NAMES=default,idpworkflow \
  mcr.microsoft.com/dts/dts-emulator:latest

# Backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
func start

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

You'll also need Azurite (local storage emulator) running, plus Azure OpenAI, Document Intelligence, Content Understanding, and SignalR Service endpoints configured in `local.settings.json`. See the [Local Development Guide](https://github.com/lordlinus/idp-workflow/blob/main/docs/local-development.md) for the full setup.

---

## Who Is This For?

If any of these sound familiar, IDP Workflow was built for you:

- **"We're drowning in documents."** — High-volume document intake with manual processing bottlenecks.
- **"We tried OCR but it breaks on new formats."** — Brittle extraction that fails when layouts change.
- **"Compliance needs an audit trail for every decision."** — Regulated industries where traceability is non-negotiable.

This is an **AI-powered document processing platform** — not a point OCR tool — with human oversight, dual AI validation, and domain extensibility built in from day one.

---

## What's Next

- **Prompt optimization** — using DSPy's `BootstrapFewShot` with domain-specific training examples
- **Batch processing** — fan-out/fan-in orchestration for processing document queues
- **Custom evaluators** — automated quality scoring per domain
- **Additional domains** — community-contributed domain configurations

---

## Try It Out

The project is fully open source: **[github.com/lordlinus/idp-workflow](https://github.com/lordlinus/idp-workflow)**

Deploy to your own Azure subscription with `azd up`, upload a PDF from the `sample_documents/` folder, and watch the pipeline run.

We'd love feedback, contributions, and new domain configurations. Open an issue or submit a PR!

---

*Built with Azure Durable Functions · Azure Document Intelligence · Azure Content Understanding · DSPy · Microsoft Agent Framework · Next.js · SignalR · Reaflow*
