'use client';

import React from 'react';
import { useWorkflowStore } from '@/store/workflowStore';
import { useEventsStore } from '@/store/eventsStore';
import { useReasoningStore } from '@/store/reasoningStore';
import { useUIStore } from '@/store/uiStore';
import { Toast } from '@/components/Toast';
import { ConnectionIndicator } from '@/components/ConnectionIndicator';
import { FileUploadArea } from '@/components/FileUploadArea';
import { HITLReviewPanel } from '@/components/HITLReviewPanel';
import { DetailPanel } from '@/components/DetailPanel';
import clsx from 'clsx';

import { TOTAL_STEPS } from '@/lib/stepConfig';
import { WorkflowDiagram } from '@/components/WorkflowDiagram';

export default function Page() {
  const [currentPage, setCurrentPage] = React.useState<'upload' | 'execution'>('upload');
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const instanceId = useWorkflowStore((state) => state.instanceId);
  const toast = useUIStore((state) => state.toast);
  const clearToast = useUIStore((state) => state.clearToast);
  const reset = useWorkflowStore((state) => state.reset);
  const clearEvents = useEventsStore((state) => state.clearEvents);
  const clearChunks = useReasoningStore((state) => state.clearChunks);
  const setShowHITLModal = useUIStore((state) => state.setShowHITLModal);

  const handleWorkflowStart = (id: string) => {
    const now = new Date().toISOString();
    document.cookie = `lastUploadUser=${encodeURIComponent(now)}; path=/; max-age=2592000`;
    setIsTransitioning(true);
    setTimeout(() => {
      setIsTransitioning(false);
      setCurrentPage('execution');
    }, 500);
  };

  const handleReset = () => {
    reset();
    clearEvents();
    clearChunks();
    setShowHITLModal(false);
    setCurrentPage('upload');
  };

  return (
    <div className="h-screen flex flex-col bg-dark-950 overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 relative">
        {/* Gradient accent line at top */}
        <div className="h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500" />
        <div className="border-b border-dark-700/60 bg-dark-900/80 backdrop-blur-xl">
          <div className="max-w-full mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-dark-50 tracking-tight">Document Intelligence</h1>
                <p className="text-[11px] text-dark-400 tracking-wide">AI-Powered Extraction Workbench</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {currentPage === 'execution' && <ConnectionIndicator />}

              {currentPage === 'execution' && (
                <button
                  onClick={handleReset}
                  className="btn-secondary text-sm flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  New Workflow
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-3 overflow-auto">
        {isTransitioning ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center animate-fade-in">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl shadow-emerald-500/20">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-dark-50 mb-1">Launching Pipeline</p>
              <p className="text-sm text-dark-400">Preparing your workflow view...</p>
              <div className="mt-4 flex justify-center">
                <div className="h-1 w-32 bg-dark-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full animate-progress-fill" />
                </div>
              </div>
            </div>
          </div>
        ) : currentPage === 'upload' ? (
          /* Upload Page */
          <div className="max-w-2xl mx-auto pt-8">
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-bold text-dark-50 mb-3 tracking-tight">Intelligent Document Processing</h2>
              <p className="text-dark-400 max-w-lg mx-auto leading-relaxed">
                Upload a document to run the 6-step AI pipeline: extract, classify, compare, review, and reason.
              </p>
            </div>
            <FileUploadArea onWorkflowStart={handleWorkflowStart} />
          </div>
        ) : (
          /* Execution Page - Pipeline on top, detail below */
          <div className="flex flex-col gap-3 h-full">
            <HITLPendingBanner />
            {/* Top: Compact horizontal pipeline */}
            <div className="flex-shrink-0 rounded-2xl border border-dark-700/60 bg-dark-800/50 backdrop-blur-sm shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-dark-700/40 bg-dark-900/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-blue-400 to-purple-400" />
                  <h3 className="text-sm font-semibold text-dark-200 tracking-wide uppercase">Pipeline</h3>
                </div>
                <WorkflowStatus />
              </div>
              <WorkflowDiagram />
            </div>
            {/* Bottom: Full-width detail/content area */}
            <div className="flex-1 min-h-0">
              <DetailPanel />
            </div>
          </div>
        )}
      </main>

      {/* Toast Notification */}
      {toast && <Toast {...toast} onClose={clearToast} />}

      {/* HITL Modal */}
      <HITLReviewPanel />
    </div>
  );
}

function HITLPendingBanner() {
  const hitlWaiting = useWorkflowStore((state) => state.hitlWaiting);
  const hitlStatus = useWorkflowStore((state) => state.hitlStatus);
  const showHITLModal = useUIStore((state) => state.showHITLModal);
  const setShowHITLModal = useUIStore((state) => state.setShowHITLModal);

  // Show banner when HITL is waiting but modal is not showing
  if (!hitlWaiting || hitlStatus !== 'waiting' || showHITLModal) {
    return null;
  }

  return (
    <div className="flex-shrink-0 rounded-xl bg-amber-500/[0.08] border border-amber-500/20 px-5 py-3.5 flex items-center justify-between backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
          <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-amber-200">Human Review Pending</p>
          <p className="text-xs text-dark-400">
            {hitlWaiting.comparisonSummary.differingFields} conflicts to resolve •
            Workflow is waiting for your decision
          </p>
        </div>
      </div>
      <button
        onClick={() => setShowHITLModal(true)}
        className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500/15 text-amber-200 border border-amber-500/30 hover:bg-amber-500/25 transition-all duration-200 hover:shadow-glow-amber"
      >
        Resume Review →
      </button>
    </div>
  );
}

function WorkflowStatus() {
  const status = useWorkflowStore((state) => state.status);
  const steps = useWorkflowStore((state) => state.steps);
  const completedCount = Array.from(steps.values()).filter((s) => s.status === 'completed').length;

  const statusConfig = {
    idle: { color: 'text-dark-400', dotColor: 'bg-dark-500', label: 'Idle' },
    initializing: { color: 'text-blue-300', dotColor: 'bg-blue-500 animate-pulse', label: 'Initializing' },
    running: { color: 'text-blue-300', dotColor: 'bg-blue-500 animate-pulse', label: 'Running' },
    completed: { color: 'text-emerald-300', dotColor: 'bg-emerald-500', label: 'Complete' },
    failed: { color: 'text-red-300', dotColor: 'bg-red-500', label: 'Failed' },
  };

  const cfg = statusConfig[status] || statusConfig.idle;

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-dark-800/60 border border-dark-700/40">
        <div className={clsx('w-1.5 h-1.5 rounded-full', cfg.dotColor)} />
        <span className={clsx('text-xs font-medium', cfg.color)}>{cfg.label}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-dark-400">
        <span className="text-emerald-400 font-semibold">{completedCount}</span>
        <span>/</span>
        <span>{TOTAL_STEPS} steps</span>
      </div>
    </div>
  );
}
