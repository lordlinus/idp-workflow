# IDP Workflow - Setup & Deployment Guide

Complete guide for setting up and running the Intelligent Document Processing system with Next.js frontend and Azure Durable Functions backend.

## Prerequisites

### System Requirements
- Node.js 18+
- Python 3.10+
- Azure Storage Emulator (Azurite) or Azure Storage Account
- Azure Functions Core Tools (`func` CLI)

### Azure Resources (Production)
- Azure Storage Account
- Azure Durable Functions (App Service or Function App)
- Azure SignalR Service
- Azure OpenAI (for AI reasoning step)

## Part 1: Backend Setup

### 1.1 Install Azure Functions Runtime

```bash
# Install Azure Functions Core Tools (if not already installed)
# macOS
brew tap azure/azure
brew install azure-functions

# Windows/Linux: Follow https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local
```

### 1.2 Configure Local Environment

In the root directory (`/home/ssattiraju/projects/experiments/MAFAzFunc`):

**local.settings.json** (already configured, verify):
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "AzureSignalRConnectionString": "Endpoint=http://localhost:8080;AccessKey=test;Version=1.0;",
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "FUNCTIONS_RUNTIME_SCALE_MONITORING_ENABLED": true
  },
  "Host": {
    "CORS": {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["*"],
      "AllowedHeaders": ["*"],
      "MaxAge": 86400
    }
  }
}
```

### 1.3 Install Python Dependencies

```bash
cd /home/ssattiraju/projects/experiments/MAFAzFunc

# Create virtual environment (if not exists)
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows

# Install requirements
pip install -r requirements.txt
```

### 1.4 Start Azurite (Storage Emulator)

In a separate terminal:

```bash
# Start Azurite on default ports (10000, 10001, 10002)
azurite --silent --location ./AzuriteConfig

# OR use Docker
docker run -p 10000:10000 -p 10001:10001 -p 10002:10002 mcr.microsoft.com/azure-storage/azurite
```

### 1.5 Start Azure Functions Runtime

```bash
cd /home/ssattiraju/projects/experiments/MAFAzFunc

# Activate venv if not already
source .venv/bin/activate

# Start functions
func start

# You should see output like:
# Azure Functions Core Tools
# Found Python codegen extension
# ...
# Now listening on: http://0.0.0.0:7071
```

**Verify backend is running:**
```bash
curl http://localhost:7071/api/idp/health
```

### 1.6 Test Endpoints

```bash
# Test domain config endpoint
curl http://localhost:7071/api/idp/domains/insurance_claims/config | jq .

# Test workflow start (requires PDF path)
curl -X POST http://localhost:7071/api/idp/start \
  -H "Content-Type: application/json" \
  -d '{
    "pdf_path": "/sample_documents/sample.pdf",
    "domain_id": "insurance_claims"
  }'
```

## Part 2: Frontend Setup

### 2.1 Install Node Dependencies

```bash
cd /home/ssattiraju/projects/experiments/MAFAzFunc/frontend-nextjs

npm install
# or
yarn install
```

### 2.2 Configure Environment

Verify `.env.local` exists and contains:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:7071/api
```

### 2.3 Start Development Server

```bash
npm run dev
# or
yarn dev
```

**Verify frontend is running:**
- Open http://localhost:3000 in browser
- You should see the "Document Intelligence" upload page
- Check browser console for any errors

## Part 3: Full Integration Test

### 3.1 Test Workflow Start to Completion

1. **Open Frontend**: http://localhost:3000

2. **Check Connections**:
   - Connection indicator (top right) should show 🟢 Connected
   - If not connected, check:
     - SignalR endpoint in `local.settings.json`
     - Backend is running on port 7071
     - Cors configuration in local.settings.json

3. **Upload Sample Document**:
   - Select domain (Insurance Claims)
   - Choose `sample_documents/sample.pdf` or your own PDF
   - Click upload
   - Watch for success toast

4. **Monitor Workflow**:
   - Workflow diagram should show steps executing
   - Step status badges update in real-time
   - Events log shows each step start/completion

5. **HITL Review** (Step 5):
   - Modal appears with field comparison table
   - Select values for conflicting fields
   - Click "Approve & Continue"
   - Workflow resumes

6. **Reasoning Stream** (Step 6):
   - Right panel shows AI reasoning chunks
   - Watch real-time streaming analysis
   - Success indicator when complete

7. **Completion**:
   - Toast shows "Workflow completed successfully!"
   - Workflow status changes to "completed"
   - Instance ID saved to browser cookie

### 3.2 Verify History

1. Upload a document (triggers history storage)
2. Refresh browser or click "New Workflow"
3. History sidebar shows previous uploads
4. Click previous workflow to reload

## Part 4: Production Deployment

### 4.1 Backend Deployment (Azure Functions)

```bash
# Login to Azure
az login
az account set --subscription <subscription-id>

# Create Function App (if not exists)
az functionapp create \
  --resource-group <resource-group> \
  --consumption-plan-location eastus \
  --runtime python \
  --runtime-version 3.11 \
  --functions-version 4 \
  --name idp-workflow-func

# Deploy
func azure functionapp publish idp-workflow-func

# Configure settings
az functionapp config appsettings set \
  --resource-group <resource-group> \
  --name idp-workflow-func \
  --settings \
    AzureWebJobsStorage="<storage-connection-string>" \
    AzureSignalRConnectionString="<signalr-connection-string>" \
    AZURE_OPENAI_API_KEY="<api-key>" \
    AZURE_OPENAI_ENDPOINT="<endpoint>"
```

