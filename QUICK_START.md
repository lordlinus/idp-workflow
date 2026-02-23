# Quick Start Guide - IDP Workflow

Get the Intelligent Document Processing workflow running in 5 minutes.

## Option 1: Using Docker Compose (Easiest)

### Prerequisites
- Docker & Docker Compose
- 2GB RAM available

### Start

```bash
cd /home/ssattiraju/projects/experiments/MAFAzFunc

# Start all services
docker-compose up

# Wait for output:
# backend_1    | Started Azure Functions Core Tools
# frontend_1   | ▲ Next.js 14.x
# azurite_1    | Azurite Blob service is successfully listening
```

**Access:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:7071/api
- Azurite Storage: http://localhost:10000

**Stop:**
```bash
docker-compose down
```

---

## Option 2: Manual Setup (More Control)

### Step 1: Start Backend (Terminal 1)

```bash
cd /home/ssattiraju/projects/experiments/MAFAzFunc

# Setup Python environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Start Azurite in background (another window)
azurite --silent --location ./AzuriteConfig &

# Start Azure Functions
func start
```

You should see:
```
Azure Functions Core Tools
...
Now listening on: http://0.0.0.0:7071
```

### Step 2: Start Frontend (Terminal 2)

```bash
cd /home/ssattiraju/projects/experiments/MAFAzFunc/frontend-nextjs

npm install
npm run dev
```

You should see:
```
▲ Next.js 14.x
- Local:        http://localhost:3000
```

### Step 3: Verify Setup

Open http://localhost:3000 in your browser.

You should see:
- 🟢 Connection indicator (top right) - Green "Connected"
- "Document Intelligence" header
- Upload area with domain selector

---

## Test the System

### 1. Upload a Document

```bash
# Option A: Use included sample
# In browser: Select "Insurance Claims Processing" → Click upload → Choose sample PDF

# Option B: Upload via API
curl -X POST http://localhost:7071/api/idp/upload \
  -F "file=@sample_documents/sample.pdf"

# Response:
# {
#   "blobPath": "uploads/20240106_120530_abc12345_sample.pdf",
#   "blobUri": "http://...",
#   "fileName": "sample.pdf"
# }
```

### 2. Watch Workflow Execute

In the browser, you'll see:

1. **Step 1 - PDF Extraction** ⚙️ → ✅
   - Converts PDF to markdown
   - Shows page count

2. **Step 2 - Classification** ⚙️ → ✅
   - Detects document type
   - Shows confidence score

3. **Steps 3a & 3b - Parallel Extraction** ⚙️ → ✅
   - Azure Content Understanding
   - DSPy LLM Extraction
   - Both run in parallel

4. **Step 4 - Comparison** ⚙️ → ✅
   - Compares Azure vs DSPy results
   - Shows match percentage

5. **Step 5 - Human Review** 👤 (STOPS HERE)
   - Modal appears with field comparison
   - Select values for conflicting fields
   - Click "Approve & Continue"

6. **Step 6 - AI Reasoning** 🤖 → ✅
   - Right panel streams reasoning chunks
   - Real-time analysis
   - Completion indicator

### 3. Check Browser Console

Press F12 in browser and check Console for:

```javascript
// Should see SignalR events
[stepStarted] Step 1 started: PDF to Markdown
[stepCompleted] Step 1 completed in 2500ms
[hitlWaiting] Review required for 3 fields
[reasoningChunk] 🎯 Confidence Score: 92.0%
[workflowCompleted] Workflow complete!
```

### 4. Verify History

After upload, refresh the page and check the History sidebar (left panel) to see previous workflows.

---

## Common Commands

### Check Services Status

```bash
# Backend health
curl http://localhost:7071/api/health

# Frontend
curl http://localhost:3000

# Storage (Azurite)
curl http://localhost:10000
```

### View Logs

