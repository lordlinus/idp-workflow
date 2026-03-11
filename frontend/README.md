# IDP Workflow - Next.js Frontend

Professional, real-time UI for Intelligent Document Processing workflow with Azure Durable Functions backend.

## Features

- 🎨 **Dark Theme UI** - Professional and polished interface
- 🔄 **Real-time Workflow Visualization** - Reaflow-based 6-step pipeline diagram
- 🔌 **SignalR Integration** - Live updates for step execution and streaming reasoning
- 👤 **HITL Review Panel** - Elegant field selection and approval interface
- 🤖 **Streaming AI Reasoning** - Real-time agent analysis with chunk-based rendering
- 📋 **Workflow History** - Persistent history via Azure Durable Functions
- 📱 **Responsive Design** - Mobile-friendly layout

## Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Real-time**: @microsoft/signalr
- **Data Fetching**: @tanstack/react-query
- **Visualization**: Reaflow
- **UI Components**: Headless UI, custom components

## Getting Started

### Prerequisites

- Node.js 18+
- Backend running at `http://localhost:7071`

### Installation

```bash
cd frontend
npm install
```

### Environment Setup

Copy `.env.local.example` to `.env.local` and adjust as needed:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:7071/api
```

### Development

```bash
npm run dev
```

Open <http://localhost:3000> in your browser.

### Build

```bash
npm run build
npm start
```

## Architecture

### Store Structure

- **workflowStore**: Workflow state (instanceId, steps, HITL, status)
- **eventsStore**: All received SignalR events
- **reasoningStore**: AI reasoning chunks
- **uiStore**: UI state (connection, modals, toasts)

### API Integration

All backend calls via `src/lib/apiClient.ts`:

- Upload PDFs to Azure Blob Storage
- Start workflows
- Submit HITL reviews
- Fetch workflow history
- SignalR negotiation

### SignalR Real-time Events

Auto-connected to Azure SignalR hub with support for:

- `stepStarted` / `stepCompleted` / `stepFailed`
- `hitlWaiting` / `hitlApproved` / `hitlRejected`
- `reasoningChunk` (streamed in real-time)
- `workflowCompleted` / `workflowFailed`

Automatic reconnection with exponential backoff.

## Component Overview

| Component | Purpose |
|-----------|---------|
| `FileUploadArea` | PDF upload and domain selection |
| `WorkflowDiagram` | Reaflow visualization of 6-step pipeline |
| `HITLReviewPanel` | Modal for field comparison and approval |
| `ReasoningPanel` | Real-time streaming AI reasoning display |
| `HistorySidebar` | Browse previous workflows (via Azure Durable Functions) |
| `ConnectionIndicator` | SignalR connection status |
| `Toast` | Notification system |

## Styling

- Dark theme (dark-900 base)
- Tailwind CSS components with custom utilities
- Animations: fade-in, slide-in, pulse-glow
- Color scheme: Primary (blue), Secondary (purple), Success (green), Danger (red)

## TypeScript Types

Fully typed with discriminated unions for SignalR events, HITL data, and reasoning chunks.
All API responses are strongly typed.

## Error Handling

- Graceful SignalR reconnection with user-facing status
- HTTP error toasts with retry options
- Form validation before submission
- Error boundaries for major sections

## Performance

- React Query caching (5-10 min stale/gc times)
- Immer-optimized Zustand stores
- Code splitting via Next.js App Router
- Lazy-loaded components
- Auto-scroll on reasoning stream updates

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Development Notes

### Adding New Events

1. Update `types/index.ts` with new event interface
2. Add handler to `lib/signalrClient.ts`
3. Update relevant Zustand store
4. Create/update UI components

### Styling Convention

- Component: `className="rounded-lg border border-dark-700 bg-dark-800 p-6"`
- Buttons: Use `btn-primary`, `btn-secondary`, `btn-danger`, `btn-success`
- Inputs: Use `input-base`
- Cards: Use `card` or `card-sm`

## License

MIT
