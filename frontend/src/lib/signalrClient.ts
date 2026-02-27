import * as signalR from '@microsoft/signalr';
import { apiClient } from './apiClient';
import { useWorkflowStore } from '@/store/workflowStore';
import { useEventsStore } from '@/store/eventsStore';
import { useReasoningStore } from '@/store/reasoningStore';
import { useUIStore } from '@/store/uiStore';
import {
  SignalRMessage,
  StepStartedData,
  StepCompletedData,
  StepFailedData,
  HITLWaitingData,
  HITLApprovedData,
  HITLRejectedData,
  ReasoningChunkData,
  WorkflowCompletedData,
  StepName,
  StepStatus,
} from '@/types';

class SignalRClient {
  private connection: signalR.HubConnection | null = null;
  private isConnecting = false;

  async negotiate(): Promise<{ url: string; accessToken: string }> {
    return await apiClient.negotiate();
  }

  async connect(): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      return;
    }

    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      const { url, accessToken } = await this.negotiate();
      useUIStore.setState({ connectionStatus: 'connecting' });

      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(url, { accessTokenFactory: () => accessToken })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      this.attachEventHandlers();

      await this.connection.start();
      useUIStore.setState({ connectionStatus: 'connected' });
    } catch (error) {
      // Suppress server-timeout errors, only log unexpected failures
      if (error instanceof Error && !/timeout/i.test(error.message)) {
        console.error('SignalR connection error:', error);
      }
      useUIStore.setState({ connectionStatus: 'error' });
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      await this.connection.stop();
    }
    this.connection = null;
    useUIStore.setState({ connectionStatus: 'disconnected' });
  }

  isConnected(): boolean {
    return this.connection?.state === signalR.HubConnectionState.Connected;
  }

  private attachEventHandlers(): void {
    if (!this.connection) return;

    // User-targeted messaging: all messages received are already for this user,
    // no need to filter by instanceId.

    // Step Started
    this.connection.on('stepStarted', (arg: { data: StepStartedData; timestamp: string; instanceId: string }) => {
      console.log('stepStarted received:', arg);
      const { data, timestamp } = arg;
      useWorkflowStore.getState().updateStep(data.stepName as StepName, {
        status: 'running' as StepStatus,
        displayName: data.displayName,
      });
      useWorkflowStore.getState().setCurrentStep(data.stepNumber);
      useEventsStore.getState().addEvent('stepStarted', data, timestamp);
    });

    // Step Completed
    this.connection.on('stepCompleted', (arg: { data: StepCompletedData; timestamp: string; instanceId: string }) => {
      console.log('stepCompleted received:', arg);
      const { data, timestamp } = arg;
      useWorkflowStore.getState().updateStep(data.stepName as StepName, {
        status: 'completed' as StepStatus,
        durationMs: data.durationMs,
        outputPreview: data.outputPreview,
        outputData: data.outputData,
      });
      useEventsStore.getState().addEvent('stepCompleted', data, timestamp);
    });

    // Step Failed
    this.connection.on('stepFailed', (arg: { data: StepFailedData; timestamp: string; instanceId: string }) => {
      console.log('stepFailed received:', arg);
      const { data, timestamp } = arg;
      useWorkflowStore.getState().updateStep(data.stepName as StepName, {
        status: 'failed' as StepStatus,
        error: data.errorMessage,
      });
      useWorkflowStore.getState().setStatus('failed');
      useEventsStore.getState().addEvent('stepFailed', data, timestamp);
      useUIStore.getState().setToast({
        message: `Step failed: ${data.errorMessage}`,
        type: 'error',
      });
    });

    // HITL Waiting
    this.connection.on('hitlWaiting', (arg: { data: HITLWaitingData; timestamp: string; instanceId: string }) => {
      console.log('hitlWaiting received:', arg);
      const { data, timestamp } = arg;
      useWorkflowStore.getState().setHITLWaiting(data);
      useUIStore.getState().setShowHITLModal(true);
      useEventsStore.getState().addEvent('hitlWaiting', data, timestamp);
    });

    // HITL Approved
    this.connection.on('hitlApproved', (arg: { data: HITLApprovedData; timestamp: string; instanceId: string }) => {
      console.log('hitlApproved received:', arg);
      const { data, timestamp } = arg;
      useWorkflowStore.getState().setHITLApproved(data.feedback);
      useUIStore.getState().setShowHITLModal(false);
      useEventsStore.getState().addEvent('hitlApproved', data, timestamp);
    });

    // HITL Rejected
    this.connection.on('hitlRejected', (arg: { data: HITLRejectedData; timestamp: string; instanceId: string }) => {
      console.log('hitlRejected received:', arg);
      const { data, timestamp } = arg;
      useWorkflowStore.getState().setHITLRejected(data.feedback);
      useUIStore.getState().setShowHITLModal(false);
      useEventsStore.getState().addEvent('hitlRejected', data, timestamp);
    });

    // Reasoning Chunk
    this.connection.on('reasoningChunk', (arg: { data: ReasoningChunkData; timestamp: string; instanceId: string }) => {
      console.log('reasoningChunk received:', arg);
      const { data, timestamp } = arg;
      const chunk = {
        ...data,
        timestamp,
      };
      useReasoningStore.getState().addChunk(chunk);

      if (data.chunkType === 'final') {
        useReasoningStore.getState().setComplete(true);
      }

      useEventsStore.getState().addEvent('reasoningChunk', data, timestamp);
    });

    // Workflow Completed
    this.connection.on('workflowCompleted', (arg: { data: WorkflowCompletedData; timestamp: string; instanceId: string }) => {
      console.log('workflowCompleted received:', arg);
      const { data, timestamp } = arg;
      useWorkflowStore.getState().setStatus('completed');
      useEventsStore.getState().addEvent('workflowCompleted', data, timestamp);
      useUIStore.getState().setToast({
        message: 'Workflow completed successfully!',
        type: 'success',
      });
    });

    // Workflow Failed
    this.connection.on('workflowFailed', (arg: { data: { error: string }; timestamp: string; instanceId: string }) => {
      console.log('workflowFailed received:', arg);
      const { data, timestamp } = arg;
      useWorkflowStore.getState().setStatus('failed');
      useEventsStore.getState().addEvent('workflowFailed', data, timestamp);
      useUIStore.getState().setToast({
        message: `Workflow failed: ${data.error}`,
        type: 'error',
      });
    });

    // Connection State Changes — suppress noisy timeout/disconnect errors
    this.connection.onreconnecting((error) => {
      useUIStore.setState({ connectionStatus: 'reconnecting' });
      // Suppress server-timeout errors; only log unexpected reconnect reasons
      if (error && !/timeout/i.test(error.message)) {
        console.log('SignalR reconnecting:', error.message);
      }
    });

    this.connection.onreconnected(async () => {
      useUIStore.setState({ connectionStatus: 'connected' });
    });

    this.connection.onclose((error) => {
      useUIStore.setState({ connectionStatus: 'disconnected' });
      // Suppress server-timeout disconnect errors
      if (error && !/timeout/i.test(error.message)) {
        console.log('SignalR disconnected:', error.message);
      }
    });
  }
}

