/**
 * Unit tests for useTodayLinks hook.
 *
 * Verifies:
 * - Empty items → no clusters, not loading
 * - Non-sample items → calls RPC, sets clusters
 * - RPC failure → empty clusters, no throw
 * - All-sample items → demo fallback (no RPC call)
 * - Item-IDs hash change → re-fetches
 * - No extra fetches on re-renders with same IDs
 */
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TodayFeedItem } from '../todayAgentUtils';
import { DEMO_ITEM_IDS } from '../todaySampleData';
import {
  type TodayFeedCluster,
  type TodayFeedLinksResponse,
  useTodayLinks,
} from '../useTodayLinks';

// ─── Mock coreRpcClient ───────────────────────────────────────────────────────

const { callCoreRpc } = vi.hoisted(() => ({ callCoreRpc: vi.fn() }));

vi.mock('../../../services/coreRpcClient', () => ({ callCoreRpc }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeItem(id: string, isDemo = false): TodayFeedItem {
  return {
    id,
    source: 'gmail',
    title: `Item ${id}`,
    preview: 'preview',
    timestamp_ms: Date.now() - 60_000,
    sender: null,
    avatar_url: null,
    is_unread: false,
    source_id: id,
    action_hint: 'reply',
    metadata: isDemo ? { demo: true } : {},
  };
}

function makeSampleItems(): TodayFeedItem[] {
  return [...DEMO_ITEM_IDS].map(id => makeItem(id, true));
}

function makeLinksResponse(clusters: TodayFeedCluster[]): TodayFeedLinksResponse {
  return { clusters, from_cache: false };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useTodayLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty clusters and isLoading=false when items is empty', () => {
    const { result } = renderHook(() => useTodayLinks([]));

    expect(result.current.clusters).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(callCoreRpc).not.toHaveBeenCalled();
  });

  it('calls RPC with non-sample items and sets clusters from response', async () => {
    const cluster: TodayFeedCluster = {
      cluster_id: 'c1',
      item_ids: ['item-a', 'item-b'],
      reason: 'Both discuss the Q3 roadmap',
    };
    callCoreRpc.mockResolvedValueOnce(makeLinksResponse([cluster]));

    const items = [makeItem('item-a'), makeItem('item-b')];
    const { result } = renderHook(() => useTodayLinks(items));

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.clusters).toEqual([cluster]);
    expect(callCoreRpc).toHaveBeenCalledOnce();
    expect(callCoreRpc).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'openhuman.today_feed_links' })
    );
  });

  it('returns empty clusters and does not throw on RPC failure', async () => {
    callCoreRpc.mockRejectedValueOnce(new Error('Network timeout'));

    const items = [makeItem('item-a'), makeItem('item-b')];
    const { result } = renderHook(() => useTodayLinks(items));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.clusters).toEqual([]);
    // No exception propagated to the hook consumer
  });

  it('returns demo cluster without calling RPC when all items are sample items', async () => {
    const sampleItems = makeSampleItems();
    const { result } = renderHook(() => useTodayLinks(sampleItems));

    // Demo fallback is synchronous — should not be loading
    expect(result.current.isLoading).toBe(false);
    expect(callCoreRpc).not.toHaveBeenCalled();

    expect(result.current.clusters).toHaveLength(1);
    expect(result.current.clusters[0].cluster_id).toBe('demo-cluster-1');
    expect(result.current.clusters[0].item_ids).toContain('demo-imessage-1');
    expect(result.current.clusters[0].item_ids).toContain('demo-calendar-1');
  });

  it('re-fetches when item IDs change', async () => {
    const clusterA: TodayFeedCluster = {
      cluster_id: 'ca',
      item_ids: ['item-a'],
      reason: 'Reason A',
    };
    const clusterB: TodayFeedCluster = {
      cluster_id: 'cb',
      item_ids: ['item-b'],
      reason: 'Reason B',
    };
    callCoreRpc
      .mockResolvedValueOnce(makeLinksResponse([clusterA]))
      .mockResolvedValueOnce(makeLinksResponse([clusterB]));

    const itemsA = [makeItem('item-a')];
    const itemsB = [makeItem('item-b')];

    const { result, rerender } = renderHook(
      ({ items }: { items: TodayFeedItem[] }) => useTodayLinks(items),
      { initialProps: { items: itemsA } }
    );

    await waitFor(() => {
      expect(result.current.clusters).toEqual([clusterA]);
    });

    rerender({ items: itemsB });

    await waitFor(() => {
      expect(result.current.clusters).toEqual([clusterB]);
    });

    expect(callCoreRpc).toHaveBeenCalledTimes(2);
  });

  it('does not re-fetch on re-renders when item IDs are unchanged', async () => {
    const cluster: TodayFeedCluster = { cluster_id: 'c1', item_ids: ['x'], reason: 'Same' };
    callCoreRpc.mockResolvedValue(makeLinksResponse([cluster]));

    const items = [makeItem('x')];
    const { rerender, result } = renderHook(() => useTodayLinks(items));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Re-render with the same reference — effect should NOT re-run
    rerender();
    rerender();

    expect(callCoreRpc).toHaveBeenCalledOnce();
  });
});
