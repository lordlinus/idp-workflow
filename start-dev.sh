#!/bin/bash

# Quick Start Script for IDP Workflow
# Starts both backend and frontend in development mode

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== IDP Workflow Development Setup ===${NC}\n"

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Python 3 not found. Please install Python 3.10+${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi

if ! command -v func &> /dev/null; then
    echo -e "${RED}Azure Functions Core Tools not found. Please install with: brew install azure-functions${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All prerequisites found${NC}\n"

# Start Azurite in background
echo -e "${YELLOW}Starting Azurite (Azure Storage Emulator)...${NC}"
if ! command -v azurite &> /dev/null; then
    echo -e "${YELLOW}Installing Azurite...${NC}"
    npm install -g azurite
fi

mkdir -p AzuriteConfig
azurite --silent --location ./AzuriteConfig &
AZURITE_PID=$!
echo -e "${GREEN}✓ Azurite started (PID: $AZURITE_PID)${NC}\n"

# Setup Python backend
echo -e "${YELLOW}Setting up Python backend...${NC}"
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi

source .venv/bin/activate

if [ ! -f "requirements.txt" ]; then
    echo -e "${RED}requirements.txt not found${NC}"
    exit 1
fi

pip install -q -r requirements.txt
echo -e "${GREEN}✓ Python dependencies installed${NC}\n"

# Setup Node frontend
echo -e "${YELLOW}Setting up Node.js frontend...${NC}"
cd frontend-nextjs

if [ ! -d "node_modules" ]; then
    npm install --silent
fi

echo -e "${GREEN}✓ Node dependencies installed${NC}\n"

cd ..

# Start services
echo -e "${GREEN}=== Starting Services ===${NC}\n"

echo -e "${YELLOW}Starting Azure Functions (Backend)...${NC}"
echo -e "  ${GREEN}→ http://localhost:7071${NC}"
func start &
FUNC_PID=$!

sleep 2

echo -e "${YELLOW}Starting Next.js (Frontend)...${NC}"
echo -e "  ${GREEN}→ http://localhost:3000${NC}"
cd frontend-nextjs
npm run dev &
NEXT_PID=$!
cd ..

echo -e "\n${GREEN}=== Services Started ===${NC}"
echo -e "  Backend:    http://localhost:7071"
echo -e "  Frontend:   http://localhost:3000"
echo -e "  Storage:    http://localhost:10000 (Azurite)"
echo -e "\n${YELLOW}Press Ctrl+C to stop all services${NC}\n"

# Cleanup on exit
trap "
    echo -e \"\n${YELLOW}Stopping services...${NC}\"
    kill $FUNC_PID 2>/dev/null || true
    kill $NEXT_PID 2>/dev/null || true
    kill $AZURITE_PID 2>/dev/null || true
    deactivate 2>/dev/null || true
    echo -e \"${GREEN}All services stopped${NC}\"
" EXIT

# Wait for processes
wait
