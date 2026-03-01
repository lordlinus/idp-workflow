import React from 'react';
import { useWorkflowStore } from '@/store/workflowStore';
import { formatDuration } from '@/lib/utils';
import { getConfidenceColor } from '@/lib/formatting';
import { STEP_INFO } from '@/lib/stepConfig';
import clsx from 'clsx';

/** Dashboard shown when the entire workflow has completed. */
export function CompletionDashboard() {
  const steps = useWorkflowStore((state) => state.steps);
  const domainId = useWorkflowStore((state) => state.domain_id);
  const startedAt = useWorkflowStore((state) => state.startedAt);
  const hitlStatus = useWorkflowStore((state) => state.hitlStatus);

  // Gather step data
  const step02 = steps.get('step_02_classification');
  const step04 = steps.get('step_04_comparison');
  const step06 = steps.get('step_06_reasoning_agent');

  const completedSteps = Array.from(steps.values()).filter((s) => s.status === 'completed');
  const totalDurationMs = completedSteps.reduce((sum, s) => sum + (s.durationMs || 0), 0);

  // Extract key metrics from step outputs
  const classification = step02?.outputData as Record<string, unknown> | undefined;
  const comparison = step04?.outputData as Record<string, unknown> | undefined;
  const reasoning = step06?.outputData as Record<string, unknown> | undefined;

  const confidenceScore = Number(reasoning?.confidence_score ?? 0);
  const totalFields = Number(comparison?.total_fields ?? reasoning?.total_fields ?? 0);
  const matchingFields = Number(comparison?.matching_fields ?? reasoning?.matching_fields ?? 0);
  const matchPct = Number(comparison?.match_percentage ?? (totalFields ? (matchingFields / totalFields) * 100 : 0));
  const docType = String(classification?.primary_category ?? 'Document');

  const handleExport = () => {
    const exportData = {
      workflow: {
        domain: domainId,
        documentType: docType,
        startedAt,
        completedAt: new Date().toISOString(),
        totalDurationMs,
      },
      results: {
        confidenceScore,
        totalFields,
        matchingFields,
        matchPercentage: Math.round(matchPct * 10) / 10,
        humanReview: hitlStatus || 'none',
      },
      stepOutputs: Object.fromEntries(
        Array.from(steps.entries()).map(([name, step]) => [name, step.outputData ?? null])
      ),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `idp-results-${domainId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 py-2">
      {/* Success banner */}
      <div className="rounded-xl bg-gradient-to-r from-emerald-500/[0.12] to-teal-500/[0.12] border border-emerald-500/20 p-5 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
          <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-lg font-bold text-emerald-200">Processing Complete</p>
        <p className="text-xs text-dark-400 mt-1.5">
          {completedSteps.length} steps completed in {formatDuration(totalDurationMs)}
        </p>
      </div>

      {/* Confidence gauge */}
      <div className="rounded-lg bg-dark-900 border border-dark-700 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-dark-300">Overall Confidence</p>
          <span className={clsx(
            'text-2xl font-bold',
            getConfidenceColor(confidenceScore, { highColor: 'text-emerald-400' })
          )}>
            {(confidenceScore * 100).toFixed(0)}%
          </span>
        </div>
        <div className="w-full bg-dark-700 rounded-full h-3">
          <div
            className={clsx(
              'h-3 rounded-full transition-all duration-1000',
              confidenceScore >= 0.8 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
              confidenceScore >= 0.6 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
              'bg-gradient-to-r from-red-500 to-orange-400'
            )}
            style={{ width: `${Math.min(confidenceScore * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-dark-900 border border-dark-700 p-3 text-center">
          <p className="text-2xl font-bold text-blue-400">{totalFields}</p>
          <p className="text-xs text-dark-400">Fields Extracted</p>
        </div>
        <div className="rounded-lg bg-dark-900 border border-dark-700 p-3 text-center">
          <p className="text-2xl font-bold text-emerald-400">{matchPct.toFixed(0)}%</p>
          <p className="text-xs text-dark-400">Azure ↔ DSPy Match</p>
        </div>
        <div className="rounded-lg bg-dark-900 border border-dark-700 p-3 text-center">
          <p className="text-2xl font-bold text-purple-400">{docType}</p>
          <p className="text-xs text-dark-400">Document Type</p>
        </div>
        <div className="rounded-lg bg-dark-900 border border-dark-700 p-3 text-center">
          <p className="text-2xl font-bold text-amber-400">
            {hitlStatus === 'approved' ? '✓' : hitlStatus === 'rejected' ? '✗' : '—'}
          </p>
          <p className="text-xs text-dark-400">Human Review</p>
        </div>
      </div>

      {/* Reasoning summary */}
      {reasoning && (
        <div className="rounded-lg bg-dark-900 border border-dark-700 p-3">
          <p className="text-xs font-medium text-dark-400 uppercase tracking-wider mb-2">AI Reasoning Summary</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-dark-400">Validations</span>
              <span className="text-dark-200">
                <span className="text-green-400">{String(reasoning.passed_validations ?? 0)}</span>
                /{String(reasoning.total_validations ?? 0)} passed
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-400">Recommendations</span>
              <span className="text-dark-200">{String(reasoning.recommendations_count ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-400">Engine</span>
              <span className="text-dark-200">{String(reasoning.engine ?? 'agent')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Step durations */}
      <div className="rounded-lg bg-dark-900 border border-dark-700 p-3">
        <p className="text-xs font-medium text-dark-400 uppercase tracking-wider mb-2">Step Performance</p>
        <div className="space-y-1.5">
          {completedSteps
            .sort((a, b) => a.number - b.number)
            .map((step) => {
              const info = STEP_INFO[step.name];
              const pct = totalDurationMs > 0 ? ((step.durationMs || 0) / totalDurationMs) * 100 : 0;
              return (
                <div key={step.name} className="flex items-center gap-2 text-xs">
                  <span className="w-4 text-center">{info?.icon || '•'}</span>
                  <span className="flex-1 text-dark-300 truncate">{step.displayName}</span>
                  <div className="w-20 bg-dark-700 rounded-full h-1.5">
                    <div
                      className="bg-blue-500/70 h-1.5 rounded-full"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <span className="text-dark-500 w-12 text-right">{formatDuration(step.durationMs || 0)}</span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Export button */}
      <button
        type="button"
        onClick={handleExport}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span>Export Results (JSON)</span>
      </button>
    </div>
  );
}
