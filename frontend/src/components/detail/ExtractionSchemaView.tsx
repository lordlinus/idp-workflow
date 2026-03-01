import React from 'react';
import { useWorkflowStore } from '@/store/workflowStore';
import { apiClient } from '@/lib/apiClient';

/** Interactive viewer for the domain extraction schema. */
export function ExtractionSchemaView() {
  const domainId = useWorkflowStore((state) => state.domain_id);
  const customSchema = useWorkflowStore((state) => state.customSchema);
  const [schema, setSchema] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [expandedFields, setExpandedFields] = React.useState<Set<string>>(new Set());

  // Use custom schema directly if available, otherwise fetch from domain API
  React.useEffect(() => {
    if (customSchema) {
      setSchema(customSchema as unknown as Record<string, unknown>);
      setLoading(false);
      setError(null);
      return;
    }
    if (!domainId) return;
    setLoading(true);
    setError(null);
    apiClient
      .getDomainConfig(domainId)
      .then((data) => {
        setSchema(data.extraction_schema as Record<string, unknown>);
      })
      .catch((err) => setError(err?.message || 'Failed to load schema'))
      .finally(() => setLoading(false));
  }, [domainId, customSchema]);

  if (!domainId && !customSchema) {
    return (
      <div className="text-center py-8 text-dark-400">
        <span className="text-3xl block mb-2">📋</span>
        <p>No domain selected yet</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <span className="text-4xl mb-3 block animate-pulse">📋</span>
          <p className="text-dark-400">Loading extraction schema...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-400">
        <span className="text-3xl block mb-2">⚠️</span>
        <p>{error}</p>
      </div>
    );
  }

  if (!schema) return null;

  // Extract the field definitions from the schema
  const fieldSchema = schema.fieldSchema as Record<string, unknown> | undefined;
  const fields = (fieldSchema?.fields ?? {}) as Record<string, Record<string, unknown>>;
  const description = schema.description as string | undefined;

  // Group fields by category
  const grouped = Object.entries(fields).reduce<Record<string, { name: string; field: Record<string, unknown> }[]>>(
    (acc, [name, field]) => {
      const cat = (field.category as string) || 'Other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push({ name, field });
      return acc;
    },
    {}
  );

  const toggleField = (name: string) => {
    setExpandedFields((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Schema header */}
      <div className="rounded-lg bg-dark-900 border border-dark-700 p-3">
        <p className="text-xs font-mono text-dark-400 mb-1">{customSchema ? 'Custom Schema' : 'Domain'}</p>
        <p className="text-sm text-dark-200 font-semibold capitalize">
          {customSchema ? 'Ad-hoc Schema' : domainId?.replace(/_/g, ' ') ?? 'Unknown'}
        </p>
        {description && (
          <p className="text-xs text-dark-400 mt-1.5">{description}</p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
            {Object.keys(fields).length} fields
          </span>
          <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
            {Object.keys(grouped).length} categories
          </span>
        </div>
      </div>

      {/* Fields by category */}
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <p className="text-xs font-medium text-dark-400 uppercase tracking-wider mb-2">{category}</p>
          <div className="space-y-1.5">
            {items.map(({ name, field }) => {
              const isExpanded = expandedFields.has(name);
              return (
                <div
                  key={name}
                  className="rounded-lg bg-dark-900 border border-dark-700 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleField(name)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-dark-700/50 transition-colors"
                  >
                    <span className="text-[10px] text-dark-500">{isExpanded ? '▼' : '▶'}</span>
                    <span className="text-sm font-mono text-dark-200 flex-1">{name}</span>
                    <span className="text-[10px] bg-dark-700 text-dark-400 px-1.5 py-0.5 rounded">
                      {(field.type as string) || 'string'}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-2 pt-0 border-t border-dark-700 space-y-1">
                      {field.description != null && (
                        <p className="text-xs text-dark-300 pt-1.5">{String(field.description)}</p>
                      )}
                      {field.method != null && (
                        <p className="text-[10px] text-dark-500">Method: <span className="text-dark-400">{String(field.method)}</span></p>
                      )}
                      {field.demo_impact != null && (
                        <p className="text-[10px] text-amber-400/80">💡 {String(field.demo_impact)}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
