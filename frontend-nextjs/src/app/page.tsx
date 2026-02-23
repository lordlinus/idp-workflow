'use client';

import React from 'react';
import { useWorkflowStore } from '@/store/workflowStore';
import { useUIStore } from '@/store/uiStore';
import { Toast } from '@/components/Toast';
import { ConnectionIndicator } from '@/components/ConnectionIndicator';
import { FileUploadArea } from '@/components/FileUploadArea';
import { WorkflowDiagram } from '@/components/WorkflowDiagram';
import { HITLReviewPanel } from '@/components/HITLReviewPanel';
import { DetailPanel } from '@/components/DetailPanel';
import { HistorySidebar } from '@/components/HistorySidebar';
import clsx from 'clsx';

export default function Page() {
  const [currentPage, setCurrentPage] = React.useState<'upload' | 'execution'>('upload');
  const [detailsExpanded, setDetailsExpanded] = React.useState(true);
  const instanceId = useWorkflowStore((state) => state.instanceId);
  const selectedStep = useWorkflowStore((state) => state.selectedStep);
  const toast = useUIStore((state) => state.toast);
  const clearToast = useUIStore((state) => state.clearToast);
  const reset = useWorkflowStore((state) => state.reset);
  const sidebarCollapsed = useWorkflowStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useWorkflowStore((state) => state.toggleSidebar);

  const handleWorkflowStart = (id: string) => {
    // Store user info for history filtering
    const now = new Date().toISOString();
    document.cookie = `lastUploadUser=${encodeURIComponent(now)}; path=/; max-age=2592000`;
    setCurrentPage('execution');
  };

  const handleReset = () => {
    reset();
    setCurrentPage('upload');
  };

  const handleHistoryLoad = (loadedInstanceId: string) => {
    setCurrentPage('execution');
  };

  // Auto-expand details when a step is selected
  React.useEffect(() => {
    if (selectedStep) {
      setDetailsExpanded(true);
    }
  }, [selectedStep]);

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
              <>
                <button
                  onClick={toggleSidebar}
                  className="btn-secondary text-sm flex items-center gap-2"
                  title={sidebarCollapsed ? 'Show History' : 'Hide History'}
                >
                  {sidebarCollapsed ? '📋 Show History' : '◀ Hide History'}
                </button>
                <button
                  onClick={handleReset}
                  className="btn-secondary text-sm"
                >
                  ↺ New Workflow
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-4 overflow-hidden">
        {currentPage === 'upload' ? (
          /* Upload Page */
          <div className="max-w-2xl mx-auto">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-dark-50 mb-2">Get Started</h2>
              <p className="text-dark-400">Upload a document to begin the intelligent processing workflow</p>
            </div>
            <FileUploadArea onWorkflowStart={handleWorkflowStart} />
          </div>
        ) : (
          /* Execution Page - Three-column layout */
          <div className="flex gap-3 h-full">
            {/* Left: History Sidebar (Collapsible) */}
            <div
              className={clsx(
                'transition-all duration-300 overflow-hidden flex-shrink-0',
                sidebarCollapsed ? 'w-0' : 'w-64'
              )}
            >
              <div className="w-64 h-full rounded-lg border border-dark-700 bg-dark-800 overflow-hidden">
                <HistorySidebar onHistoryLoad={handleHistoryLoad} />
              </div>
            </div>

            {/* Center: Workflow Diagram (Main focus) */}
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

            {/* Right: Detail Panel (Collapsible based on selection) */}
            <div
              className={clsx(
                'transition-all duration-300 overflow-hidden flex-shrink-0',
                selectedStep && detailsExpanded ? 'w-96' : 'w-0'
              )}
            >
              <div className="w-96 h-full rounded-lg border border-dark-700 bg-dark-800 overflow-hidden shadow-lg">
                <DetailPanel />
              </div>
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
