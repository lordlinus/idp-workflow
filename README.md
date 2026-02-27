# Intelligent Document Processing (IDP) Workflow

**Professional, Real-time Document Processing with Next.js UI + Azure Durable Functions**

Multi-agent Azure Functions application for intelligent document processing using Azure AI services, DSPy framework, and a modern Next.js dashboard with real-time SignalR updates and Reaflow workflow visualization.

## 🎯 Overview

This IDP workflow processes documents through a sophisticated pipeline that combines:

- **Azure Document Intelligence** - PDF extraction and OCR
- **DSPy Framework** - Classification and structured extraction
- **Azure Content Understanding** - AI-powered content analysis
- **Human-in-the-Loop (HITL)** - Elegant review and validation interface
- **AI Reasoning Agent** - Intelligent decision-making and summarization
- **Real-time Dashboard** - Next.js UI with Reaflow workflow visualization
- **SignalR Real-time Updates** - Live progress tracking for all users

## ⚡ Quick Start

```bash
# Terminal 1: Backend
source .venv/bin/activate && func start

# Terminal 2: Frontend
cd frontend && npm run dev
```

**See the [Getting Started](#-getting-started) section below for detailed setup instructions.**

## 📁 Project Structure

```
├── frontend/                    # 🆕 Next.js 14 Frontend
│   ├── src/
│   │   ├── app/                # Pages and layout
│   │   ├── components/         # React components
│   │   │   ├── FileUploadArea.tsx
│   │   │   ├── WorkflowDiagram.tsx (Reaflow)
│   │   │   ├── HITLReviewPanel.tsx
│   │   │   ├── ReasoningPanel.tsx
│   │   │   └── ...
│   │   ├── lib/                # Services and utilities
│   │   │   ├── apiClient.ts
│   │   │   ├── signalrClient.ts
│   │   │   └── queryKeys.ts
│   │   ├── store/              # Zustand stores
│   │   └── types/              # TypeScript types
│   ├── package.json
│   ├── tailwind.config.ts
│   └── README.md
│
├── function_app.py              # Azure Functions entry point
├── requirements.txt             # Python dependencies
├── host.json                    # Azure Functions configuration
├── local.settings.json          # Local environment variables
│
├── sample_documents/            # Sample PDFs for testing
│
├── azure.yaml                   # Azure Developer CLI configuration
├── infra/                       # Infrastructure as Code (Bicep)
│   ├── main.bicep              # Main infrastructure template
│   ├── core.bicep              # Core resource definitions
│   └── main.parameters.json   # Parameter values
│
└── idp_workflow/                # Main workflow package
    ├── constants.py             # Configuration constants
    ├── config.py                # Settings management
    ├── models.py                # Pydantic data models
    │
    ├── activities/              # Azure Durable Functions activities
    │   └── activities.py        # Step execution activities
    │
    ├── orchestration/           # Workflow orchestration
    │   ├── orchestration.py     # Main workflow coordinator
    │   └── state.py             # State management
    │
    ├── api/                     # HTTP and SignalR endpoints
    │   └── endpoints.py         # REST API and real-time endpoints
    │
    ├── steps/                   # Workflow step implementations
    │   ├── step_01_pdf_extractor.py
    │   ├── step_02_classifier.py
    │   ├── step_03_extractors.py
    │   ├── step_04_comparator.py
    │   └── step_06_reasoning_agent.py
    │
    ├── utils/                   # Shared utilities
    │   ├── helpers.py           # Helper functions
    │   └── signalr.py           # SignalR message builders
    │
    ├── domains/                 # Domain-specific configurations
    │   ├── domain_loader.py
    │   ├── home_loan/
    │   ├── insurance_claims/
    │   ├── small_business_lending/
    │   └── trade_finance/
    │
    └── tools/                   # AI Agent tools
        ├── content_understanding_tool.py
        └── dspy_utils.py
```

## 🎨 Frontend Features

- **Real-time Workflow Visualization** - Reaflow-based 6-step pipeline diagram
- **Live Status Updates** - SignalR for real-time step progress
- **HITL Review Panel** - Elegant side-by-side field comparison (Azure vs DSPy)
- **Streaming Reasoning** - Real-time AI reasoning chunks with chunk-type formatting
- **Workflow History** - Browse previous workflows via Azure Durable Functions
- **Professional Dark Theme** - Modern, polished UI with smooth animations
- **Responsive Design** - Works on desktop and mobile

## 🔧 Tech Stack

### Frontend
- Next.js 14 (App Router)
- TypeScript (strict mode)
- Tailwind CSS
- Zustand + Immer (state management)
- @tanstack/react-query (data fetching)
- @microsoft/signalr (real-time)
- Reaflow (workflow visualization)

### Backend
- Azure Functions (Python)
- Azure Durable Functions (orchestration)
- Azure SignalR Service (real-time)
- Azure Blob Storage (document storage)
- Azure OpenAI (AI reasoning)
- DSPy Framework (extraction)

## 🚀 Getting Started

### Prerequisites

- Python 3.13+
- Azure Functions Core Tools v4
- Azure account with:
  - Azure API Management (APIM) gateway for LLM calls
  - Azure Document Intelligence
  - Azure SignalR Service
  - Azure Storage Account

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd <repository-name>
   ```

2. **Create virtual environment**

   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. **Install dependencies**

   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**

   Edit `local.settings.json` and fill in your Azure service credentials (see `local.settings.json` template in the repo):

   Required environment variables:
   - `AZURE_OPENAI_ENDPOINT`
   - `AZURE_OPENAI_KEY`
   - `AZURE_OPENAI_CHAT_DEPLOYMENT_NAME`
   - `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`
   - `AZURE_DOCUMENT_INTELLIGENCE_KEY`
   - `COGNITIVE_SERVICES_ENDPOINT`
   - `COGNITIVE_SERVICES_KEY`
   - `AzureSignalRConnectionString`
   - `AzureWebJobsStorage`

### Running Locally

1. **Start the Azure Functions host**

   ```bash
   func start
   ```

2. **Open the web UI**

   Navigate to `http://localhost:3000` (frontend dev server).

3. **Test with sample documents**

   Upload documents through the UI or use curl (see [Testing](#-testing) section).

## 📋 Workflow Steps

The IDP workflow processes documents through these stages:

1. **PDF Extraction** - Extract text and structure from PDF using Azure Document Intelligence
2. **Classification** - Categorize document type using DSPy classifier
3. **Data Extraction** - Extract structured data using:
   - Azure Content Understanding (AI service)
   - DSPy Extractors (LLM-based)
4. **Comparison** - Compare results from both extraction methods
5. **Human Review** - Present discrepancies for human validation (HITL)
6. **AI Reasoning** - Intelligent analysis, validation, and summary generation

## 🔌 API Endpoints

### HTTP Endpoints

- `POST /api/idp/start` - Start a new workflow
- `POST /api/idp/hitl/review/{instanceId}` - Submit human review decision

### SignalR Endpoints

- `GET/POST /api/idp/negotiate` - Negotiate SignalR connection
- `POST /api/idp/subscribe/{instanceId}` - Subscribe to workflow updates
- `POST /api/idp/unsubscribe/{instanceId}` - Unsubscribe from updates

### Real-time Events

- `stepStarted` - Step begins execution
- `stepCompleted` - Step completes successfully
- `stepFailed` - Step encounters an error
- `hitlWaiting` - Waiting for human review
- `reasoningChunk` - Streaming reasoning output
- `workflowCompleted` - Workflow finishes

## 🔧 Configuration

### Domain Configuration

Each domain (e.g., insurance_claims, home_loan) has its own configuration:

```
idp_workflow/domains/<domain_name>/
├── config.json                      # Domain settings
├── classification_categories.json   # Document categories
├── extraction_schema.json          # Data extraction schema
└── validation_rules.json           # Validation rules
```

To add a new domain:

1. Create a new folder in `idp_workflow/domains/`
2. Add the four configuration files
3. The domain will be automatically loaded

### DSPy Configuration

Configure DSPy LM settings in `idp_workflow/config.py`:

- Model name and deployment
- Temperature and max tokens
- Retry logic and caching

## 📊 Monitoring

- **Application Insights** - Logs and telemetry
- **SignalR Events** - Real-time progress tracking
- **Function Logs** - Detailed execution traces

## 🧪 Testing

Test the API using curl:

```bash
# Start workflow
curl -X POST http://localhost:7071/api/idp/start \
  -H "Content-Type: application/json" \
  -d '{
    "pdf_path": "/path/to/document.pdf",
    "domain_id": "insurance_claims",
    "max_pages": 50
  }'

# Submit review
curl -X POST http://localhost:7071/api/idp/hitl/review/{instanceId} \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "reviewer": "user@example.com",
    "feedback": "Looks good"
  }'
```

## 🚀 Deploy to Azure

This project uses [Azure Developer CLI (azd)](https://learn.microsoft.com/azure/developer/azure-developer-cli/) for deployment.

### Prerequisites
- [Azure Developer CLI](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd)
- [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-tools)
- [Node.js 18+](https://nodejs.org/)
- [Python 3.13+](https://www.python.org/)
- An Azure subscription with existing services:
  - Azure SignalR Service
  - Azure Document Intelligence
  - Azure Cognitive Services (Content Understanding)
  - Azure API Management (APIM) gateway for LLM calls

### Deploy
```bash
# Initialize environment
azd init --environment <env-name>

# Configure external service connections
azd env set AZURE_SIGNALR_CONNECTION_STRING "<value>"
azd env set AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT "<value>"
azd env set AZURE_DOCUMENT_INTELLIGENCE_KEY "<value>"
azd env set COGNITIVE_SERVICES_ENDPOINT "<value>"
azd env set COGNITIVE_SERVICES_KEY "<value>"
azd env set AZURE_OPENAI_ENDPOINT "<your-apim-gateway-url>"
azd env set AZURE_OPENAI_KEY "<your-apim-subscription-key>"
azd env set AZURE_OPENAI_CHAT_DEPLOYMENT_NAME "gpt-4.1"
azd env set AZURE_OPENAI_REASONING_DEPLOYMENT_NAME "o3-mini"
azd env set AZURE_OPENAI_API_VERSION "2025-01-01-preview"
azd env set TASKHUB_NAME "IDPWorkflow"

# Provision infrastructure and deploy
azd up
```

## 🤝 Contributing

1. Follow the existing code structure
2. Add tests for new features
3. Update documentation
4. Submit pull requests for review

## 📝 License

[Your License Here]

## 🆘 Support

For issues or questions:

- Check the documentation in `docs/`
- Review logs in Application Insights
- Contact the development team
