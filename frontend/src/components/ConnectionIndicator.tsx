import React from 'react';
import { useUIStore } from '@/store/uiStore';
import clsx from 'clsx';

const statusConfig = {
  connected: { icon: '🟢', label: 'Connected', color: 'text-green-400' },
  connecting: { icon: '🟡', label: 'Connecting...', color: 'text-yellow-400 animate-pulse' },
  reconnecting: { icon: '🟡', label: 'Reconnecting...', color: 'text-yellow-400 animate-pulse' },
  disconnected: { icon: '🔴', label: 'Disconnected', color: 'text-red-400' },
  error: { icon: '🔴', label: 'Connection Error', color: 'text-red-400' },
};

export function ConnectionIndicator() {
  const connectionStatus = useUIStore((state) => state.connectionStatus);
  const config = statusConfig[connectionStatus];

  return (
    <div className="flex items-center gap-2">
      <span className={clsx('text-lg', config.color)}>{config.icon}</span>
      <span className={clsx('text-sm font-medium', config.color)}>{config.label}</span>
    </div>
  );
}
