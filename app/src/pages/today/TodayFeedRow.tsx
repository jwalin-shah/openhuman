/**
 * TodayFeedRow — single feed item with hover-revealed action menu.
 * Extracted from Today.tsx inline FeedRow; adds per-row actions.
 * Supports keyboard navigation via the `isFocused` prop and `forwardRef`.
 */
import debug from 'debug';
import { forwardRef, useRef, useState } from 'react';

import {
  ACTION_LABELS,
  PRIMARY_ACTION,
  SOURCE_ACTIONS,
  type TodayActionKind,
  type TodayFeedItem,
  type TodaySource,
} from './todayAgentUtils';

const log = debug('[today-ui]');

// ─── Shared display helpers (duplicated from Today.tsx for extraction) ────────

const SOURCE_BADGE_CLASSES: Record<TodaySource, string> = {
  imessage: 'bg-primary-100 text-primary-700',
  gmail: 'bg-coral-100 text-coral-700',
  calendar: 'bg-sage-100 text-sage-700',
};

const SOURCE_LABELS: Record<TodaySource, string> = {
  imessage: 'iMessage',
  gmail: 'Gmail',
  calendar: 'Calendar',
};

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

// ─── Action dropdown ──────────────────────────────────────────────────────────

interface ActionMenuProps {
  item: TodayFeedItem;
  onAction(action: TodayActionKind, item: TodayFeedItem): void;
}

function ActionMenu({ item, onAction }: ActionMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const primaryAction = PRIMARY_ACTION[item.source];
  const allActions = SOURCE_ACTIONS[item.source];
  const secondaryActions = allActions.filter(a => a !== primaryAction);

  const handleAction = (action: TodayActionKind, e: React.MouseEvent) => {
    e.stopPropagation();
    log('action clicked action=%s item_id=%s source=%s', action, item.id, item.source);
    setMenuOpen(false);
    onAction(action, item);
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(prev => !prev);
  };

  return (
    <div
      ref={menuRef}
      className="relative flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
      {/* Primary action pill */}
      <button
        onClick={e => handleAction(primaryAction, e)}
        data-testid={`action-${primaryAction}-${item.id}`}
        className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-primary-500 text-white hover:bg-primary-600 transition-colors whitespace-nowrap">
        {ACTION_LABELS[primaryAction]}
      </button>

      {/* Chevron for dropdown (only when secondary actions exist) */}
      {secondaryActions.length > 0 && (
        <>
          <button
            onClick={toggleMenu}
            data-testid={`action-menu-${item.id}`}
            className="w-6 h-6 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
            aria-label="More actions">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-10 bg-white border border-stone-200 rounded-xl shadow-strong min-w-[120px] overflow-hidden">
              {/* Show all actions in dropdown for completeness */}
              {allActions.map(action => (
                <button
                  key={action}
                  onClick={e => handleAction(action, e)}
                  className="w-full text-left px-3 py-2 text-xs text-stone-700 hover:bg-stone-50 transition-colors">
                  {ACTION_LABELS[action]}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Feed row ─────────────────────────────────────────────────────────────────

export interface TodayFeedRowProps {
  item: TodayFeedItem;
  onAction(action: TodayActionKind, item: TodayFeedItem): void;
  /** When true, renders a keyboard-navigation focus ring on the row. */
  isFocused?: boolean;
}

export const TodayFeedRow = forwardRef<HTMLLIElement, TodayFeedRowProps>(
  ({ item, onAction, isFocused = false }, ref) => {
    const badgeClasses = SOURCE_BADGE_CLASSES[item.source] ?? 'bg-stone-100 text-stone-500';
    const sourceLabel = SOURCE_LABELS[item.source] ?? item.source;
    const relTime = formatRelativeTime(item.timestamp_ms);

    return (
      <li
        ref={ref}
        className={`px-4 py-3 hover:bg-stone-50 transition-colors group${isFocused ? ' ring-2 ring-primary-400 ring-offset-1' : ''}`}>
        <div className="flex items-start gap-3">
          {/* Source badge */}
          <span
            className={`mt-0.5 shrink-0 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClasses}`}
            data-source={item.source}>
            {sourceLabel}
          </span>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {item.is_unread && (
                <span
                  className="inline-block w-2 h-2 rounded-full bg-primary-500 shrink-0"
                  aria-label="unread"
                />
              )}
              <p className="text-sm font-semibold text-stone-900 truncate">{item.title}</p>
            </div>
            {item.sender && <p className="text-xs text-stone-500 truncate">From: {item.sender}</p>}
            <p className="mt-0.5 text-sm text-stone-600 line-clamp-2">{item.preview}</p>
          </div>

          {/* Timestamp */}
          <span className="shrink-0 text-[11px] text-stone-400 whitespace-nowrap">{relTime}</span>

          {/* Hover action area */}
          <ActionMenu item={item} onAction={onAction} />
        </div>
      </li>
    );
  }
);

export default TodayFeedRow;
