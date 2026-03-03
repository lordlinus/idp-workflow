import axios, { AxiosInstance } from 'axios';
import {
  UploadResponse,
  StartWorkflowRequest,
  StartWorkflowResponse,
  WorkflowStatusResponse,
  HITLReviewSubmission,
  DomainId,
  ExtractionSchema,
  SchemaValidationResponse,
  LLMProvidersResponse,
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

/**
 * Get or create a persistent user ID for SignalR user-targeted messaging.
 * Stored in sessionStorage so it persists across page refreshes within a tab.
 */
function getUserId(): string {
  if (typeof window === 'undefined') return '';
  let userId = sessionStorage.getItem('userId');
  if (!userId) {
    userId = 'user-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    sessionStorage.setItem('userId', userId);
  }
  return userId;
}

class APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get the current user ID for SignalR targeting.
   */
  getUserId(): string {
    return getUserId();
  }

  /**
   * Upload PDF file to Azure Blob Storage
   */
  async uploadPDF(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post<UploadResponse>('/idp/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return response.data;
  }

  /**
   * Use demo document for a specific domain
   */
  async useDemoDocument(domainId: DomainId): Promise<UploadResponse & { domain_id: string }> {
    const response = await this.client.post<UploadResponse & { domain_id: string }>(
      `/idp/demo/${domainId}`
    );
    return response.data;
  }

  /**
   * Start a new workflow
   */
  async startWorkflow(request: StartWorkflowRequest): Promise<StartWorkflowResponse> {
    const response = await this.client.post<StartWorkflowResponse>('/idp/start', request, {
      headers: { 'x-user-id': getUserId() },
    });
    return response.data;
  }

  /**
   * Get SignalR connection info (user-targeted).
   * Uses "/idp/signalr-connect" instead of "negotiate" because SWA intercepts
   * routes containing "negotiate" and injects its own auth provider.
   */
  async negotiate(): Promise<{ url: string; accessToken: string }> {
    const response = await this.client.post<{ url: string; accessToken: string }>('/idp/signalr-connect', null, {
      headers: { 'x-user-id': getUserId() },
    });
    return response.data;
  }

  /**
   * Submit HITL review
   */
  async submitHITLReview(instanceId: string, review: HITLReviewSubmission): Promise<void> {
    await this.client.post(`/idp/hitl/review/${instanceId}`, review);
  }

  /**
   * Get current workflow status (for catching up after SignalR connection)
   */
  async getWorkflowStatus(instanceId: string): Promise<WorkflowStatusResponse> {
    const response = await this.client.get<WorkflowStatusResponse>(
      `/idp/workflow/${instanceId}/status`
    );
    return response.data;
  }

  /**
   * Terminate a running workflow orchestration.
   * Used before starting a new workflow to prevent stale events.
   */
  async terminateWorkflow(instanceId: string, reason?: string): Promise<void> {
    await this.client.post(`/idp/workflow/${instanceId}/terminate`, {
      reason: reason || 'New workflow started by user',
    });
  }

  /**
   * Get domain configuration including extraction schema
   */
  async getDomainConfig(domainId: DomainId): Promise<Record<string, unknown>> {
    const response = await this.client.get<Record<string, unknown>>(
      `/idp/domains/${domainId}/config`
    );
    return response.data;
  }

  /**
   * Validate an ad-hoc extraction schema
   */
  async validateSchema(schema: ExtractionSchema): Promise<SchemaValidationResponse> {
    const response = await this.client.post<SchemaValidationResponse>(
      '/idp/validate-schema',
      { schema }
    );
    return response.data;
  }

  /**
   * Get available LLM providers and models
   */
  async getLLMProviders(): Promise<LLMProvidersResponse> {
    const response = await this.client.get<LLMProvidersResponse>('/idp/llm-providers');
    return response.data;
  }

  /**
   * Build URL to serve a document PDF via the backend proxy.
   */
  getDocumentUrl(blobPath: string): string {
    return `${API_BASE_URL}/idp/document?path=${encodeURIComponent(blobPath)}`;
  }
}

export const apiClient = new APIClient();
