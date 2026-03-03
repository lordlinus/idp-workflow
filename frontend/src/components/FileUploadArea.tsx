import React, { useRef } from 'react';
import { useUploadPDF, useStartWorkflow, useDemoDocument, useValidateSchema } from '@/lib/queryKeys';
import { useWorkflowStore } from '@/store/workflowStore';
import { useEventsStore } from '@/store/eventsStore';
import { useReasoningStore } from '@/store/reasoningStore';
import { useUIStore } from '@/store/uiStore';
import { useSignalR } from '@/lib/signalrClient';
import { apiClient } from '@/lib/apiClient';
import { DOMAIN_CONFIG } from '@/lib/utils';
import { DomainId, LLMProvider, ExtractionSchema, ClassificationCategory, WorkflowOptions } from '@/types';
import clsx from 'clsx';

const SCHEMA_TEMPLATES: Record<string, { label: string; icon: string; schema: string; categories: string }> = {
  invoice: {
    label: 'Invoice',
    icon: '🧾',
    schema: JSON.stringify({
      fieldSchema: {
        fields: {
          invoice_number: { type: 'string', description: 'Unique invoice identifier' },
          invoice_date: { type: 'date', description: 'Date the invoice was issued' },
          due_date: { type: 'date', description: 'Payment due date' },
          vendor_name: { type: 'string', description: 'Name of the vendor or supplier' },
          vendor_address: { type: 'string', description: 'Vendor mailing address' },
          customer_name: { type: 'string', description: 'Name of the customer or buyer' },
          subtotal: { type: 'number', description: 'Subtotal before tax' },
          tax_amount: { type: 'number', description: 'Tax amount applied' },
          total_amount: { type: 'number', description: 'Total amount due including tax' },
          currency: { type: 'string', description: 'Currency code (e.g., USD, EUR)' },
          payment_terms: { type: 'string', description: 'Payment terms (e.g., Net 30)' },
          line_items: {
            type: 'array',
            description: 'Individual line items on the invoice',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string', description: 'Item description' },
                quantity: { type: 'integer', description: 'Quantity ordered' },
                unit_price: { type: 'number', description: 'Price per unit' },
                amount: { type: 'number', description: 'Line total' },
              },
            },
          },
        },
      },
    }, null, 2),
    categories: JSON.stringify([
      { name: 'Commercial_Invoice', 'description/Note': 'Standard commercial invoice for goods or services', pattern_keywords: ['invoice', 'bill', 'amount due', 'payment'] },
      { name: 'Proforma_Invoice', 'description/Note': 'Preliminary invoice before shipment', pattern_keywords: ['proforma', 'estimate', 'quotation'] },
      { name: 'Credit_Note', 'description/Note': 'Credit memo or refund document', pattern_keywords: ['credit', 'refund', 'return'] },
    ], null, 2),
  },
  contract: {
    label: 'Contract',
    icon: '📝',
    schema: JSON.stringify({
      fieldSchema: {
        fields: {
          contract_title: { type: 'string', description: 'Title or name of the contract' },
          contract_number: { type: 'string', description: 'Contract reference number' },
          effective_date: { type: 'date', description: 'Date the contract becomes effective' },
          expiration_date: { type: 'date', description: 'Contract expiration or end date' },
          party_a_name: { type: 'string', description: 'Name of the first party' },
          party_a_address: { type: 'string', description: 'Address of the first party' },
          party_b_name: { type: 'string', description: 'Name of the second party' },
          party_b_address: { type: 'string', description: 'Address of the second party' },
          contract_value: { type: 'number', description: 'Total monetary value of the contract' },
          payment_schedule: { type: 'string', description: 'Payment terms and schedule' },
          governing_law: { type: 'string', description: 'Jurisdiction or governing law' },
          termination_clause: { type: 'string', description: 'Conditions for early termination' },
          renewal_terms: { type: 'string', description: 'Auto-renewal or renewal conditions' },
        },
      },
    }, null, 2),
    categories: JSON.stringify([
      { name: 'Service_Agreement', 'description/Note': 'Contract for professional services', pattern_keywords: ['service', 'agreement', 'scope of work', 'deliverables'] },
      { name: 'NDA', 'description/Note': 'Non-disclosure or confidentiality agreement', pattern_keywords: ['confidential', 'non-disclosure', 'proprietary'] },
      { name: 'Employment_Contract', 'description/Note': 'Employment agreement', pattern_keywords: ['employment', 'salary', 'benefits', 'termination'] },
    ], null, 2),
  },
  medical: {
    label: 'Medical',
    icon: '🏥',
    schema: JSON.stringify({
      fieldSchema: {
        fields: {
          patient_name: { type: 'string', description: 'Full name of the patient' },
          patient_id: { type: 'string', description: 'Patient medical record number' },
          date_of_birth: { type: 'date', description: 'Patient date of birth' },
          visit_date: { type: 'date', description: 'Date of the medical visit or encounter' },
          provider_name: { type: 'string', description: 'Name of the healthcare provider' },
          facility_name: { type: 'string', description: 'Name of the medical facility' },
          diagnosis: { type: 'string', description: 'Primary diagnosis or condition' },
          diagnosis_code: { type: 'string', description: 'ICD-10 diagnosis code' },
          procedure: { type: 'string', description: 'Procedure performed' },
          procedure_code: { type: 'string', description: 'CPT procedure code' },
          total_charges: { type: 'number', description: 'Total charges for the visit' },
          insurance_provider: { type: 'string', description: 'Insurance company name' },
          policy_number: { type: 'string', description: 'Insurance policy number' },
          medications: {
            type: 'array',
            description: 'Prescribed medications',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Medication name' },
                dosage: { type: 'string', description: 'Dosage instructions' },
                frequency: { type: 'string', description: 'Frequency of administration' },
              },
            },
          },
        },
      },
    }, null, 2),
    categories: JSON.stringify([
      { name: 'Medical_Claim', 'description/Note': 'Health insurance claim form', pattern_keywords: ['claim', 'diagnosis', 'procedure', 'insurance'] },
      { name: 'Lab_Report', 'description/Note': 'Laboratory test results', pattern_keywords: ['lab', 'test', 'results', 'specimen'] },
      { name: 'Prescription', 'description/Note': 'Medication prescription', pattern_keywords: ['prescription', 'medication', 'rx', 'pharmacy'] },
    ], null, 2),
  },
};

