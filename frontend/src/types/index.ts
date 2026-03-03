// Workflow and Step Types
export type DomainId = 'home_loan' | 'insurance_claims' | 'small_business_lending' | 'trade_finance';

export type StepName =
  | 'step_01_pdf_extraction'
  | 'step_02_classification'
  | 'step_03_01_azure_extraction'
  | 'step_03_02_dspy_extraction'
  | 'step_04_comparison'
  | 'step_05_human_review'
  | 'step_06_reasoning_agent';

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Step {
  name: StepName;
  number: number;
  displayName: string;
  status: StepStatus;
  durationMs?: number;
  outputPreview?: string;
  outputData?: Record<string, unknown>; // Full output data from step execution
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface WorkflowInstance {
  instanceId: string;
  domain_id: DomainId;
  startedAt: string;
  status: 'running' | 'completed' | 'failed' | 'pending';
  currentStep: number;
  steps: Map<StepName, Step>;
}

// SignalR Types
export interface SignalRMessage<T = unknown> {
  target: string;
  arguments: [
    {
      event: string;
      instanceId: string;
      timestamp: string;
      data: T;
    }
  ];
}

export type SignalREventType =
  | 'stepStarted'
  | 'stepCompleted'
  | 'stepFailed'
  | 'stepProgress'
  | 'hitlWaiting'
  | 'hitlApproved'
  | 'hitlRejected'
  | 'reasoningChunk'
  | 'workflowCompleted'
  | 'workflowFailed';

// Step Events
export interface StepStartedData {
  stepName: StepName;
  displayName: string;
  stepNumber: number;
}

export interface StepCompletedData {
  stepName: StepName;
  displayName: string;
  stepNumber: number;
  status: 'completed';
  durationMs: number;
  outputPreview: string;
  outputData?: Record<string, unknown>;
}

export interface StepFailedData {
  stepName: StepName;
  displayName: string;
  stepNumber: number;
  errorMessage: string;
}

// HITL Types
export interface FieldComparison {
  fieldName: string;
  azureValue: unknown;
  dspyValue: unknown;
  match: boolean;
  confidence?: number;
  needsReview: boolean;
}

export interface HITLWaitingData {
  fieldsForReview: string[];
  timeoutSeconds: number;
  comparisonSummary: {
    totalFields: number;
    matchingFields: number;
    differingFields: number;
    matchPercentage: number;
  };
  fieldComparisons: FieldComparison[];
  reviewUrl: string;
}

export interface FieldSelection {
  field_name: string;
  selected_source: 'azure' | 'dspy' | 'manual';
  selected_value: unknown;
  azure_value?: unknown;
  dspy_value?: unknown;
  notes?: string;
}

export interface HITLReviewSubmission {
  approved: boolean;
  feedback?: string;
  reviewer?: string;
  accepted_values: Record<string, unknown>;
  field_selections: FieldSelection[];
  default_source?: 'azure' | 'dspy' | 'comparison';
}

export interface HITLApprovedData {
  reviewer: string;
  feedback?: string;
  approved: true;
}

export interface HITLRejectedData {
  reviewer: string;
  feedback?: string;
  approved: false;
}

// Step Progress (intermediate updates from within activities)
export interface StepProgressData {
  stepName: StepName;
  message: string;
  progress?: number;           // 0-100 percentage (optional)
  detail?: string;             // Extra detail line
  subStep?: string;            // e.g. "page_classification", "analyzer_creation"
  metadata?: Record<string, unknown>;
}

// Reasoning Types
export type ReasoningChunkType = 'tool_call' | 'tool_result' | 'validation_summary' | 'field_matching' | 'confidence' | 'summary' | 'final' | 'error';

export interface ReasoningChunkData {
  chunkType: ReasoningChunkType;
  content: string;
  chunkIndex: number;
  metadata?: Record<string, unknown>;
}

export interface ReasoningChunk extends ReasoningChunkData {
  timestamp: string;
}

// Workflow Completion
export interface WorkflowCompletedData {
  summary: {
    document_type: string;
    confidence_score: number;
    total_fields: number;
    matching_fields: number;
  };
  resultUrl: string;
}

// LLM Provider Types
export type LLMProvider = 'azure_openai' | 'claude' | 'azure_ai_models';

export interface WorkflowOptions {
  llm_provider?: LLMProvider;
  llm_model?: string;
  llm_temperature?: number;
  [key: string]: unknown;
}

// Extraction Schema Types
export interface ExtractionFieldDef {
  type: 'string' | 'number' | 'integer' | 'date' | 'boolean' | 'array' | 'object';
  description?: string;
  method?: string;
  category?: string;
  items?: ExtractionFieldDef;
  properties?: Record<string, ExtractionFieldDef>;
}

export interface ExtractionSchema {
  fieldSchema: {
    fields: Record<string, ExtractionFieldDef>;
  };
  baseAnalyzerId?: string;
  scenario?: string;
  description?: string;
  config?: Record<string, unknown>;
  models?: Record<string, string>;
}

export interface ClassificationCategory {
  name: string;
  'description/Note'?: string;
  description?: string;
  pattern_keywords?: string[];
  required?: boolean;
  extraction_priority?: number;
}

// API Types
export interface UploadResponse {
  blobPath: string;
  blobUri: string;
  fileName: string;
}

export interface StartWorkflowRequest {
  pdf_path: string;
  domain_id: DomainId | string;
  max_pages?: number;
  options?: WorkflowOptions;
  custom_extraction_schema?: ExtractionSchema;
  custom_classification_categories?: ClassificationCategory[];
}

export interface StartWorkflowResponse {
  message: string;
  instanceId: string;
  request_id: string;
}

export interface SchemaValidationResponse {
  valid: boolean;
  errors?: string[];
  fields?: Array<{ name: string; type: string; description: string }>;
  field_count?: number;
}

export interface LLMProviderInfo {
  id: LLMProvider;
  name: string;
  description: string;
  requires_env: string[];
  shorthand_models?: Record<string, string>;
}

export interface LLMProvidersResponse {
  providers: LLMProviderInfo[];
}

export interface WorkflowStatusResponse {
  instanceId: string;
  runtimeStatus: string;
  customStatus: string | null;
  output: Record<string, unknown> | null;
  createdTime: string | null;
  lastUpdatedTime: string | null;
}

// Event Log
export interface EventLogEntry {
  id: string;
  type: SignalREventType;
  timestamp: string;
  data: unknown;
}

// Connection Status
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting' | 'error';
