/**
 * Sample feed items for the Today page demo/empty state.
 *
 * All timestamps are computed at call-time so the relative display ("8m ago",
 * "2h ago", etc.) is always fresh — never a frozen constant.
 *
 * Calendar events that have already passed today are bumped to tomorrow so the
 * feed never shows a past-due event on first impression.
 */
import type { TodayFeedItem } from './todayAgentUtils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns a Date set to today (or tomorrow if `bumpIfPast` and the time has passed). */
function todayAt(hours: number, minutes: number, bumpIfPast = false): number {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
  if (bumpIfPast && d.getTime() <= now.getTime()) {
    d.setDate(d.getDate() + 1);
  }
  return d.getTime();
}

// ─── Sample items factory ────────────────────────────────────────────────────

/**
 * Returns the 6 canonical sample feed items with fresh timestamps.
 * Call this function each render cycle — do NOT store the result in a module-
 * level constant, because relative timestamps would drift.
 */
export function getSampleItems(): TodayFeedItem[] {
  const now = Date.now();

  return [
    // iMessage — Sarah Chen (unread, ~8 minutes ago)
    {
      id: 'demo-imessage-1',
      source: 'imessage',
      title: 'Sarah Chen',
      preview: 'Still good for coffee at 3?',
      timestamp_ms: now - 8 * 60 * 1000,
      sender: null,
      avatar_url: null,
      is_unread: true,
      source_id: 'demo-imessage-1',
      action_hint: 'reply',
      metadata: { demo: true },
    },

    // iMessage — Dad (~2 hours ago)
    {
      id: 'demo-imessage-2',
      source: 'imessage',
      title: 'Dad',
      preview: 'Happy birthday kiddo! Proud of you.',
      timestamp_ms: now - 2 * 60 * 60 * 1000,
      sender: null,
      avatar_url: null,
      is_unread: false,
      source_id: 'demo-imessage-2',
      action_hint: 'reply',
      metadata: { demo: true },
    },

    // Gmail — Figma Team (~45 minutes ago)
    {
      id: 'demo-gmail-1',
      source: 'gmail',
      title: 'Your weekly design digest',
      preview: 'Top Figma components, design inspiration, and community highlights from this week.',
      timestamp_ms: now - 45 * 60 * 1000,
      sender: 'noreply@figma.com',
      avatar_url: null,
      is_unread: false,
      source_id: 'demo-gmail-1',
      action_hint: 'reply',
      metadata: { demo: true, from_name: 'Figma Team' },
    },

    // Gmail — Stripe (~4 hours ago, unread)
    {
      id: 'demo-gmail-2',
      source: 'gmail',
      title: 'Payment received — $2,400 from Acme Corp',
      preview:
        'A payment of $2,400.00 has been received from Acme Corp. Funds will be deposited within 2 business days.',
      timestamp_ms: now - 4 * 60 * 60 * 1000,
      sender: 'receipts@stripe.com',
      avatar_url: null,
      is_unread: true,
      source_id: 'demo-gmail-2',
      action_hint: 'reply',
      metadata: { demo: true, from_name: 'Stripe' },
    },

    // Calendar — Design review at 3 PM (bump to tomorrow if already past)
    {
      id: 'demo-calendar-1',
      source: 'calendar',
      title: 'Design review — ship checklist',
      preview: '3:00 PM – 3:30 PM · Room 204',
      timestamp_ms: todayAt(15, 0, true),
      sender: null,
      avatar_url: null,
      is_unread: false,
      source_id: 'demo-calendar-1',
      action_hint: 'summarize',
      metadata: { demo: true, location: 'Room 204', duration_minutes: 30 },
    },

    // Calendar — 1:1 with Jamie at 5:30 PM
    {
      id: 'demo-calendar-2',
      source: 'calendar',
      title: '1:1 with Jamie',
      preview: '5:30 PM – 6:00 PM',
      timestamp_ms: todayAt(17, 30, true),
      sender: null,
      avatar_url: null,
      is_unread: false,
      source_id: 'demo-calendar-2',
      action_hint: 'summarize',
      metadata: { demo: true, duration_minutes: 30 },
    },
  ];
}

/** Set of all demo item IDs — used to tag rows with the "Demo" pill. */
export const DEMO_ITEM_IDS = new Set([
  'demo-imessage-1',
  'demo-imessage-2',
  'demo-gmail-1',
  'demo-gmail-2',
  'demo-calendar-1',
  'demo-calendar-2',
]);
