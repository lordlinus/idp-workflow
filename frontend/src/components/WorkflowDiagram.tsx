'use client';

import React from 'react';
import { useWorkflowStore } from '@/store/workflowStore';
import { formatDuration } from '@/lib/utils';
import { StepName, StepStatus } from '@/types';
import clsx from 'clsx';

/* ------------------------------------------------------------------ */
/*  Pipeline definition                                                */
/* ------------------------------------------------------------------ */

interface StepDef {
  name: StepName;
  displayName: string;
  number: number;
  icon: string;
}

/** Each column is rendered left-to-right. Columns with >1 step stack vertically (parallel). */
const PIPELINE_ROWS: StepDef[][] = [
  [{ name: 'step_01_pdf_extraction', displayName: 'PDF Extractor', number: 1, icon: '📄' }],
  [{ name: 'step_02_classification', displayName: 'Classifier', number: 2, icon: '🏷️' }],
  [
    { name: 'step_03_01_azure_extraction', displayName: 'Azure CU', number: 3, icon: '☁️' },
    { name: 'step_03_02_dspy_extraction', displayName: 'LLM', number: 3, icon: '🤖' },
  ],
  [{ name: 'step_04_comparison', displayName: 'Comparator', number: 4, icon: '⚖️' }],
  [{ name: 'step_05_human_review', displayName: 'Human Review', number: 5, icon: '👤' }],
  [{ name: 'step_06_reasoning_agent', displayName: 'Reasoner', number: 6, icon: '🧠' }],
];

/* ------------------------------------------------------------------ */
/*  Status styling config                                              */
/* ------------------------------------------------------------------ */

const STATUS_STYLES: Record<StepStatus | 'pending', {
  bg: string;
  border: string;
  glow: string;
  text: string;
  badge: string;
  badgeText: string;
  iconBg: string;
}> = {
  pending: {
    bg: 'bg-dark-800/60',
    border: 'border-dark-600/40',
    glow: '',
    text: 'text-dark-400',
    badge: 'bg-dark-700',
    badgeText: 'text-dark-500',
    iconBg: 'bg-dark-700/60',
  },
  running: {
    bg: 'bg-gradient-to-br from-blue-950/80 to-blue-900/40',
    border: 'border-blue-500/50',
    glow: 'shadow-glow-blue',
    text: 'text-blue-200',
    badge: 'bg-blue-500/20',
    badgeText: 'text-blue-300',
    iconBg: 'bg-blue-500/20',
  },
  completed: {
    bg: 'bg-gradient-to-br from-emerald-950/80 to-emerald-900/30',
    border: 'border-emerald-500/40',
    glow: 'shadow-glow-emerald',
    text: 'text-emerald-200',
    badge: 'bg-emerald-500/20',
    badgeText: 'text-emerald-300',
    iconBg: 'bg-emerald-500/20',
  },
  failed: {
    bg: 'bg-gradient-to-br from-red-950/80 to-red-900/30',
    border: 'border-red-500/40',
    glow: 'shadow-glow-red',
    text: 'text-red-200',
    badge: 'bg-red-500/20',
    badgeText: 'text-red-300',
    iconBg: 'bg-red-500/20',
  },
};

/* ------------------------------------------------------------------ */
/*  Status indicator dot                                               */
/* ------------------------------------------------------------------ */

