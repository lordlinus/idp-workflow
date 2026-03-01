import React from 'react';

/** Render a value: detects JSON strings, objects, and plain text */
export function ValueDisplay({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-dark-500">—</span>;

  // Already an object/array — render as formatted JSON
  if (typeof value === 'object') {
    return (
      <pre className="whitespace-pre-wrap break-words text-xs font-mono text-dark-200">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  const str = String(value);

  // Detect JSON strings: starts with [{ or { or [
  if (/^\s*[\[{]/.test(str)) {
    try {
      const parsed = JSON.parse(str);
      return (
        <pre className="whitespace-pre-wrap break-words text-xs font-mono text-dark-200">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    } catch {
      // Not valid JSON, fall through to plain text
    }
  }

  return <span className="break-words">{str}</span>;
}
