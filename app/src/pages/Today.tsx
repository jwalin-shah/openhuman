import debug from 'debug';
import { useCallback, useEffect, useRef, useState } from 'react';

import { callCoreRpc } from '../services/coreRpcClient';
import { useAppSelector } from '../store/hooks';
import { TodayAgentDrawer } from './today/TodayAgentDrawer';
import type {
  TodayFeedItem,
  TodayFeedListParams,
  TodayFeedListResponse,
} from './today/todayAgentUtils';
import TodayComposerBar from './today/TodayComposerBar';
import { TodayFeedRow } from './today/TodayFeedRow';
import { useTodayAgent } from './today/useTodayAgent';

// ─── Re-export types for backward compatibility (tests import from '../Today')

export type {
  TodaySource,
  TodayFeedItem,
  TodayFeedListParams,
  TodayFeedListResponse,
} from './today/todayAgentUtils';

// ─── Debug logger ────────────────────────────────────────────────────────────

const log = debug('[today-ui]');
const logError = debug('[today-ui]:error');

// ─── Source filter tabs ──────────────────────────────────────────────────────

type FilterTab = 'all' | 'imessage' | 'gmail' | 'calendar';

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'imessage', label: 'Messages' },
  { id: 'gmail', label: 'Mail' },
  { id: 'calendar', label: 'Calendar' },
];

// ─── Relative timestamp helper ───────────────────────────────────────────────

function formatRelativeTime(timestampMs: number): string {
  const now = Date.now();
  const deltaMs = now - timestampMs;
  const deltaSec = Math.floor(deltaMs / 1000);
  const deltaMin = Math.floor(deltaMs / 60_000);
  const deltaHr = Math.floor(deltaMs / 3_600_000);

  if (deltaMs < 0) {
    const futureSec = Math.abs(deltaSec);
    const futureMin = Math.abs(deltaMin);
    const futureHr = Math.abs(deltaHr);
    if (futureSec < 60) return 'in <1m';
    if (futureMin < 60) return `in ${futureMin}m`;
    if (futureHr < 24) return `in ${futureHr}h`;
    return `in ${Math.floor(futureHr / 24)}d`;
  }

  if (deltaSec < 60) return 'just now';
  if (deltaMin < 60) return `${deltaMin}m ago`;
  if (deltaHr < 24) return `${deltaHr}h ago`;
  return `${Math.floor(deltaHr / 24)}d ago`;
}

// ─── Skeleton row ────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <li className="px-4 py-3 flex items-start gap-3 animate-pulse">
      <div className="mt-1 w-16 h-4 rounded bg-stone-200" />
      <div className="flex-1 space-y-2">
        <div className="w-40 h-3.5 rounded bg-stone-200" />
        <div className="w-full h-3 rounded bg-stone-100" />
        <div className="w-3/4 h-3 rounded bg-stone-100" />
      </div>
      <div className="w-10 h-3 rounded bg-stone-200" />
    </li>
  );
}

// ─── Data hook ───────────────────────────────────────────────────────────────

