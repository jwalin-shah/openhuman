/**
 * Pure utility functions and types for the Today page agent integration.
 * No side effects — safe to import from tests without mocking.
 */

// ─── Core types (re-exported from this module; Today.tsx re-exports them for
//     backward-compat with existing tests that import from '../Today') ─────────

export type TodaySource = 'imessage' | 'gmail' | 'calendar';

export interface TodayFeedItem {
  id: string;
  source: TodaySource;
  title: string;
  preview: string;
  timestamp_ms: number;
  sender?: string | null;
  avatar_url?: string | null;
  is_unread: boolean;
  source_id: string;
  action_hint: string;
  metadata: Record<string, unknown>;
}

export interface TodayFeedListParams {
  window_hours?: number;
  limit_per_source?: number;
  source_filter?: string;
}

export interface TodayFeedListResponse {
  items: TodayFeedItem[];
  source_counts: Record<string, number>;
  window_hours: number;
  generated_at_ms: number;
}

// ─── Action metadata ──────────────────────────────────────────────────────────

export type TodayActionKind = 'reply' | 'draft' | 'summarize';

export const SOURCE_ACTIONS: Record<TodaySource, TodayActionKind[]> = {
  imessage: ['reply', 'summarize'],
  gmail: ['reply', 'draft', 'summarize'],
  calendar: ['summarize'],
};

export const PRIMARY_ACTION: Record<TodaySource, TodayActionKind> = {
  imessage: 'reply',
  gmail: 'reply',
  calendar: 'summarize',
};

export const ACTION_LABELS: Record<TodayActionKind, string> = {
  reply: 'Reply',
  draft: 'Draft',
  summarize: 'Summarize',
};

// ─── Instruction sentences ────────────────────────────────────────────────────

const ACTION_INSTRUCTIONS: Record<TodaySource, Partial<Record<TodayActionKind, string>>> = {
  imessage: {
    reply: 'Draft a reply to this iMessage. Keep it concise and natural.',
    summarize: 'Summarize this iMessage conversation in a few sentences.',
  },
  gmail: {
    reply: 'Draft a reply to this Gmail. Keep it professional and concise.',
    draft: 'Draft a new email in response to this Gmail thread.',
    summarize: 'Summarize this email in a few sentences, highlighting key action items.',
  },
  calendar: {
    summarize:
      'Prepare a meeting summary for this calendar event. Include key topics, participants, and suggested preparation steps.',
  },
};

// ─── Prompt builders ──────────────────────────────────────────────────────────

/**
 * Build the agent prompt for a per-row action (reply, draft, summarize).
 */
export function buildActionPrompt(action: TodayActionKind, item: TodayFeedItem): string {
  const instruction =
    ACTION_INSTRUCTIONS[item.source]?.[action] ??
    `${ACTION_LABELS[action]} for this ${item.source} item.`;

  const sourceLabel =
    item.source === 'imessage' ? 'iMessage' : item.source === 'gmail' ? 'Gmail' : 'Calendar';

  const lines: string[] = [instruction, '', '--- Context ---', `Source: ${sourceLabel}`];

  if (item.sender) lines.push(`From: ${item.sender}`);
  lines.push(`Title: ${item.title}`);

  const time = new Date(item.timestamp_ms).toISOString();
  lines.push(`Time: ${time}`);
  lines.push(`Preview: ${item.preview}`);

  const metadataEntries = Object.entries(item.metadata);
  if (metadataEntries.length > 0) {
    lines.push('Metadata:');
    for (const [key, value] of metadataEntries) {
      lines.push(`  ${key}: ${String(value)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Build the agent prompt for the composer bar ("What do you want to do today?").
 * Caps feed at 20 items, 80 chars per preview, and 4000 chars total for the
 * feed summary block.
 */
export function buildComposerPrompt(
  userInstruction: string,
  visibleItems: TodayFeedItem[]
): string {
  const MAX_ITEMS = 20;
  const MAX_PREVIEW_CHARS = 80;
  const MAX_FEED_CHARS = 4000;

  const cappedItems = visibleItems.slice(0, MAX_ITEMS);
  const remaining = visibleItems.length - cappedItems.length;

  const itemLines = cappedItems.map(item => {
    const sourceLabel =
      item.source === 'imessage' ? 'iMessage' : item.source === 'gmail' ? 'Gmail' : 'Calendar';
    const preview =
      item.preview.length > MAX_PREVIEW_CHARS
        ? `${item.preview.slice(0, MAX_PREVIEW_CHARS)}…`
        : item.preview;
    const senderPart = item.sender ? ` (from ${item.sender})` : '';
    return `- [${sourceLabel}] ${item.title}${senderPart}: ${preview}`;
  });

  // Apply total character budget on feed summary block
  let feedSummary = itemLines.join('\n');
  if (feedSummary.length > MAX_FEED_CHARS) {
    // Truncate and append "…and N more"
    let truncated = '';
    let count = 0;
    for (const line of itemLines) {
      const next = truncated ? `${truncated}\n${line}` : line;
      if (next.length > MAX_FEED_CHARS - 20) break;
      truncated = next;
      count++;
    }
    const skipped = cappedItems.length - count + remaining;
    feedSummary = skipped > 0 ? `${truncated}\n…and ${skipped} more` : truncated;
  } else if (remaining > 0) {
    feedSummary = `${feedSummary}\n…and ${remaining} more`;
  }

  return [
    `The user is looking at their Today feed and asks: "${userInstruction}"`,
    '',
    'Here is their current feed:',
    feedSummary,
  ].join('\n');
}
