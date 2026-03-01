import React from 'react';
import ReactMarkdown from 'react-markdown';
import { useReasoningStore } from '@/store/reasoningStore';
import { formatTimestamp } from '@/lib/utils';
import clsx from 'clsx';

/** Live reasoning stream display for the AI reasoning agent (Step 6). */
export function ReasoningStream() {
  const chunks = useReasoningStore((state) => state.chunks);
  const isComplete = useReasoningStore((state) => state.isComplete);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Smart auto-scroll: only scroll if user is near the bottom
  React.useEffect(() => {
    if (containerRef.current) {
      const el = containerRef.current;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      if (isNearBottom) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [chunks]);

  const chunkTypeStyles: Record<string, { bgColor: string; borderColor: string; icon: string; title: string }> = {
    tool_call: {
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/30',
      icon: '🔧',
      title: 'Tool Call',
    },
    tool_result: {
      bgColor: 'bg-teal-500/10',
      borderColor: 'border-teal-500/30',
      icon: '✓',
      title: 'Tool Result',
    },
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
    error: {
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      icon: '⚠️',
      title: 'Error',
    },
  };

  return (
    <div ref={containerRef} className="space-y-3">
      {chunks.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <span className="text-4xl mb-3 block">⏳</span>
            <p className="text-dark-400">Waiting for reasoning stream...</p>
          </div>
        </div>
      ) : (
        <>
          {chunks.map((chunk, index) => {
            const style = chunkTypeStyles[chunk.chunkType] || chunkTypeStyles.summary;
            const isStreamingSummary =
              chunk.chunkType === 'summary' && Boolean((chunk.metadata as Record<string, unknown>)?.isStreaming);
            const isToolEvent = chunk.chunkType === 'tool_call' || chunk.chunkType === 'tool_result';
            const toolName = (chunk.metadata as Record<string, unknown>)?.toolName as string | undefined;

            // Compact rendering for tool_call / tool_result
            if (isToolEvent) {
              return (
                <div
                  key={chunk.chunkType + index}
                  className={clsx(
                    'rounded-md border px-3 py-1.5 animate-fade-in flex items-center gap-2',
                    style.bgColor,
                    style.borderColor
                  )}
                >
                  <span className="text-sm">{style.icon}</span>
                  <span className="text-xs font-medium text-dark-300">
                    {chunk.chunkType === 'tool_call' ? 'Calling' : 'Result'}
                  </span>
                  {toolName && (
                    <code className="text-xs font-mono px-1.5 py-0.5 rounded bg-dark-700/50 text-cyan-300">
                      {toolName}
                    </code>
                  )}
                  <span className="text-xs text-dark-400 flex-1 truncate">
                    {chunk.content}
                  </span>
                  <span className="text-[10px] text-dark-600 shrink-0">
                    {formatTimestamp(chunk.timestamp)}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={chunk.chunkType + index}
                className={clsx(
                  'rounded-lg border p-3 animate-fade-in',
                  style.bgColor,
                  style.borderColor
                )}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg">{style.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-semibold text-dark-50 text-sm">
                        {style.title}
                        {isStreamingSummary && !isComplete && (
                          <span className="ml-2 text-xs text-dark-500 animate-pulse">streaming…</span>
                        )}
                      </p>
                      <span className="text-xs text-dark-500">
                        {formatTimestamp(chunk.timestamp)}
                      </span>
                    </div>
                    {chunk.chunkType === 'summary' ? (
                      <div className="text-sm text-dark-200 prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown>{chunk.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm text-dark-200 whitespace-pre-wrap break-words">
                        {chunk.content}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {!isComplete && (
            <div className="flex items-center gap-2 p-3">
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
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-center">
              <p className="text-sm font-medium text-green-300">✅ Reasoning complete</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
