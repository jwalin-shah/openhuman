import debug from 'debug';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { callCoreRpc } from '../services/coreRpcClient';
import { useAppSelector } from '../store/hooks';
import { TodayAgentDrawer } from './today/TodayAgentDrawer';
import {
  PRIMARY_ACTION,
  type TodayFeedItem,
  type TodayFeedListParams,
  type TodayFeedListResponse,
} from './today/todayAgentUtils';
import { bucketize } from './today/todayBuckets';
import TodayComposerBar from './today/TodayComposerBar';
import { TodayFeedRow } from './today/TodayFeedRow';
import { TodayMorningBrief } from './today/TodayMorningBrief';
import { TodaySampleBanner, TodaySourceNudge } from './today/TodaySampleBanner';
import { DEMO_ITEM_IDS, getSampleItems } from './today/todaySampleData';
import { useTodayAgent } from './today/useTodayAgent';
import { type TodayFeedCluster, useTodayLinks } from './today/useTodayLinks';

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

// ─── Platform detection ───────────────────────────────────────────────────────

/**
 * Returns true when running on macOS.
 *
 * Heuristic: userAgent contains "Mac". Evaluated once at module load since
 * platform does not change at runtime.
 */
function detectMacOS(): boolean {
  try {
    return /Mac/.test(navigator.userAgent);
  } catch {
    return false;
  }
}

const IS_MACOS = detectMacOS();

// ─── Demo pill ────────────────────────────────────────────────────────────────

