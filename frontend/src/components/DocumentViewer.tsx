import React from 'react';
import { useWorkflowStore } from '@/store/workflowStore';

export function DocumentViewer() {
  const documentUrl = useWorkflowStore((state) => state.documentUrl);
  const documentName = useWorkflowStore((state) => state.documentName);

  if (!documentUrl) {
    return (
      <div className="flex items-center justify-center h-64 text-dark-500 text-sm">
        No document available
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3 px-1">
        <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
        </svg>
        <span className="text-xs text-dark-300 truncate" title={documentName || undefined}>
          {documentName || 'Document'}
        </span>
      </div>
      <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-dark-700/40 bg-dark-900">
        <object
          data={documentUrl}
          type="application/pdf"
          className="w-full h-full"
          aria-label={documentName || 'Document PDF'}
        >
          <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
            <svg className="w-10 h-10 text-dark-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-sm text-dark-400">Unable to display PDF inline</p>
            <a
              href={documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:text-blue-300 underline transition-colors"
            >
              Open in new tab →
            </a>
          </div>
        </object>
      </div>
    </div>
  );
}
