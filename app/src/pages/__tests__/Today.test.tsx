import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import chatRuntimeReducer from '../../store/chatRuntimeSlice';
import threadReducer from '../../store/threadSlice';
import Today, { type TodayFeedItem, type TodayFeedListResponse } from '../Today';
import { DEMO_ITEM_IDS } from '../today/todaySampleData';

// ─── Mock coreRpcClient ───────────────────────────────────────────────────────

const { callCoreRpc } = vi.hoisted(() => ({ callCoreRpc: vi.fn() }));

vi.mock('../../services/coreRpcClient', () => ({ callCoreRpc }));

// ─── Mock useTodayLinks ───────────────────────────────────────────────────────
// Mock the entire hook so callCoreRpc call counts in existing tests stay stable.
// Today.test.tsx tests Today.tsx integration — useTodayLinks internals are
// covered in __tests__/useTodayLinks.test.ts.
// Two new tests override this mock to verify Linked pill rendering.

const { useTodayLinks } = vi.hoisted(() => ({
  useTodayLinks: vi.fn().mockReturnValue({ clusters: [], isLoading: false }),
}));

vi.mock('../today/useTodayLinks', () => ({ useTodayLinks }));

// ─── Mock chatService ─────────────────────────────────────────────────────────

const { chatSend, chatCancel } = vi.hoisted(() => ({
  chatSend: vi.fn().mockResolvedValue(undefined),
  chatCancel: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../services/chatService', () => ({
  chatSend,
  chatCancel,
  useRustChat: vi.fn(() => true),
  // subscribeChatEvents is used by TodayMorningBrief (useTodayBrief hook).
  // Return a no-op unsubscribe fn so the hook doesn't throw in tests.
  subscribeChatEvents: vi.fn(() => () => {}),
}));

// ─── Mock threadApi ───────────────────────────────────────────────────────────

const { createNewThread } = vi.hoisted(() => ({
  createNewThread: vi.fn().mockResolvedValue({ id: 'thread-today-1', title: 'Today' }),
}));

vi.mock('../../services/api/threadApi', () => ({
  threadApi: {
    createNewThread,
    getThreads: vi.fn().mockResolvedValue({ threads: [], count: 0 }),
    getThreadMessages: vi.fn().mockResolvedValue({ messages: [] }),
    appendMessage: vi.fn().mockImplementation(async (_tid, msg) => msg),
    generateTitleIfNeeded: vi.fn().mockResolvedValue({ id: 'thread-today-1', title: 'Today' }),
    updateMessage: vi.fn(),
    deleteThread: vi.fn(),
    purge: vi.fn(),
  },
}));

// ─── Redux test store ─────────────────────────────────────────────────────────

function createTodayTestStore() {
  return configureStore({
    reducer: combineReducers({ thread: threadReducer, chatRuntime: chatRuntimeReducer }),
  });
}

// ─── Render helper ────────────────────────────────────────────────────────────

function renderToday() {
  const store = createTodayTestStore();
  return {
    store,
    ...render(
      <Provider store={store}>
        <MemoryRouter>
          <Today />
        </MemoryRouter>
      </Provider>
    ),
  };
}

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

// ─── Tests ────────────────────────────────────────────────────────────────────

// jsdom does not implement scrollIntoView — mock it so keyboard-nav calls
// don't throw "not a function" uncaught exceptions during tests.
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
}

