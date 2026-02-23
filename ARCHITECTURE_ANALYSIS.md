# IDP Workflow Architecture Analysis: Session & Data Visibility

## Current State Summary

### ✅ Current Data Isolation

Your system **CURRENTLY ISOLATES data by workflow instance (session)**, but there are important nuances:

---

## 1. Data Visibility: Per-Session Isolation ✓

### How It Works

#### **Workflow Level Isolation**

```
Client A → Start Workflow → InstanceID: workflow-abc-123
Client B → Start Workflow → InstanceID: workflow-xyz-789

Each instance is completely separate:
- Separate orchestration execution
- Separate state management
- Separate data processing
```

#### **SignalR Group-Based Routing**

```python
# From endpoints.py - subscribe_to_workflow()
group_name = f"workflow-{instance_id}"

# SignalR Groups:
- workflow-abc-123  (Only Client A receives messages)
- workflow-xyz-789  (Only Client B receives messages)
```

### ✅ What Users See

- **Own Data Only**: Each user only receives updates for their subscribed workflow instance
- **Automatic Filtering**: SignalR groups enforce this at the message broker level
- **No Frontend Filtering Needed**: The architecture uses server-side routing, not frontend filtering

---

## 2. Data Flow Architecture

### Current Design: Server-Side Isolation (RECOMMENDED)

```
┌─────────────────────────────────────────────────────────────┐
│ ORCHESTRATION (Durable Functions)                           │
│ - Processes workflow steps                                  │
│ - Per instance_id (isolated)                               │
└──────────────────┬──────────────────────────────────────────┘
                   │ Broadcasts via
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ broadcast_signalr Activity                                  │
│ - Builds message with target_user or groupName              │
│ - Sends to SignalR output binding                           │
└──────────────────┬──────────────────────────────────────────┘
                   │ Routes to
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ Azure SignalR Service                                       │
│ - Enforces group membership                                 │
│ - Only subscribed connections receive messages              │
│ - Per-instance isolation guaranteed                         │
└──────────────────┬──────────────────────────────────────────┘
                   │ Delivers to
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ Client (Frontend)                                           │
│ - Receives only own workflow updates                        │
│ - No filtering needed                                       │
└─────────────────────────────────────────────────────────────┘
```

### Data Sent Over SignalR

**Full Data Approach (Current)**:

```python
# From orchestration.py - broadcast
yield _broadcast(context, build_step_completed_message(
    instance_id=context.instance_id,
    completion_event=StepCompletionEvent(
        output_data=step_output,        # ← FULL DATA sent
        output_preview=preview_text     # ← Summary for UI
    )
))
```

**What's Actually Sent**:

- ✅ Full extraction schema
- ✅ Full validation rules
- ✅ Complete comparison data (Azure vs DSPy)
- ✅ All field values for HITL review

**Pros of Full Data Approach**:

- Frontend has complete information without additional API calls
- No round-trips needed for HITL review
- Faster UI rendering
- Less latency on slow networks

**Cons of Full Data Approach**:

- Larger message payloads
- More bandwidth usage
- If data contains sensitive info, all clients in that workflow see it

---

## 3. Security & Session Management

### Current Implementation Status

| Aspect | Current | Need to Add |
|--------|---------|-------------|
| **Instance Isolation** | ✅ Per workflow ID | |
| **SignalR Groups** | ✅ `workflow-{instance_id}` | |
| **User Tracking** | ⚠️ Via `request_id` (optional) | 🔴 User authentication |
| **Access Control** | ⚠️ Instance ID (no auth) | 🔴 Who can access which workflow? |
| **Data Validation** | ✅ Per instance | 🔴 User permission checks |
| **Audit Logging** | ✅ Logs request_id | 🔴 Who did what and when |

### Current Limitations

```python
# From endpoints.py - subscribe_to_workflow()
connection_id = req.headers.get("x-signalr-connection-id")

# ⚠️ ISSUE: No authentication!
# - Anyone with an instanceId can subscribe
# - No user identity check
# - No permission validation
```

---

## 4. Best Practices for Azure Functions + SignalR

### ✅ What You're Doing Right

1. **Durable Functions Orchestration**
   - Excellent for long-running workflows
   - Native SignalR support
   - State management built-in

