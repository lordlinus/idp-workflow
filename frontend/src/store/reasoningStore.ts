import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { ReasoningChunk, ReasoningChunkType } from '@/types';

interface ReasoningState {
  chunks: ReasoningChunk[];
  isComplete: boolean;
  addChunk: (chunk: ReasoningChunk) => void;
  clearChunks: () => void;
  setComplete: (complete: boolean) => void;
  getChunksByType: (type: ReasoningChunkType) => ReasoningChunk[];
}

export const useReasoningStore = create<ReasoningState>()(
  immer((set, get) => ({
    chunks: [],
    isComplete: false,

    addChunk: (chunk: ReasoningChunk) => {
      set((state) => {
        state.chunks.push(chunk);
      });
    },

    clearChunks: () => {
      set((state) => {
        state.chunks = [];
        state.isComplete = false;
      });
    },

    setComplete: (complete: boolean) => {
      set((state) => {
        state.isComplete = complete;
      });
    },

    getChunksByType: (type: ReasoningChunkType) => {
      return get().chunks.filter((c) => c.chunkType === type);
    },
  }))
);
