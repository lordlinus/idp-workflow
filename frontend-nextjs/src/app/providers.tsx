'use client';

import { ReactNode, useEffect } from 'react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
    },
  },
});

// Suppress React 19 key-spread warning from reaflow library (not actionable until library updates)
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const message = args[0];
    if (typeof message === 'string' && message.includes('A props object containing a "key" prop is being spread into JSX')) {
      return; // Suppress this specific warning from reaflow
    }
    originalConsoleError.apply(console, args);
  };
}

export function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
