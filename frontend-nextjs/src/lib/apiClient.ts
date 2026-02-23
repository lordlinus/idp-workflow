import axios, { AxiosInstance } from 'axios';
import {
  UploadResponse,
  StartWorkflowRequest,
  StartWorkflowResponse,
  HistoryResponse,
  HITLReviewSubmission,
  DomainId,
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:7071/api';

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
    const response = await this.client.post<StartWorkflowResponse>('/idp/start', request);
    return response.data;
  }

  /**
   * Get workflow history with filtering
   */
  async getHistory(limit: number = 20, status?: string): Promise<HistoryResponse> {
    const params: Record<string, unknown> = { limit };
    if (status) {
      params.status = status;
    }

    const response = await this.client.get<HistoryResponse>('/idp/history', { params });
    return response.data;
  }

  /**
   * Get SignalR negotiation token
   */
  async negotiate(): Promise<{ url: string; accessToken: string }> {
    const response = await this.client.post<{ url: string; accessToken: string }>('/idp/negotiate');
    return response.data;
  }

  /**
   * Subscribe to workflow updates
   */
  async subscribe(instanceId: string, connectionId: string): Promise<void> {
    await this.client.post(`/idp/subscribe/${instanceId}`, null, {
      headers: { 'x-signalr-connection-id': connectionId },
    });
  }

  /**
   * Unsubscribe from workflow updates
   */
  async unsubscribe(instanceId: string, connectionId: string): Promise<void> {
    await this.client.post(`/idp/unsubscribe/${instanceId}`, null, {
      headers: { 'x-signalr-connection-id': connectionId },
    });
  }

  /**
   * Submit HITL review
   */
  async submitHITLReview(instanceId: string, review: HITLReviewSubmission): Promise<void> {
    await this.client.post(`/idp/hitl/review/${instanceId}`, review);
  }
}

export const apiClient = new APIClient();
