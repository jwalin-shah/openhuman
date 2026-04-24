/**
 * Unit tests for todayBuckets.ts — the pure feed grouper.
 *
 * All tests inject a fixed `now` value so timing is deterministic.
 */
import { describe, expect, it } from 'vitest';

import type { TodayFeedItem } from '../todayAgentUtils';
import { bucketize, type BucketKind, type TodayBucket } from '../todayBuckets';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = 1_700_000_000_000; // fixed epoch for tests

let _idSeq = 0;
function makeItem(overrides: Partial<TodayFeedItem> = {}): TodayFeedItem {
  _idSeq += 1;
  return {
    id: `item-${_idSeq}`,
    source: 'gmail',
    title: 'Test item',
    preview: 'preview text',
    timestamp_ms: NOW - 60_000, // 1 minute ago by default
    sender: null,
    avatar_url: null,
    is_unread: false,
    source_id: `src-${_idSeq}`,
    action_hint: 'reply',
    metadata: {},
    ...overrides,
  };
}

function findBucket(buckets: TodayBucket[], kind: BucketKind) {
  const b = buckets.find(b => b.kind === kind);
  if (!b) throw new Error(`Bucket '${kind}' not found`);
  return b;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('bucketize', () => {
  // ── Return shape ─────────────────────────────────────────────────────────────

  it('always returns all 4 buckets in canonical order', () => {
    const result = bucketize([], NOW);
    expect(result.map(b => b.kind)).toEqual(['right-now', 'up-next', 'today', 'earlier']);
  });

  it('sets correct labels for each bucket', () => {
    const result = bucketize([], NOW);
    expect(result[0].label).toBe('Right now');
    expect(result[1].label).toBe('Up next');
    expect(result[2].label).toBe('Today');
    expect(result[3].label).toBe('Earlier');
  });

  // ── Empty input ──────────────────────────────────────────────────────────────

  it('returns empty items arrays when given no items', () => {
    const result = bucketize([], NOW);
    for (const bucket of result) {
      expect(bucket.items).toHaveLength(0);
    }
  });

  // ── Message sources (imessage / gmail) ───────────────────────────────────────

  it('places a gmail message from 1 hour ago into "today"', () => {
    const item = makeItem({ source: 'gmail', timestamp_ms: NOW - 60 * 60 * 1000 });
    const result = bucketize([item], NOW);
    expect(findBucket(result, 'today').items).toContain(item);
    expect(findBucket(result, 'earlier').items).not.toContain(item);
  });

  it('places an imessage from exactly 6 hours ago into "today"', () => {
    const item = makeItem({ source: 'imessage', timestamp_ms: NOW - 6 * 60 * 60 * 1000 });
    const result = bucketize([item], NOW);
    expect(findBucket(result, 'today').items).toContain(item);
  });

  it('places a gmail message from 6h + 1ms ago into "earlier"', () => {
    const item = makeItem({ source: 'gmail', timestamp_ms: NOW - 6 * 60 * 60 * 1000 - 1 });
    const result = bucketize([item], NOW);
    expect(findBucket(result, 'earlier').items).toContain(item);
    expect(findBucket(result, 'today').items).not.toContain(item);
  });

  it('places an imessage from 8 hours ago into "earlier"', () => {
    const item = makeItem({ source: 'imessage', timestamp_ms: NOW - 8 * 60 * 60 * 1000 });
    const result = bucketize([item], NOW);
    expect(findBucket(result, 'earlier').items).toContain(item);
  });

  // ── Calendar — "Up next" ─────────────────────────────────────────────────────

  it('places a calendar event starting 31 minutes from now into "up-next"', () => {
    const item = makeItem({
      source: 'calendar',
      timestamp_ms: NOW + 31 * 60 * 1000,
      metadata: { end_time_ms: NOW + 61 * 60 * 1000 },
    });
    const result = bucketize([item], NOW);
    expect(findBucket(result, 'up-next').items).toContain(item);
  });

  it('places a calendar event starting in 2 hours into "up-next"', () => {
    const item = makeItem({
      source: 'calendar',
      timestamp_ms: NOW + 2 * 60 * 60 * 1000,
      metadata: {},
    });
    const result = bucketize([item], NOW);
    expect(findBucket(result, 'up-next').items).toContain(item);
  });

  // ── Calendar — "Right now" ───────────────────────────────────────────────────

  it('places a calendar event starting now (end future) into "right-now"', () => {
    const item = makeItem({
      source: 'calendar',
      timestamp_ms: NOW,
      metadata: { end_time_ms: NOW + 60 * 60 * 1000 },
    });
    const result = bucketize([item], NOW);
    expect(findBucket(result, 'right-now').items).toContain(item);
  });

  it('places a calendar event that started 5 min ago (end future) into "right-now"', () => {
    const item = makeItem({
      source: 'calendar',
      timestamp_ms: NOW - 5 * 60 * 1000,
      metadata: { end_time_ms: NOW + 55 * 60 * 1000 },
    });
    const result = bucketize([item], NOW);
    expect(findBucket(result, 'right-now').items).toContain(item);
  });

  it('places a calendar event starting 20 min from now (end well beyond) into "right-now"', () => {
    const item = makeItem({
      source: 'calendar',
      timestamp_ms: NOW + 20 * 60 * 1000,
      metadata: { end_time_ms: NOW + 80 * 60 * 1000 },
    });
    const result = bucketize([item], NOW);
    expect(findBucket(result, 'right-now').items).toContain(item);
  });

  it('treats start ≤ now + 30m AND start ≥ now - 10m (no end) as "right-now"', () => {
    // Started 9 minutes ago, no end time → within the 10m grace window
    const item = makeItem({ source: 'calendar', timestamp_ms: NOW - 9 * 60 * 1000, metadata: {} });
    const result = bucketize([item], NOW);
    expect(findBucket(result, 'right-now').items).toContain(item);
  });

  // ── Calendar — boundary: right-now vs up-next ────────────────────────────────

  it('places event starting exactly at now + 30m into "right-now" (boundary inclusive)', () => {
    // start = now + 30m is ≤ now + 30m (inclusive), and start ≥ now - 10m → right-now
    const item = makeItem({
      source: 'calendar',
      timestamp_ms: NOW + 30 * 60 * 1000,
      metadata: { end_time_ms: NOW + 90 * 60 * 1000 },
    });
    const result = bucketize([item], NOW);
    expect(findBucket(result, 'right-now').items).toContain(item);
  });

  it('places event starting at now + 30m + 1ms into "up-next"', () => {
    const item = makeItem({
      source: 'calendar',
      timestamp_ms: NOW + 30 * 60 * 1000 + 1,
      metadata: { end_time_ms: NOW + 90 * 60 * 1000 },
    });
    const result = bucketize([item], NOW);
    expect(findBucket(result, 'up-next').items).toContain(item);
  });

  // ── Calendar — no end time edge cases ────────────────────────────────────────

  it('treats all-day calendar event (start > now, no end) as "up-next"', () => {
    const item = makeItem({
      source: 'calendar',
      timestamp_ms: NOW + 4 * 60 * 60 * 1000, // 4 hours from now
      metadata: {},
    });
    const result = bucketize([item], NOW);
    expect(findBucket(result, 'up-next').items).toContain(item);
  });

  it('treats past calendar event (start > 10m ago, no end) as "today"', () => {
    // Started 11 min ago (outside grace window), no end → "today"
    const item = makeItem({ source: 'calendar', timestamp_ms: NOW - 11 * 60 * 1000, metadata: {} });
    const result = bucketize([item], NOW);
    expect(findBucket(result, 'today').items).toContain(item);
  });

  it('accepts end_ms as alias for end_time_ms', () => {
    const item = makeItem({
      source: 'calendar',
      timestamp_ms: NOW - 5 * 60 * 1000,
      metadata: { end_ms: NOW + 55 * 60 * 1000 }, // alias
    });
    const result = bucketize([item], NOW);
    expect(findBucket(result, 'right-now').items).toContain(item);
  });

  // ── Sorting ──────────────────────────────────────────────────────────────────

  it('"right-now" bucket is sorted ascending (soonest start first)', () => {
    const sooner = makeItem({
      source: 'calendar',
      timestamp_ms: NOW + 5 * 60 * 1000,
      metadata: { end_time_ms: NOW + 65 * 60 * 1000 },
    });
    const later = makeItem({
      source: 'calendar',
      timestamp_ms: NOW + 25 * 60 * 1000,
      metadata: { end_time_ms: NOW + 85 * 60 * 1000 },
    });
    const result = bucketize([later, sooner], NOW); // intentionally reversed
    const bucket = findBucket(result, 'right-now');
    expect(bucket.items[0]).toBe(sooner);
    expect(bucket.items[1]).toBe(later);
  });

  it('"up-next" bucket is sorted ascending (soonest first)', () => {
    const closer = makeItem({
      source: 'calendar',
      timestamp_ms: NOW + 35 * 60 * 1000,
      metadata: {},
    });
    const farther = makeItem({
      source: 'calendar',
      timestamp_ms: NOW + 120 * 60 * 1000,
      metadata: {},
    });
    const result = bucketize([farther, closer], NOW);
    const bucket = findBucket(result, 'up-next');
    expect(bucket.items[0]).toBe(closer);
    expect(bucket.items[1]).toBe(farther);
  });

  it('"today" bucket is sorted descending (most recent first)', () => {
    const newest = makeItem({ source: 'gmail', timestamp_ms: NOW - 1 * 60 * 1000 });
    const oldest = makeItem({ source: 'gmail', timestamp_ms: NOW - 3 * 60 * 60 * 1000 });
    const result = bucketize([oldest, newest], NOW);
    const bucket = findBucket(result, 'today');
    expect(bucket.items[0]).toBe(newest);
    expect(bucket.items[1]).toBe(oldest);
  });

  it('"earlier" bucket is sorted descending (most recent first)', () => {
    const moreRecent = makeItem({ source: 'imessage', timestamp_ms: NOW - 7 * 60 * 60 * 1000 });
    const oldest = makeItem({ source: 'imessage', timestamp_ms: NOW - 12 * 60 * 60 * 1000 });
    const result = bucketize([oldest, moreRecent], NOW);
    const bucket = findBucket(result, 'earlier');
    expect(bucket.items[0]).toBe(moreRecent);
    expect(bucket.items[1]).toBe(oldest);
  });

  // ── All items in one bucket ──────────────────────────────────────────────────

  it('handles all items in a single bucket (no spill to others)', () => {
    const items = [
      makeItem({ source: 'gmail', timestamp_ms: NOW - 30 * 60 * 1000 }),
      makeItem({ source: 'gmail', timestamp_ms: NOW - 120 * 60 * 1000 }),
      makeItem({ source: 'imessage', timestamp_ms: NOW - 10 * 60 * 1000 }),
    ];
    const result = bucketize(items, NOW);
    expect(findBucket(result, 'today').items).toHaveLength(3);
    expect(findBucket(result, 'earlier').items).toHaveLength(0);
    expect(findBucket(result, 'right-now').items).toHaveLength(0);
    expect(findBucket(result, 'up-next').items).toHaveLength(0);
  });

  // ── Items straddling multiple buckets ────────────────────────────────────────

  it('correctly distributes items across all four buckets', () => {
    const rightNow = makeItem({
      source: 'calendar',
      timestamp_ms: NOW + 10 * 60 * 1000,
      metadata: { end_time_ms: NOW + 70 * 60 * 1000 },
    });
    const upNext = makeItem({
      source: 'calendar',
      timestamp_ms: NOW + 90 * 60 * 1000,
      metadata: {},
    });
    const todayMsg = makeItem({ source: 'gmail', timestamp_ms: NOW - 2 * 60 * 60 * 1000 });
    const earlierMsg = makeItem({ source: 'imessage', timestamp_ms: NOW - 8 * 60 * 60 * 1000 });

    const result = bucketize([rightNow, upNext, todayMsg, earlierMsg], NOW);

    expect(findBucket(result, 'right-now').items).toEqual([rightNow]);
    expect(findBucket(result, 'up-next').items).toEqual([upNext]);
    expect(findBucket(result, 'today').items).toEqual([todayMsg]);
    expect(findBucket(result, 'earlier').items).toEqual([earlierMsg]);
  });

  // ── Non-calendar items never enter calendar buckets ──────────────────────────

  it('never puts imessage/gmail items into right-now or up-next', () => {
    // Even a future-timestamped message (unlikely but possible)
    const futureMsg = makeItem({ source: 'gmail', timestamp_ms: NOW + 60 * 60 * 1000 });
    const result = bucketize([futureMsg], NOW);
    expect(findBucket(result, 'right-now').items).toHaveLength(0);
    expect(findBucket(result, 'up-next').items).toHaveLength(0);
    // A future message with age < 6h goes to "today" (negative age ≤ 6h)
    expect(findBucket(result, 'today').items).toContain(futureMsg);
  });

  // ── Original order is not mutated ────────────────────────────────────────────

  it('does not mutate the input array', () => {
    const items = [
      makeItem({ source: 'gmail', timestamp_ms: NOW - 30 * 60 * 1000 }),
      makeItem({ source: 'gmail', timestamp_ms: NOW - 10 * 60 * 1000 }),
    ];
    const originalOrder = [...items];
    bucketize(items, NOW);
    expect(items[0]).toBe(originalOrder[0]);
    expect(items[1]).toBe(originalOrder[1]);
  });
});