/** Subtle amber badge shown on sample rows to mark them as demo data. */
function DemoPill() {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 shrink-0"
      aria-label="sample data">
      Demo
    </span>
  );
}

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

  const realItems: TodayFeedItem[] = data?.items ?? [];

  // ─── Demo mode heuristic ──────────────────────────────────────────────────
  // Show sample mode whenever the feed loaded successfully but returned zero
  // items. This is the simple fallback; connection-aware detection is deferred.
  //
  // NOTE (deferred): Ideally we'd only show sample mode when at least one
  // source is not-configured. The channelConnectionsSlice tracks only
  // Telegram/Discord/Web — not Gmail or Calendar — so there is no reliable
  // connection signal for these sources. The simple heuristic (zero items →
  // sample mode) is safe for demo: real feeds with genuine activity always
  // return at least one item.
  const isSampleMode = !isLoading && !error && data !== null && realItems.length === 0;

  // Sample items — fresh timestamps each render cycle.
  // Memoised on `isSampleMode` so we don't regenerate when not in sample mode.
  const sampleItems = useMemo(() => (isSampleMode ? getSampleItems() : []), [isSampleMode]);

  // Displayed items: real feed or sample feed
  const items: TodayFeedItem[] = isSampleMode ? sampleItems : realItems;

  // Cross-source semantic clusters — progressive enhancement; feed renders
  // instantly and pills fade in when clusters arrive (1-3 s typically).
  const { clusters } = useTodayLinks(items);

  // Map from item ID to its cluster, used to pass cluster prop to each row.
  const clusterMap = useMemo<Map<string, TodayFeedCluster>>(() => {
    const map = new Map<string, TodayFeedCluster>();
    for (const cluster of clusters) {
      for (const id of cluster.item_ids) {
        map.set(id, cluster);
      }
    }
    return map;
  }, [clusters]);

  // Per-filter source nudge: shown in sample mode when a specific tab is
  // active but that source has no items (edge case for the filtered view).
  const showSourceNudge =
    isSampleMode &&
    activeFilter !== 'all' &&
    items.filter(i => i.source === activeFilter).length === 0;

  // Compute time-bucket groups. nowMsRef is updated in an effect whenever
  // items change so that vi.setSystemTime() in tests can mock the current time,
  // and the 2-minute auto-refresh naturally migrates calendar items between buckets.
  const nowMsRef = useRef<number>(0);
  useEffect(() => {
    nowMsRef.current = Date.now();
  }, [items]);
  const buckets = bucketize(items, nowMsRef.current);
  const nonEmptyBuckets = buckets.filter(b => b.items.length > 0);

  // ── Keyboard navigation state ────────────────────────────────────────────────
  // -1 means no row is focused
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  // Array of refs, one per feed row; rebuilt each render from items
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);

  // Reset focus when the filter changes or items are reloaded
  useEffect(() => {
    log('[keyboard-nav] filter changed — resetting focusedIndex');
    setFocusedIndex(-1);
  }, [activeFilter]);

  // ── Document-level keydown listener ─────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Suppress when the agent drawer is open
      if (agent.isOpen) return;

      // Suppress when focus is inside an input, textarea, or contenteditable.
      // Guard with `instanceof Element` before `.closest()` because in JSDOM
      // (tests) `e.target` may be the Document itself, which lacks `.closest`.
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof Element && target.closest('[contenteditable="true"]') != null)
      ) {
        return;
      }

      const count = items.length;
      if (count === 0) return;

      switch (e.key) {
        case 'j':
        case 'ArrowDown': {
          e.preventDefault();
          const next = focusedIndex < count - 1 ? focusedIndex + 1 : 0;
          log('[keyboard-nav] j/ArrowDown -> index=%d', next);
          setFocusedIndex(next);
          rowRefs.current[next]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          break;
        }
        case 'k':
        case 'ArrowUp': {
          e.preventDefault();
          const prev = focusedIndex > 0 ? focusedIndex - 1 : count - 1;
          log('[keyboard-nav] k/ArrowUp -> index=%d', prev);
          setFocusedIndex(prev);
          rowRefs.current[prev]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          break;
        }
        case 'Enter': {
          if (focusedIndex < 0 || focusedIndex >= count) return;
          const focusedItem = items[focusedIndex];
          if (!focusedItem) return;
          const primaryAction = PRIMARY_ACTION[focusedItem.source];
          log(
            '[keyboard-nav] Enter -> action=%s item_id=%s source=%s',
            primaryAction,
            focusedItem.id,
            focusedItem.source
          );
          void agent.sendAction(primaryAction, focusedItem);
          break;
        }
        case 'Escape': {
          if (focusedIndex >= 0) {
            log('[keyboard-nav] Escape -> clearing focus');
            setFocusedIndex(-1);
          }
          break;
        }
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [agent, agent.isOpen, focusedIndex, items]);

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
                ? `${realItems.length} item${realItems.length !== 1 ? 's' : ''} · last ${formatRelativeTime(data.generated_at_ms)}`
                : 'iMessage · Gmail · Calendar'}
            </p>
          </div>
        </div>

        {/* Morning brief — proactive AI insight, fires automatically after feed loads */}
        <TodayMorningBrief items={items} isFeedLoading={isLoading} />

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

        {/* Sample data banner — shown above feed in demo mode */}
        {isSampleMode && <TodaySampleBanner />}

        {/* Per-source nudge when a filtered tab has no items in sample mode */}
        {showSourceNudge && (
          <TodaySourceNudge
            source={activeFilter as 'gmail' | 'calendar' | 'imessage'}
            isMacOS={IS_MACOS}
          />
        )}

        {/* Feed list — grouped into time buckets.
            Using a <div> wrapper with per-bucket <section> elements keeps
            bucket-header markup (plain <p>) out of the <ul> DOM, so existing
            queries on `li` elements remain stable for keyboard-nav tests. */}
        {!isLoading && !error && items.length > 0 && (
          <div data-testid="today-feed">
            {nonEmptyBuckets.map(bucket => {
              const headerId = `bucket-header-${bucket.kind}`;
              log('[today-ui] rendering bucket kind=%s count=%d', bucket.kind, bucket.items.length);
              return (
                <section
                  key={bucket.kind}
                  role="group"
                  aria-labelledby={headerId}
                  data-testid={`bucket-${bucket.kind}`}>
                  {/* Subtle stone-500 label, uppercase tracking — premium design */}
                  <p
                    id={headerId}
                    className="px-4 pt-4 pb-1 text-[11px] font-medium uppercase tracking-wider text-stone-500 select-none">
                    {bucket.label}
                  </p>
                  {/* Using div wrapper so we can overlay the Demo pill
                      without nesting <li> elements inside <ul>. TodayFeedRow
                      renders its own <li>, and the outer div provides the
                      relative-positioning context for the pill badge. */}
                  <div className="divide-y divide-stone-100">
                    {bucket.items.map(item => {
                      // Maintain the global linear index so keyboard-nav refs
                      // stay aligned with the `items` array order.
                      const idx = items.indexOf(item);
                      const isDemo = DEMO_ITEM_IDS.has(item.id);
                      return (
                        <div key={item.id} className="relative">
                          {/* Demo pill — overlaid on sample rows only */}
                          {isDemo && (
                            <div className="absolute top-3 right-4 z-10 pointer-events-none">
                              <DemoPill />
                            </div>
                          )}
                          <TodayFeedRow
                            ref={el => {
                              rowRefs.current[idx] = el;
                            }}
                            item={item}
                            isFocused={focusedIndex === idx}
                            cluster={clusterMap.get(item.id)}
                            onAction={(action, feedItem) => {
                              log(
                                '[today-ui] row action action=%s item_id=%s is_demo=%s',
                                action,
                                feedItem.id,
                                String(DEMO_ITEM_IDS.has(feedItem.id))
                              );
                              void agent.sendAction(action, feedItem);
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
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
