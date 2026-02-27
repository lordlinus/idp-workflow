import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './apiClient';
import {
  UploadResponse,
  StartWorkflowRequest,
  StartWorkflowResponse,
  HITLReviewSubmission,
  DomainId,
  ExtractionSchema,
  SchemaValidationResponse,
  LLMProvidersResponse,
} from '@/types';

// Query Keys
export const queryKeys = {
  all: ['idp'],
  llmProviders: ['idp', 'llm-providers'],
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
 * Validate an ad-hoc extraction schema
 */
export function useValidateSchema() {
  return useMutation({
    mutationFn: async (schema: ExtractionSchema): Promise<SchemaValidationResponse> => {
      return apiClient.validateSchema(schema);
    },
  });
}

/**
 * Get available LLM providers and models
 */
export function useLLMProviders() {
  return useQuery<LLMProvidersResponse>({
    queryKey: queryKeys.llmProviders,
    queryFn: () => apiClient.getLLMProviders(),
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
      queryClient.invalidateQueries({ queryKey: queryKeys.all });
    },
  });
}
