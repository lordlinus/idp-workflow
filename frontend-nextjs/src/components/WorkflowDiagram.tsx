import React from 'react';
import { Canvas, Node, Edge, Label, CanvasPosition, type CanvasRef } from 'reaflow';
import { useWorkflowStore } from '@/store/workflowStore';
import { formatDuration, getStatusIcon } from '@/lib/utils';
import { StepName } from '@/types';
import clsx from 'clsx';

const STEPS = [
  { name: 'step_01_pdf_extraction', displayName: 'PDF Extractor', number: 1 },
  { name: 'step_02_classification', displayName: 'Classifier', number: 2 },
  { name: 'step_03_01_azure_extraction', displayName: 'Azure Extractor', number: 3, parallel: true },
  { name: 'step_03_02_dspy_extraction', displayName: 'DSPy Extractor', number: 3, parallel: true },
  { name: 'step_04_comparison', displayName: 'Comparator', number: 4 },
  { name: 'step_05_human_review', displayName: 'Human Review', number: 5 },
  { name: 'step_06_reasoning_agent', displayName: 'Reasoner', number: 6 },
];

// Custom node component for Reaflow
function StepNodeContent({ 
  id, 
  width, 
  height,
  onNodeClick 
}: { 
  id: string; 
  width: number; 
  height: number;
  onNodeClick: (stepName: StepName) => void;
}) {
  const steps = useWorkflowStore((state) => state.steps);
  const selectedStep = useWorkflowStore((state) => state.selectedStep);
  const step = STEPS.find((s) => s.name === id);
  const stepData = steps.get(id as any);
  const status = stepData?.status || 'pending';
  const duration = stepData?.durationMs;
  const isSelected = selectedStep === id;

  if (!step) return null;

  const bgColor =
    status === 'running'
      ? '#1e3a5f'
      : status === 'completed'
        ? '#064e3b'
        : status === 'failed'
          ? '#7f1d1d'
          : '#1f2937';

  const borderColor = isSelected
    ? '#fbbf24'
    : status === 'running'
      ? '#3b82f6'
      : status === 'completed'
        ? '#10b981'
        : status === 'failed'
          ? '#ef4444'
          : '#374151';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNodeClick(id as StepName);
  };

  return (
    <foreignObject width={width} height={height} x={0} y={0}>
      <div
        onClick={handleClick}
        className={clsx(
          'w-full h-full rounded-md border-2 p-1.5 flex flex-col justify-center items-center text-center cursor-pointer transition-all hover:scale-105',
          status === 'running' && 'animate-pulse',
          isSelected && 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-dark-800'
        )}
        style={{ backgroundColor: bgColor, borderColor }}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{getStatusIcon(status as any)}</span>
          <span className="text-[10px] font-mono text-gray-400">#{step.number}</span>
        </div>
        <p className="font-semibold text-white text-xs leading-tight">{step.displayName}</p>
        {duration && <p className="text-[10px] text-gray-400">{formatDuration(duration)}</p>}
      </div>
    </foreignObject>
  );
}

export function WorkflowDiagram() {
  const steps = useWorkflowStore((state) => state.steps);
  const selectStep = useWorkflowStore((state) => state.selectStep);
  const selectedStep = useWorkflowStore((state) => state.selectedStep);

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<CanvasRef | null>(null);
  const [containerHeight, setContainerHeight] = React.useState<number | string>('100%');

  const handleNodeClick = (stepName: StepName) => {
    // Toggle selection - click same node to deselect
    selectStep(selectedStep === stepName ? null : stepName);
  };

  // Build nodes - compact size to fit in viewport at 100% zoom
  const nodes = STEPS.map((step) => ({
    id: step.name,
    text: step.displayName,
    width: 140,
    height: 55,
    data: {
      stepName: step.name,
      displayName: step.displayName,
      number: step.number,
    },
  }));

  // Build edges
  const edges = [
    { id: 'e1-2', from: 'step_01_pdf_extraction', to: 'step_02_classification' },
    { id: 'e2-3a', from: 'step_02_classification', to: 'step_03_01_azure_extraction' },
    { id: 'e2-3b', from: 'step_02_classification', to: 'step_03_02_dspy_extraction' },
    { id: 'e3a-4', from: 'step_03_01_azure_extraction', to: 'step_04_comparison' },
    { id: 'e3b-4', from: 'step_03_02_dspy_extraction', to: 'step_04_comparison' },
    { id: 'e4-5', from: 'step_04_comparison', to: 'step_05_human_review' },
    { id: 'e5-6', from: 'step_05_human_review', to: 'step_06_reasoning_agent' },
  ];

  const fitToContainer = React.useCallback(() => {
    // No-op: We want to maintain 1:1 scale and allow scrolling/panning from Top
  }, []);

  React.useEffect(() => {
    // No initial fit required if we are using defaultPosition=TOP and fit=false
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: containerHeight, minHeight: '100%', position: 'relative', background: '#0f172a' }}>
      <Canvas
        ref={canvasRef}
        nodes={nodes}
        edges={edges}
        direction="DOWN"
        fit={false}
        pannable={false}
        zoomable={false}
        defaultPosition={CanvasPosition.TOP}
        layoutOptions={{
          'elk.nodeLabels.placement': 'INSIDE V_CENTER H_CENTER',
          'elk.algorithm': 'layered',
          'elk.direction': 'DOWN',
          'elk.spacing.nodeNode': '60', // Horizontal spacing between parallel nodes
          'elk.layered.spacing.nodeNodeBetweenLayers': '80', // Vertical spacing between steps
          'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
        }}
        onLayoutChange={(layout) => {
          if (layout.height) {
            // Add padding to bottom to ensure comfortable scrolling
            setContainerHeight(layout.height + 100);
          }
        }}
        node={(nodeProps) => {
          // React 19 fix: Don't spread key from props
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { key, ...rest } = nodeProps as any;
          return (
            <Node
              key={key}
              {...rest}
              style={{ fill: 'transparent', stroke: 'transparent' }}
              label={<Label style={{ display: 'none' }} />}
            >
              {(event) => (
                <StepNodeContent
                  id={event.node.id}
                  width={event.width}
                  height={event.height}
                  onNodeClick={handleNodeClick}
                />
              )}
            </Node>
          );
        }}
        edge={(edgeProps) => {
          // React 19 fix: Don't spread key from props
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { key, ...rest } = edgeProps as any;
          return (
            <Edge
              key={key}
              {...rest}
              interpolation="curved"
              style={{ stroke: '#94a3b8', strokeWidth: 2 }}
            />
          );
        }}
      />
    </div>
  );
}
