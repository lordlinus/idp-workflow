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
        'fixed top-4 left-1/2 z-50 flex items-center gap-3 rounded-xl border px-5 py-3 shadow-lg backdrop-blur-md animate-slide-down',
        bgColors[type],
        textColors[type]
      )}
      role="alert"
    >
      <span className="text-lg">{icons[type]}</span>
      <p className="text-sm font-medium">{message}</p>
      <button
        onClick={onClose}
        className="ml-2 text-dark-400 hover:text-dark-200 transition-colors"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