### 4.2 Frontend Deployment (Vercel, Azure Static Web Apps, or Docker)

#### Option A: Vercel
```bash
npm install -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard:
# NEXT_PUBLIC_API_BASE_URL=https://<your-function-app>.azurewebsites.net/api
```

#### Option B: Azure Static Web Apps
```bash
# Build
npm run build

# Deploy via Azure Portal or CLI
az staticwebapp create \
  --name idp-workflow-ui \
  --resource-group <resource-group> \
  --source-location frontend-nextjs \
  --build-folder .next \
  --app-location "." \
  --api-location "api"
```

#### Option C: Docker
```bash
# Build image
docker build -f frontend-nextjs/Dockerfile -t idp-workflow-ui .

# Run
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_BASE_URL=https://<your-function-app>.azurewebsites.net/api \
  idp-workflow-ui
```

### 4.3 Azure Configuration

**Storage Account**:
```bash
# Create container for PDFs
az storage container create \
  --name documents \
  --account-name <storage-account> \
  --auth-mode login
```

**SignalR**:
```bash
# Create SignalR Service
az signalr create \
  --name idp-workflow-signalr \
  --resource-group <resource-group> \
  --sku Standard_S1 \
  --unit-count 1

# Get connection string
az signalr key list \
  --name idp-workflow-signalr \
  --resource-group <resource-group>
```

**OpenAI**:
```bash
# Create OpenAI resource in Azure Portal or CLI
# Set environment variables:
AZURE_OPENAI_API_KEY=<key>
AZURE_OPENAI_ENDPOINT=<endpoint>
AZURE_OPENAI_DEPLOYMENT_ID=<deployment-id>
```

## Part 5: Monitoring & Debugging

### Backend Logs

```bash
# Stream function logs
func start --build=remote

# Azure Portal
# Navigate to Function App → Monitor → Log stream
```

### Frontend Logs

```bash
# Browser DevTools Console
# Network tab for API calls
# Application → Cookies to verify history storage

# Server-side (if using Node.js runtime)
npm run dev -- --debug
```

### SignalR Debugging

```bash
# Check connection status in browser console
window.signalR // Should show connection details

# Monitor messages in Network tab (WebSocket)
# Filter by "ws://" in DevTools
```

## Part 6: Troubleshooting

### Issue: Frontend Cannot Connect to Backend

**Symptoms**: 
- 🔴 Connection indicator shows "Disconnected"
- CORS errors in browser console

**Solution**:
1. Verify backend is running on port 7071
2. Check `local.settings.json` CORS configuration
3. Verify `NEXT_PUBLIC_API_BASE_URL` environment variable
4. Try clearing browser cache and reloading

### Issue: File Upload Fails

**Symptoms**:
- Toast: "Failed to upload file"

**Solution**:
1. Verify Azurite is running on port 10000
2. Check `AzureWebJobsStorage` connection string
3. Verify `documents` container exists in blob storage
4. Check file size limits

### Issue: HITL Modal Doesn't Appear

**Symptoms**:
- Workflow runs but no review prompt

**Solution**:
1. Check if Step 4 comparison found conflicts
2. Verify `hitlWaiting` event in browser console
3. Check backend logs for event broadcasting errors
4. Verify SignalR connection is active

### Issue: Workflow Hangs at Step X

**Symptoms**:
- Step status stuck on "running"

**Solution**:
1. Check function app logs for errors
2. Verify activity timeout settings
3. Check if external service (OpenAI, Storage) is responding
4. Restart Azure Functions runtime

## Part 7: Performance Tuning

### Frontend
- Enable HTTP/2 in production
- Compress assets (Next.js handles this)
- Use CDN for static assets
- Optimize bundle size with `npm run build --analyze`

### Backend
- Increase Function App compute tier if needed
- Configure auto-scale based on queue depth
- Use connection pooling for database connections
- Monitor execution times for slow activities

### SignalR
- Increase service tier based on concurrent users
- Enable persistent connections
- Configure message size limits

## Part 8: Security Checklist

- [ ] Disable CORS in production (restrict to frontend domain)
- [ ] Add authentication to endpoints (Azure AD, API keys)
- [ ] Use HTTPS only in production
- [ ] Store sensitive config in Azure Key Vault
- [ ] Implement rate limiting on endpoints
- [ ] Validate all user input
- [ ] Sanitize PDF paths to prevent directory traversal
- [ ] Use managed identities for Azure resource access
- [ ] Enable firewall rules on storage accounts
- [ ] Monitor and alert on failures

## Support

For issues or questions:
1. Check backend logs: `func start` console output
2. Check frontend console: Browser DevTools (F12)
3. Check SignalR events: Network tab in DevTools
4. Review `ARCHITECTURE_ANALYSIS.md` for system design
5. Check `docs/Agents.md` for agent framework details
6. Review `docs/UI_QUICK_REFERENCE.md` for API contracts

---

**Last Updated**: January 2026
**Version**: 1.0.0
