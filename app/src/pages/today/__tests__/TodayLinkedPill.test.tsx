/**
 * Unit tests for TodayLinkedPill component.
 *
 * Verifies:
 * - Renders "Linked" text
 * - aria-label reflects cluster reason
 * - Tooltip hidden by default
 * - Tooltip appears on mouseenter, hides on mouseleave
 * - Tooltip content: reason + related count
 * - Singular "1 related item" for cluster with 2 items
 * - Plural "2 related items" for cluster with 3 items
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TodayLinkedPill } from '../TodayLinkedPill';
import type { TodayFeedCluster } from '../useTodayLinks';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCluster(overrides: Partial<TodayFeedCluster> = {}): TodayFeedCluster {
  return {
    cluster_id: 'test-cluster',
    item_ids: ['item-1', 'item-2'],
    reason: 'Both items mention the Q3 review meeting',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TodayLinkedPill', () => {
  it('renders "Linked" text', () => {
    render(<TodayLinkedPill cluster={makeCluster()} />);
    expect(screen.getByTestId('today-linked-pill')).toHaveTextContent('Linked');
  });

  it('aria-label contains the cluster reason', () => {
    const cluster = makeCluster({ reason: 'Sarah references the 3pm design review' });
    render(<TodayLinkedPill cluster={cluster} />);
    const pill = screen.getByTestId('today-linked-pill');
    expect(pill).toHaveAttribute('aria-label', `Linked: ${cluster.reason}`);
  });

  it('tooltip is not visible by default', () => {
    render(<TodayLinkedPill cluster={makeCluster()} />);
    expect(screen.queryByTestId('today-linked-tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip on mouse enter', () => {
    render(<TodayLinkedPill cluster={makeCluster()} />);
    const pill = screen.getByTestId('today-linked-pill');
    fireEvent.mouseEnter(pill.parentElement!);
    expect(screen.getByTestId('today-linked-tooltip')).toBeInTheDocument();
  });

  it('hides tooltip on mouse leave', () => {
    render(<TodayLinkedPill cluster={makeCluster()} />);
    const wrapper = screen.getByTestId('today-linked-pill').parentElement!;
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByTestId('today-linked-tooltip')).toBeInTheDocument();
    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByTestId('today-linked-tooltip')).not.toBeInTheDocument();
  });

  it('tooltip contains the cluster reason', () => {
    const cluster = makeCluster({ reason: 'Sarah references the 3pm design review' });
    render(<TodayLinkedPill cluster={cluster} />);
    fireEvent.mouseEnter(screen.getByTestId('today-linked-pill').parentElement!);
    expect(screen.getByTestId('today-linked-tooltip')).toHaveTextContent(cluster.reason);
  });

  it('shows "1 related item" (singular) for cluster with 2 items', () => {
    // 2 items → relatedCount = 2 - 1 = 1
    const cluster = makeCluster({ item_ids: ['item-1', 'item-2'] });
    render(<TodayLinkedPill cluster={cluster} />);
    fireEvent.mouseEnter(screen.getByTestId('today-linked-pill').parentElement!);
    expect(screen.getByTestId('today-linked-tooltip')).toHaveTextContent('1 related item');
    expect(screen.getByTestId('today-linked-tooltip')).not.toHaveTextContent('1 related items');
  });

  it('shows "2 related items" (plural) for cluster with 3 items', () => {
    // 3 items → relatedCount = 3 - 1 = 2
    const cluster = makeCluster({ item_ids: ['item-1', 'item-2', 'item-3'] });
    render(<TodayLinkedPill cluster={cluster} />);
    fireEvent.mouseEnter(screen.getByTestId('today-linked-pill').parentElement!);
    expect(screen.getByTestId('today-linked-tooltip')).toHaveTextContent('2 related items');
  });
});