interface FileUploadAreaProps {
  onWorkflowStart: (instanceId: string) => void;
}

export function FileUploadArea({ onWorkflowStart }: FileUploadAreaProps) {
  const [selectedDomain, setSelectedDomain] = React.useState<DomainId>('insurance_claims');
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [llmProvider, setLlmProvider] = React.useState<LLMProvider>('azure_openai');
  const [llmModel, setLlmModel] = React.useState('');
  const [useCustomSchema, setUseCustomSchema] = React.useState(false);
  const [schemaJson, setSchemaJson] = React.useState('');
  const [schemaError, setSchemaError] = React.useState<string | null>(null);
  const [schemaValid, setSchemaValid] = React.useState<boolean | null>(null);
  const [useCustomCategories, setUseCustomCategories] = React.useState(false);
  const [categoriesJson, setCategoriesJson] = React.useState('');
  const [transitionPhase, setTransitionPhase] = React.useState<'idle' | 'uploading' | 'starting' | 'connecting' | 'ready'>('idle');
  const [transitionFileName, setTransitionFileName] = React.useState<string>('');

  const uploadPDF = useUploadPDF();
  const startWorkflow = useStartWorkflow();
  const demoDocument = useDemoDocument();
  const initializeWorkflow = useWorkflowStore((state) => state.initializeWorkflow);
  const setToast = useUIStore((state) => state.setToast);
  const signalR = useSignalR();
  const validateSchema = useValidateSchema();

  const buildWorkflowOptions = (): { options?: WorkflowOptions; custom_extraction_schema?: ExtractionSchema; custom_classification_categories?: ClassificationCategory[] } => {
    const result: { options?: WorkflowOptions; custom_extraction_schema?: ExtractionSchema; custom_classification_categories?: ClassificationCategory[] } = {};
    
    // LLM provider options
    if (llmProvider !== 'azure_openai' || llmModel) {
      result.options = {
        llm_provider: llmProvider,
        ...(llmModel ? { llm_model: llmModel } : {}),
      };
    }
    
    // Custom schema
    if (useCustomSchema && schemaJson.trim()) {
      try {
        result.custom_extraction_schema = JSON.parse(schemaJson);
      } catch { /* validated elsewhere */ }
    }
    
    // Custom categories
    if (useCustomCategories && categoriesJson.trim()) {
      try {
        result.custom_classification_categories = JSON.parse(categoriesJson);
      } catch { /* user will see JSON error */ }
    }
    
    return result;
  };

  const handleValidateSchema = async () => {
    setSchemaError(null);
    setSchemaValid(null);
    try {
      const parsed = JSON.parse(schemaJson);
      const result = await validateSchema.mutateAsync(parsed);
      if (result.valid) {
        setSchemaValid(true);
        setSchemaError(null);
        setToast({ message: `Schema valid: ${result.field_count} fields`, type: 'success' });
      } else {
        setSchemaValid(false);
        setSchemaError(result.errors?.join('; ') || 'Invalid schema');
      }
    } catch (e) {
      setSchemaValid(false);
      setSchemaError(e instanceof SyntaxError ? 'Invalid JSON syntax' : (e instanceof Error ? e.message : 'Validation failed'));
    }
  };

  const handleSelectTemplate = (templateKey: string) => {
    const template = SCHEMA_TEMPLATES[templateKey];
    if (!template) return;
    setSchemaJson(template.schema);
    setCategoriesJson(template.categories);
    setUseCustomCategories(true);
    setSchemaError(null);
    setSchemaValid(null);
    // Auto-validate after a tick
    setTimeout(async () => {
      try {
        const parsed = JSON.parse(template.schema);
        const result = await validateSchema.mutateAsync(parsed);
        if (result.valid) {
          setSchemaValid(true);
          setToast({ message: `${template.label} template loaded: ${result.field_count} fields`, type: 'success' });
        }
      } catch { /* ignore */ }
    }, 100);
  };

  const startWorkflowWithBlob = async (blobPath: string, domainId: DomainId, fileName: string) => {
    try {
      setTransitionPhase('starting');

      // Clear stale state from any previous workflow
      useEventsStore.getState().clearEvents();
      useReasoningStore.getState().clearChunks();

      // Terminate any previous running orchestration to prevent stale events
      const previousInstanceId = useWorkflowStore.getState().instanceId;
      if (previousInstanceId) {
        try {
          await apiClient.terminateWorkflow(previousInstanceId);
        } catch {
          // Non-fatal: old instance may already be completed/terminated
        }
      }

      // Connect SignalR FIRST (before starting workflow to minimize race window)
      // User-targeted messaging: no subscribe needed — the negotiate binds userId
      if (!signalR.isConnected()) {
        setTransitionPhase('connecting');
        await signalR.connect();
      }

      setTransitionPhase('starting');

      // Start workflow
      const advancedOptions = buildWorkflowOptions();
      const workflowResponse = await startWorkflow.mutateAsync({
        pdf_path: blobPath,
        domain_id: domainId,
        ...advancedOptions,
      });

      // Build document viewer URL
      const documentUrl = apiClient.getDocumentUrl(blobPath);

      // Initialize workflow store with document info
      initializeWorkflow(workflowResponse.instanceId, domainId, llmProvider, llmModel || undefined, advancedOptions.custom_extraction_schema, documentUrl, fileName);

      // Sync any missed state
      await signalR.syncStatus(workflowResponse.instanceId);

      // Store instanceId in sessionStorage (cleared on browser close)
      sessionStorage.setItem('currentInstanceId', workflowResponse.instanceId);
      const history = JSON.parse(sessionStorage.getItem('workflowHistory') || '[]');
      history.push({
        instanceId: workflowResponse.instanceId,
        domainId,
        fileName,
        startedAt: new Date().toISOString(),
      });
      sessionStorage.setItem('workflowHistory', JSON.stringify(history));

      setTransitionPhase('ready');
      // Brief pause to show the "ready" state before transitioning
      await new Promise(resolve => setTimeout(resolve, 600));
      onWorkflowStart(workflowResponse.instanceId);
    } catch (error) {
      console.error('Error starting workflow:', error);
      setTransitionPhase('idle');
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
      setTransitionPhase('uploading');
      setTransitionFileName(file.name);
      const uploadedFile = await uploadPDF.mutateAsync(file);

      await startWorkflowWithBlob(uploadedFile.blobPath, selectedDomain, uploadedFile.fileName);
    } catch (error) {
      console.error('Error uploading file:', error);
      setTransitionPhase('idle');
      setToast({
        message: error instanceof Error ? error.message : 'Failed to upload file',
        type: 'error',
      });
    }
  };

  const handleUseDemo = async () => {
    try {
      setTransitionPhase('uploading');
      setTransitionFileName(`${DOMAIN_CONFIG[selectedDomain].label} demo document`);
      const demoResult = await demoDocument.mutateAsync(selectedDomain);

      await startWorkflowWithBlob(demoResult.blobPath, selectedDomain, demoResult.fileName);
    } catch (error) {
      console.error('Error using demo document:', error);
      setTransitionPhase('idle');
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

  // --- Inline phased transition card ---
  if (transitionPhase !== 'idle') {
    const phases = [
      { key: 'uploading', label: 'Uploading document', icon: 'upload' },
      { key: 'connecting', label: 'Connecting to pipeline', icon: 'link' },
      { key: 'starting', label: 'Starting workflow', icon: 'play' },
      { key: 'ready', label: 'Launching pipeline', icon: 'check' },
    ] as const;

    const phaseOrder = ['uploading', 'connecting', 'starting', 'ready'] as const;
    const currentIdx = phaseOrder.indexOf(transitionPhase);
    const progressPercent = ((currentIdx + 1) / phaseOrder.length) * 100;

    const phaseIcon = (phase: typeof phases[number], status: 'done' | 'active' | 'pending') => {
      if (status === 'done') {
        return (
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      }
      if (status === 'active') {
        return (
          <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        );
      }
      return (
        <div className="w-8 h-8 rounded-full bg-dark-700/50 border border-dark-600/40 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-dark-500" />
        </div>
      );
    };

    return (
      <div className="space-y-6 animate-fade-in">
        {/* File info */}
        <div className="flex items-center gap-3 rounded-xl bg-dark-800/60 border border-dark-700/50 px-5 py-4">
          <div className="w-10 h-10 rounded-lg bg-red-500/15 border border-red-500/25 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-dark-100 truncate">{transitionFileName}</p>
            <p className="text-xs text-dark-500">{DOMAIN_CONFIG[selectedDomain].label} pipeline</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="rounded-xl bg-dark-800/60 border border-dark-700/50 p-6">
          <div className="mb-6">
            <div className="h-1.5 w-full bg-dark-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${progressPercent}%`,
                  background: transitionPhase === 'ready'
                    ? 'linear-gradient(to right, #10B981, #34D399)'
                    : 'linear-gradient(to right, #3B82F6, #8B5CF6)',
                }}
              />
            </div>
          </div>

          {/* Phase checklist */}
          <div className="space-y-4">
            {phases.map((phase, idx) => {
              const status: 'done' | 'active' | 'pending' =
                idx < currentIdx ? 'done' :
                idx === currentIdx ? 'active' : 'pending';

              return (
                <div key={phase.key} className="flex items-center gap-3">
                  {phaseIcon(phase, status)}
                  <span className={clsx(
                    'text-sm font-medium transition-colors duration-300',
                    status === 'done' && 'text-emerald-400',
                    status === 'active' && 'text-dark-100',
                    status === 'pending' && 'text-dark-500',
                  )}>
                    {phase.label}
                    {status === 'active' && <span className="text-dark-400 ml-1">...</span>}
                    {status === 'done' && <span className="text-emerald-500/60 ml-1.5 text-xs">done</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ready message */}
        {transitionPhase === 'ready' && (
          <div className="text-center animate-fade-in">
            <p className="text-sm text-emerald-400 font-medium">Workflow started — opening pipeline view</p>
          </div>
        )}
      </div>
    );
  }

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

      {/* Advanced Options Toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-dark-400 hover:text-dark-200 transition-colors"
        >
          <span className="text-xs">{showAdvanced ? '▼' : '▶'}</span>
          <span>Advanced Options</span>
          {(llmProvider !== 'azure_openai' || useCustomSchema || useCustomCategories) && (
            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Active</span>
          )}
        </button>
      </div>

      {!showAdvanced && llmProvider === 'azure_openai' && !useCustomSchema && !useCustomCategories && (
        <p className="text-xs text-dark-500 flex items-center gap-1.5 -mt-3">
          <span>💡</span>
          <span>Try switching LLM providers or providing a custom schema for ad-hoc document processing</span>
        </p>
      )}

      {showAdvanced && (
        <div className="space-y-5 rounded-lg border border-dark-700 bg-dark-800/50 p-4">
          {/* LLM Provider Selector */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              LLM Provider (for DSPy extraction &amp; classification)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'azure_openai' as LLMProvider, label: 'Azure OpenAI', icon: '☁️' },
                { id: 'claude' as LLMProvider, label: 'Claude', icon: '🔮' },
                { id: 'azure_ai_models' as LLMProvider, label: 'Azure AI Models', icon: '🔷' },
              ]).map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => { setLlmProvider(provider.id); setLlmModel(''); }}
                  disabled={isLoading}
                  className={clsx(
                    'p-3 rounded-lg border text-center transition-all text-sm',
                    llmProvider === provider.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-dark-700 bg-dark-900 text-dark-300 hover:border-dark-500'
                  )}
                >
                  <span className="text-lg block mb-1">{provider.icon}</span>
                  {provider.label}
                </button>
              ))}
            </div>

            {/* Model selector for Azure AI Models (open-weight on Azure) */}
            {llmProvider === 'azure_ai_models' && (
              <div className="mt-3">
                <label className="block text-xs text-dark-400 mb-1">Model (deployed via Azure AI Foundry)</label>
                <select
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm text-dark-200 focus:border-primary focus:outline-none"
                >
                  <option value="">Default (Qwen 2.5 72B)</option>
                  <option value="qwen">Qwen 2.5 72B Instruct</option>
                  <option value="qwen3">Qwen 3 235B</option>
                  <option value="deepseek">DeepSeek V3</option>
                  <option value="deepseek-r1">DeepSeek R1</option>
                  <option value="llama">Llama 3.3 70B</option>
                  <option value="phi">Phi-4</option>
                </select>
              </div>
            )}

            {/* Model override for Claude */}
            {llmProvider === 'claude' && (
              <div className="mt-3">
                <label className="block text-xs text-dark-400 mb-1">Model</label>
                <select
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm text-dark-200 focus:border-primary focus:outline-none"
                >
                  <option value="">Default (Claude Sonnet 4)</option>
                  <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                  <option value="claude-opus-4-20250514">Claude Opus 4</option>
                  <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                </select>
              </div>
            )}
          </div>

          {/* Custom Extraction Schema */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-dark-300">Custom Extraction Schema</label>
              <button
                type="button"
                onClick={() => { setUseCustomSchema(!useCustomSchema); setSchemaError(null); setSchemaValid(null); }}
                className={clsx(
                  'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                  useCustomSchema ? 'bg-primary' : 'bg-dark-600'
                )}
              >
                <span className={clsx(
                  'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
                  useCustomSchema ? 'translate-x-4.5' : 'translate-x-0.5'
                )} />
              </button>
            </div>
            {useCustomSchema && (
              <div className="space-y-2">
                <p className="text-xs text-dark-500 mb-1">
                  Quick-fill a template or write your own schema:
                </p>
                <div className="flex gap-2 mb-2">
                  {Object.entries(SCHEMA_TEMPLATES).map(([key, tmpl]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleSelectTemplate(key)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-dark-700 border border-dark-600 text-dark-300 hover:text-dark-100 hover:border-primary/50 hover:bg-primary/10 transition-all text-xs"
                    >
                      <span>{tmpl.icon}</span>
                      <span>{tmpl.label}</span>
                    </button>
                  ))}
                </div>
                <textarea
                  value={schemaJson}
                  onChange={(e) => { setSchemaJson(e.target.value); setSchemaError(null); setSchemaValid(null); }}
                  placeholder={`{\n  "fieldSchema": {\n    "fields": {\n      "invoice_number": { "type": "string", "description": "Invoice ID" },\n      "total_amount": { "type": "number", "description": "Total due" }\n    }\n  }\n}`}
                  rows={8}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-xs font-mono text-dark-200 focus:border-primary focus:outline-none resize-y"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleValidateSchema}
                    disabled={!schemaJson.trim() || validateSchema.isPending}
                    className="text-xs px-3 py-1.5 rounded-md bg-dark-700 border border-dark-600 text-dark-300 hover:text-dark-100 hover:border-dark-500 transition-colors disabled:opacity-50"
                  >
                    {validateSchema.isPending ? 'Validating...' : '✓ Validate Schema'}
                  </button>
                  {schemaValid === true && (
                    <span className="text-xs text-green-400">✅ Valid</span>
                  )}
                  {schemaError && (
                    <span className="text-xs text-red-400">❌ {schemaError}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Custom Classification Categories */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-dark-300">Custom Classification Categories</label>
              <button
                type="button"
                onClick={() => setUseCustomCategories(!useCustomCategories)}
                className={clsx(
                  'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                  useCustomCategories ? 'bg-primary' : 'bg-dark-600'
                )}
              >
                <span className={clsx(
                  'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
                  useCustomCategories ? 'translate-x-4.5' : 'translate-x-0.5'
                )} />
              </button>
            </div>
            {useCustomCategories && (
              <div className="space-y-2">
                <p className="text-xs text-dark-500">
                  Provide a JSON array of category objects with <code className="text-dark-400">name</code> and <code className="text-dark-400">description</code>.
                </p>
                <textarea
                  value={categoriesJson}
                  onChange={(e) => setCategoriesJson(e.target.value)}
                  placeholder={`[\n  { "name": "Invoice", "description": "Commercial invoice document" },\n  { "name": "Receipt", "description": "Payment receipt" }\n]`}
                  rows={5}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-xs font-mono text-dark-200 focus:border-primary focus:outline-none resize-y"
                />
              </div>
            )}
          </div>
        </div>
      )}

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
    </div>
  );
}
