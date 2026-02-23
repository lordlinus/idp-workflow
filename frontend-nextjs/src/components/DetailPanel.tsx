import React from 'react';
import { useWorkflowStore } from '@/store/workflowStore';
import { useReasoningStore } from '@/store/reasoningStore';
import { formatTimestamp, formatDuration } from '@/lib/utils';
import { StepName } from '@/types';
import clsx from 'clsx';

const STEP_INFO: Record<string, { displayName: string; description: string; icon: string }> = {
  step_01_pdf_extraction: {
    displayName: 'PDF Extractor',
    description: 'Extracts text, tables, and structure from uploaded PDF documents',
    icon: '📄',
  },
  step_02_classification: {
    displayName: 'Document Classifier',
    description: 'Classifies document type and identifies the processing domain',
    icon: '🏷️',
  },
  step_03_01_azure_extraction: {
    displayName: 'Azure Document Intelligence',
    description: 'Extracts structured fields using Azure AI Document Intelligence',
    icon: '☁️',
  },
  step_03_02_dspy_extraction: {
    displayName: 'DSPy LLM Extractor',
    description: 'Extracts fields using DSPy-powered language model prompts',
    icon: '🤖',
  },
  step_04_comparison: {
    displayName: 'Field Comparator',
    description: 'Compares extraction results from Azure and DSPy, identifies conflicts',
    icon: '⚖️',
  },
  step_05_human_review: {
    displayName: 'Human Review',
    description: 'Human-in-the-loop validation and conflict resolution',
    icon: '👤',
  },
  step_06_reasoning_agent: {
    displayName: 'Reasoning Agent',
    description: 'AI agent performs final validation and generates confidence scores',
    icon: '🧠',
  },
};

