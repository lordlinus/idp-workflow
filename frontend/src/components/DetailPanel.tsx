import React from 'react';
import { useWorkflowStore } from '@/store/workflowStore';
import { useReasoningStore } from '@/store/reasoningStore';
import { STEP_INFO } from '@/lib/stepConfig';
import clsx from 'clsx';

import {
  StepOutputView,
  ReasoningStream,
  ValidationRulesPanel,
  ExtractionSchemaView,
  CompletionDashboard,
  DefaultView,
} from './detail';
import { DocumentViewer } from './DocumentViewer';

export function DetailPanel() {
  const selectedStep = useWorkflowStore((state) => state.selectedStep);
  const steps = useWorkflowStore((state) => state.steps);
  const [showSchema, setShowSchema] = React.useState(false);
  const [showDocument, setShowDocument] = React.useState(false);
  const documentUrl = useWorkflowStore((state) => state.documentUrl);
  
  // Check if reasoning step is currently running
  const reasoningStep = steps.get('step_06_reasoning_agent');
  const isReasoningActive = reasoningStep?.status === 'running' || reasoningStep?.status === 'completed';
  const reasoningChunks = useReasoningStore((state) => state.chunks);

  // Determine what to show:
  // 1. Schema view if toggled
  // 2. If reasoning is active (or has chunks) and step 6 is selected (or no selection), show reasoning stream
  // 3. If a step is selected, show its output
  // 4. Otherwise show default view
  const workflowStatus = useWorkflowStore((state) => state.status);
  const hasReasoningContent = isReasoningActive || reasoningChunks.length > 0;
  const isReasoningSelected = selectedStep === 'step_06_reasoning_agent';
  const showReasoning = !showSchema && !showDocument && hasReasoningContent && (isReasoningSelected || selectedStep === null);
  const showStepOutput = !showSchema && !showDocument && selectedStep !== null && !showReasoning;
  const showCompletion = !showSchema && !showDocument && !showStepOutput && !showReasoning && workflowStatus === 'completed';
  const showDefault = !showSchema && !showDocument && !showStepOutput && !showReasoning && !showCompletion;

  // Panel title
  let title = 'Details';
  let subtitle = 'Select a step to view details';
  
  if (showSchema) {
    title = 'Extraction Schema';
    subtitle = 'Fields extracted from documents';
  } else if (showDocument) {
    title = 'Source Document';
    subtitle = 'PDF being processed';
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
            {documentUrl && (
              <button
                type="button"
                onClick={() => { setShowDocument(!showDocument); if (!showDocument) setShowSchema(false); }}
                className={clsx(
                  'text-xs px-3 py-1.5 rounded-lg border transition-all duration-200',
                  showDocument
                    ? 'bg-red-500/15 border-red-500/30 text-red-300 shadow-glow-red'
                    : 'bg-dark-800/60 border-dark-600/40 text-dark-400 hover:text-dark-200 hover:border-dark-500'
                )}
                title="View source document"
              >
                📄 Document
              </button>
            )}
            <button
              type="button"
              onClick={() => { setShowSchema(!showSchema); if (!showSchema) setShowDocument(false); }}
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
        {showDocument && <DocumentViewer />}
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
