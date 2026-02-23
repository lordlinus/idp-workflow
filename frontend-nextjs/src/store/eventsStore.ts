import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { EventLogEntry, SignalREventType } from '@/types';

interface EventsState {
  events: EventLogEntry[];
  addEvent: (type: SignalREventType, data: unknown, timestamp: string) => void;
  clearEvents: () => void;
  getEventsByType: (type: SignalREventType) => EventLogEntry[];
}

let eventCounter = 0;

export const useEventsStore = create<EventsState>()(
  immer((set, get) => ({
    events: [],

    addEvent: (type: SignalREventType, data: unknown, timestamp: string) => {
      set((state) => {
        state.events.push({
          id: `event-${++eventCounter}`,
          type,
          timestamp,
          data,
        });
        // Keep only last 100 events in memory
        if (state.events.length > 100) {
          state.events.splice(0, 1);
        }
      });
    },

    clearEvents: () => {
      set((state) => {
        state.events = [];
        eventCounter = 0;
      });
    },

    getEventsByType: (type: SignalREventType) => {
      return get().events.filter((e) => e.type === type);
    },
  }))
);
