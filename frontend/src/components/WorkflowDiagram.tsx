'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useWorkflowStore } from '@/store/workflowStore';
import { formatDuration, getStatusIcon } from '@/lib/utils';
import { StepName } from '@/types';
import clsx from 'clsx';

/* ------------------------------------------------------------------ */
/*  Pipeline definition                                                */
/* ------------------------------------------------------------------ */

interface StepDef {
  name: StepName;
  displayName: string;
  number: number;
}

/** Each "row" is rendered vertically. Rows with >1 step are parallel. */
const PIPELINE_ROWS: StepDef[][] = [
  [{ name: 'step_01_pdf_extraction', displayName: 'PDF Extractor', number: 1 }],
  [{ name: 'step_02_classification', displayName: 'Classifier', number: 2 }],
  [
    { name: 'step_03_01_azure_extraction', displayName: 'Azure Extractor', number: 3 },
    { name: 'step_03_02_dspy_extraction', displayName: 'DSPy Extractor', number: 3 },
  ],
  [{ name: 'step_04_comparison', displayName: 'Comparator', number: 4 }],
  [{ name: 'step_05_human_review', displayName: 'Human Review', number: 5 }],
  [{ name: 'step_06_reasoning_agent', displayName: 'Reasoner', number: 6 }],
];

/* ------------------------------------------------------------------ */
/*  Individual step node                                               */
/* ------------------------------------------------------------------ */

function StepNode({ step, onClick }: { step: StepDef; onClick: (name: StepName) => void }) {
  const stepData = useWorkflowStore((state) => state.steps.get(step.name));
  const selectedStep = useWorkflowStore((state) => state.selectedStep);
  const status = stepData?.status || 'pending';
  const duration = stepData?.durationMs;
  const isSelected = selectedStep === step.name;

  return (
    <button
      type="button"
      onClick={() => onClick(step.name)}
      className={clsx(
        'relative w-[150px] rounded-lg border-2 px-3 py-2.5 flex flex-col items-center text-center cursor-pointer transition-all duration-200',
        'hover:brightness-125 hover:-translate-y-0.5 focus:outline-none',
        status === 'running' && 'animate-pulse',
        isSelected && 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-[#0f172a]',
      )}
      style={{
        backgroundColor:
          status === 'running'
            ? '#1e3a5f'
            : status === 'completed'
              ? '#064e3b'
              : status === 'failed'
                ? '#7f1d1d'
                : '#1f2937',
        borderColor: isSelected
          ? '#fbbf24'
          : status === 'running'
            ? '#3b82f6'
            : status === 'completed'
              ? '#10b981'
              : status === 'failed'
                ? '#ef4444'
                : '#374151',
      }}
    >
      {/* Status icon + step number */}
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-sm leading-none">{getStatusIcon(status)}</span>
        <span className="text-[10px] font-mono text-gray-400">#{step.number}</span>
      </div>
      {/* Name */}
      <p className="font-semibold text-white text-xs leading-tight">{step.displayName}</p>
      {/* Duration */}
      {duration != null && duration > 0 && (
        <p className="text-[10px] text-gray-400 mt-0.5">{formatDuration(duration)}</p>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  SVG connector between rows                                         */
/* ------------------------------------------------------------------ */

function Connector({
  fromCount,
  toCount,
}: {
  fromCount: number;
  toCount: number;
}) {
  const NODE_W = 150;
  const GAP = 24;
  const SVG_H = 40;

  const maxCount = Math.max(fromCount, toCount);
  const totalW = maxCount * NODE_W + (maxCount - 1) * GAP;

  const centers = (count: number): number[] => {
    const rowW = count * NODE_W + (count - 1) * GAP;
    const offset = (totalW - rowW) / 2;
    return Array.from({ length: count }, (_, i) => offset + i * (NODE_W + GAP) + NODE_W / 2);
  };

  const fromCenters = centers(fromCount);
  const toCenters = centers(toCount);

  const paths: React.ReactNode[] = [];
  for (const fx of fromCenters) {
    for (const tx of toCenters) {
      const midY = SVG_H / 2;
      const d = `M ${fx} 0 C ${fx} ${midY}, ${tx} ${midY}, ${tx} ${SVG_H}`;
      paths.push(
        <path
          key={`${fx}-${tx}`}
          d={d}
          fill="none"
          stroke="#475569"
          strokeWidth={2}
          strokeLinecap="round"
        />,
      );
    }
  }

  return (
    <svg
      width={totalW}
      height={SVG_H}
      viewBox={`0 0 ${totalW} ${SVG_H}`}
      className="flex-shrink-0"
      style={{ display: 'block', margin: '0 auto' }}
    >
      {paths}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function WorkflowDiagram() {
  const selectStep = useWorkflowStore((state) => state.selectStep);
  const selectedStep = useWorkflowStore((state) => state.selectedStep);
  const steps = useWorkflowStore((state) => state.steps);

  const step3Azure = steps.get('step_03_01_azure_extraction');
  const step3Dspy = steps.get('step_03_02_dspy_extraction');
  const isParallelRunning = step3Azure?.status === 'running' && step3Dspy?.status === 'running';

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const computeScale = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    // Reset scale to 1 to measure natural content size
    content.style.transform = 'scale(1)';
    const contentH = content.scrollHeight;
    const contentW = content.scrollWidth;
    const containerH = container.clientHeight;
    const containerW = container.clientWidth;

    if (contentH === 0 || contentW === 0) return;

    // Scale to fit both dimensions, cap at 1 (never enlarge)
    const s = Math.min(1, containerH / contentH, containerW / contentW);
    setScale(s);
    content.style.transform = `scale(${s})`;
  }, []);

  useEffect(() => {
    computeScale();
    const ro = new ResizeObserver(() => computeScale());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [computeScale]);

  const handleNodeClick = (stepName: StepName) => {
    selectStep(selectedStep === stepName ? null : stepName);
  };

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden">
      <div
        ref={contentRef}
        className="flex flex-col items-center py-8 px-4 origin-top"
        style={{ transform: `scale(${scale})` }}
      >
        {PIPELINE_ROWS.map((row, rowIdx) => (
          <React.Fragment key={rowIdx}>
            {rowIdx > 0 && (
              <Connector
                fromCount={PIPELINE_ROWS[rowIdx - 1].length}
                toCount={row.length}
              />
            )}
            <div className="relative flex items-center gap-6 flex-shrink-0">
              {row.length > 1 && isParallelRunning && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-6 z-10">
                  <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-full animate-pulse whitespace-nowrap">
                    ⚡ Running in Parallel
                  </span>
                </div>
              )}
              {row.map((step) => (
                <StepNode key={step.name} step={step} onClick={handleNodeClick} />
              ))}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
