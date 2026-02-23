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
  azureValue: string | number | null;
  dspyValue: string | number | null;
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
  selected_value: string | number | null;
  azure_value?: string | number | null;
  dspy_value?: string | number | null;
  notes?: string;
}

export interface HITLReviewSubmission {
  approved: boolean;
  feedback?: string;
  reviewer?: string;
  accepted_values: Record<string, string | number | null>;
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

// Reasoning Types
export type ReasoningChunkType = 'validation_summary' | 'field_matching' | 'confidence' | 'summary' | 'final';

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

// API Types
export interface UploadResponse {
  blobPath: string;
  blobUri: string;
  fileName: string;
}

export interface StartWorkflowRequest {
  pdf_path: string;
  domain_id: DomainId;
  max_pages?: number;
}

export interface StartWorkflowResponse {
  message: string;
  instanceId: string;
  request_id: string;
}

export interface HistoryItem {
  instanceId: string;
  domain_id: DomainId;
  status: 'Completed' | 'Pending' | 'Failed';
  input: {
    pdf_path: string;
    domain_id: DomainId;
  };
  output?: {
    summary?: {
      document_type: string;
      confidence_score: number;
    };
  };
  createdTime: string;
  lastUpdatedTime: string;
}

export interface HistoryResponse {
  instances: HistoryItem[];
  nextPageLink?: string;
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
