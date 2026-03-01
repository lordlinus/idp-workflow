/**
 * Shared formatting utilities for field values and confidence display.
 */

/**
 * Safely format a field value for display.
 * Handles objects, arrays, nulls, and primitives.
 */
export function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value || '—';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === 'object' && item !== null
          ? Object.entries(item)
              .filter(([, v]) => v !== null && v !== undefined && v !== '')
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ')
          : String(item)
      )
      .join('\n');
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) =>
        typeof v === 'object' ? `${k}: ${JSON.stringify(v)}` : `${k}: ${v}`
      )
      .join('\n');
  }
  return String(value);
}

/**
 * Return a Tailwind text-color class based on a 0–1 confidence score.
 *
 * Default thresholds: ≥ 0.8 → green, ≥ 0.6 → amber, below → red.
 * Pass custom thresholds/colors to override.
 */
export function getConfidenceColor(
  confidence: number,
  options?: {
    high?: number;
    medium?: number;
    highColor?: string;
    mediumColor?: string;
    lowColor?: string;
  },
): string {
  const {
    high = 0.8,
    medium = 0.6,
    highColor = 'text-green-400',
    mediumColor = 'text-amber-400',
    lowColor = 'text-red-400',
  } = options ?? {};
  if (confidence >= high) return highColor;
  if (confidence >= medium) return mediumColor;
  return lowColor;
}
