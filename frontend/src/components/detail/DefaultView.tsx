import React from 'react';
import { useWorkflowStore } from '@/store/workflowStore';
import { STEP_INFO, TOTAL_STEPS } from '@/lib/stepConfig';

/** Default view when no step is selected and workflow is not completed. */
export function DefaultView() {
  const status = useWorkflowStore((state) => state.status);
  const steps = useWorkflowStore((state) => state.steps);

  const completedSteps = Array.from(steps.values()).filter((s) => s.status === 'completed');
  const runningStep = Array.from(steps.values()).find((s) => s.status === 'running');

  if (status === 'idle' || status === 'initializing') {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-center">
        <div className="w-14 h-14 rounded-2xl bg-dark-700/40 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-dark-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
        <h4 className="text-base font-semibold text-dark-200 mb-1.5">Workflow Monitor</h4>
        <p className="text-sm text-dark-500 max-w-xs leading-relaxed">
          Click any step node in the pipeline to inspect its output
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      {/* Progress summary */}
      <div className="rounded-lg bg-dark-900 border border-dark-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-dark-300">Pipeline Progress</p>
          <span className="text-xs text-dark-400">
            <span className="text-green-400 font-semibold">{completedSteps.length}</span> / {TOTAL_STEPS} steps
          </span>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-dark-700 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${(completedSteps.length / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      {/* Current activity */}
      {runningStep && (
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <p className="text-sm font-medium text-blue-300">Running</p>
          </div>
          <p className="text-dark-200 text-sm">{runningStep.displayName}</p>
        </div>
      )}

      {/* Completed steps summary */}
      {completedSteps.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-dark-400 uppercase tracking-wider">Completed</p>
          {completedSteps.map((step) => {
            const info = STEP_INFO[step.name];
            return (
              <div
                key={step.name}
                className="flex items-center gap-2 text-sm text-dark-300 rounded-lg bg-dark-900/50 px-3 py-2 cursor-pointer hover:bg-dark-700 transition-colors"
                onClick={() => useWorkflowStore.getState().selectStep(step.name)}
              >
                <span className="text-green-400">✓</span>
                <span>{info?.icon}</span>
                <span className="flex-1">{step.displayName}</span>
                {step.outputPreview && (
                  <span className="text-xs text-dark-500 truncate max-w-[140px]">{step.outputPreview}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tip */}
      <p className="text-xs text-dark-500 text-center pt-2">
        Click a step node for detailed output
      </p>
    </div>
  );
}