interface UseTodayFeedState {
  data: TodayFeedListResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

function useTodayFeed(sourceFilter: string | undefined): UseTodayFeedState {
  const [data, setData] = useState<TodayFeedListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refetchTriggerRef = useRef(0);
  const [refetchTick, setRefetchTick] = useState(0);

  const fetchFeed = useCallback(async () => {
    const params: TodayFeedListParams = sourceFilter ? { source_filter: sourceFilter } : {};
    log('fetching feed', { sourceFilter });
    setIsLoading(true);
    setError(null);
    try {
      const result = await callCoreRpc<TodayFeedListResponse>({
        method: 'openhuman.today_feed_list',
        params,
      });
      log('feed loaded', { itemCount: result.items.length, sourceCounts: result.source_counts });
      setData(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load feed';
      logError('feed fetch error', { error: msg });
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [sourceFilter]);

  const refetch = useCallback(() => {
    refetchTriggerRef.current += 1;
    log('manual refetch triggered', { count: refetchTriggerRef.current });
    setRefetchTick(c => c + 1);
  }, []);

  useEffect(() => {
    log('hook mounted / params changed', { sourceFilter, refetchTick });
    void fetchFeed();

    const interval = setInterval(() => {
      log('auto-refresh interval fired');
      void fetchFeed();
    }, 120_000);

    return () => {
      log('hook cleanup');
      clearInterval(interval);
    };
  }, [fetchFeed, refetchTick, sourceFilter]);

  return { data, isLoading, error, refetch };
}

// ─── Today page ──────────────────────────────────────────────────────────────

const Today = () => {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const sourceFilter: string | undefined = activeFilter === 'all' ? undefined : activeFilter;

  const { data, isLoading, error, refetch } = useTodayFeed(sourceFilter);

  // Agent hook
  const agent = useTodayAgent();

  // Read global activeThreadId from Redux to disable UI while agent is running
  const globalActiveThreadId = useAppSelector(state => state.thread.activeThreadId);
  const agentBusy = Boolean(globalActiveThreadId);

  const items: TodayFeedItem[] = data?.items ?? [];
  const isEmpty = !isLoading && !error && items.length === 0;

  const handleFilterChange = (tab: FilterTab) => {
    log('filter changed', { from: activeFilter, to: tab });
    setActiveFilter(tab);
  };

  const handleComposerSubmit = (instruction: string) => {
    log('composer submit instruction_len=%d item_count=%d', instruction.length, items.length);
    void agent.sendComposer(instruction, items);
  };

  log('render', { isLoading, hasError: !!error, itemCount: items.length, activeFilter, agentBusy });

  return (
    <div className="p-4 pt-6 relative">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-soft border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold text-stone-900">Today</h1>
            <p className="text-xs text-stone-500">
              {data != null
                ? `${items.length} item${items.length !== 1 ? 's' : ''} · last ${formatRelativeTime(data.generated_at_ms)}`
                : 'iMessage · Gmail · Calendar'}
            </p>
          </div>
        </div>

        {/* Composer bar */}
        <TodayComposerBar onSubmit={handleComposerSubmit} disabled={agentBusy} />

        {/* Source filter tabs */}
        <div className="flex gap-1 border-b border-stone-100 px-4 py-2">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeFilter === tab.id}
              onClick={() => handleFilterChange(tab.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeFilter === tab.id
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading state — 3 skeleton rows */}
        {isLoading && !data && (
          <ul aria-label="Loading feed" data-testid="today-skeleton">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </ul>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <div
            role="alert"
            data-testid="today-error"
            className="mx-4 my-4 rounded-xl bg-coral-50 border border-coral-200 px-4 py-3">
            <p className="text-sm font-medium text-coral-700">{error}</p>
            <button
              data-testid="today-retry"
              onClick={refetch}
              className="mt-2 text-xs font-semibold text-coral-600 underline hover:text-coral-800">
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-stone-500">
              Your day is clear — nothing new from iMessage, Gmail, or Calendar.
            </p>
          </div>
        )}

        {/* Feed list */}
        {!isLoading && !error && items.length > 0 && (
          <ul className="divide-y divide-stone-100" data-testid="today-feed">
            {items.map(item => (
              <TodayFeedRow
                key={item.id}
                item={item}
                onAction={(action, feedItem) => {
                  void agent.sendAction(action, feedItem);
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Agent drawer — sibling to the feed card, positioned fixed */}
      <TodayAgentDrawer
        isOpen={agent.isOpen}
        onClose={agent.close}
        onRetry={agent.error ? agent.close : undefined}
        threadId={agent.activeThreadId}
        contextLabel={agent.contextLabel}
        actionKind={agent.actionKind}
      />
    </div>
  );
};

export default Today;
