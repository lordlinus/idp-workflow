import React from 'react';
import ReactMarkdown from 'react-markdown';
import { useReasoningStore } from '@/store/reasoningStore';
import { ReasoningChunk } from '@/types';
import { formatTimestamp } from '@/lib/utils';
import clsx from 'clsx';

// ── Helpers ──────────────────────────────────────────────────────

/** Merge consecutive tool_call/tool_result chunks into paired groups. */
interface ToolPair {
  call: ReasoningChunk;
  result: ReasoningChunk | null;
}
interface ToolGroup {
  kind: 'tool_group';
  pairs: ToolPair[];
  startIndex: number;
}
interface SingleChunk {
  kind: 'single';
  chunk: ReasoningChunk;
  index: number;
}
type GroupedItem = ToolGroup | SingleChunk;

function groupChunks(chunks: ReasoningChunk[]): GroupedItem[] {
  const items: GroupedItem[] = [];
  let i = 0;
  while (i < chunks.length) {
    const c = chunks[i];
    if (c.chunkType === 'tool_call' || c.chunkType === 'tool_result') {
      // Collect consecutive tool events into one group
      const pairs: ToolPair[] = [];
      const startIndex = i;
      while (i < chunks.length && (chunks[i].chunkType === 'tool_call' || chunks[i].chunkType === 'tool_result')) {
        if (chunks[i].chunkType === 'tool_call') {
          const call = chunks[i];
          // Check if next chunk is the matching result
          const next = i + 1 < chunks.length ? chunks[i + 1] : null;
          if (next && next.chunkType === 'tool_result') {
            pairs.push({ call, result: next });
            i += 2;
          } else {
            pairs.push({ call, result: null });
            i += 1;
          }
        } else {
          // Orphan result (no matching call) — treat as call-less pair
          pairs.push({ call: chunks[i], result: null });
          i += 1;
        }
      }
      items.push({ kind: 'tool_group', pairs, startIndex });
    } else {
      items.push({ kind: 'single', chunk: c, index: i });
      i += 1;
    }
  }
  return items;
}

// ── Collapsible tool group ───────────────────────────────────────

function ToolActivityGroup({ group, isLast }: { group: ToolGroup; isLast: boolean }) {
  const [expanded, setExpanded] = React.useState(false);
  const completedCount = group.pairs.filter((p) => p.result !== null).length;
  const totalCount = group.pairs.length;
  const allDone = completedCount === totalCount;
  const lastPair = group.pairs[group.pairs.length - 1];
  const latestTimestamp = lastPair.result?.timestamp ?? lastPair.call.timestamp;

  // Auto-expand if there are very few items (≤2)
  const isTiny = totalCount <= 2;

  return (
    <div className="rounded-lg border border-dark-700/40 bg-dark-800/30 overflow-hidden animate-fade-in">
      {/* Summary header — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-dark-700/20 transition-colors text-left"
      >
        {/* Status icon */}
        <div className={clsx(
          'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
          allDone ? 'bg-emerald-500/20' : 'bg-cyan-500/20'
        )}>
          {allDone ? (
            <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <div className="w-2.5 h-2.5 border-[1.5px] border-cyan-400 border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* Label */}
        <span className="text-xs font-medium text-dark-200 flex-1">
          {allDone ? (
            <>{totalCount} tool {totalCount === 1 ? 'call' : 'calls'} completed</>
          ) : (
            <>Running tool calls ({completedCount}/{totalCount})...</>
          )}
        </span>

        {/* Timestamp */}
        <span className="text-[10px] text-dark-600 shrink-0">
          {formatTimestamp(latestTimestamp)}
        </span>

        {/* Expand chevron */}
        <svg
          className={clsx('w-3.5 h-3.5 text-dark-500 transition-transform duration-200', (expanded || isTiny) && 'rotate-180')}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded detail rows */}
      {(expanded || isTiny) && (
        <div className="border-t border-dark-700/30 px-2 py-1.5 space-y-0.5">
          {group.pairs.map((pair, idx) => {
            const toolName = (pair.call.metadata as Record<string, unknown>)?.toolName as string | undefined;
            const isDone = pair.result !== null;
            return (
              <div
                key={idx}
                className="flex items-center gap-2 px-2 py-1 rounded text-xs"
              >
                {/* Inline status */}
                {isDone ? (
                  <svg className="w-3 h-3 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <div className="w-3 h-3 border-[1.5px] border-cyan-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                )}

                {/* Tool name */}
                {toolName && (
                  <code className="font-mono px-1.5 py-0.5 rounded bg-dark-700/50 text-cyan-300 shrink-0">
                    {toolName}
                  </code>
                )}

                {/* Description — show result content if done, otherwise call content */}
                <span className={clsx('flex-1 truncate', isDone ? 'text-dark-400' : 'text-dark-300')}>
                  {isDone ? pair.result!.content : pair.call.content}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────

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

  const grouped = React.useMemo(() => groupChunks(chunks), [chunks]);

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
          {grouped.map((item, gIdx) => {
            if (item.kind === 'tool_group') {
              return (
                <ToolActivityGroup
                  key={`tg-${item.startIndex}`}
                  group={item}
                  isLast={gIdx === grouped.length - 1}
                />
              );
            }

            const chunk = item.chunk;
            const style = chunkTypeStyles[chunk.chunkType] || chunkTypeStyles.summary;
            const isStreamingSummary =
              chunk.chunkType === 'summary' && Boolean((chunk.metadata as Record<string, unknown>)?.isStreaming);

            return (
              <div
                key={chunk.chunkType + item.index}
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
