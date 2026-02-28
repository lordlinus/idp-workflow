import React from 'react';
import ReactMarkdown from 'react-markdown';
import { useWorkflowStore } from '@/store/workflowStore';
import { useReasoningStore } from '@/store/reasoningStore';
import { formatTimestamp, formatDuration } from '@/lib/utils';
import { StepName, TOTAL_STEPS } from '@/types';
import { apiClient } from '@/lib/apiClient';
import clsx from 'clsx';

/** Render a value: detects JSON strings, objects, and plain text */
function ValueDisplay({ value }: { value: unknown }) {
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
    displayName: 'LLM Extractor',
    description: 'Extracts fields using DSPy with configurable LLM (Azure OpenAI, Qwen, DeepSeek)',
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

  // Smart auto-scroll: only scroll if user is near the bottom
  React.useEffect(() => {
    if (containerRef.current) {
      const el = containerRef.current;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      if (isNearBottom) {
        el.scrollTop = el.scrollHeight;
      }
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
        <div className="text-center py-10 text-dark-400">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-dark-700/30 flex items-center justify-center">
            <svg className="w-6 h-6 text-dark-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-sm font-medium text-dark-300">No output data available yet</p>
          {stepData?.status === 'pending' && (
            <p className="text-xs mt-1.5 text-dark-500">Step has not started</p>
          )}
          {stepData?.status === 'running' && (
            <p className="text-xs mt-1.5 text-dark-500">Step is currently running...</p>
          )}
        </div>
      );
    }

    const output = stepData.outputData as Record<string, unknown>;

    // Step 1: PDF Extraction — show markdown preview
    if (stepName === 'step_01_pdf_extraction') {
      const preview = output.preview as string | undefined;
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-dark-900 border border-dark-700 p-3 text-center">
              <p className="text-xl font-bold text-blue-400">{String(output.total_pages ?? '—')}</p>
              <p className="text-xs text-dark-400">Pages</p>
            </div>
            <div className="rounded-lg bg-dark-900 border border-dark-700 p-3 text-center">
              <p className="text-xl font-bold text-purple-400">{Number(output.characters ?? 0).toLocaleString()}</p>
              <p className="text-xs text-dark-400">Characters</p>
            </div>
          </div>
          {preview && (
            <div className="rounded-lg bg-dark-900 border border-dark-700 p-4">
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wider mb-3">Markdown Preview</p>
              <div className="prose prose-invert prose-sm max-w-none text-dark-200 [&_h1]:text-dark-100 [&_h2]:text-dark-100 [&_h3]:text-dark-100 [&_table]:text-xs [&_th]:bg-dark-700 [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_td]:border-dark-600 [&_th]:border-dark-600">
                <ReactMarkdown>{preview}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Step 2: Classification — show primary category + classifications table
    if (stepName === 'step_02_classification') {
      const classifications = output.classifications as Record<string, unknown> | undefined;
      const classificationsList = (classifications as unknown as Array<Record<string, unknown>>) 
        ?? (output.classifications as Array<Record<string, unknown>> | undefined) 
        ?? [];
      return (
        <div className="space-y-3">
          <div className="rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 p-4">
            <p className="text-xs text-dark-400 mb-1">Primary Category</p>
            <p className="text-lg font-bold text-dark-50">{String(output.primary_category ?? 'Unknown')}</p>
            {output.primary_confidence != null && (
              <p className="text-sm text-dark-300 mt-1">
                Confidence: <span className="text-green-400 font-medium">{(Number(output.primary_confidence) * 100).toFixed(0)}%</span>
              </p>
            )}
          </div>
          {Array.isArray(classificationsList) && classificationsList.length > 0 && (
            <div className="rounded-lg bg-dark-900 border border-dark-700 p-3">
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wider mb-3">Page Classifications</p>
              <div className="space-y-2">
                {classificationsList.map((cls, i) => (
                  <div key={i} className="flex items-center justify-between rounded bg-dark-800 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-dark-700 text-dark-300 px-1.5 py-0.5 rounded">
                        p{String(cls.page_number ?? cls.page ?? i + 1)}
                      </span>
                      <span className="text-sm text-dark-200">{String(cls.category ?? '—')}</span>
                    </div>
                    <span className={clsx(
                      'text-xs font-medium',
                      Number(cls.confidence ?? 0) >= 0.8 ? 'text-green-400' :
                      Number(cls.confidence ?? 0) >= 0.5 ? 'text-amber-400' : 'text-red-400'
                    )}>
                      {(Number(cls.confidence ?? 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Steps 3a/3b: Extraction — show extracted_data as formatted JSON
    if (stepName === 'step_03_01_azure_extraction' || stepName === 'step_03_02_dspy_extraction') {
      const extractedData = output.extracted_data as Record<string, unknown> | undefined;
      const isAzure = stepName === 'step_03_01_azure_extraction';
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-dark-900 border border-dark-700 p-3 text-center">
              <p className="text-xl font-bold text-blue-400">{String(output.total_pages_processed ?? '—')}</p>
              <p className="text-xs text-dark-400">Pages Processed</p>
            </div>
            <div className="rounded-lg bg-dark-900 border border-dark-700 p-3 text-center">
              <p className="text-xl font-bold text-purple-400">
                {extractedData ? Object.keys(extractedData).length : '—'}
              </p>
              <p className="text-xs text-dark-400">Fields Extracted</p>
            </div>
          </div>
          {extractedData && (
            <div className="rounded-lg bg-dark-900 border border-dark-700 p-3">
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wider mb-3">
                {isAzure ? '☁️ Azure CU' : '🤖 LLM'} Extracted Fields
              </p>
              <div className="space-y-2">
                {Object.entries(extractedData).map(([key, value]) => (
                  <div key={key} className="rounded bg-dark-800 px-3 py-2">
                    <p className="text-xs font-mono text-dark-400 mb-0.5">{key}</p>
                    <div className="text-sm text-dark-100">
                      <ValueDisplay value={value} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Step 6: Reasoning Agent — show AI summary as markdown + recommendations
    if (stepName === 'step_06_reasoning_agent') {
      const aiSummary = output.ai_summary as string | undefined;
      const recommendations = output.recommendations as string[] | undefined;
      return (
        <div className="space-y-3">
          {/* Validation Rules */}
          <ValidationRulesPanel />

          {/* Metrics row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-dark-900 border border-dark-700 p-2 text-center">
              <p className="text-lg font-bold text-emerald-400">
                {(Number(output.confidence_score ?? 0) * 100).toFixed(0)}%
              </p>
              <p className="text-[10px] text-dark-400">Confidence</p>
            </div>
            <div className="rounded-lg bg-dark-900 border border-dark-700 p-2 text-center">
              <p className="text-lg font-bold text-blue-400">
                {String(output.passed_validations ?? 0)}/{String(output.total_validations ?? 0)}
              </p>
              <p className="text-[10px] text-dark-400">Validations</p>
            </div>
            <div className="rounded-lg bg-dark-900 border border-dark-700 p-2 text-center">
              <p className="text-lg font-bold text-purple-400">{String(output.engine ?? '—')}</p>
              <p className="text-[10px] text-dark-400">Engine</p>
            </div>
          </div>

          {/* AI Summary in markdown */}
          {aiSummary && (
            <div className="rounded-lg bg-dark-900 border border-dark-700 p-4">
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wider mb-3">🧠 AI Analysis</p>
              <div className="prose prose-invert prose-sm max-w-none text-dark-200 [&_h1]:text-dark-100 [&_h2]:text-dark-100 [&_h3]:text-dark-100 [&_li]:text-dark-200 [&_strong]:text-dark-100">
                <ReactMarkdown>{aiSummary}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {recommendations && recommendations.length > 0 && (
            <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
              <p className="text-xs font-medium text-amber-300 uppercase tracking-wider mb-2">💡 Recommendations</p>
              <ul className="space-y-1.5">
                {recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-dark-200">
                    <span className="text-amber-400 mt-0.5 text-xs">▸</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    // Default fallback: generic key-value rendering (Step 4, Step 5, etc.)
    return (
      <div className="space-y-3">
        {Object.entries(output).map(([key, value]) => (
          <div key={key} className="rounded-lg bg-dark-900 p-3 border border-dark-700">
            <p className="text-xs font-mono text-dark-400 mb-1">{key}</p>
            <div className="text-sm text-dark-200">
              <ValueDisplay value={value} />
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
        {renderOutput()}
      </div>
    </div>
  );
}

// Default view when nothing selected
function DefaultView() {
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

// Completion Dashboard
function CompletionDashboard() {
  const steps = useWorkflowStore((state) => state.steps);
  const domainId = useWorkflowStore((state) => state.domain_id);
  const startedAt = useWorkflowStore((state) => state.startedAt);
  const hitlStatus = useWorkflowStore((state) => state.hitlStatus);

  // Gather step data
  const step02 = steps.get('step_02_classification');
  const step03Azure = steps.get('step_03_01_azure_extraction');
  const step03Dspy = steps.get('step_03_02_dspy_extraction');
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
            confidenceScore >= 0.8 ? 'text-emerald-400' :
            confidenceScore >= 0.6 ? 'text-amber-400' : 'text-red-400'
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

// Validation Rules Panel — shows domain validation rules for the reasoning step
function ValidationRulesPanel() {
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

// Extraction Schema Viewer
function ExtractionSchemaView() {
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

export function DetailPanel() {
  const selectedStep = useWorkflowStore((state) => state.selectedStep);
  const steps = useWorkflowStore((state) => state.steps);
  const [showSchema, setShowSchema] = React.useState(false);
  
  // Check if reasoning step is currently running
  const reasoningStep = steps.get('step_06_reasoning_agent');
  const isReasoningActive = reasoningStep?.status === 'running' || reasoningStep?.status === 'completed';

  // Determine what to show:
  // 1. Schema view if toggled
  // 2. If a step is selected, show its output
  // 3. If reasoning is active and no selection, show reasoning stream
  // 4. Otherwise show default view
  const workflowStatus = useWorkflowStore((state) => state.status);
  const showStepOutput = !showSchema && selectedStep !== null;
  const showReasoning = !showSchema && !showStepOutput && isReasoningActive && workflowStatus !== 'completed';
  const showCompletion = !showSchema && !showStepOutput && workflowStatus === 'completed';
  const showDefault = !showSchema && !showStepOutput && !showReasoning && !showCompletion;

  // Panel title
  let title = 'Details';
  let subtitle = 'Select a step to view details';
  
  if (showSchema) {
    title = 'Extraction Schema';
    subtitle = 'Fields extracted from documents';
  } else if (showStepOutput && selectedStep) {
    const info = STEP_INFO[selectedStep];
    title = info?.displayName || 'Step Output';
    subtitle = 'Step execution details';
  } else if (showCompletion) {
    title = 'Results';
    subtitle = 'Processing complete';
  } else if (showReasoning) {
    title = 'AI Reasoning';
    subtitle = 'Live reasoning stream';
  }

  return (
    <div className="h-full rounded-2xl border border-dark-700/60 bg-dark-800/50 backdrop-blur-sm flex flex-col overflow-hidden shadow-xl">
      {/* Header */}
      <div className="border-b border-dark-700/40 bg-dark-900/60 px-5 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showReasoning && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-[10px] font-medium text-blue-300 uppercase tracking-wider">Live</span>
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold text-dark-100">{title}</h3>
              <p className="text-[11px] text-dark-500">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSchema(!showSchema)}
              className={clsx(
                'text-xs px-3 py-1.5 rounded-lg border transition-all duration-200',
                showSchema
                  ? 'bg-blue-500/15 border-blue-500/30 text-blue-300 shadow-glow-blue'
                  : 'bg-dark-800/60 border-dark-600/40 text-dark-400 hover:text-dark-200 hover:border-dark-500'
              )}
              title="View extraction schema"
            >
              📋 Schema
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto flex-1 px-5 py-4">
        {showSchema && <ExtractionSchemaView />}
        {showStepOutput && selectedStep && <StepOutputView stepName={selectedStep} />}
        {showCompletion && <CompletionDashboard />}
        {showReasoning && (
          <>
            <ValidationRulesPanel />
            <ReasoningStream />
          </>
        )}
        {showDefault && <DefaultView />}
      </div>
    </div>
  );
}