function StatusDot({ status }: { status: StepStatus | 'pending' }) {
  if (status === 'completed') {
    return (
      <div className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20">
        <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  if (status === 'running') {
    return (
      <div className="relative flex items-center justify-center w-4 h-4">
        <div className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping" />
        <div className="w-2 h-2 rounded-full bg-blue-400" />
      </div>
    );
  }
  if (status === 'failed') {
    return (
      <div className="flex items-center justify-center w-4 h-4 rounded-full bg-red-500/20">
        <svg className="w-2.5 h-2.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-4 h-4 flex items-center justify-center">
      <div className="w-2 h-2 rounded-full bg-dark-500/60" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Individual step node                                               */
/* ------------------------------------------------------------------ */

function StepNode({ step, onClick }: { step: StepDef; onClick: (name: StepName) => void }) {
  const stepData = useWorkflowStore((state) => state.steps.get(step.name));
  const selectedStep = useWorkflowStore((state) => state.selectedStep);
  const status = (stepData?.status || 'pending') as StepStatus | 'pending';
  const duration = stepData?.durationMs;
  const isSelected = selectedStep === step.name;
  const styles = STATUS_STYLES[status];

  return (
    <button
      type="button"
      onClick={() => onClick(step.name)}
      className={clsx(
        'group relative w-[140px] rounded-xl border px-3 py-2.5 flex flex-col items-center text-center',
        'cursor-pointer transition-all duration-300 ease-out',
        'hover:scale-[1.04] hover:brightness-110 focus:outline-none',
        styles.bg,
        styles.border,
        status !== 'pending' && styles.glow,
        status === 'running' && 'animate-pulse-glow',
        isSelected && 'ring-2 ring-yellow-400/80 ring-offset-2 ring-offset-dark-900 scale-[1.04]',
      )}
    >
      {/* Top: icon + status dot row */}
      <div className="flex items-center justify-between w-full mb-1.5">
        <span className={clsx('w-7 h-7 rounded-lg flex items-center justify-center text-sm', styles.iconBg)}>
          {step.icon}
        </span>
        <StatusDot status={status} />
      </div>

      {/* Label */}
      <span className={clsx(
        'font-semibold text-xs leading-tight w-full text-left truncate transition-colors duration-200',
        status === 'pending' ? 'text-dark-300' : 'text-dark-50',
      )}>
        {step.displayName}
      </span>

      {/* Duration badge */}
      {duration != null && duration > 0 ? (
        <span className={clsx(
          'mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full w-fit self-start',
          styles.badge, styles.badgeText,
        )}>
          {formatDuration(duration)}
        </span>
      ) : status === 'running' ? (
        <span className="mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full w-fit self-start bg-blue-500/20 text-blue-300">
          Processing...
        </span>
      ) : null}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated SVG connector                                             */
/* ------------------------------------------------------------------ */

function ConnectorLine({ colIdx }: { colIdx: number }) {
  const steps = useWorkflowStore((state) => state.steps);

  const prevCol = PIPELINE_ROWS[colIdx];
  const nextCol = PIPELINE_ROWS[colIdx + 1];

  const allPrevCompleted = prevCol.every(
    (s) => (steps.get(s.name)?.status || 'pending') === 'completed',
  );
  const anyNextRunning = nextCol.some(
    (s) => (steps.get(s.name)?.status || 'pending') === 'running',
  );
  const anyNextCompleted = nextCol.some(
    (s) => (steps.get(s.name)?.status || 'pending') === 'completed',
  );

  const isActive = anyNextRunning || allPrevCompleted;
  const isDone = allPrevCompleted && anyNextCompleted;

  const strokeColor = isDone
    ? '#10B981'
    : anyNextRunning
      ? '#3B82F6'
      : allPrevCompleted
        ? '#10B981'
        : '#374151';

  return (
    <div className="flex items-center justify-center flex-shrink-0 w-8">
      <svg width="32" height="12" viewBox="0 0 32 12" className="overflow-visible">
        {/* Background track */}
        <line x1="0" y1="6" x2="32" y2="6" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />
        {/* Active line */}
        <line
          x1="0" y1="6" x2="32" y2="6"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={isActive && !isDone ? '4 4' : 'none'}
          className={isActive && !isDone ? 'animate-flow-dash' : ''}
          style={{ transition: 'stroke 0.5s ease' }}
        />
        {/* Arrowhead */}
        <polygon
          points="28,2 32,6 28,10"
          fill={strokeColor}
          style={{ transition: 'fill 0.5s ease' }}
        />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function WorkflowDiagram() {
  const selectStep = useWorkflowStore((state) => state.selectStep);
  const selectedStep = useWorkflowStore((state) => state.selectedStep);

  const handleNodeClick = (stepName: StepName) => {
    selectStep(selectedStep === stepName ? null : stepName);
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-center justify-center gap-1 px-4 py-4 min-w-fit">
        {PIPELINE_ROWS.map((col, colIdx) => (
          <React.Fragment key={colIdx}>
            {colIdx > 0 && <ConnectorLine colIdx={colIdx - 1} />}
            <div className={clsx(
              'flex flex-col items-center gap-2 flex-shrink-0',
              col.length > 1 && 'relative',
            )}>
              {/* Parallel step bracket indicator */}
              {col.length > 1 && (
                <div className="absolute -left-2 top-1 bottom-1 w-0.5 rounded-full bg-gradient-to-b from-blue-500/40 via-purple-500/40 to-blue-500/40" />
              )}
              {col.map((step) => (
                <StepNode key={step.name} step={step} onClick={handleNodeClick} />
              ))}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
