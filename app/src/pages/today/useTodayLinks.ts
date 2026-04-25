/**
 * useTodayLinks — fetches cross-source semantic clusters for Today feed items.
 *
 * Progressive enhancement: the feed renders instantly; this hook fires after
 * the feed loads and fades the "Linked" pills in when clusters arrive.
 *
 * Demo fallback: when all items are sample items (DEMO_ITEM_IDS), skips the
 * RPC and returns a hardcoded cluster so recorded demos always show the feature.
 */
import debug from 'debug';
import { useEffect, useMemo, useState } from 'react';

import { callCoreRpc } from '../../services/coreRpcClient';
import type { TodayFeedItem } from './todayAgentUtils';
import { DEMO_ITEM_IDS } from './todaySampleData';

const log = debug('[today-links]');
const logError = debug('[today-links]:error');

// ─── Shared contract types ────────────────────────────────────────────────────
// Defined here (not in todayAgentUtils.ts) to avoid conflicts with the sibling
// Rust agent. A follow-up commit can consolidate into todayAgentUtils.ts.

export interface TodayFeedCluster {
  cluster_id: string;
  item_ids: string[];
  reason: string;
}

export interface TodayFeedLinksResponse {
  clusters: TodayFeedCluster[];
  from_cache: boolean;
}

export interface TodayFeedLinksParams {
  item_ids: string[];
  items: TodayFeedItem[];
}

// ─── Demo cluster ─────────────────────────────────────────────────────────────
// Sarah is texting "Still good for coffee at 3?" — this references the same
// 3:00 PM slot as the "Design review — ship checklist" calendar event.
// Linking them surfaces a useful connection: she may be referring to that meeting.

const DEMO_CLUSTER: TodayFeedCluster = {
  cluster_id: 'demo-cluster-1',
  item_ids: ['demo-imessage-1', 'demo-calendar-1'],
  reason: "Sarah's text about 3pm likely references the Design review at 3:00 PM",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Stable string hash of item IDs — used as the useEffect dependency so the
 * hook only re-fetches when the actual set of IDs changes, not on every render.
 */
function computeItemsHash(items: TodayFeedItem[]): string {
  return items
    .map(i => i.id)
    .sort()
    .join('|');
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTodayLinks(items: TodayFeedItem[]): {
  clusters: TodayFeedCluster[];
  isLoading: boolean;
} {
  const [clusters, setClusters] = useState<TodayFeedCluster[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Stable dependency — avoids re-running effect on reference changes when IDs
  // haven't changed. `computeItemsHash` is a module-level constant so omitting
  // it from the dep array is safe.
  const itemsHash = useMemo(() => computeItemsHash(items), [items]);

  useEffect(() => {
    if (items.length === 0) {
      log('no items — clearing clusters');
      setClusters([]);
      setIsLoading(false);
      return;
    }

    // Demo fallback: all items are sample items → return hardcoded cluster, skip RPC.
    const allSample = items.every(i => DEMO_ITEM_IDS.has(i.id));
    if (allSample) {
      log('demo fallback active', { itemCount: items.length });
      setClusters([DEMO_CLUSTER]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    log('fetching links via RPC', { itemCount: items.length });

    callCoreRpc<TodayFeedLinksResponse>({
      method: 'openhuman.today_feed_links',
      params: { item_ids: items.map(i => i.id), items } satisfies TodayFeedLinksParams,
    })
      .then(res => {
        if (cancelled) return;
        log('links loaded', { clusterCount: res.clusters.length, fromCache: res.from_cache });
        setClusters(res.clusters);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        logError('fetch failed', { err: err instanceof Error ? err.message : String(err) });
        // Graceful degradation — no pills, feed still usable.
        setClusters([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // `items` is intentionally excluded — itemsHash is the stable proxy for
    // item identity. Including `items` directly would re-run on every render
    // even when IDs haven't changed.
  }, [itemsHash]);

  return { clusters, isLoading };
}
