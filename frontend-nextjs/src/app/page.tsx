'use client';

import React from 'react';
import { useWorkflowStore } from '@/store/workflowStore';
import { useUIStore } from '@/store/uiStore';
import { Toast } from '@/components/Toast';
import { ConnectionIndicator } from '@/components/ConnectionIndicator';
import { FileUploadArea } from '@/components/FileUploadArea';
import { HITLReviewPanel } from '@/components/HITLReviewPanel';
import { DetailPanel } from '@/components/DetailPanel';
import clsx from 'clsx';

import { WorkflowDiagram } from '@/components/WorkflowDiagram';

export default function Page() {
  const [currentPage, setCurrentPage] = React.useState<'upload' | 'execution'>('upload');
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const instanceId = useWorkflowStore((state) => state.instanceId);
  const toast = useUIStore((state) => state.toast);
  const clearToast = useUIStore((state) => state.clearToast);
  const reset = useWorkflowStore((state) => state.reset);

  const handleWorkflowStart = (id: string) => {
    const now = new Date().toISOString();
    document.cookie = `lastUploadUser=${encodeURIComponent(now)}; path=/; max-age=2592000`;
    setIsTransitioning(true);
    setTimeout(() => {
      setIsTransitioning(false);
      setCurrentPage('execution');
    }, 1200);
  };

  const handleReset = () => {
    reset();
    setCurrentPage('upload');
  };

  return (
    <div className="h-screen flex flex-col bg-dark-900 overflow-hidden">
      {/* Header */}
      <header className="border-b border-dark-700 bg-dark-900 flex-shrink-0">
        <div className="max-w-full mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📄</span>
            <div>
              <h1 className="text-xl font-bold text-dark-50">Document Intelligence</h1>
              <p className="text-xs text-dark-400">AI-Powered Extraction Workbench</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ConnectionIndicator />

            {currentPage === 'execution' && (
              <button
                onClick={handleReset}
                className="btn-secondary text-sm"
              >
                ↺ New Workflow
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-4 overflow-hidden">
        {isTransitioning ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center animate-pulse">
              <span className="text-5xl block mb-4">🚀</span>
              <p className="text-xl font-bold text-dark-50 mb-2">Initializing Workflow</p>
              <p className="text-sm text-dark-400">Connecting to AI pipeline...</p>
              <div className="mt-4 flex justify-center">
                <div className="h-1 w-48 bg-dark-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full animate-[loading_1.2s_ease-in-out_infinite]" 
                    style={{ width: '60%', animation: 'loading 1.2s ease-in-out infinite' }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : currentPage === 'upload' ? (
          /* Upload Page */
          <div className="max-w-2xl mx-auto pt-8">
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-bold text-dark-50 mb-3">Intelligent Document Processing</h2>
              <p className="text-dark-400 max-w-lg mx-auto">
                Upload a document to run the 6-step AI pipeline: extract, classify, compare, review, and reason.
              </p>
            </div>
            <FileUploadArea onWorkflowStart={handleWorkflowStart} />
          </div>
        ) : (
          /* Execution Page - Two-column layout */
          <div className="flex gap-3 h-full">
            {/* Center: Workflow Diagram */}
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="rounded-lg border border-dark-700 bg-dark-800 flex-1 flex flex-col overflow-hidden shadow-lg">
                {/* Header */}
                <div className="border-b border-dark-700 bg-dark-900 px-6 py-4 flex items-center justify-between flex-shrink-0">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-dark-50">Workflow Execution</h3>
                    <p className="text-xs text-dark-400 mt-1">Click nodes to view step details</p>
                  </div>
                  <WorkflowStatus />
                </div>
                {/* Diagram */}
                <div className="flex-1 relative bg-dark-800 overflow-y-auto">
                  <WorkflowDiagram />
                </div>
              </div>
            </div>

            {/* Right: Detail Panel (always visible) */}
            <div className="w-[420px] flex-shrink-0">
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

function WorkflowStatus() {
  const status = useWorkflowStore((state) => state.status);
  const steps = useWorkflowStore((state) => state.steps);
  const completedCount = Array.from(steps.values()).filter((s) => s.status === 'completed').length;

  const statusColor = {
    idle: 'text-gray-400',
    initializing: 'text-blue-400',
    running: 'text-blue-400',
    completed: 'text-green-400',
    failed: 'text-red-400',
  };

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-2">
        <div
          className={clsx(
            'w-2 h-2 rounded-full',
            status === 'running' && 'bg-blue-500 animate-pulse',
            status === 'completed' && 'bg-green-500',
            status === 'failed' && 'bg-red-500',
            (status === 'idle' || status === 'initializing') && 'bg-gray-500'
          )}
        />
        <span className={statusColor[status] || 'text-gray-400'}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>
      <div className="text-dark-400">
        <span className="text-green-400 font-medium">{completedCount}</span>/6 steps
      </div>
    </div>
  );
}
