import React from 'react';
import { useUIStore } from '@/store/uiStore';
import clsx from 'clsx';

const statusConfig = {
  connected: {
    dotColor: 'bg-emerald-400',
    dotGlow: 'shadow-[0_0_6px_2px_rgba(52,211,153,0.3)]',
    label: 'Connected',
    textColor: 'text-emerald-300',
    pulse: false,
  },
  connecting: {
    dotColor: 'bg-amber-400',
    dotGlow: '',
    label: 'Connecting...',
    textColor: 'text-amber-300',
    pulse: true,
  },
  reconnecting: {
    dotColor: 'bg-amber-400',
    dotGlow: '',
    label: 'Reconnecting...',
    textColor: 'text-amber-300',
    pulse: true,
  },
  disconnected: {
    dotColor: 'bg-red-400',
    dotGlow: '',
    label: 'Disconnected',
    textColor: 'text-red-300',
    pulse: false,
  },
  error: {
    dotColor: 'bg-red-400',
    dotGlow: '',
    label: 'Error',
    textColor: 'text-red-300',
    pulse: false,
  },
};

export function ConnectionIndicator() {
  const connectionStatus = useUIStore((state) => state.connectionStatus);
  const config = statusConfig[connectionStatus];

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-dark-800/60 border border-dark-700/40">
      <div className="relative flex items-center justify-center w-2 h-2">
        {config.pulse && (
          <div className={clsx('absolute inset-0 rounded-full animate-ping', config.dotColor, 'opacity-40')} />
        )}
        <div className={clsx('w-2 h-2 rounded-full', config.dotColor, config.dotGlow)} />
      </div>
      <span className={clsx('text-xs font-medium', config.textColor)}>{config.label}</span>
    </div>
  );
}