```bash
# Backend
func start  # Shows logs directly

# Frontend (in separate terminal)
cd frontend-nextjs && npm run dev

# Browser console (F12)
```

### Stop Services

```bash
# If using docker-compose
docker-compose down

# If manual setup
# Kill each terminal (Ctrl+C)
# Deactivate Python venv
deactivate
```

---

## Troubleshooting

### Frontend shows "🔴 Disconnected"

1. Check if backend is running on port 7071
2. Check browser console for CORS errors
3. Verify `NEXT_PUBLIC_API_BASE_URL` in `.env.local`
4. Restart frontend: `npm run dev`

### Upload fails with "Failed to upload file"

1. Check Azurite is running: `curl http://localhost:10000`
2. Verify file is a PDF
3. Check backend logs for storage errors
4. Verify `AzureWebJobsStorage` in `local.settings.json`

### HITL modal doesn't appear

1. Check if Step 4 found conflicts (check console)
2. Verify SignalR connection is active (green indicator)
3. Check backend logs for event broadcasting errors
4. Refresh browser and retry

### Workflow hangs at a step

1. Check backend logs for exceptions
2. Look for timeouts in the orchestration
3. Verify external services (OpenAI, etc.) are available
4. Restart backend: `func start`

---

## Next Steps

After verifying the system works:

1. **Explore Different Domains**
   - Try "Home Loan / Mortgage Processing"
   - Try "Small Business Lending"
   - Try "Trade Finance Document Analysis"

2. **Test HITL Features**
   - Upload documents with conflicting extractions
   - Try different field selections
   - Add reviewer feedback

3. **Monitor Real-time Stream**
   - Watch Step 6 reasoning chunks in real-time
   - Observe different chunk types and their styling
   - Note confidence scores

4. **Check History**
   - Upload multiple documents
   - Verify they appear in history sidebar
   - Click to reload previous workflows

5. **Customize**
   - Edit domain configurations in `idp_workflow/domains/`
   - Modify UI components in `frontend-nextjs/src/components/`
   - Adjust styling in Tailwind config

---

## Development Notes

### File Structure

```
/home/ssattiraju/projects/experiments/MAFAzFunc/
├── frontend-nextjs/          # Next.js UI
│   ├── src/
│   │   ├── app/             # Pages and layout
│   │   ├── components/      # React components
│   │   ├── lib/             # Services and utilities
│   │   ├── store/           # Zustand stores
│   │   ├── types/           # TypeScript types
│   │   └── styles/          # CSS and Tailwind
│   ├── package.json
│   └── tsconfig.json
├── idp_workflow/             # Backend logic
│   ├── orchestration.py      # Durable Functions orchestration
│   ├── api/endpoints.py      # HTTP and SignalR endpoints
│   ├── steps/               # Activity functions
│   ├── domains/             # Domain configurations
│   └── models.py            # Pydantic models
├── function_app.py           # Azure Functions entry point
├── local.settings.json       # Local configuration
├── requirements.txt          # Python dependencies
└── docker-compose.yml        # Docker setup
```

### Making Changes

**Backend Changes**:
```bash
# Edit file
vim idp_workflow/orchestration.py

# Azure Functions auto-reloads
# Or restart: func start
```

**Frontend Changes**:
```bash
# Edit file
vim frontend-nextjs/src/components/WorkflowDiagram.tsx

# Hot reload happens automatically
# Or refresh browser
```

---

## Production Deployment

See `SETUP_GUIDE.md` for detailed production deployment instructions.

---

## Getting Help

1. Check browser console (F12)
2. Check backend logs (`func start` output)
3. Verify prerequisites: Python 3.10+, Node 18+, Docker (if using compose)
4. Review error messages in toast notifications
5. Check `ARCHITECTURE_ANALYSIS.md` for system design
6. Review `docs/UI_QUICK_REFERENCE.md` for API details

---

**That's it!** You now have a fully functional Intelligent Document Processing system running locally. 🎉
