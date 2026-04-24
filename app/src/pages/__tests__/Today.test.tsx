import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Today, { type TodayFeedItem, type TodayFeedListResponse } from '../Today';

// ─── Mock coreRpcClient ───────────────────────────────────────────────────────

const { callCoreRpc } = vi.hoisted(() => ({ callCoreRpc: vi.fn() }));

vi.mock('../../services/coreRpcClient', () => ({ callCoreRpc }));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<TodayFeedItem> = {}): TodayFeedItem {
  return {
    id: 'item-1',
    source: 'gmail',
    title: 'Test Email',
    preview: 'Hello, this is a preview of the email.',
    timestamp_ms: Date.now() - 5 * 60 * 1000, // 5 minutes ago
    sender: 'alice@example.com',
    avatar_url: null,
    is_unread: false,
    source_id: 'gmail-msg-1',
    action_hint: 'reply',
    metadata: {},
    ...overrides,
  };
}

function makeResponse(items: TodayFeedItem[]): TodayFeedListResponse {
  return {
    items,
    source_counts: { gmail: items.filter(i => i.source === 'gmail').length },
    window_hours: 24,
    generated_at_ms: Date.now(),
  };
}

function renderToday() {
  return render(
    <MemoryRouter>
      <Today />
    </MemoryRouter>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Today page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows skeleton rows while loading', () => {
    // Never resolves during the test
    callCoreRpc.mockReturnValue(new Promise(() => {}));

    renderToday();

    expect(screen.getByTestId('today-skeleton')).toBeInTheDocument();
    // Should have 3 skeleton rows (list items inside the skeleton container)
    const skeleton = screen.getByTestId('today-skeleton');
    expect(skeleton.querySelectorAll('li').length).toBe(3);
  });

  it('shows the empty state copy when no items are returned', async () => {
    callCoreRpc.mockResolvedValueOnce(makeResponse([]));

    renderToday();

    await waitFor(() => {
      expect(
        screen.getByText('Your day is clear — nothing new from iMessage, Gmail, or Calendar.')
      ).toBeInTheDocument();
    });

    expect(screen.queryByTestId('today-feed')).not.toBeInTheDocument();
  });

  it('renders feed rows with correct source badges when items are returned', async () => {
    const items: TodayFeedItem[] = [
      makeItem({ id: '1', source: 'gmail', title: 'Email from Alice', is_unread: true }),
      makeItem({ id: '2', source: 'imessage', title: 'iMessage from Bob' }),
      makeItem({ id: '3', source: 'calendar', title: 'Team standup' }),
    ];

    callCoreRpc.mockResolvedValueOnce(makeResponse(items));

    renderToday();

    await waitFor(() => {
      expect(screen.getByTestId('today-feed')).toBeInTheDocument();
    });

    expect(screen.getByText('Email from Alice')).toBeInTheDocument();
    expect(screen.getByText('iMessage from Bob')).toBeInTheDocument();
    expect(screen.getByText('Team standup')).toBeInTheDocument();

    // Source badges — use getAllByText since "Calendar" appears in both tab and badge
    expect(screen.getAllByText('Gmail').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('iMessage').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Calendar').length).toBeGreaterThanOrEqual(1);

    // Verify at least one badge with data-source attribute
    expect(document.querySelector('[data-source="gmail"]')).toBeInTheDocument();
    expect(document.querySelector('[data-source="imessage"]')).toBeInTheDocument();
    expect(document.querySelector('[data-source="calendar"]')).toBeInTheDocument();

    // Unread dot for item 1
    const unreadDots = screen.getAllByLabelText('unread');
    expect(unreadDots.length).toBe(1);
  });

  it('passes source_filter param when a filter tab is clicked', async () => {
    callCoreRpc
      .mockResolvedValueOnce(makeResponse([makeItem({ id: '1', source: 'gmail' })]))
      .mockResolvedValueOnce(makeResponse([makeItem({ id: '2', source: 'imessage' })]));

    renderToday();

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('today-feed')).toBeInTheDocument();
    });

    // First call should have no source_filter (All tab)
    expect(callCoreRpc).toHaveBeenNthCalledWith(1, {
      method: 'openhuman.today_feed_list',
      params: {},
    });

    // Click the Messages tab
    fireEvent.click(screen.getByRole('tab', { name: 'Messages' }));

    await waitFor(() => {
      expect(callCoreRpc).toHaveBeenCalledWith({
        method: 'openhuman.today_feed_list',
        params: { source_filter: 'imessage' },
      });
    });
  });

  it('shows error banner with retry button on failure, and retries on click', async () => {
    callCoreRpc
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(makeResponse([makeItem({ id: '1', title: 'Recovered item' })]));

    renderToday();

    await waitFor(() => {
      expect(screen.getByTestId('today-error')).toBeInTheDocument();
    });

    expect(screen.getByTestId('today-error')).toHaveTextContent('Network error');
    const retryBtn = screen.getByTestId('today-retry');
    expect(retryBtn).toBeInTheDocument();

    // Click retry
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Recovered item')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('today-error')).not.toBeInTheDocument();
    expect(callCoreRpc).toHaveBeenCalledTimes(2);
  });
});
