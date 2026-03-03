import { StepName } from '@/types';

/* ------------------------------------------------------------------ */
/*  Centralized step configuration                                     */
/*  To add a new step, edit this file only (and optionally add a       */
/*  step-specific output component in DetailPanel).                    */
/* ------------------------------------------------------------------ */

export interface StepConfig {
  name: StepName;
  /** Pipeline step number (parallel steps share the same number). */
  number: number;
  /** Short label for the workflow diagram. */
  displayName: string;
  /** Longer label used in status sync / SignalR catch-up. */
  fullDisplayName: string;
  /** Description shown in the detail panel. */
  description: string;
  icon: string;
}

const STEP_CONFIGS: StepConfig[] = [
  {
    name: 'step_01_pdf_extraction',
    number: 1,
    displayName: 'PDF Extractor',
    fullDisplayName: 'PDF Extractor',
    description: 'Extracts text, tables, and structure from uploaded PDF documents',
    icon: '📄',
  },
  {
    name: 'step_02_classification',
    number: 2,
    displayName: 'Classifier',
    fullDisplayName: 'Document Classifier',
    description: 'Classifies document type and identifies the processing domain',
    icon: '🏷️',
  },
  {
    name: 'step_03_01_azure_extraction',
    number: 3,
    displayName: 'Azure CU',
    fullDisplayName: 'Azure Document Intelligence',
    description: 'Extracts structured fields using Azure AI Document Intelligence',
    icon: '☁️',
  },
  {
    name: 'step_03_02_dspy_extraction',
    number: 3,
    displayName: 'LLM',
    fullDisplayName: 'DSPy LLM Extractor',
    description: 'Extracts fields using DSPy with configurable LLM (Azure OpenAI, Claude, Azure AI Models)',
    icon: '🤖',
  },
  {
    name: 'step_04_comparison',
    number: 4,
    displayName: 'Comparator',
    fullDisplayName: 'Field Comparator',
    description: 'Compares extraction results from Azure and DSPy, identifies conflicts',
    icon: '⚖️',
  },
  {
    name: 'step_05_human_review',
    number: 5,
    displayName: 'Human Review',
    fullDisplayName: 'Human Review',
    description: 'Human-in-the-loop validation and conflict resolution',
    icon: '👤',
  },
  {
    name: 'step_06_reasoning_agent',
    number: 6,
    displayName: 'Reasoner',
    fullDisplayName: 'Reasoning Agent',
    description: 'AI agent performs final validation and generates confidence scores',
    icon: '🧠',
  },
];

/** Total number of step slots (counting parallel steps individually). */
export const TOTAL_STEPS = STEP_CONFIGS.length;

/** Ordered step names. */
export const STEP_ORDER: StepName[] = STEP_CONFIGS.map((s) => s.name);

/** Display names keyed by step name (uses fullDisplayName for backward compat). */
export const STEP_DISPLAY_NAMES: Record<string, string> = Object.fromEntries(
  STEP_CONFIGS.map((s) => [s.name, s.fullDisplayName]),
);

/** Step info (icon, description, displayName) keyed by step name. */
export const STEP_INFO: Record<string, { displayName: string; description: string; icon: string }> =
  Object.fromEntries(
    STEP_CONFIGS.map((s) => [
      s.name,
      { displayName: s.fullDisplayName, description: s.description, icon: s.icon },
    ]),
  );

/** Map step number → step names (parallel steps share a number). */
export const STEP_NUM_TO_NAMES: Record<number, StepName[]> = STEP_CONFIGS.reduce(
  (acc, s) => {
    (acc[s.number] ??= []).push(s.name);
    return acc;
  },
  {} as Record<number, StepName[]>,
);

/** Pipeline rows for the workflow diagram — each inner array is a column (parallel steps stack). */
export const PIPELINE_ROWS: { name: StepName; displayName: string; number: number; icon: string }[][] =
  Object.values(
    STEP_CONFIGS.reduce(
      (acc, s) => {
        (acc[s.number] ??= []).push({
          name: s.name,
          displayName: s.displayName,
          number: s.number,
          icon: s.icon,
        });
        return acc;
      },
      {} as Record<number, { name: StepName; displayName: string; number: number; icon: string }[]>,
    ),
  );
