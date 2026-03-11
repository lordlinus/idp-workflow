# DocProcessIQ — Intelligent Document Processing

[![GitHub stars](https://img.shields.io/github/stars/lordlinus/idp-workflow?style=flat-square)](https://github.com/lordlinus/idp-workflow/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/lordlinus/idp-workflow?style=flat-square)](https://github.com/lordlinus/idp-workflow/network/members)
[![GitHub issues](https://img.shields.io/github/issues/lordlinus/idp-workflow?style=flat-square)](https://github.com/lordlinus/idp-workflow/issues)
[![License](https://img.shields.io/github/license/lordlinus/idp-workflow?style=flat-square)](LICENSE)
[![Deploy to Azure](https://img.shields.io/badge/azd-Deploy%20to%20Azure-blue?style=flat-square&logo=microsoft-azure)](https://learn.microsoft.com/azure/developer/azure-developer-cli/)

End-to-end document processing pipeline on Azure — upload a PDF, get structured data back with human-in-the-loop validation and AI reasoning.

Built with **Azure Durable Functions**, **Azure Document Intelligence**, **DSPy**, and a **Next.js** real-time dashboard.

## Architecture

```mermaid
graph TD
    classDef blue fill:#0078D4,stroke:#005A9E,color:#fff
    classDef green fill:#107C10,stroke:#0B5B0B,color:#fff
    classDef orange fill:#FF8C00,stroke:#CC7000,color:#fff
    classDef purple fill:#5C2D91,stroke:#4B2376,color:#fff
    classDef gray fill:#505050,stroke:#333,color:#fff

    USER(["👤 User"])
    SWA["Static Web App"]:::blue
    FUNC["Azure Functions"]:::blue
    STORAGE["Blob Storage"]:::blue
    DTS["Durable Task\nScheduler"]:::gray
    APPI["App Insights"]:::purple
    SIGNALR["SignalR
Streaming Updates"]:::orange
    DOCINTEL["Document\nIntelligence"]:::green
    CU["Content\nUnderstanding"]:::green
    OPENAI["Azure OpenAI"]:::green

    USER --> SWA --> FUNC --> STORAGE
    FUNC --> DTS
    FUNC -.-> APPI
    FUNC --> SIGNALR -.-> USER
    FUNC --> DOCINTEL
    FUNC --> CU
    FUNC --> OPENAI
```

> **Pipeline:** Upload PDF → ① Extract → ② Classify → ③ Extract Data → ④ Compare → ⑤ Human Review → ⑥ AI Reasoning → Structured Result

## Features

- **6-step pipeline** — extraction → classification → dual AI extraction → comparison → human review → AI reasoning
- **Real-time UI** — Next.js dashboard with SignalR live updates and Reaflow workflow visualization
- **Human-in-the-Loop** — side-by-side field comparison with approve / reject / edit
- **Domain-driven** — add new document types by dropping JSON config files (no code changes)
- **Production-ready infra** — Flex Consumption Functions, Network Security Perimeter, managed identity, Application Insights

## Deploy to Azure

> **Prerequisites:** [Azure Developer CLI](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd), [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-tools), [Node.js 18+](https://nodejs.org/), [Python 3.13+](https://www.python.org/), and an Azure subscription with Azure OpenAI, Document Intelligence, Content Understanding (CU), and SignalR Service already provisioned.

```bash
# Clone and initialize
azd init --template lordlinus/idp-workflow --environment <env-name>

# Set regions (SWA is limited to: centralus, eastus2, eastasia, westeurope, westus2)
azd env set AZURE_LOCATION "swedencentral"
azd env set AZURE_SWA_LOCATION "eastasia"

# Configure external service connections
azd env set AZURE_SIGNALR_CONNECTION_STRING "<value>"
azd env set AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT "<value>"
azd env set AZURE_DOCUMENT_INTELLIGENCE_KEY "<value>"
azd env set COGNITIVE_SERVICES_ENDPOINT "<value>"
azd env set COGNITIVE_SERVICES_KEY "<value>"
azd env set AZURE_OPENAI_ENDPOINT "<your-endpoint-or-apim-gateway-url>"
azd env set AZURE_OPENAI_KEY "<your-key-or-apim-subscription-key>"
azd env set AZURE_OPENAI_CHAT_DEPLOYMENT_NAME "gpt-4.1"
azd env set AZURE_OPENAI_REASONING_DEPLOYMENT_NAME "o3-mini"
azd env set AZURE_OPENAI_API_VERSION "2025-01-01-preview"
azd env set TASKHUB_NAME "idpworkflow"

# Provision and deploy (~15-20 min)
azd up
```

<details>
<summary>What gets deployed</summary>

| Resource | Purpose |
|----------|---------|
| Azure Functions (Flex Consumption) | Backend API + orchestration |
| Azure Static Web App | Next.js frontend |
| Durable Task Scheduler | Orchestration state management |
| Storage Account | Blob storage for documents |
| Application Insights | Monitoring and diagnostics |
| User-Assigned Managed Identity | Passwordless DTS authentication |
| Network Security Perimeter | Storage network lockdown |

The `postdeploy` hook automatically uploads sample documents, locks down storage networking (NSP → Enforced), and grants your identity access to the [DTS dashboard](https://dashboard.durabletask.io/).

</details>

To tear down all resources:

```bash
azd down --purge
```

## Run Locally

```bash
# DTS Emulator (requires Docker)
docker run -d -p 8080:8080 -p 8082:8082 \
  -e DTS_TASK_HUB_NAMES=default,idpworkflow \
  mcr.microsoft.com/dts/dts-emulator:latest

# Backend (Terminal 1)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
func start

# Frontend (Terminal 2)
cd frontend && npm install && npm run dev
```

Open <http://localhost:3000> and upload a PDF from `sample_documents/`.

See [Local Development Guide](docs/local-development.md) for full environment setup including `local.settings.json` configuration.

## How It Works

```mermaid
flowchart LR
    classDef extract fill:#107C10,stroke:#0B5B0B,color:#fff
    classDef compare fill:#0078D4,stroke:#005A9E,color:#fff
    classDef hitl fill:#FF8C00,stroke:#CC7000,color:#fff
    classDef reason fill:#5C2D91,stroke:#4B2376,color:#fff
    classDef result fill:#333,stroke:#1a1a1a,color:#fff
    classDef start fill:#0078D4,stroke:#005A9E,color:#fff

    PDF(["📄 Upload PDF"]):::start
    S1["① PDF Extraction<br/>Doc Intelligence → Markdown"]:::extract
    S2["② Classification<br/>DSPy ChainOfThought"]:::extract
    S3A["③a Azure CU<br/>Structured Extraction"]:::extract
    S3B["③b DSPy LLM<br/>Multi-provider"]:::extract
    S4["④ Comparison<br/>Field-by-field Diff"]:::compare
    S5["⑤ Human Review<br/>HITL Gate"]:::hitl
    S6["⑥ AI Reasoning<br/>Validation & Scoring"]:::reason
    OUT(["✅ Structured Result"]):::result

    PDF --> S1 --> S2
    S2 --> S3A & S3B
    S3A & S3B --> S4
    S4 --> S5 --> S6 --> OUT
```

```
POST /api/idp/start
 → Step 1  PDF Extraction        (Azure Document Intelligence → Markdown)
 → Step 2  Classification        (DSPy ChainOfThought)
 → Step 3  Data Extraction       (Azure CU + DSPy, run in parallel)
 → Step 4  Comparison            (field-by-field diff)
 → Step 5  Human Review          (HITL — waits for approval or timeout)
 → Step 6  AI Reasoning Agent    (validation, summary, recommendations)
 → Final result returned
```

Each step broadcasts `stepStarted` / `stepCompleted` events via SignalR so the frontend updates in real time.

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture & Patterns](docs/architecture.md) | Deep dive into backend/frontend patterns, project structure, and how to extend the pipeline |
| [Local Development](docs/local-development.md) | Environment variables, DTS emulator, running backend + frontend locally |

## Making It Real

We're actively exploring this pattern with customers across industries where high-volume document processing is a bottleneck:

| Industry | Use Case | Before | After | Key Value |
|----------|----------|--------|-------|----------|
| **Financial Services** | Mortgage & loan underwriting | 2–5 days | Minutes | Dual-model extraction catches errors single-model pipelines miss. Human review focuses on the 10–15% of fields that need attention. |
| **Insurance** | Claims intake & adjudication | 4–8 hours | Minutes | Per-page classification handles multi-section claims. AI reasoning validates against policy rules. Complete audit trail for compliance. |
| **Healthcare** | Medical records & billing | Hours | Minutes | Domain-driven schemas handle varied formats. Confidence scoring prioritizes which records need human verification. |
| **Trade Finance** | Letter of credit & invoice verification | Days | Minutes | Parallel extraction cross-validates financial figures. Field-by-field comparison surfaces discrepancies instantly. |
| **Government** | Permit & application processing | Weeks | Hours | Zero-code extensibility — new form types onboarded with JSON configs, not development cycles. |

**Why this pattern works:**

- **Accuracy over speed** — Dual-model cross-validation beats any single model. Disagreements direct human attention to exactly the fields that need it.
- **Compliance built in** — Every step, decision, and human override timestamped. No separate audit system.
- **No AI vendor lock-in** — Switch between Azure OpenAI, Claude, or open-weight models from a dropdown.
- **Days to onboard new doc types** — Four JSON files per domain. No code changes, no model retraining.

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 14, TypeScript, Tailwind CSS, Zustand + Immer, React Query, SignalR, Reaflow |
| **Backend** | Python 3.13, Azure Functions, Durable Functions, DSPy, Azure Document Intelligence, Azure OpenAI |
| **Infra** | Bicep, azd, Flex Consumption, Durable Task Scheduler, Network Security Perimeter |

## Contributing

1. Follow the existing code structure and [architecture patterns](docs/architecture.md)
2. Add tests for new features
3. Update documentation
4. Submit pull requests for review

## License

[MIT](LICENSE)

## Support

- [Open an issue](https://github.com/lordlinus/idp-workflow/issues) on GitHub
- Review logs in Application Insights
- Access the [DTS dashboard](https://dashboard.durabletask.io/) for orchestration debugging
