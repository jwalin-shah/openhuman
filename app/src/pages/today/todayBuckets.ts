/**
 * todayBuckets — pure time-bucket grouping for the Today feed.
 *
 * Bucket rules:
 *   "Right now"  — calendar events whose window overlaps the next 30 min:
 *                  start ≤ now + 30m  AND  (end ≥ now  OR  start ≥ now - 10m)
 *   "Up next"    — calendar events more than 30 min out (start > now + 30m)
 *   "Today"      — imessage / gmail from the last 6 hours
 *   "Earlier"    — imessage / gmail older than 6 hours
 *
 * Sort order within each bucket:
 *   "Right now" / "Up next"  — ascending timestamp_ms (soonest first)
 *   "Today" / "Earlier"      — descending timestamp_ms (most recent first)
 *
 * Edge cases:
 *   - Calendar event with no end time: "Up next" if start > now, else "Today"
 *   - Empty buckets are returned with an empty items array (caller hides them)
 */
import type { TodayFeedItem, TodaySource } from './todayAgentUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BucketKind = 'right-now' | 'up-next' | 'today' | 'earlier';

export interface TodayBucket {
  kind: BucketKind;
  label: string;
  items: TodayFeedItem[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MS_10_MIN = 10 * 60 * 1000;
const MS_30_MIN = 30 * 60 * 1000;
const MS_6_HOURS = 6 * 60 * 60 * 1000;

const BUCKET_ORDER: BucketKind[] = ['right-now', 'up-next', 'today', 'earlier'];

const BUCKET_LABELS: Record<BucketKind, string> = {
  'right-now': 'Right now',
  'up-next': 'Up next',
  today: 'Today',
  earlier: 'Earlier',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CALENDAR_SOURCE: TodaySource = 'calendar';

/**
 * Extract the calendar end time from item metadata.
 * Accepts `end_time_ms` (primary) or `end_ms` (alias).
 * Returns undefined when neither field is present or the value is not a number.
 */
function getCalendarEndMs(item: TodayFeedItem): number | undefined {
  const raw = item.metadata['end_time_ms'] ?? item.metadata['end_ms'];
  return typeof raw === 'number' ? raw : undefined;
}

/**
 * Classify a single calendar event into a bucket kind.
 */
function classifyCalendar(item: TodayFeedItem, now: number): BucketKind {
  const startMs = item.timestamp_ms;
  const endMs = getCalendarEndMs(item);

  const hasEnd = endMs !== undefined;

  // "Right now": start ≤ now + 30m AND (end ≥ now OR start ≥ now - 10m)
  const startSoon = startMs <= now + MS_30_MIN;
  const endCoversNow = hasEnd ? endMs >= now : false;
  const startedRecently = startMs >= now - MS_10_MIN;

  if (startSoon && (endCoversNow || startedRecently)) {
    return 'right-now';
  }

  // "Up next": start > now + 30m
  if (startMs > now + MS_30_MIN) {
    return 'up-next';
  }

  // No end time and start ≤ now: treat as "Today"
  // (All-day event or past event without end tracked)
  return 'today';
}

/**
 * Classify a non-calendar (imessage / gmail) item into a bucket kind.
 */
function classifyMessage(item: TodayFeedItem, now: number): BucketKind {
  const age = now - item.timestamp_ms;
  return age <= MS_6_HOURS ? 'today' : 'earlier';
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Group a flat list of TodayFeedItems into time buckets.
 *
 * @param items - Raw feed items in any order
 * @param now   - Current time in ms (pass `Date.now()` in production;
 *                inject a fixed value in tests for determinism)
 * @returns     Array of buckets in canonical display order.
 *              Buckets with zero items are included with an empty `items` array
 *              so callers can check `.items.length` and hide accordingly.
 */
export function bucketize(items: TodayFeedItem[], now: number): TodayBucket[] {
  const bucketMap: Record<BucketKind, TodayFeedItem[]> = {
    'right-now': [],
    'up-next': [],
    today: [],
    earlier: [],
  };

  for (const item of items) {
    const kind =
      item.source === CALENDAR_SOURCE ? classifyCalendar(item, now) : classifyMessage(item, now);

    bucketMap[kind].push(item);
  }

  // Sort within each bucket
  // Calendar-forward buckets: ascending (soonest first)
  for (const kind of ['right-now', 'up-next'] as const) {
    bucketMap[kind].sort((a, b) => a.timestamp_ms - b.timestamp_ms);
  }
  // Message-history buckets: descending (most recent first)
  for (const kind of ['today', 'earlier'] as const) {
    bucketMap[kind].sort((a, b) => b.timestamp_ms - a.timestamp_ms);
  }

  return BUCKET_ORDER.map(kind => ({ kind, label: BUCKET_LABELS[kind], items: bucketMap[kind] }));
}
