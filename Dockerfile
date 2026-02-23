# IDP Workflow - Multi-stage Dockerfile for production

# Stage 1: Build Next.js frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend-nextjs/package*.json ./

RUN npm ci

COPY frontend-nextjs/ ./

RUN npm run build

# Stage 2: Build Python backend
FROM mcr.microsoft.com/azure-functions/python:4-python3.11

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true \
    FUNCTIONS_EXTENSION_VERSION=~4

WORKDIR /home/site/wwwroot

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY function_app.py .
COPY host.json .
COPY idp_workflow/ ./idp_workflow/
COPY sample_documents/ ./sample_documents/

# Copy built frontend
COPY --from=frontend-builder /app/frontend/.next /home/site/wwwroot/frontend/.next
COPY --from=frontend-builder /app/frontend/public /home/site/wwwroot/frontend/public
COPY --from=frontend-builder /app/frontend/package*.json /home/site/wwwroot/frontend/

# Expose ports
EXPOSE 7071 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:7071/api/health || exit 1

CMD ["func", "start"]
