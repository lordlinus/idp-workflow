# Local Development Guide

How to run the IDP Workflow on your local machine.

> **Looking for the quick-start?** See the [main README](../README.md).

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.13+ | [python.org](https://www.python.org/) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org/) |
| Azure Functions Core Tools | v4 | [Install guide](https://learn.microsoft.com/azure/azure-functions/functions-run-tools) |
| Docker | Latest | [docker.com](https://www.docker.com/) — required for the DTS emulator |

You also need access to these Azure services (they can be shared / dev-tier):

- Azure OpenAI (or an APIM gateway)
- Azure Document Intelligence
- Azure Cognitive Services (Content Understanding)
- Azure SignalR Service

---

## 1. Clone and Set Up

```bash
git clone https://github.com/lordlinus/idp-workflow.git
cd idp-workflow

# Python backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Next.js frontend
cd frontend
npm install
cd ..
```

---

## 2. Configure `local.settings.json`

Create or edit `local.settings.json` in the project root:

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",

    "TASKHUB_NAME": "idpworkflow",
    "DurableTaskSchedulerConnection": "Endpoint=http://localhost:8080;TaskHub=idpworkflow;Authentication=None",

    "AzureSignalRConnectionString": "<your-signalr-connection-string>",

    "AZURE_OPENAI_ENDPOINT": "<your-endpoint-or-apim-gateway-url>",
    "AZURE_OPENAI_KEY": "<your-key-or-apim-subscription-key>",
    "AZURE_OPENAI_CHAT_DEPLOYMENT_NAME": "gpt-4.1",
    "AZURE_OPENAI_REASONING_DEPLOYMENT_NAME": "o3-mini",
    "AZURE_OPENAI_API_VERSION": "2025-01-01-preview",

    "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT": "<your-doc-intelligence-endpoint>",
    "AZURE_DOCUMENT_INTELLIGENCE_KEY": "<your-doc-intelligence-key>",

    "COGNITIVE_SERVICES_ENDPOINT": "<your-cognitive-services-endpoint>",
    "COGNITIVE_SERVICES_KEY": "<your-cognitive-services-key>"
  },
  "Host": {
    "CORS": "*"
  }
}
```

### Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `FUNCTIONS_WORKER_RUNTIME` | Yes | Must be `python` |
| `AzureWebJobsStorage` | Yes | `UseDevelopmentStorage=true` for local (requires Azurite) |
| `TASKHUB_NAME` | Yes | Durable Task hub name (default: `idpworkflow`) |
| `DurableTaskSchedulerConnection` | Yes | DTS emulator endpoint (see below) |
| `AzureSignalRConnectionString` | Yes | SignalR Service connection string |
| `AZURE_OPENAI_ENDPOINT` | Yes | Azure OpenAI or APIM gateway URL |
| `AZURE_OPENAI_KEY` | Yes | API key or APIM subscription key |
| `AZURE_OPENAI_CHAT_DEPLOYMENT_NAME` | Yes | Chat model deployment name |
| `AZURE_OPENAI_REASONING_DEPLOYMENT_NAME` | Yes | Reasoning model deployment name |
| `AZURE_OPENAI_API_VERSION` | Yes | API version (default: `2025-01-01-preview`) |
| `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` | Yes | Document Intelligence endpoint |
| `AZURE_DOCUMENT_INTELLIGENCE_KEY` | Yes | Document Intelligence key |
| `COGNITIVE_SERVICES_ENDPOINT` | Yes | Cognitive Services (Content Understanding) endpoint |
| `COGNITIVE_SERVICES_KEY` | Yes | Cognitive Services key |
| `HITL_TIMEOUT_HOURS` | No | Human review timeout (default: `24`) |
| `ANTHROPIC_API_KEY` | No | Anthropic API key (required if using Claude provider) |
| `ANTHROPIC_MODEL` | No | Claude model name (default: `claude-sonnet-4-20250514`) |
| `AZURE_AI_MODELS_ENDPOINT` | No | Azure AI Model Inference endpoint URL (required if using Azure AI Models provider) |
| `AZURE_AI_MODELS_KEY` | No | Azure AI Model Inference API key (required if using Azure AI Models provider) |
| `AZURE_AI_MODELS_MODEL` | No | Model shorthand or deployment name (default: `qwen`) |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | No | Application Insights (optional for local dev) |

---

## 3. Start the DTS Emulator

The Durable Task Scheduler emulator runs as a Docker container:

```bash
docker run -d -p 8080:8080 -p 8082:8082 \
  -e DTS_TASK_HUB_NAMES=default,idpworkflow \
  mcr.microsoft.com/dts/dts-emulator:latest
```

This exposes port 8080 (scheduler API) and 8082 (dashboard UI), and pre-creates the `idpworkflow` task hub.

Verify it's running:

```bash
curl http://localhost:8080
```

You can also open the DTS dashboard at `http://localhost:8082` to inspect orchestration instances.

The connection string in `local.settings.json` should point to `http://localhost:8080` with `Authentication=None`.

---

## 4. Start Azurite (Local Storage Emulator)

If you don't have Azurite running already:

```bash
# Install globally
npm install -g azurite

# Start (uses default ports 10000, 10001, 10002)
azurite --silent
```

Or use the VS Code Azurite extension.

---

## 5. Run the Application

```bash
# Terminal 1: Backend
source .venv/bin/activate
func start

# Terminal 2: Frontend
cd frontend
npm run dev
```

The backend starts on `http://localhost:7071` and the frontend on `http://localhost:3000`.

---

## 6. Test with Sample Documents

1. Open <http://localhost:3000>
2. Upload a PDF from the `sample_documents/` directory
3. Watch the pipeline execute in real time

Or use curl:

```bash
# Start a workflow
curl -X POST http://localhost:7071/api/idp/start \
  -H "Content-Type: application/json" \
  -d '{
    "pdf_path": "/path/to/document.pdf",
    "domain_id": "insurance_claims",
    "max_pages": 50
  }'

# Submit a human review decision
curl -X POST http://localhost:7071/api/idp/hitl/review/{instanceId} \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "reviewer": "user@example.com",
    "feedback": "Looks good"
  }'
```

You can also use the VS Code REST Client with `tests/demo.http`.

---

## Frontend Development Commands

```bash
cd frontend
npm run dev          # Dev server on :3000
npm run build        # Production build
npm run lint         # ESLint
npm run type-check   # TypeScript strict check
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `func start` fails with missing modules | Ensure you activated the venv: `source .venv/bin/activate` |
| SignalR connection errors | Verify `AzureSignalRConnectionString` is correct and the service is running |
| DTS emulator not reachable | Check Docker: `docker ps` — the container should be mapped to port 8080 |
| Storage errors | Ensure Azurite is running or `AzureWebJobsStorage` points to a valid storage account |
| CORS errors in browser | `local.settings.json` should have `"Host": { "CORS": "*" }` |
