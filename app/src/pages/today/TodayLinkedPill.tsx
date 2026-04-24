/**
 * TodayLinkedPill — subtle pill shown on feed rows that belong to a semantic
 * cluster. Reveals the cluster reason on hover via a tooltip.
 *
 * Stateless component — hover state is local-only; no Redux or context needed.
 */
import { useState } from 'react';

import type { TodayFeedCluster } from './useTodayLinks';

interface Props {
  cluster: TodayFeedCluster;
}

export function TodayLinkedPill({ cluster }: Props) {
  const [showTooltip, setShowTooltip] = useState(false);
  // "Linked" count excludes the current item itself.
  const relatedCount = cluster.item_ids.length - 1;

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}>
      {/* Pill badge */}
      <span
        className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary-50 text-primary-600 border border-primary-200 cursor-default animate-fade-in"
        aria-label={`Linked: ${cluster.reason}`}
        data-testid="today-linked-pill">
        Linked
      </span>

      {/* Hover tooltip */}
      {showTooltip && (
        <span
          role="tooltip"
          className="absolute bottom-full right-0 mb-1 w-max max-w-xs px-2 py-1.5 rounded-md bg-stone-900 text-white text-[11px] leading-snug shadow-md z-10 pointer-events-none"
          data-testid="today-linked-tooltip">
          <span className="block">{cluster.reason}</span>
          {relatedCount > 0 && (
            <span className="block text-stone-300 mt-0.5">
              {relatedCount} related item{relatedCount === 1 ? '' : 's'}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

export default TodayLinkedPill;
