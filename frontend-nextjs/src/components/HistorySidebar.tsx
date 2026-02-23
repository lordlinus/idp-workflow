import { useHistory } from '@/lib/queryKeys';
import { useWorkflowStore } from '@/store/workflowStore';
import { useSignalR } from '@/lib/signalrClient';
import { useUIStore } from '@/store/uiStore';
import { formatDate, getStatusColor } from '@/lib/utils';
import { HistoryItem } from '@/types';

interface HistorySidebarProps {
  onHistoryLoad: (instanceId: string) => void;
}

export function HistorySidebar({ onHistoryLoad }: HistorySidebarProps) {
  // Always try to load history
  const { data: historyData, isLoading, isError } = useHistory(20, undefined, true);
  const setToast = useUIStore((state) => state.setToast);
  const signalR = useSignalR();
  const initializeWorkflow = useWorkflowStore((state) => state.initializeWorkflow);

  const handleLoadHistory = async (item: HistoryItem) => {
    try {
      setToast({ message: 'Loading workflow...', type: 'info' });

      // Initialize workflow store
      initializeWorkflow(item.instanceId, item.input.domain_id);

      // Connect SignalR if not already connected
      if (!signalR.isConnected()) {
        await signalR.connect();
      }

      // Subscribe to workflow events
      await signalR.subscribe(item.instanceId);

      onHistoryLoad(item.instanceId);
      setToast({ message: 'Workflow loaded from history!', type: 'success' });
    } catch (error) {
      console.error('Failed to load history:', error);
      setToast({
        message: error instanceof Error ? error.message : 'Failed to load workflow',
        type: 'error',
      });
    }
  };

  const instances = historyData?.instances || [];

  return (
    <div className="h-full rounded-xl border border-dark-700 bg-dark-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-dark-700 bg-dark-900 px-6 py-4">
        <h3 className="text-lg font-semibold text-dark-50">History</h3>
        <p className="text-xs text-dark-400 mt-1">Your recent workflows</p>
      </div>

      {/* Content */}
      <div className="overflow-y-auto flex-1">
        {isLoading ? (
          <div className="px-6 py-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg bg-dark-700/50 h-20 animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center h-full px-6 py-8">
            <div className="text-center">
              <p className="text-red-300 text-sm">Failed to load history</p>
            </div>
          </div>
        ) : instances.length === 0 ? (
          <div className="flex items-center justify-center h-full px-6 py-8">
            <div className="text-center">
              <p className="text-dark-400 text-sm">No workflows yet</p>
              <p className="text-dark-500 text-xs mt-1">History will appear after processing</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 px-6 py-6">
            {instances.map((item) => (
              <button
                key={item.instanceId}
                onClick={() => handleLoadHistory(item)}
                className="w-full text-left rounded-lg border border-dark-700 bg-dark-900 hover:bg-dark-800 p-3 transition-colors group"
              >
                {/* Domain + Status */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-sm font-medium text-dark-50 truncate">
                      {item.input.domain_id.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded ${getStatusColor(
                      item.status
                    )}`}
                  >
                    {item.status}
                  </span>
                </div>

                {/* Date */}
                <p className="text-xs text-dark-500 truncate">{formatDate(item.createdTime)}</p>

                {/* Instance ID */}
                <p className="text-xs font-mono text-dark-400 mt-2 truncate group-hover:text-dark-300">
                  {item.instanceId}
                </p>

                {/* Preview */}
                {item.output?.summary && (
                  <div className="mt-2 text-xs text-dark-500 space-y-1">
                    <div>
                      Doc:{' '}
                      <span className="text-dark-400">
                        {item.output.summary.document_type}
                      </span>
                    </div>
                    <div>
                      Confidence:{' '}
                      <span className="text-dark-400">
                        {(item.output.summary.confidence_score * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
