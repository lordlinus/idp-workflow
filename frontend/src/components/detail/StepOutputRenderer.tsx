import React from 'react';
import ReactMarkdown from 'react-markdown';
import { getConfidenceColor } from '@/lib/formatting';
import { StepName } from '@/types';
import { ValueDisplay } from './ValueDisplay';
import { ValidationRulesPanel } from './ValidationRulesPanel';
import clsx from 'clsx';

interface StepOutputRendererProps {
  stepName: StepName;
  output: Record<string, unknown>;
}

/** Dispatcher that routes to the right renderer based on step name. */
export function StepOutputRenderer({ stepName, output }: StepOutputRendererProps) {
  // Step 1: PDF Extraction — show markdown preview
  if (stepName === 'step_01_pdf_extraction') {
    return <PDFExtractionOutput output={output} />;
  }

  // Step 2: Classification — show primary category + classifications table
  if (stepName === 'step_02_classification') {
    return <ClassificationOutput output={output} />;
  }

  // Steps 3a/3b: Extraction — show extracted_data as formatted JSON
  if (stepName === 'step_03_01_azure_extraction' || stepName === 'step_03_02_dspy_extraction') {
    return <ExtractionOutput output={output} stepName={stepName} />;
  }

  // Step 6: Reasoning Agent — show AI summary as markdown + recommendations
  if (stepName === 'step_06_reasoning_agent') {
    return <ReasoningAgentOutput output={output} />;
  }

  // Default fallback: generic key-value rendering (Step 4, Step 5, etc.)
  return <GenericOutput output={output} />;
}

/* ------------------------------------------------------------------ */
/*  Step 1: PDF Extraction                                             */
/* ------------------------------------------------------------------ */

function PDFExtractionOutput({ output }: { output: Record<string, unknown> }) {
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

/* ------------------------------------------------------------------ */
/*  Step 2: Classification                                             */
/* ------------------------------------------------------------------ */

function ClassificationOutput({ output }: { output: Record<string, unknown> }) {
  // The activity returns: { classifications: { pages_classified, classifications: [...], primary_category, primary_confidence }, classification_result: { categories: [...] }, primary_category, processing_time_ms }
  const classificationsObj = output.classifications as Record<string, unknown> | undefined;
  const primaryCategory = String(output.primary_category ?? classificationsObj?.primary_category ?? 'Unknown');
  const primaryConfidence = Number(classificationsObj?.primary_confidence ?? output.primary_confidence ?? 0);
  const pagesClassified = Number(classificationsObj?.pages_classified ?? 0);

  // Per-page classifications — nested inside classifications.classifications
  const classificationsList: Array<Record<string, unknown>> =
    (Array.isArray(classificationsObj?.classifications)
      ? classificationsObj!.classifications as Array<Record<string, unknown>>
      : null)
    ?? (Array.isArray(output.classifications) ? output.classifications as Array<Record<string, unknown>> : [])
    ?? [];

  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 p-4">
          <p className="text-xs text-dark-400 mb-1">Primary Category</p>
          <p className="text-lg font-bold text-dark-50">{primaryCategory}</p>
          <p className="text-sm text-dark-300 mt-1">
            Confidence: <span className={clsx('font-medium', getConfidenceColor(primaryConfidence, { medium: 0.5 }))}>
              {(primaryConfidence * 100).toFixed(0)}%
            </span>
          </p>
        </div>
        <div className="rounded-lg bg-dark-900 border border-dark-700 p-4 flex flex-col items-center justify-center">
          <p className="text-xl font-bold text-purple-400">{pagesClassified}</p>
          <p className="text-xs text-dark-400">Pages Classified</p>
        </div>
      </div>

      {/* Per-page classification table */}
      {classificationsList.length > 0 && (
        <div className="rounded-lg bg-dark-900 border border-dark-700 p-3">
          <p className="text-xs font-medium text-dark-400 uppercase tracking-wider mb-3">Page-by-Page Classifications</p>
          <div className="space-y-2">
            {classificationsList.map((cls, i) => {
              const detectedFields = (cls.detected_fields as string[] | undefined) ?? [];
              return (
                <div key={i} className="rounded bg-dark-800 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-dark-700 text-dark-300 px-1.5 py-0.5 rounded font-mono">
                        p{String(cls.page_number ?? cls.page ?? i + 1)}
                      </span>
                      <span className="text-sm text-dark-200 font-medium">{String(cls.category ?? '—')}</span>
                    </div>
                    <span className={clsx(
                      'text-xs font-medium',
                      getConfidenceColor(Number(cls.confidence ?? 0), { medium: 0.5 })
                    )}>
                      {(Number(cls.confidence ?? 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                  {detectedFields.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {detectedFields.map((field, fi) => (
                        <span key={fi} className="text-[10px] bg-dark-700 text-dark-400 px-1.5 py-0.5 rounded">
                          {field}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 3: Extraction (Azure CU / DSPy LLM)                          */
/* ------------------------------------------------------------------ */

function ExtractionOutput({ output, stepName }: { output: Record<string, unknown>; stepName: StepName }) {
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

/* ------------------------------------------------------------------ */
/*  Step 6: Reasoning Agent (completed output)                         */
/* ------------------------------------------------------------------ */

function ReasoningAgentOutput({ output }: { output: Record<string, unknown> }) {
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

/* ------------------------------------------------------------------ */
/*  Default: generic key-value rendering                               */
/* ------------------------------------------------------------------ */

function GenericOutput({ output }: { output: Record<string, unknown> }) {
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
}