2. **Group-Based Broadcasting**
   - Scales efficiently
   - Per-instance isolation
   - Reduces message overhead

3. **Activity-Based Broadcasting**
   - Clean separation of concerns
   - Reusable message broadcast logic
   - Handles message transformation

### 🔴 What Needs Improvement

#### 1. **Add User Authentication**

```python
# BEFORE (current)
@app.route(route="idp/subscribe/{instanceId}", methods=["POST"])
async def subscribe_to_workflow(req: func.HttpRequest):
    connection_id = req.headers.get("x-signalr-connection-id")
    # No auth check!

# AFTER (recommended)
@app.route(route="idp/subscribe/{instanceId}", methods=["POST"])
async def subscribe_to_workflow(req: func.HttpRequest):
    # Get authenticated user identity
    user_id = req.headers.get("x-user-id") or extract_from_jwt(req)
    if not user_id:
        return func.HttpResponse("Unauthorized", status_code=401)
    
    # Check if user owns this workflow
    if not user_can_access_workflow(user_id, instance_id):
        return func.HttpResponse("Forbidden", status_code=403)
    
    # Then proceed with group subscription
```

#### 2. **Track User with Workflow**

```python
# BEFORE (current)
WorkflowInitInput:
    pdf_path: str
    domain_id: str
    request_id: str

# AFTER (recommended)
WorkflowInitInput:
    pdf_path: str
    domain_id: str
    request_id: str
    user_id: str          # ← ADD: Who initiated workflow
    created_by: str       # ← ADD: For audit trail
```

#### 3. **Include User in SignalR Messages**

```python
# BEFORE (current)
def build_signalr_message(
    instance_id: str,
    event_type: SignalREvent,
    data: dict[str, Any],
    target_user: Optional[str] = None,  # Not used currently
) -> dict:
    message = {
        "target": event_type.value,
        "arguments": [...]
    }
    if target_user:
        message["userId"] = target_user  # ← Code path exists but unused
    return message

# AFTER (recommended)
# Actually use target_user for user-specific filtering
# Build message with userId to ensure only allowed users receive
```

#### 4. **Store Workflow Metadata**

```python
# MISSING: Should track this somewhere (Table Storage, CosmosDB)
{
    "instanceId": "abc-123",
    "userId": "user@company.com",
    "createdAt": "2024-01-06T10:00:00Z",
    "status": "in_progress",
    "domain": "insurance_claims",
    "permissions": ["user@company.com", "admin@company.com"]  # Who can view
}
```

---

## 5. Recommended Architecture Changes

### Phase 1: Authentication (Critical)

```python
# Add to models.py
class WorkflowInitInput(BaseModel):
    pdf_path: str
    domain_id: str
    request_id: str
    user_id: str = Field(description="User who initiated workflow")
    created_by: str = Field(default_factory=lambda: "system")

# Modify endpoints.py - http_start_workflow
@app.route(route="idp/start", methods=["POST"])
async def http_start_workflow(req: func.HttpRequest, client):
    # 1. Authenticate user
    user_id = extract_user_id(req)
    if not user_id:
        return func.HttpResponse("Unauthorized", status_code=401)
    
    # 2. Include in workflow
    workflow_input = WorkflowInitInput(
        pdf_path=body.get("pdf_path"),
        domain_id=body.get("domain_id"),
        request_id=request_id,
        user_id=user_id  # ← ADD
    )
    
    # 3. Store workflow metadata
    await store_workflow_metadata(instance_id, user_id, body.get("domain_id"))
```

### Phase 2: Access Control

```python
# Add to endpoints.py - subscribe_to_workflow
@app.route(route="idp/subscribe/{instanceId}")
async def subscribe_to_workflow(req: func.HttpRequest):
    instance_id = req.route_params.get("instanceId")
    user_id = extract_user_id(req)
    
    # Check access
    workflow_metadata = await get_workflow_metadata(instance_id)
    if user_id not in workflow_metadata["permissions"]:
        return func.HttpResponse("Forbidden", status_code=403)
    
    group_name = f"workflow-{instance_id}"
    # Now safe to subscribe
```

### Phase 3: Data Optimization

