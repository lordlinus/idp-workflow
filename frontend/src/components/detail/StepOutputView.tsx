import React from 'react';
import { useWorkflowStore } from '@/store/workflowStore';
import { formatDuration } from '@/lib/utils';
import { STEP_INFO } from '@/lib/stepConfig';
import { StepName } from '@/types';
import { StepOutputRenderer } from './StepOutputRenderer';
import clsx from 'clsx';

/** Displays full step details: header, status, preview, and output data. */
export function StepOutputView({ stepName }: { stepName: StepName }) {
  const steps = useWorkflowStore((state) => state.steps);
  const stepData = steps.get(stepName);
  const info = STEP_INFO[stepName];
  const selectStep = useWorkflowStore((state) => state.selectStep);

  if (!info) return null;

  return (
    <div className="space-y-4">
      {/* Step header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-dark-700/60 flex items-center justify-center text-xl flex-shrink-0">
          {info.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-dark-50">{info.displayName}</h4>
            <button
              onClick={() => selectStep(null)}
              className="text-dark-500 hover:text-dark-300 text-xs px-2 py-1 rounded-lg hover:bg-dark-700/40 transition-all duration-200"
            >
              ✕ Close
            </button>
          </div>
          <p className="text-xs text-dark-400 mt-0.5">{info.description}</p>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-dark-700/30 border border-dark-600/30">
          <div
            className={clsx(
              'w-1.5 h-1.5 rounded-full',
              stepData?.status === 'completed'
                ? 'bg-emerald-400'
                : stepData?.status === 'running'
                  ? 'bg-blue-400 animate-pulse'
                  : stepData?.status === 'failed'
                    ? 'bg-red-400'
                    : 'bg-dark-500'
            )}
          />
          <span className="text-dark-300 text-xs capitalize">{stepData?.status || 'pending'}</span>
        </div>
        {stepData?.durationMs && (
          <div className="text-xs text-dark-400 flex items-center gap-1.5">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-dark-200">{formatDuration(stepData.durationMs)}</span>
          </div>
        )}
      </div>

      {/* Preview text if available */}
      {stepData?.outputPreview && (
        <div className="rounded-lg bg-dark-900/50 border border-dark-700 p-3">
          <p className="text-xs text-dark-400 mb-1">Preview</p>
          <p className="text-sm text-dark-200 italic">{stepData.outputPreview}</p>
        </div>
      )}

      {/* LLM Provider info for DSPy extraction */}
      {stepName === 'step_03_02_dspy_extraction' && stepData?.outputData && (
        <div className="rounded-lg bg-purple-500/10 border border-purple-500/30 p-3">
          <p className="text-xs font-medium text-purple-300 mb-1">🤖 LLM Provider</p>
          <p className="text-sm text-dark-200">
            {(stepData.outputData as Record<string, unknown>).schema_path 
              ? 'Domain schema' 
              : 'Ad-hoc schema'}
          </p>
        </div>
      )}

      {/* Output data */}
      <div>
        <h5 className="text-sm font-medium text-dark-300 mb-2">Output Data</h5>
        {stepData?.outputData ? (
          <StepOutputRenderer stepName={stepName} output={stepData.outputData as Record<string, unknown>} />
        ) : (
          <NoOutputPlaceholder status={stepData?.status} />
        )}
      </div>
    </div>
  );
}

function NoOutputPlaceholder({ status }: { status?: string }) {
  return (
    <div className="text-center py-10 text-dark-400">
      <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-dark-700/30 flex items-center justify-center">
        <svg className="w-6 h-6 text-dark-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <p className="text-sm font-medium text-dark-300">No output data available yet</p>
      {status === 'pending' && (
        <p className="text-xs mt-1.5 text-dark-500">Step has not started</p>
      )}
      {status === 'running' && (
        <p className="text-xs mt-1.5 text-dark-500">Step is currently running...</p>
      )}
    </div>
  );
}
