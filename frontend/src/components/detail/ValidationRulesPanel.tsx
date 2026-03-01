import React from 'react';
import { useWorkflowStore } from '@/store/workflowStore';
import { apiClient } from '@/lib/apiClient';
import clsx from 'clsx';

/** Collapsible panel showing domain validation rules for the reasoning step. */
export function ValidationRulesPanel() {
  const domainId = useWorkflowStore((state) => state.domain_id);
  const [rules, setRules] = React.useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    if (!domainId) return;
    setLoading(true);
    setError(null);
    apiClient
      .getDomainConfig(domainId)
      .then((data) => {
        const validationRules = data.validation_rules as Array<Record<string, unknown>> | undefined;
        setRules(validationRules ?? []);
      })
      .catch((err) => setError(err?.message || 'Failed to load rules'))
      .finally(() => setLoading(false));
  }, [domainId]);

  if (!domainId) return null;
  if (loading) {
    return (
      <div className="rounded-lg border border-dark-700 bg-dark-900 p-3 mb-4">
        <p className="text-sm text-dark-400 animate-pulse">Loading validation rules...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 mb-4">
        <p className="text-sm text-red-400">⚠️ {error}</p>
      </div>
    );
  }
  if (rules.length === 0) return null;

  const severityStyles: Record<string, string> = {
    error: 'bg-red-500/20 text-red-300 border-red-500/30',
    warning: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    info: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  };

  return (
    <div className="rounded-lg border border-dark-700 bg-dark-900 mb-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-dark-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>📋</span>
          <span className="text-sm font-semibold text-dark-100">
            Validation Rules
          </span>
          <span className="text-xs bg-dark-700 text-dark-400 px-1.5 py-0.5 rounded-full">
            {rules.length} rules
          </span>
        </div>
        <span className="text-xs text-dark-500">{collapsed ? '▶' : '▼'}</span>
      </button>
      {!collapsed && (
        <div className="border-t border-dark-700 px-3 py-2 space-y-1.5">
          {rules.map((rule, i) => {
            const severity = String(rule.severity ?? 'info');
            const ruleType = String(rule.rule_type ?? 'unknown');
            return (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg bg-dark-800 px-3 py-2"
              >
                <span className="text-xs mt-0.5">
                  {severity === 'error' ? '✗' : severity === 'warning' ? '⚠' : 'ℹ'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-dark-100">
                      {String(rule.name ?? '').replace(/_/g, ' ')}
                    </span>
                    <span
                      className={clsx(
                        'text-[10px] px-1.5 py-0.5 rounded border',
                        severityStyles[severity] ?? severityStyles.info
                      )}
                    >
                      {severity}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded border bg-dark-700 text-dark-400 border-dark-600">
                      {ruleType.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {rule.description != null && (
                    <p className="text-xs text-dark-400 mt-0.5">
                      {String(rule.description)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