export const signalRClient = new SignalRClient();

// Step display names for status sync
const STEP_DISPLAY_NAMES: Record<string, string> = {
  step_01_pdf_extraction: 'PDF Extractor',
  step_02_classification: 'Document Classifier',
  step_03_01_azure_extraction: 'Azure Document Intelligence',
  step_03_02_dspy_extraction: 'DSPy LLM Extractor',
  step_04_comparison: 'Field Comparator',
  step_05_human_review: 'Human Review',
  step_06_reasoning_agent: 'Reasoning Agent',
};

// Ordered steps for inferring completed steps from custom status
const STEP_ORDER: StepName[] = [
  'step_01_pdf_extraction',
  'step_02_classification',
  'step_03_01_azure_extraction',
  'step_03_02_dspy_extraction',
  'step_04_comparison',
  'step_05_human_review',
  'step_06_reasoning_agent',
];

/**
 * Sync workflow state from the backend status endpoint.
 * Catches up on any events missed before SignalR connection.
 */
async function syncWorkflowStatus(instanceId: string): Promise<void> {
  try {
    const status = await apiClient.getWorkflowStatus(instanceId);
    const customStatus = status.customStatus || '';

    // Infer which step is currently running from customStatus string
    // Format: "[request_id] Step N: description"
    const stepMatch = customStatus.match(/Step (\d+)/);
    const currentStepNum = stepMatch ? parseInt(stepMatch[1]) : 0;

    // Mark steps before the current one as completed (they must have finished)
    const store = useWorkflowStore.getState();

    // Map step numbers to step names (accounting for parallel steps 3a/3b)
    const stepNumToNames: Record<number, StepName[]> = {
      1: ['step_01_pdf_extraction'],
      2: ['step_02_classification'],
      3: ['step_03_01_azure_extraction', 'step_03_02_dspy_extraction'],
      4: ['step_04_comparison'],
      5: ['step_05_human_review'],
      6: ['step_06_reasoning_agent'],
    };

    for (let n = 1; n < currentStepNum; n++) {
      const names = stepNumToNames[n] || [];
      for (const name of names) {
        const existing = store.steps.get(name);
        if (!existing || existing.status === 'pending') {
          store.updateStep(name, {
            status: 'completed' as StepStatus,
            displayName: STEP_DISPLAY_NAMES[name] || name,
          });
        }
      }
    }

    // Mark current step as running if not already tracked
    const currentNames = stepNumToNames[currentStepNum] || [];
    for (const name of currentNames) {
      const existing = store.steps.get(name);
      if (!existing || existing.status === 'pending') {
        store.updateStep(name, {
          status: 'running' as StepStatus,
          displayName: STEP_DISPLAY_NAMES[name] || name,
        });
      }
    }

    // If workflow completed, apply final output
    if (status.runtimeStatus === 'Completed' && status.output) {
      store.setStatus('completed');
    } else if (status.runtimeStatus === 'Failed') {
      store.setStatus('failed');
    } else {
      store.setStatus('running');
    }

    console.log(`Status synced: step ${currentStepNum}, status=${status.runtimeStatus}`);
  } catch (error) {
    console.warn('Failed to sync workflow status (non-fatal):', error);
  }
}

/**
 * Hook for SignalR operations.
 * Uses user-targeted messaging — no subscribe/unsubscribe needed.
 */
export function useSignalR() {
  return {
    connect: () => signalRClient.connect(),
    disconnect: () => signalRClient.disconnect(),
    isConnected: () => signalRClient.isConnected(),
    syncStatus: (instanceId: string) => syncWorkflowStatus(instanceId),
  };
}