```python
# Choose strategy based on data sensitivity:

# OPTION A: Send minimal data (sensitive info)
output_preview="User data redacted"
output_data={}  # Empty - fetch via separate API if needed

# OPTION B: Send full data (less sensitive)
output_data=complete_extraction_results
output_preview=summary_text

# OPTION C: Send filtered data (recommended hybrid)
output_data={
    "fields": [...]  # Only non-sensitive fields
    "metadata": {}   # Summary only
}
# Full detailed data available via API call if needed
```

---

## 6. Data Flow Decision Matrix

| Scenario | Strategy | Rationale |
|----------|----------|-----------|
| **Public Demo Data** | Send full data over SignalR | Fast, no extra API calls |
| **Sensitive Financials** | Send preview + require API call for details | User auth + encryption in transit |
| **Large Documents** | Send compressed + paginated | Reduce bandwidth, better UX |
| **Multi-User HITL Review** | Send to specific users only | Each reviewer gets only their copy |
| **Audit Compliance** | Log all data access | Track who accessed what |

---

## 7. Implementation Recommendations

### Quick Win (1-2 hours)

- ✅ Add `user_id` to `WorkflowInitInput`
- ✅ Validate user_id in subscribe endpoint
- ✅ Add basic access check (user owns instance)

### Medium Effort (2-4 hours)

- Add metadata table to track workflow ownership
- Add user authentication to all endpoints
- Log workflow access for audit

### Long Term (1-2 days)

- Add role-based access control (RBAC)
- Implement data sensitivity levels
- Add encryption for sensitive fields
- Compliance audit logging

---

## 8. Code Examples

### Add User Tracking to Models

```python
# models.py
class WorkflowInitInput(BaseModel):
    pdf_path: str
    domain_id: str
    request_id: str
    user_id: str = Field(description="User who initiated the workflow")
    viewer_ids: list[str] = Field(
        default_factory=list,
        description="Additional users who can view this workflow"
    )

# Modify orchestration to store it
workflow_input = WorkflowInitInput.model_validate(input_data)
yield context.call_activity(
    "activity_store_workflow_metadata",
    {
        "instance_id": context.instance_id,
        "user_id": workflow_input.user_id,
        "viewers": workflow_input.viewer_ids,
        "domain_id": workflow_input.domain_id,
        "created_at": context.current_utc_datetime.isoformat(),
    }
)
```

### Access Control in Subscribe

```python
# endpoints.py
@app.route(route="idp/subscribe/{instanceId}", methods=["POST"])
async def subscribe_to_workflow(req: func.HttpRequest):
    instance_id = req.route_params.get("instanceId")
    connection_id = req.headers.get("x-signalr-connection-id")
    
    # Get user from auth header
    user_id = extract_user_from_request(req)
    if not user_id:
        return func.HttpResponse(
            json.dumps({"error": "Unauthorized"}),
            status_code=401,
            mimetype="application/json"
        )
    
    # Verify user can access this workflow
    # (Would fetch from metadata storage)
    has_access = await check_workflow_access(instance_id, user_id)
    if not has_access:
        return func.HttpResponse(
            json.dumps({"error": "Forbidden"}),
            status_code=403,
            mimetype="application/json"
        )
    
    # Now subscribe to group
    group_name = f"workflow-{instance_id}"
    # ... rest of group subscription
```

---

## Summary: Architecture Health Check

| Criterion | Status | Notes |
|-----------|--------|-------|
| **Instance Isolation** | ✅ Good | SignalR groups enforce this |
| **Data Segregation** | ✅ Good | Per-workflow data handling |
| **User Authentication** | 🔴 Missing | CRITICAL: Add before production |
| **Access Control** | 🔴 Missing | Anyone can subscribe if they know instanceId |
| **Data Privacy** | ⚠️ Partial | Full data sent without filtering |
| **Scalability** | ✅ Good | Durable Functions + SignalR scales well |
| **Message Broadcasting** | ✅ Good | Group-based approach is efficient |
| **Audit Trail** | ⚠️ Partial | Logging exists, need user tracking |

---

## Bottom Line

**Your current architecture correctly isolates data by workflow instance at the SignalR level.** Frontend does NOT need to filter - the server does it automatically via groups. However, **you're missing user authentication**, which is critical before production use.

**Recommended next steps**:

1. Add user_id to workflow input
2. Add authentication checks in subscribe endpoint
3. Implement access control based on workflow ownership
4. Store workflow metadata in a table
5. Add audit logging
