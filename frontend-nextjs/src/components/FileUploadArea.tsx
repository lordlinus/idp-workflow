import React, { useRef } from 'react';
import { useUploadPDF, useStartWorkflow, useDemoDocument } from '@/lib/queryKeys';
import { useWorkflowStore } from '@/store/workflowStore';
import { useUIStore } from '@/store/uiStore';
import { useSignalR } from '@/lib/signalrClient';
import { DOMAIN_CONFIG } from '@/lib/utils';
import { DomainId } from '@/types';
import clsx from 'clsx';

interface FileUploadAreaProps {
  onWorkflowStart: (instanceId: string) => void;
}

export function FileUploadArea({ onWorkflowStart }: FileUploadAreaProps) {
  const [selectedDomain, setSelectedDomain] = React.useState<DomainId>('insurance_claims');
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadPDF = useUploadPDF();
  const startWorkflow = useStartWorkflow();
  const demoDocument = useDemoDocument();
  const initializeWorkflow = useWorkflowStore((state) => state.initializeWorkflow);
  const setToast = useUIStore((state) => state.setToast);
  const signalR = useSignalR();

  const startWorkflowWithBlob = async (blobPath: string, domainId: DomainId) => {
    try {
      // Start workflow
      setToast({ message: 'Starting workflow...', type: 'info' });
      const workflowResponse = await startWorkflow.mutateAsync({
        pdf_path: blobPath,
        domain_id: domainId,
      });

      // Initialize workflow store
      initializeWorkflow(workflowResponse.instanceId, domainId);

      // Connect SignalR
      await signalR.connect();
      await signalR.subscribe(workflowResponse.instanceId);

      // Store instanceId in cookie for history
      document.cookie = `lastInstanceId=${workflowResponse.instanceId}; path=/; max-age=2592000`;

      setToast({ message: 'Workflow started successfully!', type: 'success' });
      onWorkflowStart(workflowResponse.instanceId);
    } catch (error) {
      console.error('Error starting workflow:', error);
      setToast({
        message: error instanceof Error ? error.message : 'Failed to start workflow',
        type: 'error',
      });
    }
  };

  const handleFile = async (file: File) => {
    if (!file.type.includes('pdf')) {
      setToast({ message: 'Please select a PDF file', type: 'error' });
      return;
    }

    try {
      // Upload PDF
      setToast({ message: 'Uploading PDF...', type: 'info' });
      const uploadedFile = await uploadPDF.mutateAsync(file);

      await startWorkflowWithBlob(uploadedFile.blobPath, selectedDomain);
    } catch (error) {
      console.error('Error uploading file:', error);
      setToast({
        message: error instanceof Error ? error.message : 'Failed to upload file',
        type: 'error',
      });
    }
  };

  const handleUseDemo = async () => {
    try {
      setToast({ message: `Loading demo document for ${DOMAIN_CONFIG[selectedDomain].label}...`, type: 'info' });
      const demoResult = await demoDocument.mutateAsync(selectedDomain);

      await startWorkflowWithBlob(demoResult.blobPath, selectedDomain);
    } catch (error) {
      console.error('Error using demo document:', error);
      setToast({
        message: error instanceof Error ? error.message : 'Failed to load demo document',
        type: 'error',
      });
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const isLoading = uploadPDF.isPending || startWorkflow.isPending || demoDocument.isPending;

  return (
    <div className="space-y-6">
      {/* Domain Selector */}
      <div>
        <label className="block text-sm font-medium text-dark-300 mb-3">
          Select Processing Domain
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(Object.entries(DOMAIN_CONFIG) as Array<[DomainId, any]>).map(([domainId, config]) => (
            <button
              key={domainId}
              onClick={() => setSelectedDomain(domainId)}
              disabled={isLoading}
              className={clsx(
                'p-4 rounded-lg border-2 transition-all text-left',
                selectedDomain === domainId
                  ? 'border-primary bg-primary/10'
                  : 'border-dark-700 bg-dark-800 hover:border-dark-600',
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{config.icon}</span>
                <div>
                  <p className="font-semibold text-dark-50">{config.label}</p>
                  <p className="text-xs text-dark-400 mt-1">{config.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Demo Button */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-dark-700"></div>
        <button
          onClick={handleUseDemo}
          disabled={isLoading}
          className={clsx(
            'flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all',
            'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500',
            'text-white shadow-lg shadow-emerald-500/20',
            isLoading && 'opacity-50 cursor-not-allowed'
          )}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Use Demo Document</span>
        </button>
        <div className="flex-1 h-px bg-dark-700"></div>
      </div>
      <p className="text-center text-xs text-dark-500 -mt-4">
        Quick start with a sample {DOMAIN_CONFIG[selectedDomain].label} document
      </p>

      {/* File Upload Area */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={clsx(
          'relative rounded-xl border-2 border-dashed p-12 text-center transition-all',
          isDragging
            ? 'border-primary bg-primary/10'
            : 'border-dark-600 bg-dark-800/50 hover:border-dark-500',
          isLoading && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFile(e.target.files[0]);
            }
          }}
          disabled={isLoading}
          className="hidden"
        />

        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/20 p-4">
              <svg
                className="h-8 w-8 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
          </div>

          <div>
            <p className="text-lg font-semibold text-dark-50">
              {isLoading ? 'Processing...' : 'Drop your PDF here'}
            </p>
            <p className="text-sm text-dark-400 mt-2">or</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="mt-2 text-primary font-medium hover:text-blue-300 transition-colors"
            >
              click to browse
            </button>
          </div>

          <p className="text-xs text-dark-500">Supported format: PDF</p>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin">
              <div className="h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
            </div>
            <span className="text-sm text-blue-300">
              {demoDocument.isPending
                ? 'Loading demo document...'
                : uploadPDF.isPending
                  ? 'Uploading file...'
                  : 'Starting workflow...'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
