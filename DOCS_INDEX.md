# IDP Workflow - Documentation Index

Comprehensive guide to the Intelligent Document Processing system with Next.js UI and Azure Durable Functions backend.

## 🚀 Getting Started

Start here if you're new to the project:

1. **[QUICK_START.md](./QUICK_START.md)** ⭐ **START HERE**
   - 5-minute setup with Docker or manual installation
   - Verify the system is working
   - Common troubleshooting

2. **[SETUP_GUIDE.md](./SETUP_GUIDE.md)**
   - Detailed step-by-step setup
   - Production deployment instructions
   - Azure resource configuration
   - Performance tuning

## 📖 Documentation

### Architecture & Design

- **[ARCHITECTURE_ANALYSIS.md](./ARCHITECTURE_ANALYSIS.md)**
  - Complete system design overview
  - Workflow pipeline explanation
  - State management and data flow
  - Technical decisions and rationale

### User Guides

- **[docs/UI_QUICK_REFERENCE.md](./docs/UI_QUICK_REFERENCE.md)**
  - Frontend user interface overview
  - How to upload and process documents
  - HITL field selection guide
  - Reasoning stream interpretation

- **[docs/Agents.md](./docs/Agents.md)**
  - AI Agent framework (Step 6 Reasoning)
  - Agent tools and capabilities
  - Response examples and output structure
  - Integration details

### API Reference

