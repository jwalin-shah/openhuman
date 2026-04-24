/**
 * TodayMorningBrief — proactive AI insight ribbon at the top of the Today page.
 *
 * Renders above the composer bar inside the white feed card. Automatically
 * fires a brief on mount (after the feed loads) and re-fires when the visible
 * item IDs change materially. A small refresh button lets the user re-trigger
 * manually.
 *
 * States
 * ──────
 *  pending  → "Thinking about your day…" with a pulse animation
 *  streaming → incremental text as it arrives
 *  complete  → final text in stone-700
 *  error     → hidden (demo should never surface an error banner here)
 *  idle      → hidden (before first fire)
 */
import debug from 'debug';

import type { TodayFeedItem } from './todayAgentUtils';
import { useTodayBrief } from './useTodayBrief';

const log = debug('[today-brief]');

// ─── Refresh icon (inline SVG, no external dep) ───────────────────────────────

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H5.498a.75.75 0 0 0-.75.75v3.232a.75.75 0 0 0 1.5 0v-1.628l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V3.939a.75.75 0 0 0-1.5 0v1.628l-.31-.31A7 7 0 0 0 2.239 8.396a.75.75 0 0 0 1.448.389A5.5 5.5 0 0 1 13.89 6.318l.311.311h-2.432a.75.75 0 0 0 0 1.5h3.432a.75.75 0 0 0 .531-.219Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ─── Lightbulb icon ───────────────────────────────────────────────────────────

function LightbulbIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden="true">
      <path d="M10 2a6 6 0 0 0-3.6 10.8A2 2 0 0 0 7 14h6a2 2 0 0 0 .6-1.2A6 6 0 0 0 10 2ZM8 16a1 1 0 0 0 1 1h2a1 1 0 0 0 0-2H9a1 1 0 0 0-1 1Z" />
    </svg>
  );
}

// ─── Component props ──────────────────────────────────────────────────────────

export interface TodayMorningBriefProps {
  items: TodayFeedItem[];
  isFeedLoading: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TodayMorningBrief({ items, isFeedLoading }: TodayMorningBriefProps) {
  const { status, text, refresh } = useTodayBrief(items, isFeedLoading);

  log('render status=%s text_len=%d', status, text.length);

  // Hidden states — error is always hidden per spec, idle means not yet started
  if (status === 'error' || status === 'idle') {
    return null;
  }

  const isPending = status === 'pending';
  const isStreaming = status === 'streaming';
  const isComplete = status === 'complete';

  return (
    <div
      data-testid="today-morning-brief"
      role="status"
      aria-live="polite"
      aria-label="AI morning brief"
      className="flex items-start gap-3 px-4 py-3 border-b border-stone-100 bg-stone-50/60">
      {/* Left: lightbulb icon */}
      <div className="flex-shrink-0 mt-0.5">
        <LightbulbIcon
          className={`w-4 h-4 ${isPending ? 'text-stone-300 animate-pulse' : 'text-primary-400'}`}
        />
      </div>

      {/* Center: text content */}
      <div className="flex-1 min-w-0">
        {isPending && (
          <p
            data-testid="today-brief-pending"
            className="text-sm text-stone-400 italic animate-pulse">
            Thinking about your day…
          </p>
        )}

        {(isStreaming || isComplete) && text && (
          <p
            data-testid="today-brief-text"
            className={`text-sm leading-relaxed ${
              isComplete ? 'text-stone-700' : 'text-stone-500'
            }`}>
            {text}
          </p>
        )}

        {/* Streaming cursor — visible while streaming */}
        {isStreaming && (
          <span
            aria-hidden="true"
            className="inline-block w-0.5 h-3.5 bg-stone-400 animate-pulse ml-0.5 align-middle"
          />
        )}
      </div>

      {/* Right: refresh button (only visible when not pending) */}
      {!isPending && (
        <button
          data-testid="today-brief-refresh"
          onClick={() => {
            log('user triggered refresh');
            refresh();
          }}
          title="Refresh brief"
          aria-label="Refresh AI brief"
          className="flex-shrink-0 mt-0.5 p-1 rounded text-stone-300 hover:text-stone-500 hover:bg-stone-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-1">
          <RefreshIcon className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default TodayMorningBrief;
