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
  private currentInstanceId: string | null = null;
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
      console.error('SignalR connection error:', error);
      useUIStore.setState({ connectionStatus: 'error' });
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  async subscribe(instanceId: string): Promise<void> {
    if (!this.connection) {
      await this.connect();
    }

    if (!this.connection) {
      throw new Error('Failed to establish SignalR connection');
    }

    this.currentInstanceId = instanceId;

    try {
      await apiClient.subscribe(instanceId, this.connection.connectionId || '');
    } catch (error) {
      console.error('Failed to subscribe to workflow:', error);
      throw error;
    }
  }

  async unsubscribe(): Promise<void> {
    if (!this.connection || !this.currentInstanceId) {
      return;
    }

    try {
      await apiClient.unsubscribe(this.currentInstanceId, this.connection.connectionId || '');
      this.currentInstanceId = null;
    } catch (error) {
      console.error('Failed to unsubscribe from workflow:', error);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      await this.connection.stop();
    }
    this.connection = null;
    this.currentInstanceId = null;
    useUIStore.setState({ connectionStatus: 'disconnected' });
  }

  isConnected(): boolean {
    return this.connection?.state === signalR.HubConnectionState.Connected;
  }

  private attachEventHandlers(): void {
    if (!this.connection) return;

    // Helper to filter events by current instance
    const isCurrentInstance = (instanceId: string): boolean => {
      return this.currentInstanceId === instanceId;
    };

    // Step Started - SignalR passes arguments directly, not wrapped in message object
    this.connection.on('stepStarted', (arg: { data: StepStartedData; timestamp: string; instanceId: string }) => {
      console.log('stepStarted received:', arg);
      if (!isCurrentInstance(arg.instanceId)) return;
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
      if (!isCurrentInstance(arg.instanceId)) return;
      const { data, timestamp } = arg;
      useWorkflowStore.getState().updateStep(data.stepName as StepName, {
        status: 'completed' as StepStatus,
        durationMs: data.durationMs,
        outputPreview: data.outputPreview,
        outputData: data.outputData, // Store full output data for detail view
      });
      useEventsStore.getState().addEvent('stepCompleted', data, timestamp);
    });

    // Step Failed
    this.connection.on('stepFailed', (arg: { data: StepFailedData; timestamp: string; instanceId: string }) => {
      console.log('stepFailed received:', arg);
      if (!isCurrentInstance(arg.instanceId)) return;
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
      if (!isCurrentInstance(arg.instanceId)) return;
      const { data, timestamp } = arg;
      useWorkflowStore.getState().setHITLWaiting(data);
      useUIStore.getState().setShowHITLModal(true);
      useEventsStore.getState().addEvent('hitlWaiting', data, timestamp);
    });

    // HITL Approved
    this.connection.on('hitlApproved', (arg: { data: HITLApprovedData; timestamp: string; instanceId: string }) => {
      console.log('hitlApproved received:', arg);
      if (!isCurrentInstance(arg.instanceId)) return;
      const { data, timestamp } = arg;
      useWorkflowStore.getState().setHITLApproved(data.feedback);
      useUIStore.getState().setShowHITLModal(false);
      useEventsStore.getState().addEvent('hitlApproved', data, timestamp);
    });

    // HITL Rejected
    this.connection.on('hitlRejected', (arg: { data: HITLRejectedData; timestamp: string; instanceId: string }) => {
      console.log('hitlRejected received:', arg);
      if (!isCurrentInstance(arg.instanceId)) return;
      const { data, timestamp } = arg;
      useWorkflowStore.getState().setHITLRejected(data.feedback);
      useUIStore.getState().setShowHITLModal(false);
      useEventsStore.getState().addEvent('hitlRejected', data, timestamp);
    });

    // Reasoning Chunk
    this.connection.on('reasoningChunk', (arg: { data: ReasoningChunkData; timestamp: string; instanceId: string }) => {
      console.log('reasoningChunk received:', arg);
      if (!isCurrentInstance(arg.instanceId)) return;
      const { data, timestamp } = arg;
      const chunk = {
        ...data,
        timestamp,
      };
      useReasoningStore.getState().addChunk(chunk);
      useUIStore.getState().setShowReasoningPanel(true);

      if (data.chunkType === 'final') {
        useReasoningStore.getState().setComplete(true);
      }

      useEventsStore.getState().addEvent('reasoningChunk', data, timestamp);
    });

    // Workflow Completed
    this.connection.on('workflowCompleted', (arg: { data: WorkflowCompletedData; timestamp: string; instanceId: string }) => {
      console.log('workflowCompleted received:', arg);
      if (!isCurrentInstance(arg.instanceId)) return;
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
      if (!isCurrentInstance(arg.instanceId)) return;
      const { data, timestamp } = arg;
      useWorkflowStore.getState().setStatus('failed');
      useEventsStore.getState().addEvent('workflowFailed', data, timestamp);
      useUIStore.getState().setToast({
        message: `Workflow failed: ${data.error}`,
        type: 'error',
      });
    });

    // Connection State Changes
    this.connection.onreconnecting(() => {
      useUIStore.setState({ connectionStatus: 'reconnecting' });
      console.log('SignalR reconnecting...');
    });

    this.connection.onreconnected(async () => {
      useUIStore.setState({ connectionStatus: 'connected' });
      if (this.currentInstanceId) {
        await this.subscribe(this.currentInstanceId);
      }
      console.log('SignalR reconnected');
    });

    this.connection.onclose(() => {
      useUIStore.setState({ connectionStatus: 'disconnected' });
      console.log('SignalR disconnected');
    });
  }
}

export const signalRClient = new SignalRClient();

/**
 * Hook for SignalR operations
 */
export function useSignalR() {
  return {
    connect: () => signalRClient.connect(),
    disconnect: () => signalRClient.disconnect(),
    subscribe: (instanceId: string) => signalRClient.subscribe(instanceId),
    unsubscribe: () => signalRClient.unsubscribe(),
    isConnected: () => signalRClient.isConnected(),
  };
}
