import { DomainId } from '@/types';

export const DOMAIN_CONFIG: Record<
  DomainId,
  { label: string; icon: string; description: string }
> = {
  home_loan: {
    label: 'Home Loan / Mortgage Processing',
    icon: '🏠',
    description: 'Process mortgage and home loan documents',
  },
  insurance_claims: {
    label: 'Insurance Claims Processing',
    icon: '📋',
    description: 'Process health insurance claim documents',
  },
  small_business_lending: {
    label: 'Small Business Lending',
    icon: '💼',
    description: 'Process small business loan applications',
  },
  trade_finance: {
    label: 'Trade Finance Document Analysis',
    icon: '📊',
    description: 'Analyze trade finance documents',
  },
};

export const STEP_DISPLAY_NAMES: Record<string, string> = {
  step_01_pdf_extraction: 'PDF Extraction',
  step_02_classification: 'Classification',
  step_03_01_azure_extraction: 'Azure Extraction',
  step_03_02_dspy_extraction: 'DSPy Extraction',
  step_04_comparison: 'Comparison',
  step_05_human_review: 'Human Review',
  step_06_reasoning_agent: 'Reasoning',
};

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Format timestamp to human-readable string
 */
export function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/**
 * Format date for display
 */
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get status badge color
 */
export function getStatusColor(
  status: 'pending' | 'running' | 'completed' | 'failed' | 'Completed' | 'Pending' | 'Failed'
): string {
  switch (status) {
    case 'pending':
    case 'Pending':
      return 'bg-dark-700 text-dark-300';
    case 'running':
      return 'bg-blue-500/20 text-blue-300 animate-pulse';
    case 'completed':
    case 'Completed':
      return 'bg-green-500/20 text-green-300';
    case 'failed':
    case 'Failed':
      return 'bg-red-500/20 text-red-300';
    default:
      return 'bg-dark-700 text-dark-300';
  }
}

/**
 * Get step status icon
 */
export function getStatusIcon(
  status: 'pending' | 'running' | 'completed' | 'failed'
): string {
  switch (status) {
    case 'pending':
      return '⏳';
    case 'running':
      return '⚙️';
    case 'completed':
      return '✅';
    case 'failed':
      return '❌';
    default:
      return '•';
  }
}

/**
 * Truncate text to specified length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
