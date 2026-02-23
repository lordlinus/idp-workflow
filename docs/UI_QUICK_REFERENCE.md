# IDP Workflow - UI Integration Quick Reference

This document provides frontend developers with everything needed to integrate with the Intelligent Document Processing (IDP) workflow API.

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Workflow Steps](#workflow-steps)
4. [API Endpoints](#api-endpoints)
5. [Real-Time Updates with SignalR](#real-time-updates-with-signalr)
6. [HITL Field Selection UI](#hitl-field-selection-ui)
7. [Streaming Reasoning Chat](#streaming-reasoning-chat)
8. [Complete Flow Example](#complete-flow-example)
9. [Error Handling](#error-handling)
10. [TypeScript Interfaces](#typescript-interfaces)

---

## Overview

The IDP workflow processes documents through 6 steps:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         IDP WORKFLOW PIPELINE                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Step 1          Step 2           Step 3a & 3b        Step 4           │
│  ┌─────┐        ┌─────────┐      ┌────────────┐      ┌──────────┐      │
│  │ PDF │───────▶│Classify │─────▶│ Extract ×2 │─────▶│ Compare  │      │
│  │     │        │         │      │ (Parallel) │      │          │      │
│  └─────┘        └─────────┘      └────────────┘      └──────────┘      │
│                                   Azure CU │                ▼          │
│                                   DSPy     │           ┌──────────┐    │
│                                                        │ Step 5   │    │
│                                                        │  HITL    │◀───┤
│                                                        │(PAUSES)  │    │
│                                                        └──────────┘    │
│                                                              │         │
│                                                              ▼         │
│                                                        ┌──────────┐    │
│                                                        │ Step 6   │    │
│                                                        │Reasoning │    │
│                                                        │(Streams) │    │
│                                                        └──────────┘    │
│                                                              │         │
│                                                              ▼         │
│                                                         ✅ Complete    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Features

| Feature | Description |
|---------|-------------|
| **SignalR Real-Time** | Push-based updates for step progress, HITL, and reasoning |
| **HITL Field Selection** | Compare Azure vs DSPy values, select per-field |
| **Streaming Reasoning** | Chat-style streaming of AI analysis via SignalR |
| **Concurrent Extraction** | Azure CU and DSPy run in parallel |
| **HTTP Submission** | HTTP is used for start + HITL review; all progress uses SignalR |

---

## Quick Start

### Option A: With SignalR (Recommended)

```javascript
// 1. Get SignalR connection
const negotiateRes = await fetch('/api/idp/negotiate', { method: 'POST' });
const { url, accessToken } = await negotiateRes.json();

// 2. Connect to SignalR
const connection = new signalR.HubConnectionBuilder()
  .withUrl(url, { accessTokenFactory: () => accessToken })
  .withAutomaticReconnect()
  .build();

// 3. Set up event handlers BEFORE connecting
connection.on('stepStarted', (msg) => console.log('Started:', msg.data.stepDisplayName));
connection.on('stepCompleted', (msg) => console.log('Completed:', msg.data.stepDisplayName));
connection.on('hitlWaiting', (msg) => showReviewModal(msg.data.fieldsForReview));
connection.on('workflowCompleted', (msg) => console.log('Done!', msg.data.summary));

await connection.start();

// 4. Start workflow
const startRes = await fetch('/api/idp/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pdf_path: '/path/to/doc.pdf',
    domain_id: 'insurance_claims'
  })
});
const { instanceId } = await startRes.json();

// 5. Subscribe to workflow events (SignalR requires the connection ID header)
await fetch(`/api/idp/subscribe/${instanceId}`, {
  method: 'POST',
  headers: { 'x-signalr-connection-id': connection.connectionId }
});

// Events will now push automatically!
```

### Option B: HTTP (minimal fallback)

Only workflow start and HITL submission are exposed over HTTP today. Progress, HITL details, and reasoning streams are delivered via SignalR. Use this only if SignalR is unavailable temporarily, then reconnect to SignalR as soon as possible.

```bash
# Start a workflow (returns instanceId, request_id)
curl -X POST http://localhost:7071/api/idp/start \
  -H "Content-Type: application/json" \
  -d '{"pdf_path": "/path/to/doc.pdf", "domain_id": "insurance_claims"}'

# Submit human review when ready
curl -X POST http://localhost:7071/api/idp/hitl/review/abc123 \
  -H "Content-Type: application/json" \
  -d '{"approved": true, "accepted_values": {"field1": "value1"}}'
```

---

## Workflow Steps

| Step | Name | Description | Output Preview |
|------|------|-------------|----------------|
| 1 | `step_01_pdf_extraction` | PDF → Markdown conversion | Page count, character count |
| 2 | `step_02_classification` | Document type detection | Category, confidence score |
| 3a | `step_03_01_azure_extraction` | Azure Content Understanding | Extracted field values |
| 3b | `step_03_02_dspy_extraction` | DSPy LLM extraction | Extracted field values |
| 4 | `step_04_comparison` | Compare Azure vs DSPy | Match %, differing fields |
| 5 | `step_05_human_review` | Human-in-the-loop | Approval decision |
| 6 | `step_06_reasoning_agent` | AI reasoning & summary (agent framework) | Final summary, recommendations |

---

## API Endpoints

### Core Endpoints (HTTP)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/idp/start` | Start new workflow (returns `instanceId`, `request_id`) |
| `POST` | `/api/idp/hitl/review/{instanceId}` | Submit human review decision |

### SignalR Real-Time Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST/GET` | `/api/idp/negotiate` | Get SignalR connection info |
| `POST` | `/api/idp/subscribe/{instanceId}` | Join workflow event group (requires header `x-signalr-connection-id`) |
| `POST` | `/api/idp/unsubscribe/{instanceId}` | Leave workflow event group (requires header `x-signalr-connection-id`) |

### HTTP Polling / Reasoning

Not implemented. Progress, HITL prompts, and reasoning are delivered via SignalR events. If you need polling, add endpoints first; until then, rely on SignalR.

---

## Real-Time Updates with SignalR

**SignalR is the primary (and current) method for real-time updates.** HTTP is only used to start workflows and submit HITL decisions; reconnect to SignalR for progress or reasoning.

### Step 1: Get SignalR Connection

```typescript
// POST /api/idp/negotiate
const response = await fetch('/api/idp/negotiate', { method: 'POST' });
const { url, accessToken } = await response.json();
```

### Step 2: Connect to SignalR

```typescript
import * as signalR from '@microsoft/signalr';

const connection = new signalR.HubConnectionBuilder()
  .withUrl(url, { accessTokenFactory: () => accessToken })
  .withAutomaticReconnect()
  .build();

await connection.start();
```

### Step 3: Subscribe to Workflow Events

```typescript
// Subscribe to a specific workflow instance
await fetch(`/api/idp/subscribe/${instanceId}`, {
  method: 'POST',
  headers: { 'x-signalr-connection-id': connection.connectionId }
});
```

### Step 4: Handle Events

```typescript
// All events have this base structure
interface SignalRMessage {
  target: string;          // Event name (e.g., "stepStarted")
  arguments: [{
    event: string;         // Event type
    instanceId: string;    // Workflow instance
    timestamp: string;     // ISO timestamp
    data: object;          // Event-specific data
  }];
}

connection.on('stepStarted', (message) => {
  const { stepName, stepDisplayName, stepNumber } = message.data;
  console.log(`Step ${stepNumber}: ${stepDisplayName} started`);
});

connection.on('stepCompleted', (message) => {
  const { stepName, stepDisplayName, stepNumber, durationMs, outputPreview } = message.data;
  console.log(`Step ${stepNumber}: ${stepDisplayName} completed in ${durationMs}ms`);
});

connection.on('hitlWaiting', (message) => {
  const { fieldsForReview } = message.data;
  showHitlReviewModal(fieldsForReview);
});

connection.on('hitlApproved', (message) => {
  const { reviewer, feedback } = message.data;
  console.log(`Approved by ${reviewer}: ${feedback}`);
});

connection.on('hitlRejected', (message) => {
  const { reviewer, feedback } = message.data;
  console.log(`Rejected by ${reviewer}: ${feedback}`);
});

connection.on('reasoningChunk', (message) => {
  const { chunkType, content, chunkIndex } = message.data;
  appendReasoningChunk(chunkType, content, chunkIndex);
});

connection.on('workflowCompleted', (message) => {
  const { summary } = message.data;
  console.log('Workflow completed:', summary);
});
```

### Step 5: Cleanup

```typescript
await fetch(`/api/idp/unsubscribe/${instanceId}`, {
  method: 'POST',
  headers: { 'x-signalr-connection-id': connection.connectionId }
});
await connection.stop();
```

### SignalR Event Types

| Event | Description | Key Data |
|-------|-------------|----------|
| `stepStarted` | Step began processing | `stepName`, `stepNumber`, `stepDisplayName` |
| `stepCompleted` | Step finished | `stepName`, `durationMs`, `outputPreview` |
| `stepFailed` | Step errored | `stepName`, `error` |
| `hitlWaiting` | Waiting for human review | `fieldsForReview`, `timeoutSeconds` |
| `hitlApproved` | Human approved | `reviewer`, `feedback` |
| `hitlRejected` | Human rejected | `reviewer`, `feedback` |
| `reasoningChunk` | AI reasoning stream | `chunkType`, `content`, `chunkIndex` |
| `workflowCompleted` | All steps done | `summary` |
| `workflowFailed` | Workflow error | `error` |

---

## HITL Field Selection UI

When Step 5 is waiting for human review, display a field selection interface.

HITL context arrives on the `hitlWaiting` SignalR event payload. Render your review UI from that payload and post the decision to `/api/idp/hitl/review/{instanceId}`.

### Submit Review: `POST /api/idp/hitl/review/{instanceId}`

#### Request Body

```json
{
  "approved": true,
  "feedback": "Verified patient name against ID",
  "reviewer": "reviewer@company.com",
  "accepted_values": {
    "patientName": "John Doe",
    "invoiceDate": "2024-01-15",
    "totalAmount": 1500.00,
    "providerName": "City Hospital"
  },
  "field_selections": [
    {
      "field_name": "patientName",
      "selected_source": "azure",
      "selected_value": "John Doe",
      "azure_value": "John Doe",
      "dspy_value": "John M. Doe",
      "notes": "Azure matched official ID"
    },
    {
      "field_name": "totalAmount",
      "selected_source": "manual",
      "selected_value": 1500.00,
      "notes": "Corrected decimal error"
    }
  ],
  "default_source": "azure"
}
```

#### Field Selection Options

| Source | When to Use |
|--------|-------------|
| `azure` | Select Azure Content Understanding value |
| `dspy` | Select DSPy LLM extraction value |
| `manual` | User enters corrected value |
| `comparison` | Use merged comparison result |

---

## Streaming Reasoning Chat

Step 6 reasoning can be displayed as a real-time chat interface.

### Primary: SignalR Real-Time (Recommended)

```javascript
// Listen for reasoning chunks via SignalR
connection.on('reasoningChunk', (message) => {
  const { chunkType, content, chunkIndex, metadata } = message.data;

  // Append to chat UI
  appendChatBubble({
    type: chunkType,
    content,
    index: chunkIndex,
    metadata
  });
});
```

#### Chunk Types

| Type | Description | UI Display |
|------|-------------|------------|
| `validation_summary` | Validation checks and results | Summary card |
| `field_matching` | How fields were consolidated | List/table |
| `confidence` | Confidence score updates | Badge/alert |
| `summary` | AI reasoning summary | Chat bubble or summary card |
| `final` | Completion signal | Success banner |

### Streaming UI Implementation with SignalR

```jsx
const StreamingChat = ({ connection }) => {
  const [chunks, setChunks] = useState([]);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const handleChunk = (message) => {
      const { chunkType, content, chunkIndex, metadata } = message.data;
      setChunks((prev) => [...prev, {
        index: chunkIndex,
        type: chunkType,
        content,
        metadata,
        timestamp: message.timestamp
      }]);

      if (chunkType === 'final') {
        setIsComplete(true);
      }
    };

    connection.on('reasoningChunk', handleChunk);
    return () => connection.off('reasoningChunk', handleChunk);
  }, [connection]);

  return (
    <div className="chat-container">
      {chunks.map((chunk) => (
        <ChatBubble key={chunk.index} chunk={chunk} />
      ))}
      {!isComplete && <TypingIndicator />}
    </div>
  );
};

const ChatBubble = ({ chunk }) => {
  const classMap = {
    validation_summary: 'validation-card',
    field_matching: 'matching-card',
    confidence: 'confidence-banner',
    summary: 'assistant-message',
    final: 'success-banner'
  };

  return (
    <div className={`chat-bubble ${classMap[chunk.type]}`}>
      <span className="timestamp">{chunk.timestamp}</span>
      <div className="content">{chunk.content}</div>
    </div>
  );
};
```

---

## Complete Flow Example

```typescript
import * as signalR from '@microsoft/signalr';

type Review = {
  approved: boolean;
  accepted_values: Record<string, any>;
  reviewer?: string;
};

class IDPWorkflowClient {
  private baseUrl = 'http://localhost:7071/api'\;
  private connection?: signalR.HubConnection;

  async startWorkflow(pdfPath: string, domainId = 'insurance_claims') {
    const res = await fetch(`${this.baseUrl}/idp/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf_path: pdfPath, domain_id: domainId })
    });
    return res.json(); // { instanceId, request_id }
  }

  async connectSignalR() {
    const negotiate = await fetch(`${this.baseUrl}/idp/negotiate`, { method: 'POST' });
    const { url, accessToken } = await negotiate.json();

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(url, { accessTokenFactory: () => accessToken })
      .withAutomaticReconnect()
      .build();

    await this.connection.start();
    return this.connection;
  }

  async subscribe(instanceId: string) {
    if (!this.connection) throw new Error('Connection not initialized');
    await fetch(`${this.baseUrl}/idp/subscribe/${instanceId}`, {
      method: 'POST',
      headers: { 'x-signalr-connection-id': this.connection.connectionId ?? '' }
    });
  }

  async submitReview(instanceId: string, review: Review) {
    const res = await fetch(`${this.baseUrl}/idp/hitl/review/${instanceId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(review)
    });
    return res.json();
  }
}

async function processDocument(pdfPath: string) {
  const client = new IDPWorkflowClient();
  const { instanceId } = await client.startWorkflow(pdfPath);

  const conn = await client.connectSignalR();
  await client.subscribe(instanceId);

  conn.on('stepStarted', (m) => console.log('Step started:', m.data.stepName));
  conn.on('stepCompleted', (m) => console.log('Step completed:', m.data.stepName));
  conn.on('hitlWaiting', async (m) => {
    console.log('HITL waiting:', m.data.fieldsForReview);
    await client.submitReview(instanceId, {
      approved: true,
      accepted_values: {},
      reviewer: 'auto@example.com'
    });
  });
  conn.on('reasoningChunk', (m) => console.log(`[reasoning] ${m.data.chunkType}: ${m.data.content}`));
  conn.on('workflowCompleted', (m) => console.log('Workflow completed:', m.data.summary));
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `202` | Accepted (workflow started, async processing) |
| `400` | Bad request (missing params, invalid input) |
| `404` | Instance not found |
| `500` | Server error |

### Error Response Format

```json
{
  "error": "Descriptive error message",
  "details": { }
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Missing instanceId` | No ID in URL | Check URL format |
| `Instance not found` | Invalid/expired ID | Verify instanceId |
| `Workflow not yet completed` | Waiting for SignalR completion | Stay connected; wait for `workflowCompleted` |
| `Step not found` | Step not yet run | Wait for step to complete |

---

## TypeScript Interfaces

```typescript
// Workflow Start
interface WorkflowStartRequest {
  pdf_path: string;
  domain_id?: string;
  max_pages?: number;
  options?: {
    reasoning_engine?: 'agent' | 'dspy';
  };
}

interface WorkflowStartResponse {
  message: string;
  instanceId: string;
  request_id: string;
}

// HITL submission
interface HITLReview {
  approved: boolean;
  feedback?: string;
  reviewer?: string;
  accepted_values: Record<string, any>;
  field_selections?: Array<{
    field_name: string;
    selected_source: 'azure' | 'dspy' | 'manual' | 'comparison';
    selected_value: any;
    azure_value?: any;
    dspy_value?: any;
    notes?: string;
  }>;
  default_source?: 'azure' | 'dspy' | 'comparison';
}

// SignalR messages (examples)
interface ReasoningChunkMessage {
  target: 'reasoningChunk';
  arguments: [
    {
      event: 'reasoningChunk';
      instanceId: string;
      timestamp: string;
      data: {
        chunkType: 'validation_summary' | 'field_matching' | 'confidence' | 'summary' | 'final';
        content: string;
        chunkIndex: number;
        metadata?: Record<string, any>;
      };
    }
  ];
}
```

---

For questions or issues, check the server logs or the main README.