All endpoints documented in [docs/UI_QUICK_REFERENCE.md](./docs/UI_QUICK_REFERENCE.md#api-endpoints):

- **HTTP Endpoints:**
  - `POST /api/idp/upload` - Upload PDF
  - `POST /api/idp/start` - Start workflow
  - `POST /api/idp/hitl/review/{instanceId}` - Submit HITL review
  - `GET /api/idp/history` - Get workflow history
  - `GET /api/idp/domains/{domain_id}/config` - Get domain config

- **SignalR Events:**
  - `stepStarted`, `stepCompleted`, `stepFailed`
  - `hitlWaiting`, `hitlApproved`, `hitlRejected`
  - `reasoningChunk`, `workflowCompleted`, `workflowFailed`

## 🏗️ Project Structure

```
.
├── frontend-nextjs/              # Next.js 14 frontend
│   ├── src/
│   │   ├── app/                 # Next.js App Router pages
│   │   ├── components/          # React components
│   │   │   ├── FileUploadArea.tsx
│   │   │   ├── WorkflowDiagram.tsx
│   │   │   ├── HITLReviewPanel.tsx
│   │   │   ├── ReasoningPanel.tsx
│   │   │   ├── HistorySidebar.tsx
│   │   │   └── ...
│   │   ├── lib/
│   │   │   ├── apiClient.ts     # HTTP client
│   │   │   ├── signalrClient.ts # SignalR service
│   │   │   ├── queryKeys.ts     # React Query hooks
│   │   │   └── utils.ts         # Utilities
│   │   ├── store/               # Zustand stores
│   │   │   ├── workflowStore.ts
│   │   │   ├── eventsStore.ts
│   │   │   ├── reasoningStore.ts
│   │   │   └── uiStore.ts
│   │   ├── types/               # TypeScript types
│   │   └── styles/              # CSS
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── Dockerfile
│   └── README.md
│
├── idp_workflow/                 # Python backend
│   ├── api/endpoints.py          # HTTP & SignalR endpoints
│   ├── orchestration/
│   │   ├── orchestration.py      # Durable Functions orchestration
│   │   └── state.py              # State management
│   ├── steps/                    # Activity functions
│   │   ├── step_01_pdf_extractor.py
│   │   ├── step_02_classifier.py
│   │   ├── step_03_extractors.py
│   │   ├── step_04_comparator.py
│   │   └── step_06_reasoning_agent.py
│   ├── domains/                  # Domain configurations
│   │   └── {domain_id}/
│   │       ├── config.json
│   │       ├── extraction_schema.json
│   │       ├── classification_categories.json
│   │       └── validation_rules.json
│   ├── tools/                    # LLM tools and utilities
│   │   ├── content_understanding_tool.py
│   │   ├── dspy_utils.py
│   │   └── ...
│   ├── models.py                 # Pydantic models
│   ├── constants.py
│   └── utils/
│
├── function_app.py               # Azure Functions entry point
├── host.json                     # Functions configuration
├── local.settings.json           # Local environment config
├── requirements.txt              # Python dependencies
│
├── docs/
│   ├── UI_QUICK_REFERENCE.md    # Frontend integration guide
│   └── Agents.md                 # Agent framework guide
│
├── QUICK_START.md                # ⭐ Start here
├── SETUP_GUIDE.md                # Detailed setup & deployment
├── ARCHITECTURE_ANALYSIS.md      # System design
├── docker-compose.yml            # Docker Compose configuration
├── Dockerfile                    # Multi-stage production build
├── Dockerfile.backend            # Backend-only Docker
└── README.md                     # Project overview
```

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **State Management**: Zustand + Immer
- **Data Fetching**: @tanstack/react-query
- **Real-time**: @microsoft/signalr
- **Visualization**: Reaflow
- **UI Components**: Headless UI, custom components

### Backend
- **Runtime**: Azure Functions (Python)
- **Orchestration**: Azure Durable Functions
- **Real-time**: Azure SignalR Service
- **Storage**: Azure Blob Storage (Azurite for local)
- **AI/LLM**: Azure OpenAI, DSPy
- **HTTP**: Async Azure Functions
- **Logging**: Python logging + Application Insights

## 📋 Key Features

- ✅ **6-Step Intelligent Document Processing Pipeline**
  - PDF Extraction
  - Document Classification
  - Parallel Azure CU + DSPy Extraction
  - Extraction Comparison
  - Human-in-the-Loop Review (HITL)
  - AI Reasoning & Consolidation

- ✅ **Real-time Workflow Visualization**
  - Reaflow-based 6-step diagram
  - Live step status updates
  - Duration and output preview

- ✅ **SignalR Real-time Updates**
  - Step progress events
  - HITL field comparison
  - Streaming AI reasoning chunks
  - Auto-reconnect with backoff

- ✅ **HITL Review Interface**
  - Side-by-side field comparison (Azure vs DSPy)
  - Per-field selection (azure/dspy/manual)
  - Confidence scores
  - Reviewer feedback

- ✅ **Streaming Reasoning Display**
  - Real-time AI analysis chunks
  - Chunk-type-based formatting
  - Validation summaries
  - Final results

- ✅ **Workflow History**
  - Azure Durable Functions integration
  - Persistent instance lookup
  - Quick reload of previous workflows

- ✅ **Professional Dark Theme**
  - Polished, elegant UI
  - Accessible color contrast
  - Smooth animations
  - Responsive design

## 🔄 Workflow Pipeline

```
┌─────────────────────────────────────────────────────────┐
│ User Uploads PDF                                        │
└──────────────────────┬──────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────┐
│ Step 1: PDF Extraction                                  │
│ (Extract text, detect structure)                        │
└──────────────────────┬──────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────┐
│ Step 2: Classification                                  │
│ (Detect document type & domain)                         │
└──────────────────────┬──────────────────────────────────┘
                       ↓
┌──────────────────────┬──────────────────────────────────┐
│ Step 3a: Azure CU    │ Step 3b: DSPy Extraction        │
│ (Parallel)           │ (Parallel)                      │
└──────────────────────┴──────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────┐
│ Step 4: Comparison                                      │
│ (Compare Azure vs DSPy results)                         │
└──────────────────────┬──────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────┐
│ Step 5: Human Review (HITL)                             │
│ (User selects preferred values for conflicts)           │
│ ⏸️  WORKFLOW PAUSES HERE                                 │
└──────────────────────┬──────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────┐
│ Step 6: AI Reasoning                                    │
│ (Agent consolidates & analyzes results)                 │
└──────────────────────┬──────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────┐
│ Workflow Complete                                       │
│ (Final result returned to client)                       │
└─────────────────────────────────────────────────────────┘
```

## 📊 State Management

```
Zustand Stores (Client-side)
├── workflowStore
│   ├── instanceId
│   ├── domain_id
│   ├── status
│   ├── currentStep
│   ├── steps (Map<StepName, Step>)
│   ├── hitlWaiting (data when step 5 blocks)
│   └── hitlStatus
├── eventsStore
│   └── events (SignalR events log)
├── reasoningStore
│   ├── chunks (ReasoningChunk[])
│   └── isComplete
└── uiStore
    ├── connectionStatus
    ├── showHITLModal
    ├── showReasoningPanel
    └── toast
```

## 🔌 Real-time Integration

**SignalR Event Flow:**

```
Backend (Azure Functions)
└─→ Orchestration broadcasts event
    └─→ activity_broadcast_signalr
        └─→ Azure SignalR Service
            └─→ Group: workflow-{instanceId}
                └─→ Connected Clients (signalRClient.ts)
                    └─→ Update Zustand stores
                        └─→ React components re-render
```

## 🚢 Deployment

### Development
```bash
# Using Docker Compose (recommended)
docker-compose up

# Or manual setup
./start-dev.sh
```

### Production
```bash
# Azure Functions
func azure functionapp publish <function-app-name>

# Frontend (Vercel, Static Web Apps, or Docker)
vercel deploy  # or similar
```

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed production deployment.

## 🧪 Testing

### Manual Testing
1. Follow [QUICK_START.md](./QUICK_START.md)
2. Upload sample document
3. Monitor workflow execution
4. Test HITL review
5. Check reasoning stream

### API Testing
```bash
# Upload
curl -X POST http://localhost:7071/api/idp/upload \
  -F "file=@sample.pdf"

# Start workflow
curl -X POST http://localhost:7071/api/idp/start \
  -H "Content-Type: application/json" \
  -d '{"pdf_path":"uploads/...", "domain_id":"insurance_claims"}'

# Submit HITL review
curl -X POST http://localhost:7071/api/idp/hitl/review/{instanceId} \
  -H "Content-Type: application/json" \
  -d '{...}'
```

## 🐛 Debugging

### Browser DevTools
- **Console**: SignalR events, errors
- **Network**: API calls, WebSocket messages
- **Application**: Cookies, local storage

### Backend Logs
```bash
# Azure Functions
func start  # Shows logs directly

# Or Docker
docker-compose logs backend -f
```

### Database/Storage
```bash
# Azurite Storage Explorer
# Connect to: DefaultEndpointsProtocol=http;...
# Or use Azure Storage Explorer
```

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Azure Functions Python Guide](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-python)
- [Azure Durable Functions](https://learn.microsoft.com/en-us/azure/azure-functions/durable/)
- [Azure SignalR Service](https://learn.microsoft.com/en-us/azure/azure-signalr/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Tailwind CSS](https://tailwindcss.com)
- [Reaflow](https://github.com/reaviz/reaflow)

## 👥 Contributing

To contribute improvements:

1. Create a feature branch
2. Make your changes
3. Test locally (run QUICK_START guide)
4. Submit PR with description
5. Ensure CI passes

## 📝 License

MIT

---

**Version**: 1.0.0  
**Last Updated**: January 2026  
**Status**: Production Ready ✅

**For questions or issues, start with [QUICK_START.md](./QUICK_START.md) and check the troubleshooting section.**
