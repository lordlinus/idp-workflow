import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './apiClient';
import {
  UploadResponse,
  StartWorkflowRequest,
  StartWorkflowResponse,
  HistoryResponse,
  HITLReviewSubmission,
  DomainId,
} from '@/types';

// Query Keys
export const queryKeys = {
  all: ['idp'],
  history: () => [...queryKeys.all, 'history'],
  historyWithFilter: (limit: number, status?: string) => [
    ...queryKeys.history(),
    { limit, status },
  ],
};

/**
 * Upload PDF file to Azure Blob Storage
 */
export function useUploadPDF() {
  return useMutation({
    mutationFn: async (file: File): Promise<UploadResponse> => {
      return apiClient.uploadPDF(file);
    },
  });
}

/**
 * Use demo document for a specific domain
 */
export function useDemoDocument() {
  return useMutation({
    mutationFn: async (domainId: DomainId): Promise<UploadResponse & { domain_id: string }> => {
      return apiClient.useDemoDocument(domainId);
    },
  });
}

/**
 * Start a new workflow
 */
export function useStartWorkflow() {
  return useMutation({
    mutationFn: async (request: StartWorkflowRequest): Promise<StartWorkflowResponse> => {
      return apiClient.startWorkflow(request);
    },
  });
}

/**
 * Get workflow history
 */
export function useHistory(limit: number = 20, status?: string, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.historyWithFilter(limit, status),
    queryFn: async (): Promise<HistoryResponse> => {
      return apiClient.getHistory(limit, status);
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
  });
}

/**
 * Submit HITL review
 */
export function useSubmitHITLReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      instanceId,
      review,
    }: {
      instanceId: string;
      review: HITLReviewSubmission;
    }): Promise<void> => {
      return apiClient.submitHITLReview(instanceId, review);
    },
    onSuccess: () => {
      // Invalidate history on successful HITL submission
      queryClient.invalidateQueries({ queryKey: queryKeys.history() });
    },
  });
}
