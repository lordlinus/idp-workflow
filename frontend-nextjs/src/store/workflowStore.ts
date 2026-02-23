import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import {
  WorkflowInstance,
  StepName,
  Step,
  StepStatus,
  DomainId,
  HITLWaitingData,
  FieldComparison,
} from '@/types';

// Enable Immer's MapSet plugin for Map/Set support
enableMapSet();

interface WorkflowState {
  // Core workflow data
  instanceId: string | null;
  domain_id: DomainId | null;
  status: 'idle' | 'initializing' | 'running' | 'completed' | 'failed';
  currentStep: number;
  steps: Map<StepName, Step>;
  startedAt: string | null;

  // UI state
  selectedStep: StepName | null;
  sidebarCollapsed: boolean;

  // HITL state
  hitlWaiting: HITLWaitingData | null;
  hitlStatus: 'waiting' | 'approved' | 'rejected' | null;
  hitlFeedback: string | null;

  // Actions
  initializeWorkflow: (instanceId: string, domain_id: DomainId) => void;
  setStatus: (status: WorkflowState['status']) => void;
  updateStep: (stepName: StepName, updates: Partial<Step>) => void;
  setCurrentStep: (stepNumber: number) => void;
  selectStep: (stepName: StepName | null) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setHITLWaiting: (data: HITLWaitingData) => void;
  setHITLApproved: (feedback?: string) => void;
  setHITLRejected: (feedback?: string) => void;
  reset: () => void;
}

const initialState = {
  instanceId: null,
  domain_id: null,
  status: 'idle' as const,
  currentStep: 0,
  steps: new Map<StepName, Step>(),
  startedAt: null,
  selectedStep: null,
  sidebarCollapsed: true,
  hitlWaiting: null,
  hitlStatus: null,
  hitlFeedback: null,
};

export const useWorkflowStore = create<WorkflowState>()(
  immer((set) => ({
    ...initialState,

    initializeWorkflow: (instanceId: string, domain_id: DomainId) => {
      set((state) => {
        state.instanceId = instanceId;
        state.domain_id = domain_id;
        state.status = 'initializing';
        state.startedAt = new Date().toISOString();
      });
    },

    setStatus: (status: WorkflowState['status']) => {
      set((state) => {
        state.status = status;
      });
    },

    updateStep: (stepName: StepName, updates: Partial<Step>) => {
      set((state) => {
        const existingStep = state.steps.get(stepName);
        if (existingStep) {
          Object.assign(existingStep, updates);
        } else {
          const stepNumber = parseInt(stepName.split('_')[1]);
          state.steps.set(stepName, {
            name: stepName,
            number: stepNumber,
            displayName: updates.displayName || stepName,
            status: updates.status || 'pending',
            ...updates,
          });
        }
      });
    },

    setCurrentStep: (stepNumber: number) => {
      set((state) => {
        state.currentStep = stepNumber;
      });
    },

    selectStep: (stepName: StepName | null) => {
      set((state) => {
        state.selectedStep = stepName;
      });
    },

    toggleSidebar: () => {
      set((state) => {
        state.sidebarCollapsed = !state.sidebarCollapsed;
      });
    },

    setSidebarCollapsed: (collapsed: boolean) => {
      set((state) => {
        state.sidebarCollapsed = collapsed;
      });
    },

    setHITLWaiting: (data: HITLWaitingData) => {
      set((state) => {
        state.hitlWaiting = data;
        state.hitlStatus = 'waiting';
        state.status = 'running';
      });
    },

    setHITLApproved: (feedback?: string) => {
      set((state) => {
        state.hitlStatus = 'approved';
        state.hitlFeedback = feedback || null;
        state.hitlWaiting = null;
      });
    },

    setHITLRejected: (feedback?: string) => {
      set((state) => {
        state.hitlStatus = 'rejected';
        state.hitlFeedback = feedback || null;
        state.hitlWaiting = null;
      });
    },

    reset: () => {
      set(() => ({ ...initialState }));
    },
  }))
);