// Reasoning stream sub-component
function ReasoningStream() {
  const chunks = useReasoningStore((state) => state.chunks);
  const isComplete = useReasoningStore((state) => state.isComplete);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  React.useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [chunks]);

  const chunkTypeStyles: Record<string, { bgColor: string; borderColor: string; icon: string; title: string }> = {
    validation_summary: {
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      icon: '✓',
      title: 'Validation Summary',
    },
    field_matching: {
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      icon: '🔗',
      title: 'Field Matching',
    },
    confidence: {
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30',
      icon: '📊',
      title: 'Confidence Score',
    },
    summary: {
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      icon: '📝',
      title: 'Summary',
    },
    final: {
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      icon: '🎉',
      title: 'Complete',
    },
  };

  return (
    <div ref={containerRef} className="space-y-3">
      {chunks.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <span className="text-4xl mb-3 block">⏳</span>
            <p className="text-dark-400">Waiting for reasoning stream...</p>
          </div>
        </div>
      ) : (
        <>
          {chunks.map((chunk, index) => {
            const style = chunkTypeStyles[chunk.chunkType] || chunkTypeStyles.summary;

            return (
              <div
                key={chunk.timestamp + index}
                className={clsx(
                  'rounded-lg border p-3 animate-fade-in',
                  style.bgColor,
                  style.borderColor
                )}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg">{style.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-semibold text-dark-50 text-sm">{style.title}</p>
                      <span className="text-xs text-dark-500">
                        {formatTimestamp(chunk.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-dark-200 whitespace-pre-wrap break-words">
                      {chunk.content}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {!isComplete && (
            <div className="flex items-center gap-2 p-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-2 w-2 rounded-full bg-dark-500 animate-bounce"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
              <span className="text-sm text-dark-400">Agent reasoning...</span>
            </div>
          )}

          {/* Complete Indicator */}
          {isComplete && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-center">
              <p className="text-sm font-medium text-green-300">✅ Reasoning complete</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Step output sub-component
function StepOutputView({ stepName }: { stepName: StepName }) {
  const steps = useWorkflowStore((state) => state.steps);
  const stepData = steps.get(stepName);
  const info = STEP_INFO[stepName];
  const selectStep = useWorkflowStore((state) => state.selectStep);

  if (!info) return null;

  const renderOutput = () => {
    if (!stepData?.outputData) {
      return (
        <div className="text-center py-8 text-dark-400">
          <span className="text-3xl block mb-2">📭</span>
          <p>No output data available yet</p>
          {stepData?.status === 'pending' && (
            <p className="text-sm mt-1">Step has not started</p>
          )}
          {stepData?.status === 'running' && (
            <p className="text-sm mt-1">Step is currently running...</p>
          )}
        </div>
      );
    }

    const output = stepData.outputData as Record<string, unknown>;

    return (
      <div className="space-y-3">
        {Object.entries(output).map(([key, value]) => (
          <div key={key} className="rounded-lg bg-dark-900 p-3 border border-dark-700">
            <p className="text-xs font-mono text-dark-400 mb-1">{key}</p>
            <div className="text-sm text-dark-200">
              {typeof value === 'object' ? (
                <pre className="whitespace-pre-wrap break-words text-xs font-mono">
                  {JSON.stringify(value, null, 2)}
                </pre>
              ) : (
                <p className="break-words">{String(value)}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Step header */}
      <div className="flex items-start gap-3">
        <span className="text-3xl">{info.icon}</span>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-dark-50">{info.displayName}</h4>
            <button
              onClick={() => selectStep(null)}
              className="text-dark-400 hover:text-dark-200 text-sm"
            >
              ✕ Close
            </button>
          </div>
          <p className="text-xs text-dark-400 mt-0.5">{info.description}</p>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <div
            className={clsx(
              'w-2 h-2 rounded-full',
              stepData?.status === 'completed'
                ? 'bg-green-500'
                : stepData?.status === 'running'
                  ? 'bg-blue-500 animate-pulse'
                  : stepData?.status === 'failed'
                    ? 'bg-red-500'
                    : 'bg-gray-500'
            )}
          />
          <span className="text-dark-300 capitalize">{stepData?.status || 'pending'}</span>
        </div>
        {stepData?.durationMs && (
          <div className="text-dark-400">
            Duration: <span className="text-dark-200">{formatDuration(stepData.durationMs)}</span>
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

      {/* Output data */}
      <div>
        <h5 className="text-sm font-medium text-dark-300 mb-2">Output Data</h5>
        {renderOutput()}
      </div>
    </div>
  );
}

// Default view when nothing selected
function DefaultView() {
  const status = useWorkflowStore((state) => state.status);

  return (
    <div className="flex flex-col items-center justify-center h-full py-12 text-center">
      <span className="text-5xl mb-4">👆</span>
      <h4 className="text-lg font-semibold text-dark-50 mb-2">Click a Step</h4>
      <p className="text-sm text-dark-400 max-w-xs">
        Click on any workflow step to view its output and details
      </p>
      {status === 'running' && (
        <p className="text-xs text-blue-400 mt-4">
          Pipeline is currently running...
        </p>
      )}
    </div>
  );
}

export function DetailPanel() {
  const selectedStep = useWorkflowStore((state) => state.selectedStep);
  const steps = useWorkflowStore((state) => state.steps);
  
  // Check if reasoning step is currently running
  const reasoningStep = steps.get('step_06_reasoning_agent');
  const isReasoningActive = reasoningStep?.status === 'running';

  // Determine what to show:
  // 1. If a step is selected, show its output
  // 2. If reasoning is active and no selection, show reasoning stream
  // 3. Otherwise show default view
  const showStepOutput = selectedStep !== null;
  const showReasoning = !showStepOutput && isReasoningActive;
  const showDefault = !showStepOutput && !showReasoning;

  // Panel title
  let title = 'Details';
  let subtitle = 'Select a step to view details';
  
  if (showStepOutput && selectedStep) {
    const info = STEP_INFO[selectedStep];
    title = info?.displayName || 'Step Output';
    subtitle = 'Step execution details';
  } else if (showReasoning) {
    title = 'AI Reasoning';
    subtitle = 'Live reasoning stream';
  }

  return (
    <div className="h-full rounded-xl border border-dark-700 bg-dark-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-dark-700 bg-dark-900 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-dark-50">{title}</h3>
            <p className="text-xs text-dark-400">{subtitle}</p>
          </div>
          {showReasoning && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs text-blue-400">Live</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto flex-1 px-4 py-4">
        {showStepOutput && selectedStep && <StepOutputView stepName={selectedStep} />}
        {showReasoning && <ReasoningStream />}
        {showDefault && <DefaultView />}
      </div>
    </div>
  );
}
