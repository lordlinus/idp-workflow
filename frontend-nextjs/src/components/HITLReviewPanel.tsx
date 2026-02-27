import React from 'react';
import { useWorkflowStore } from '@/store/workflowStore';
import { useUIStore } from '@/store/uiStore';
import { useSubmitHITLReview } from '@/lib/queryKeys';
import { FieldSelection, FieldComparison } from '@/types';
import clsx from 'clsx';

type FilterTab = 'all' | 'conflicts' | 'matching';

export function HITLReviewPanel() {
  const hitlWaiting = useWorkflowStore((state) => state.hitlWaiting);
  const instanceId = useWorkflowStore((state) => state.instanceId);
  const showModal = useUIStore((state) => state.showHITLModal);
  const setShowModal = useUIStore((state) => state.setShowHITLModal);
  const setToast = useUIStore((state) => state.setToast);
  const llmProvider = useWorkflowStore((state) => state.llmProvider);
  const llmModel = useWorkflowStore((state) => state.llmModel);

  const submitHITL = useSubmitHITLReview();

  // UI state
  const [activeTab, setActiveTab] = React.useState<FilterTab>('conflicts');
  
  // Field selections state: map of fieldName -> selectedSource
  const [selections, setSelections] = React.useState<Record<string, FieldSelection>>({});
  const [feedback, setFeedback] = React.useState('');
  const [reviewer, setReviewer] = React.useState('');

  // Initialize selections when HITL data arrives
  React.useEffect(() => {
    if (hitlWaiting && hitlWaiting.fieldComparisons) {
      const initialSelections: Record<string, FieldSelection> = {};
      hitlWaiting.fieldComparisons.forEach((field) => {
        initialSelections[field.fieldName] = {
          field_name: field.fieldName,
          selected_source: 'azure',
          selected_value: field.azureValue,
          azure_value: field.azureValue,
          dspy_value: field.dspyValue,
          notes: '',
        };
      });
      setSelections(initialSelections);
    }
  }, [hitlWaiting]);

  const handleSourceChange = (fieldName: string, source: 'azure' | 'dspy' | 'manual') => {
    setSelections((prev) => {
      const field = hitlWaiting?.fieldComparisons.find((f) => f.fieldName === fieldName);
      if (!field) return prev;

      return {
        ...prev,
        [fieldName]: {
          ...prev[fieldName],
          selected_source: source,
          selected_value:
            source === 'manual' ? '' : source === 'azure' ? field.azureValue : field.dspyValue,
        },
      };
    });
  };

  const handleManualValueChange = (fieldName: string, value: string) => {
    setSelections((prev) => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        selected_source: 'manual',
        selected_value: value,
      },
    }));
  };

  const handleApprove = async () => {
    if (!instanceId) {
      setToast({ message: 'No workflow instance found', type: 'error' });
      return;
    }

    try {
      const fieldSelections = Object.values(selections);
      const acceptedValues = Object.fromEntries(
        fieldSelections.map((f) => [f.field_name, f.selected_value])
      );

      await submitHITL.mutateAsync({
        instanceId,
        review: {
          approved: true,
          feedback,
          reviewer: reviewer || 'auto-reviewer@company.com',
          accepted_values: acceptedValues,
          field_selections: fieldSelections,
          default_source: 'azure',
        },
      });

      setToast({ message: 'Review submitted successfully!', type: 'success' });
      setShowModal(false);
    } catch (error) {
      console.error('Failed to submit review:', error);
      setToast({
        message: error instanceof Error ? error.message : 'Failed to submit review',
        type: 'error',
      });
    }
  };

  const handleReject = async () => {
    if (!instanceId) {
      setToast({ message: 'No workflow instance found', type: 'error' });
      return;
    }

    if (!feedback.trim()) {
      setToast({ message: 'Please provide feedback for rejection', type: 'error' });
      return;
    }

    try {
      const fieldSelections = Object.values(selections);
      const acceptedValues = Object.fromEntries(
        fieldSelections.map((f) => [f.field_name, f.selected_value])
      );

      await submitHITL.mutateAsync({
        instanceId,
        review: {
          approved: false,
          feedback,
          reviewer: reviewer || 'auto-reviewer@company.com',
          accepted_values: acceptedValues,
          field_selections: fieldSelections,
          default_source: 'azure',
        },
      });

      setToast({ message: 'Rejection submitted successfully!', type: 'success' });
      setShowModal(false);
    } catch (error) {
      console.error('Failed to submit rejection:', error);
      setToast({
        message: error instanceof Error ? error.message : 'Failed to submit rejection',
        type: 'error',
      });
    }
  };

  const isSubmitting = submitHITL.isPending;

  // Filter fields based on active tab - must be before early return (Rules of Hooks)
  const filteredFields = React.useMemo(() => {
    if (!hitlWaiting?.fieldComparisons) return [];
    
    switch (activeTab) {
      case 'conflicts':
        return hitlWaiting.fieldComparisons.filter((f) => !f.match);
      case 'matching':
        return hitlWaiting.fieldComparisons.filter((f) => f.match);
      default:
        return hitlWaiting.fieldComparisons;
    }
  }, [hitlWaiting?.fieldComparisons, activeTab]);

  const conflictCount = hitlWaiting?.fieldComparisons?.filter((f) => !f.match).length || 0;
  const matchCount = hitlWaiting?.fieldComparisons?.filter((f) => f.match).length || 0;

  // Early return must be AFTER all hooks
  if (!showModal || !hitlWaiting) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-h-[90vh] max-w-5xl rounded-2xl bg-dark-800 border border-dark-700 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-dark-700 bg-dark-900 px-8 py-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-dark-50">Human Review Required</h2>
              <p className="text-sm text-dark-400 mt-1">
                Review conflicts and select the correct values for each field.
                You can dismiss and come back — the workflow will wait.
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-dark-50">
                {hitlWaiting.comparisonSummary.matchPercentage.toFixed(0)}%
              </div>
              <div className="text-xs text-dark-400">Match Score</div>
            </div>
          </div>
          
          {/* Filter Tabs */}
          <div className="flex gap-2 mt-6">
            <button
              onClick={() => setActiveTab('conflicts')}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeTab === 'conflicts'
                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50'
                  : 'bg-dark-700 text-dark-300 hover:bg-dark-600 border border-transparent'
              )}
            >
              ⚠️ Conflicts ({conflictCount})
            </button>
            <button
              onClick={() => setActiveTab('matching')}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeTab === 'matching'
                  ? 'bg-green-500/20 text-green-300 border border-green-500/50'
                  : 'bg-dark-700 text-dark-300 hover:bg-dark-600 border border-transparent'
              )}
            >
              ✓ Matching ({matchCount})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeTab === 'all'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50'
                  : 'bg-dark-700 text-dark-300 hover:bg-dark-600 border border-transparent'
              )}
            >
              All Fields ({hitlWaiting.comparisonSummary.totalFields})
            </button>
          </div>
          
          {/* Instructions */}
          {activeTab === 'conflicts' && conflictCount > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <p className="text-sm text-yellow-200">
                <span className="font-semibold">Action Required:</span> For each conflicting field below, 
                select whether to use the Azure value, DSPy value, or enter a manual correction.
              </p>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          {/* Fields Table */}
          <div className="px-8 py-6">
            {filteredFields.length === 0 ? (
              <div className="text-center py-12 text-dark-400">
                <span className="text-4xl block mb-3">
                  {activeTab === 'conflicts' ? '✅' : '📋'}
                </span>
                <p className="text-lg">
                  {activeTab === 'conflicts' 
                    ? 'No conflicts to review!' 
                    : activeTab === 'matching'
                      ? 'No matching fields'
                      : 'No fields to display'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredFields.map((field) => {
                const selection = selections[field.fieldName];
                const conflicted = !field.match;

                return (
                  <div
                    key={field.fieldName}
                    className={clsx(
                      'rounded-lg border p-4 transition-all',
                      conflicted
                        ? 'border-yellow-500/30 bg-yellow-500/5'
                        : 'border-dark-700 bg-dark-900'
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-dark-50">{field.fieldName}</p>
                        {field.confidence && (
                          <p className="text-xs text-dark-400 mt-1">
                            Confidence: {(field.confidence * 100).toFixed(1)}%
                          </p>
                        )}
                      </div>
                      {conflicted && <span className="text-lg">⚠️</span>}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {/* Azure Value */}
                      <div className="rounded border border-blue-500/30 bg-blue-500/5 p-3">
                        <label className="flex items-center gap-2 mb-2">
                          <input
                            type="radio"
                            name={`source-${field.fieldName}`}
                            value="azure"
                            checked={selection?.selected_source === 'azure'}
                            onChange={() => handleSourceChange(field.fieldName, 'azure')}
                            disabled={isSubmitting}
                            className="accent-blue-500"
                          />
                          <span className="text-sm font-medium text-blue-300">Azure</span>
                        </label>
                        <p className="text-sm text-dark-50 break-words">{field.azureValue}</p>
                      </div>

                      {/* DSPy Value */}
                      <div className="rounded border border-purple-500/30 bg-purple-500/5 p-3">
                        <label className="flex items-center gap-2 mb-2">
                          <input
                            type="radio"
                            name={`source-${field.fieldName}`}
                            value="dspy"
                            checked={selection?.selected_source === 'dspy'}
                            onChange={() => handleSourceChange(field.fieldName, 'dspy')}
                            disabled={isSubmitting}
                            className="accent-purple-500"
                          />
                          <span className="text-sm font-medium text-purple-300">DSPy{llmProvider && llmProvider !== 'azure_openai' ? ` (${llmModel || llmProvider})` : ''}</span>
                        </label>
                        <p className="text-sm text-dark-50 break-words">{field.dspyValue}</p>
                      </div>
                    </div>

                    {/* Manual Entry */}
                    <div>
                      <label className="flex items-center gap-2 mb-2">
                        <input
                          type="radio"
                          name={`source-${field.fieldName}`}
                          value="manual"
                          checked={selection?.selected_source === 'manual'}
                          onChange={() => handleSourceChange(field.fieldName, 'manual')}
                          disabled={isSubmitting}
                          className="accent-emerald-500"
                        />
                        <span className="text-sm font-medium text-emerald-300">Manual Entry</span>
                      </label>
                      {selection?.selected_source === 'manual' && (
                        <input
                          type="text"
                          value={selection.selected_value || ''}
                          onChange={(e) => handleManualValueChange(field.fieldName, e.target.value)}
                          disabled={isSubmitting}
                          className="input-base text-sm"
                          placeholder="Enter corrected value"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            )}

            {/* Feedback Section - Always visible */}
            <div className="mt-8 space-y-3 border-t border-dark-700 pt-6">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Reviewer Name (Optional)
                </label>
                <input
                  type="text"
                  value={reviewer}
                  onChange={(e) => setReviewer(e.target.value)}
                  disabled={isSubmitting}
                  className="input-base"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Feedback / Notes
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  disabled={isSubmitting}
                  className="input-base min-h-24 resize-none"
                  placeholder="Add any comments or feedback..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-dark-700 bg-dark-900 px-8 py-6 flex items-center justify-between">
          <button
            onClick={() => setShowModal(false)}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-dark-300 bg-dark-700 border border-dark-600 hover:bg-dark-600 hover:text-dark-100 transition-colors"
          >
            ← Review Later
          </button>
          <div className="flex gap-4">
            <button
              onClick={handleReject}
              disabled={isSubmitting}
              className="btn-danger"
            >
              {isSubmitting ? 'Submitting...' : 'Reject & Request Changes'}
            </button>
            <button
              onClick={handleApprove}
              disabled={isSubmitting}
              className="btn-success"
            >
              {isSubmitting ? 'Submitting...' : 'Approve & Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
