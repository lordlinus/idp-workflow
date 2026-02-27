import React from 'react';
import clsx from 'clsx';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

const bgColors = {
  success: 'bg-green-500/20 border-green-500/50',
  error: 'bg-red-500/20 border-red-500/50',
  info: 'bg-blue-500/20 border-blue-500/50',
};

const textColors = {
  success: 'text-green-300',
  error: 'text-red-300',
  info: 'text-blue-300',
};

const icons = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
};

export function Toast({ message, type, onClose }: ToastProps) {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={clsx(
        'fixed bottom-6 right-6 flex items-center gap-3 rounded-lg border px-4 py-3 backdrop-blur-sm animate-slide-in',
        bgColors[type],
        textColors[type]
      )}
      role="alert"
    >
      <span className="text-xl">{icons[type]}</span>
      <p className="font-medium">{message}</p>
    </div>
  );
}
