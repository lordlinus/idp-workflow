import React from 'react';
import { useReasoningStore } from '@/store/reasoningStore';
import { formatTimestamp } from '@/lib/utils';
import clsx from 'clsx';

export function ReasoningPanel() {
  const chunks = useReasoningStore((state) => state.chunks);
  const isComplete = useReasoningStore((state) => state.isComplete);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  React.useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [chunks]);

  const chunkTypeStyles = {
    validation_summary: {
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      icon: '✓',
      title: 'Validation Summary',
    },
    field_matching: {
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      icon: '🔗',
      title: 'Field Matching',
    },
    confidence: {
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30',
      icon: '📊',
      title: 'Confidence Score',
    },
    summary: {
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      icon: '📝',
      title: 'Summary',
    },
    final: {
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      icon: '🎉',
      title: 'Complete',
    },
  };

  return (
    <div className="h-full rounded-xl border border-dark-700 bg-dark-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-dark-700 bg-dark-900 px-6 py-4">
        <h3 className="text-lg font-semibold text-dark-50 flex items-center gap-2">
          <span className="text-xl">🤖</span>
          AI Reasoning Agent
        </h3>
        <p className="text-xs text-dark-400 mt-1">Step 6: Real-time reasoning stream</p>
      </div>

      {/* Content */}
      <div
        ref={containerRef}
        className="overflow-y-auto flex-1 px-6 py-6 space-y-4"
      >
        {chunks.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <span className="text-4xl mb-3 block">⏳</span>
              <p className="text-dark-400">Waiting for reasoning stream...</p>
            </div>
          </div>
        ) : (
          <>
            {chunks.map((chunk, index) => {
              const style = chunkTypeStyles[chunk.chunkType];

              return (
                <div
                  key={chunk.timestamp + index}
                  className={clsx(
                    'rounded-lg border p-4 animate-fade-in',
                    style.bgColor,
                    style.borderColor
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-1">{style.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="font-semibold text-dark-50 text-sm">{style.title}</p>
                        <span className="text-xs text-dark-500">
                          {formatTimestamp(chunk.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-dark-200 whitespace-pre-wrap break-words">
                        {chunk.content}
                      </p>
                      {chunk.metadata && Object.keys(chunk.metadata).length > 0 && (
                        <div className="mt-2 text-xs text-dark-400 space-y-1">
                          {Object.entries(chunk.metadata).map(([key, value]) => (
                            <div key={key}>
                              <span className="font-mono">{key}:</span>{' '}
                              <span className="text-dark-300">
                                {typeof value === 'object'
                                  ? JSON.stringify(value)
                                  : String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing Indicator */}
            {!isComplete && (
              <div className="flex items-center gap-2 p-4">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-2 w-2 rounded-full bg-dark-500 animate-bounce"
                      style={{ animationDelay: `${i * 0.1}s` }}
                    />
                  ))}
                </div>
                <span className="text-sm text-dark-400">Agent reasoning...</span>
              </div>
            )}

            {/* Complete Indicator */}
            {isComplete && (
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-center">
                <p className="text-sm font-medium text-green-300">✅ Reasoning complete</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