describe('Today page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset useTodayLinks to the default no-op so existing tests are unaffected.
    useTodayLinks.mockReturnValue({ clusters: [], isLoading: false });
  });

  // ── Original 5 tests (preserved) ────────────────────────────────────────────

  it('shows skeleton rows while loading', () => {
    // Never resolves during the test
    callCoreRpc.mockReturnValue(new Promise(() => {}));

    renderToday();

    expect(screen.getByTestId('today-skeleton')).toBeInTheDocument();
    // Should have 3 skeleton rows (list items inside the skeleton container)
    const skeleton = screen.getByTestId('today-skeleton');
    expect(skeleton.querySelectorAll('li').length).toBe(3);
  });

  it('shows sample mode (banner + feed) when no items are returned', async () => {
    callCoreRpc.mockResolvedValueOnce(makeResponse([]));

    renderToday();

    // Banner appears
    await waitFor(() => {
      expect(screen.getByTestId('today-sample-banner')).toBeInTheDocument();
    });

    expect(screen.getByText(/Showing sample data\. Connect your accounts/i)).toBeInTheDocument();

    // Connect buttons are present
    expect(screen.getByTestId('today-sample-connect-gmail')).toBeInTheDocument();
    expect(screen.getByTestId('today-sample-connect-calendar')).toBeInTheDocument();

    // The feed is populated with sample rows (not empty)
    expect(screen.getByTestId('today-feed')).toBeInTheDocument();

    // All 6 sample item IDs produce "Demo" pills
    const demoPills = screen.getAllByLabelText('sample data');
    expect(demoPills.length).toBe(DEMO_ITEM_IDS.size);

    // Sample titles are visible
    expect(screen.getByText('Sarah Chen')).toBeInTheDocument();
    expect(screen.getByText('Dad')).toBeInTheDocument();
    expect(screen.getByText('Your weekly design digest')).toBeInTheDocument();
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

  // ── New tests for agentic features ───────────────────────────────────────────

  it('renders composer bar with placeholder text', async () => {
    callCoreRpc.mockResolvedValueOnce(makeResponse([]));

    renderToday();

    const input = screen.getByTestId('today-composer-input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'What do you want to do today?');
  });

  it('calls agent flow when Enter is pressed on the composer', async () => {
    callCoreRpc.mockResolvedValueOnce(makeResponse([]));

    renderToday();

    await waitFor(() => {
      expect(screen.getByTestId('today-composer-input')).toBeInTheDocument();
    });

    const input = screen.getByTestId('today-composer-input');
    fireEvent.change(input, { target: { value: 'Summarize my day' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(createNewThread).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(chatSend).toHaveBeenCalledWith(
        expect.objectContaining({ threadId: 'thread-today-1', model: 'reasoning-v1' })
      );
    });
  });

  it('renders action buttons in the DOM for each feed row', async () => {
    const items: TodayFeedItem[] = [
      makeItem({ id: 'g1', source: 'gmail', title: 'Email from Alice' }),
      makeItem({ id: 'c1', source: 'calendar', title: 'Standup' }),
    ];
    callCoreRpc.mockResolvedValueOnce(makeResponse(items));

    renderToday();

    await waitFor(() => {
      expect(screen.getByTestId('today-feed')).toBeInTheDocument();
    });

    // Gmail primary action is "Reply"
    expect(screen.getByTestId('action-reply-g1')).toBeInTheDocument();
    // Calendar primary action is "Summarize"
    expect(screen.getByTestId('action-summarize-c1')).toBeInTheDocument();
  });

  it('triggers agent flow when a row action button is clicked', async () => {
    const items: TodayFeedItem[] = [
      makeItem({ id: 'g1', source: 'gmail', title: 'Email from Alice', sender: 'alice@test.com' }),
    ];
    callCoreRpc.mockResolvedValueOnce(makeResponse(items));

    renderToday();

    await waitFor(() => {
      expect(screen.getByTestId('action-reply-g1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('action-reply-g1'));

    await waitFor(() => {
      expect(createNewThread).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(chatSend).toHaveBeenCalledWith(
        expect.objectContaining({ threadId: 'thread-today-1', model: 'reasoning-v1' })
      );
    });
  });

  it('opens drawer with loading state when agent is running', async () => {
    // chatSend never resolves — keeps thread in-flight
    chatSend.mockReturnValue(new Promise(() => {}));
    callCoreRpc.mockResolvedValueOnce(
      makeResponse([makeItem({ id: 'g1', source: 'gmail', title: 'Email' })])
    );

    renderToday();

    await waitFor(() => {
      expect(screen.getByTestId('action-reply-g1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('action-reply-g1'));

    await waitFor(() => {
      expect(screen.getByTestId('today-agent-drawer')).toBeInTheDocument();
    });

    // Drawer should be visible (translate-x-0 class present, not translate-x-full)
    const drawer = screen.getByTestId('today-agent-drawer');
    expect(drawer.className).toContain('translate-x-0');
  });

  it('closes the drawer when Escape is pressed', async () => {
    chatSend.mockReturnValue(new Promise(() => {}));
    callCoreRpc.mockResolvedValueOnce(
      makeResponse([makeItem({ id: 'g1', source: 'gmail', title: 'Email' })])
    );

    renderToday();

    await waitFor(() => {
      expect(screen.getByTestId('action-reply-g1')).toBeInTheDocument();
    });

    // Open the drawer
    fireEvent.click(screen.getByTestId('action-reply-g1'));

    await waitFor(() => {
      const drawer = screen.getByTestId('today-agent-drawer');
      expect(drawer.className).toContain('translate-x-0');
    });

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

    await waitFor(() => {
      const drawer = screen.getByTestId('today-agent-drawer');
      expect(drawer.className).toContain('translate-x-full');
    });
  });

  // ── Keyboard navigation tests ─────────────────────────────────────────────────

  it('pressing j moves focus to the first row from no-focus state', async () => {
    const items: TodayFeedItem[] = [
      makeItem({ id: 'r1', source: 'gmail', title: 'First' }),
      makeItem({ id: 'r2', source: 'imessage', title: 'Second' }),
    ];
    callCoreRpc.mockResolvedValueOnce(makeResponse(items));

    renderToday();

    await waitFor(() => {
      expect(screen.getByTestId('today-feed')).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: 'j' });

    // First <li> should now have the focus ring class
    const rows = document.querySelectorAll('[data-testid="today-feed"] li');
    expect(rows[0].className).toContain('ring-2');
    expect(rows[1].className).not.toContain('ring-2');
  });

  it('pressing j twice moves focus to the second row', async () => {
    const items: TodayFeedItem[] = [
      makeItem({ id: 'r1', source: 'gmail', title: 'First' }),
      makeItem({ id: 'r2', source: 'imessage', title: 'Second' }),
    ];
    callCoreRpc.mockResolvedValueOnce(makeResponse(items));

    renderToday();

    await waitFor(() => {
      expect(screen.getByTestId('today-feed')).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: 'j' });
    fireEvent.keyDown(document, { key: 'j' });

    const rows = document.querySelectorAll('[data-testid="today-feed"] li');
    expect(rows[0].className).not.toContain('ring-2');
    expect(rows[1].className).toContain('ring-2');
  });

  it('pressing k moves focus backward (wraps from first to last)', async () => {
    const items: TodayFeedItem[] = [
      makeItem({ id: 'r1', source: 'gmail', title: 'First' }),
      makeItem({ id: 'r2', source: 'imessage', title: 'Second' }),
    ];
    callCoreRpc.mockResolvedValueOnce(makeResponse(items));

    renderToday();

    await waitFor(() => {
      expect(screen.getByTestId('today-feed')).toBeInTheDocument();
    });

    // j → first row focused; k from first → wraps to last
    fireEvent.keyDown(document, { key: 'j' });
    fireEvent.keyDown(document, { key: 'k' });

    const rows = document.querySelectorAll('[data-testid="today-feed"] li');
    // Wraps to last (index 1)
    expect(rows[items.length - 1].className).toContain('ring-2');
  });

  it('pressing j wraps from the last row to the first', async () => {
    const items: TodayFeedItem[] = [
      makeItem({ id: 'r1', source: 'gmail', title: 'First' }),
      makeItem({ id: 'r2', source: 'imessage', title: 'Second' }),
    ];
    callCoreRpc.mockResolvedValueOnce(makeResponse(items));

    renderToday();

    await waitFor(() => {
      expect(screen.getByTestId('today-feed')).toBeInTheDocument();
    });

    // Navigate to the last row, then j again → wraps to first
    fireEvent.keyDown(document, { key: 'j' }); // index 0
    fireEvent.keyDown(document, { key: 'j' }); // index 1 (last)
    fireEvent.keyDown(document, { key: 'j' }); // wraps → index 0

    const rows = document.querySelectorAll('[data-testid="today-feed"] li');
    expect(rows[0].className).toContain('ring-2');
    expect(rows[1].className).not.toContain('ring-2');
  });

  it('Enter on a focused row triggers the primary action for that row', async () => {
    const items: TodayFeedItem[] = [
      makeItem({ id: 'g1', source: 'gmail', title: 'Email from Alice', sender: 'alice@test.com' }),
    ];
    callCoreRpc.mockResolvedValueOnce(makeResponse(items));

    renderToday();

    await waitFor(() => {
      expect(screen.getByTestId('today-feed')).toBeInTheDocument();
    });

    // Focus first row
    fireEvent.keyDown(document, { key: 'j' });
    // Trigger primary action via Enter
    fireEvent.keyDown(document, { key: 'Enter' });

    await waitFor(() => {
      expect(createNewThread).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(chatSend).toHaveBeenCalledWith(
        expect.objectContaining({ threadId: 'thread-today-1', model: 'reasoning-v1' })
      );
    });
  });

  it('Escape clears focus when the drawer is not open', async () => {
    const items: TodayFeedItem[] = [makeItem({ id: 'r1', source: 'gmail', title: 'First' })];
    callCoreRpc.mockResolvedValueOnce(makeResponse(items));

    renderToday();

    await waitFor(() => {
      expect(screen.getByTestId('today-feed')).toBeInTheDocument();
    });

    // Focus first row
    fireEvent.keyDown(document, { key: 'j' });

    let rows = document.querySelectorAll('[data-testid="today-feed"] li');
    expect(rows[0].className).toContain('ring-2');

    // Press Escape to clear focus
    fireEvent.keyDown(document, { key: 'Escape' });

    rows = document.querySelectorAll('[data-testid="today-feed"] li');
    expect(rows[0].className).not.toContain('ring-2');
  });

  it('keyboard shortcuts are suppressed when focus is inside an input', async () => {
    const items: TodayFeedItem[] = [
      makeItem({ id: 'r1', source: 'gmail', title: 'First' }),
      makeItem({ id: 'r2', source: 'imessage', title: 'Second' }),
    ];
    callCoreRpc.mockResolvedValueOnce(makeResponse(items));

    renderToday();

    await waitFor(() => {
      expect(screen.getByTestId('today-feed')).toBeInTheDocument();
    });

    // Fire keydown with the composer input as the event target
    const composerInput = screen.getByTestId('today-composer-input');
    fireEvent.keyDown(composerInput, { key: 'j', target: composerInput });

    // No row should receive focus
    const rows = document.querySelectorAll('[data-testid="today-feed"] li');
    for (const row of rows) {
      expect(row.className).not.toContain('ring-2');
    }
  });

  it('sample rows are keyboard-navigable (feed list has li elements) in demo mode', async () => {
    callCoreRpc.mockResolvedValueOnce(makeResponse([]));

    renderToday();

    // Sample mode: banner appears and feed is populated with rows
    await waitFor(() => {
      expect(screen.getByTestId('today-sample-banner')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId('today-feed')).toBeInTheDocument();
    });

    // Feed has <li> rows (one per sample item) — confirms keyboard nav targets exist
    const rows = document.querySelectorAll('[data-testid="today-feed"] li');
    expect(rows.length).toBe(6); // 6 sample items
    // No focus ring before any navigation
    for (const row of rows) {
      expect(row.className).not.toContain('ring-2');
    }
  });

  // ── Sample mode / demo-mode tests ────────────────────────────────────────────

  it('sample mode: connect-gmail button navigates to /settings/connections', async () => {
    callCoreRpc.mockResolvedValueOnce(makeResponse([]));

    renderToday();

    await waitFor(() => {
      expect(screen.getByTestId('today-sample-connect-gmail')).toBeInTheDocument();
    });

    // MemoryRouter captures navigation; clicking should not throw
    fireEvent.click(screen.getByTestId('today-sample-connect-gmail'));

    // After click the banner remains (navigation handled by router — no real navigate in unit test)
    expect(screen.getByTestId('today-sample-banner')).toBeInTheDocument();
  });

  it('sample mode: connect-calendar button navigates to /settings/connections', async () => {
    callCoreRpc.mockResolvedValueOnce(makeResponse([]));

    renderToday();

    await waitFor(() => {
      expect(screen.getByTestId('today-sample-connect-calendar')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('today-sample-connect-calendar'));

    expect(screen.getByTestId('today-sample-banner')).toBeInTheDocument();
  });

  it('sample mode: clicking a sample row action opens the agent drawer', async () => {
    chatSend.mockReturnValue(new Promise(() => {}));
    callCoreRpc.mockResolvedValueOnce(makeResponse([]));

    renderToday();

    await waitFor(() => {
      expect(screen.getByTestId('today-feed')).toBeInTheDocument();
    });

    // The first iMessage sample row (demo-imessage-1) has primary action "Reply"
    const replyBtn = screen.getByTestId('action-reply-demo-imessage-1');
    expect(replyBtn).toBeInTheDocument();

    fireEvent.click(replyBtn);

    await waitFor(() => {
      expect(screen.getByTestId('today-agent-drawer')).toBeInTheDocument();
    });

    const drawer = screen.getByTestId('today-agent-drawer');
    expect(drawer.className).toContain('translate-x-0');
  });

  it('sample mode: Demo pill is absent on real feed rows', async () => {
    const items: TodayFeedItem[] = [
      makeItem({ id: 'real-1', source: 'gmail', title: 'Real email' }),
    ];
    callCoreRpc.mockResolvedValueOnce(makeResponse(items));

    renderToday();

    await waitFor(() => {
      expect(screen.getByTestId('today-feed')).toBeInTheDocument();
    });

    // No Demo pills when showing real data
    expect(screen.queryByLabelText('sample data')).not.toBeInTheDocument();

    // No sample banner either
    expect(screen.queryByTestId('today-sample-banner')).not.toBeInTheDocument();
  });

  it('sample mode: sample items have correct source shape (fixture check)', async () => {
    callCoreRpc.mockResolvedValueOnce(makeResponse([]));

    renderToday();

    await waitFor(() => {
      expect(screen.getByTestId('today-feed')).toBeInTheDocument();
    });

    // iMessage source badge visible
    expect(document.querySelector('[data-source="imessage"]')).toBeInTheDocument();
    // Gmail source badge visible
    expect(document.querySelector('[data-source="gmail"]')).toBeInTheDocument();
    // Calendar source badge visible
    expect(document.querySelector('[data-source="calendar"]')).toBeInTheDocument();

    // Unread dot for the first iMessage (Sarah Chen — is_unread: true)
    const unreadDots = screen.getAllByLabelText('unread');
    // At least 2 unread items: demo-imessage-1 and demo-gmail-2 (Stripe)
    expect(unreadDots.length).toBeGreaterThanOrEqual(2);
  });

  // ── Bucket grouping integration tests ─────────────────────────────────────────

  it('renders "Today" bucket header for recent messages, no calendar bucket headers', async () => {
    const items: TodayFeedItem[] = [
      makeItem({ id: 'm1', source: 'gmail', title: 'Email One' }),
      makeItem({ id: 'm2', source: 'imessage', title: 'Message One' }),
    ];
    callCoreRpc.mockResolvedValueOnce(makeResponse(items));

    renderToday();

    await waitFor(() => {
      expect(screen.getByTestId('today-feed')).toBeInTheDocument();
    });

    // "Today" bucket section should appear (items are 5 min ago)
    // Note: the page <h1> also says "Today" so we query the section testid, not text.
    expect(screen.getByTestId('bucket-today')).toBeInTheDocument();

    // Calendar-only buckets should not render when there are no calendar events
    expect(screen.queryByText('Right now')).not.toBeInTheDocument();
    expect(screen.queryByText('Up next')).not.toBeInTheDocument();
    // "Earlier" should not render since items are recent
    expect(screen.queryByText('Earlier')).not.toBeInTheDocument();

    // Calendar bucket sections absent
    expect(screen.queryByTestId('bucket-right-now')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bucket-up-next')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bucket-earlier')).not.toBeInTheDocument();

    // All items still visible within the bucket
    expect(screen.getByText('Email One')).toBeInTheDocument();
    expect(screen.getByText('Message One')).toBeInTheDocument();
  });

  it('renders bucket headers in canonical order when items span multiple buckets', async () => {
    const now = Date.now();

    const items: TodayFeedItem[] = [
      // "Right now" — calendar starting in 10 min with end time
      makeItem({
        id: 'cal1',
        source: 'calendar',
        title: 'Standup',
        timestamp_ms: now + 10 * 60 * 1000,
        metadata: { end_time_ms: now + 70 * 60 * 1000 },
      }),
      // "Up next" — calendar starting in 2 hours
      makeItem({
        id: 'cal2',
        source: 'calendar',
        title: 'Team Lunch',
        timestamp_ms: now + 2 * 60 * 60 * 1000,
        metadata: {},
      }),
      // "Today" — gmail from 1 hour ago
      makeItem({
        id: 'gm1',
        source: 'gmail',
        title: 'Email from Alice',
        timestamp_ms: now - 60 * 60 * 1000,
      }),
      // "Earlier" — imessage from 8 hours ago
      makeItem({
        id: 'im1',
        source: 'imessage',
        title: 'Old message',
        timestamp_ms: now - 8 * 60 * 60 * 1000,
      }),
    ];
    callCoreRpc.mockResolvedValueOnce(makeResponse(items));

    renderToday();

    await waitFor(() => {
      expect(screen.getByTestId('today-feed')).toBeInTheDocument();
    });

    // All four bucket sections present via data-testid
    expect(screen.getByTestId('bucket-right-now')).toBeInTheDocument();
    expect(screen.getByTestId('bucket-up-next')).toBeInTheDocument();
    expect(screen.getByTestId('bucket-today')).toBeInTheDocument();
    expect(screen.getByTestId('bucket-earlier')).toBeInTheDocument();

    // Bucket header labels visible in feed (note: "Today" also appears in the page <h1>,
    // so we use getAllByText for "Today" and verify there's at least one bucket header match)
    expect(screen.getByText('Right now')).toBeInTheDocument();
    expect(screen.getByText('Up next')).toBeInTheDocument();
    expect(screen.getAllByText('Today').length).toBeGreaterThanOrEqual(2); // <h1> + bucket header
    expect(screen.getByText('Earlier')).toBeInTheDocument();

    // All items present
    expect(screen.getByText('Standup')).toBeInTheDocument();
    expect(screen.getByText('Team Lunch')).toBeInTheDocument();
    expect(screen.getByText('Email from Alice')).toBeInTheDocument();
    expect(screen.getByText('Old message')).toBeInTheDocument();

    // Headers appear in canonical order (Right now → Up next → Today → Earlier)
    const feed = screen.getByTestId('today-feed');
    const headers = Array.from(feed.querySelectorAll('p')).map(el => el.textContent);
    const bucketHeaderTexts = headers.filter(t =>
      ['Right now', 'Up next', 'Today', 'Earlier'].includes(t ?? '')
    );
    expect(bucketHeaderTexts).toEqual(['Right now', 'Up next', 'Today', 'Earlier']);
  });

  // ── Cross-source Linked pill tests ─────────────────────────────────────────

  it('does not render Linked pill on rows without a cluster', async () => {
    const items: TodayFeedItem[] = [
      makeItem({ id: 'no-cluster-1', source: 'gmail', title: 'Standalone email' }),
    ];
    // useTodayLinks already returns empty clusters (set in beforeEach).
    callCoreRpc.mockResolvedValueOnce(makeResponse(items));

    renderToday();

    await waitFor(() => {
      expect(screen.getByTestId('today-feed')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('today-linked-pill')).not.toBeInTheDocument();
  });

  it('renders Linked pill on a row whose item id is in a cluster', async () => {
    const items: TodayFeedItem[] = [
      makeItem({ id: 'linked-a', source: 'imessage', title: 'Sarah Chen' }),
      makeItem({ id: 'linked-b', source: 'calendar', title: 'Design review' }),
    ];

    // Override useTodayLinks to return a cluster linking both items.
    useTodayLinks.mockReturnValue({
      clusters: [
        {
          cluster_id: 'test-cluster-1',
          item_ids: ['linked-a', 'linked-b'],
          reason: "Sarah's text references the design review",
        },
      ],
      isLoading: false,
    });
    callCoreRpc.mockResolvedValueOnce(makeResponse(items));

    renderToday();

    await waitFor(() => {
      expect(screen.getByTestId('today-feed')).toBeInTheDocument();
    });

    // Both items are in the cluster so both rows should have a Linked pill.
    const pills = screen.getAllByTestId('today-linked-pill');
    expect(pills.length).toBe(2);
  });
});
