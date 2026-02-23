import { create } from 'zustand';
import { ConnectionStatus } from '@/types';

interface UIState {
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;
  showHITLModal: boolean;
  setShowHITLModal: (show: boolean) => void;
  showReasoningPanel: boolean;
  setShowReasoningPanel: (show: boolean) => void;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  setToast: (toast: UIState['toast']) => void;
  clearToast: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  connectionStatus: 'disconnected',
  setConnectionStatus: (status: ConnectionStatus) => set({ connectionStatus: status }),

  showHITLModal: false,
  setShowHITLModal: (show: boolean) => set({ showHITLModal: show }),

  showReasoningPanel: false,
  setShowReasoningPanel: (show: boolean) => set({ showReasoningPanel: show }),

  toast: null,
  setToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: null }),
}));
