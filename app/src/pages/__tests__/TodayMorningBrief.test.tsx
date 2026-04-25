/**
 * Tests for TodayMorningBrief and useTodayBrief
 *
 * Acceptance criteria:
 * 1. Brief does NOT fire while feed is loading
 * 2. Brief fires after feed loads
 * 3. Brief re-fires when item IDs change
 * 4. Error state is silent (no visible error banner)
 * 5. Ephemeral brief thread does NOT block composer (no setActiveThread call)
 */
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import chatRuntimeReducer from '../../store/chatRuntimeSlice';
import threadReducer, { setActiveThread } from '../../store/threadSlice';
import type { TodayFeedItem } from '../today/todayAgentUtils';
import { TodayMorningBrief } from '../today/TodayMorningBrief';
import { buildBriefPrompt, computeItemHash } from '../today/useTodayBrief';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Capture socket listeners so tests can emit synthetic events
type SocketEventName = 'text_delta' | 'chat_done' | 'chat_error';
const socketHandlers = new Map<SocketEventName, (payload: unknown) => void>();

const mockSocket = {
  id: 'test-socket-id',
  on: vi.fn((event: string, cb: (payload: unknown) => void) => {
    socketHandlers.set(event as SocketEventName, cb);
  }),
  off: vi.fn(),
};

vi.mock('../../services/socketService', () => ({
  socketService: { getSocket: vi.fn(() => mockSocket) },
}));

const { chatSend, chatCancel } = vi.hoisted(() => ({
  chatSend: vi.fn().mockResolvedValue(undefined),
  chatCancel: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../services/chatService', () => ({
  chatSend,
  chatCancel,
  useRustChat: vi.fn(() => true),
  subscribeChatEvents: vi.fn((listeners: Record<string, (payload: unknown) => void>) => {
    if (listeners.onTextDelta) mockSocket.on('text_delta', listeners.onTextDelta);
    if (listeners.onDone) mockSocket.on('chat_done', listeners.onDone);
    if (listeners.onError) mockSocket.on('chat_error', listeners.onError);
    return () => {
      if (listeners.onTextDelta) mockSocket.off('text_delta', listeners.onTextDelta);
      if (listeners.onDone) mockSocket.off('chat_done', listeners.onDone);
      if (listeners.onError) mockSocket.off('chat_error', listeners.onError);
    };
  }),
}));

const { createNewThread } = vi.hoisted(() => ({
  createNewThread: vi
    .fn()
    .mockResolvedValue({ id: 'brief-thread-1', title: 'Brief', created_at: '' }),
}));

vi.mock('../../services/api/threadApi', () => ({
  threadApi: {
    createNewThread,
    getThreads: vi.fn().mockResolvedValue({ threads: [], count: 0 }),
    getThreadMessages: vi.fn().mockResolvedValue({ messages: [] }),
    appendMessage: vi.fn().mockImplementation(async (_tid: unknown, msg: unknown) => msg),
    generateTitleIfNeeded: vi.fn().mockResolvedValue({ id: 'brief-thread-1', title: 'Brief' }),
    updateMessage: vi.fn(),
    deleteThread: vi.fn(),
    purge: vi.fn(),
  },
}));

// ─── Store factory ────────────────────────────────────────────────────────────

function createTestStore(activeThreadId?: string | null) {
  const store = configureStore({
    reducer: combineReducers({ thread: threadReducer, chatRuntime: chatRuntimeReducer }),
  });

  if (activeThreadId) {
    // Dispatch to set the active thread so the hook sees it on initial read
    store.dispatch(setActiveThread(activeThreadId));
  }

  return store;
}

// ─── Render helpers ───────────────────────────────────────────────────────────

interface RenderBriefOptions {
  items?: TodayFeedItem[];
  isFeedLoading?: boolean;
  activeThreadId?: string | null;
}

function renderBrief(opts: RenderBriefOptions = {}) {
  const { items = [], isFeedLoading = false, activeThreadId = null } = opts;
  const store = createTestStore(activeThreadId);

  function buildJsx(i: TodayFeedItem[], loading: boolean) {
    return (
      <Provider store={store}>
        <MemoryRouter>
          <TodayMorningBrief items={i} isFeedLoading={loading} />
        </MemoryRouter>
      </Provider>
    );
  }

  const utils = render(buildJsx(items, isFeedLoading));

  function rerenderBrief(nextItems: TodayFeedItem[], nextLoading = false) {
    utils.rerender(buildJsx(nextItems, nextLoading));
  }

  return { store, rerenderBrief, ...utils };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<TodayFeedItem> = {}): TodayFeedItem {
  return {
    id: 'item-1',
    source: 'gmail',
    title: 'Test Email',
    preview: 'Hello, this is a preview.',
    timestamp_ms: Date.now() - 5 * 60 * 1000,
    sender: 'alice@example.com',
    avatar_url: null,
    is_unread: false,
    source_id: 'gmail-msg-1',
    action_hint: 'reply',
    metadata: {},
    ...overrides,
  };
}

function emitSocket(event: SocketEventName, payload: unknown) {
  act(() => {
    socketHandlers.get(event)?.(payload);
  });
}

// ─── Pure function tests ──────────────────────────────────────────────────────

describe('computeItemHash', () => {
  it('returns stable hash regardless of item order', () => {
    const a = makeItem({ id: 'z' });
    const b = makeItem({ id: 'a' });
    expect(computeItemHash([a, b])).toBe(computeItemHash([b, a]));
  });

  it('produces different hashes for different id sets', () => {
    expect(computeItemHash([makeItem({ id: 'x' })])).not.toBe(
      computeItemHash([makeItem({ id: 'y' })])
    );
  });

  it('returns empty string for empty items', () => {
    expect(computeItemHash([])).toBe('');
  });
});

describe('buildBriefPrompt', () => {
  it('caps at 15 items', () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      makeItem({ id: `item-${i}`, title: `Title ${i}` })
    );
    const prompt = buildBriefPrompt(items);
    expect(prompt).toContain('Title 14');
    expect(prompt).not.toContain('Title 15');
  });

  it('marks unread items with [UNREAD]', () => {
    const prompt = buildBriefPrompt([makeItem({ id: 'u1', is_unread: true })]);
    expect(prompt).toContain('[UNREAD]');
  });

  it('includes sender', () => {
    const prompt = buildBriefPrompt([makeItem({ id: 's1', sender: 'bob@test.com' })]);
    expect(prompt).toContain('bob@test.com');
  });

  it('truncates preview to 80 chars', () => {
    const prompt = buildBriefPrompt([makeItem({ id: 'p1', preview: 'x'.repeat(120) })]);
    expect(prompt).toContain('x'.repeat(80) + '…');
  });
});

// ─── Component integration tests ──────────────────────────────────────────────

describe('TodayMorningBrief', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketHandlers.clear();
    createNewThread.mockResolvedValue({ id: 'brief-thread-1', title: 'Brief', created_at: '' });
    chatSend.mockResolvedValue(undefined);
  });

  it('renders nothing while feed is loading (no items)', () => {
    renderBrief({ isFeedLoading: true });
    expect(screen.queryByTestId('today-morning-brief')).not.toBeInTheDocument();
  });

  it('renders nothing while feed is loading even with items', () => {
    renderBrief({ items: [makeItem({ id: 'x1' })], isFeedLoading: true });
    expect(screen.queryByTestId('today-morning-brief')).not.toBeInTheDocument();
  });

  it('shows pending state after feed loads with items', async () => {
    renderBrief({ items: [makeItem({ id: 'a1' })], isFeedLoading: false });

    await waitFor(() => {
      expect(screen.getByTestId('today-morning-brief')).toBeInTheDocument();
    });

    expect(screen.getByTestId('today-brief-pending')).toHaveTextContent('Thinking about your day…');
  });

  it('creates a new thread after feed loads', async () => {
    renderBrief({ items: [makeItem({ id: 'b1' })], isFeedLoading: false });
    await waitFor(() => expect(createNewThread).toHaveBeenCalledTimes(1));
  });

  it('calls chatSend with brief prompt', async () => {
    renderBrief({ items: [makeItem({ id: 'c1', title: 'My Email' })], isFeedLoading: false });

    await waitFor(() =>
      expect(chatSend).toHaveBeenCalledWith(
        expect.objectContaining({ threadId: 'brief-thread-1', model: 'reasoning-v1' })
      )
    );

    const { message } = chatSend.mock.calls[0][0] as { message: string };
    expect(message).toContain('My Email');
  });

  it('does NOT set activeThreadId — brief does not block composer', async () => {
    const { store } = renderBrief({ items: [makeItem({ id: 'd1' })], isFeedLoading: false });

    await waitFor(() => expect(createNewThread).toHaveBeenCalled());

    expect(store.getState().thread.activeThreadId).toBeNull();
  });

  it('transitions to streaming state on text_delta', async () => {
    renderBrief({ items: [makeItem({ id: 'e1' })], isFeedLoading: false });
    await waitFor(() => expect(chatSend).toHaveBeenCalled());

    emitSocket('text_delta', {
      thread_id: 'brief-thread-1',
      request_id: 'req-1',
      round: 1,
      delta: 'Good morning.',
    });

    await waitFor(() =>
      expect(screen.getByTestId('today-brief-text')).toHaveTextContent('Good morning.')
    );
  });

  it('accumulates multiple text deltas', async () => {
    renderBrief({ items: [makeItem({ id: 'f1' })], isFeedLoading: false });
    await waitFor(() => expect(chatSend).toHaveBeenCalled());

    emitSocket('text_delta', {
      thread_id: 'brief-thread-1',
      request_id: 'req-1',
      round: 1,
      delta: 'Hello ',
    });
    emitSocket('text_delta', {
      thread_id: 'brief-thread-1',
      request_id: 'req-1',
      round: 1,
      delta: 'world.',
    });

    await waitFor(() =>
      expect(screen.getByTestId('today-brief-text')).toHaveTextContent('Hello world.')
    );
  });

  it('shows refresh button and stone-700 text on chat_done', async () => {
    renderBrief({ items: [makeItem({ id: 'g1' })], isFeedLoading: false });
    await waitFor(() => expect(chatSend).toHaveBeenCalled());

    emitSocket('text_delta', {
      thread_id: 'brief-thread-1',
      request_id: 'req-1',
      round: 1,
      delta: 'Quiet morning.',
    });
    emitSocket('chat_done', {
      thread_id: 'brief-thread-1',
      request_id: 'req-1',
      full_response: 'Quiet morning.',
      rounds_used: 1,
      total_input_tokens: 10,
      total_output_tokens: 5,
    });

    await waitFor(() => expect(screen.getByTestId('today-brief-refresh')).toBeInTheDocument());

    const textEl = screen.getByTestId('today-brief-text');
    expect(textEl).toHaveTextContent('Quiet morning.');
    expect(textEl.className).toContain('text-stone-700');
  });

  it('hides silently on chat_error — no error UI', async () => {
    renderBrief({ items: [makeItem({ id: 'h1' })], isFeedLoading: false });
    await waitFor(() => expect(chatSend).toHaveBeenCalled());

    emitSocket('chat_error', {
      thread_id: 'brief-thread-1',
      request_id: 'req-1',
      message: 'Inference failed',
      error_type: 'inference',
      round: 1,
    });

    await waitFor(() =>
      expect(screen.queryByTestId('today-morning-brief')).not.toBeInTheDocument()
    );
  });

  it('hides silently when chatSend rejects', async () => {
    chatSend.mockRejectedValueOnce(new Error('Network failure'));
    renderBrief({ items: [makeItem({ id: 'i1' })], isFeedLoading: false });

    await waitFor(() => expect(chatSend).toHaveBeenCalled());

    await waitFor(() =>
      expect(screen.queryByTestId('today-morning-brief')).not.toBeInTheDocument()
    );
  });

  it('hides silently when createNewThread rejects', async () => {
    createNewThread.mockRejectedValueOnce(new Error('RPC down'));
    renderBrief({ items: [makeItem({ id: 'j1' })], isFeedLoading: false });

    await waitFor(() => expect(createNewThread).toHaveBeenCalled());

    await waitFor(() =>
      expect(screen.queryByTestId('today-morning-brief')).not.toBeInTheDocument()
    );
  });

  it('ignores text_delta for other thread IDs', async () => {
    renderBrief({ items: [makeItem({ id: 'k1' })], isFeedLoading: false });
    await waitFor(() => expect(chatSend).toHaveBeenCalled());

    emitSocket('text_delta', {
      thread_id: 'some-other-thread-id',
      request_id: 'req-x',
      round: 1,
      delta: 'Should not appear',
    });

    // Should still show pending, not streaming text
    await waitFor(() => expect(screen.getByTestId('today-brief-pending')).toBeInTheDocument());
    expect(screen.queryByTestId('today-brief-text')).not.toBeInTheDocument();
  });

  it('does not fire while loading, fires after feed loads', async () => {
    const items = [makeItem({ id: 'l1' })];
    const { rerenderBrief } = renderBrief({ items: [], isFeedLoading: true });

    expect(createNewThread).not.toHaveBeenCalled();
    expect(screen.queryByTestId('today-morning-brief')).not.toBeInTheDocument();

    rerenderBrief(items, false);

    await waitFor(() => expect(createNewThread).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('today-morning-brief')).toBeInTheDocument());
  });

  it('re-fires when item IDs change', async () => {
    createNewThread
      .mockResolvedValueOnce({ id: 'brief-thread-m1', title: 'Brief' })
      .mockResolvedValueOnce({ id: 'brief-thread-m2', title: 'Brief' });

    const items1 = [makeItem({ id: 'm1' })];
    const items2 = [makeItem({ id: 'm2' })];

    const { rerenderBrief } = renderBrief({ items: items1, isFeedLoading: false });
    await waitFor(() => expect(createNewThread).toHaveBeenCalledTimes(1));

    rerenderBrief(items2, false);
    await waitFor(() => expect(createNewThread).toHaveBeenCalledTimes(2));
  });

  it('does NOT re-fire when same item IDs re-render', async () => {
    const items = [makeItem({ id: 'n1' })];
    const { rerenderBrief } = renderBrief({ items, isFeedLoading: false });

    await waitFor(() => expect(createNewThread).toHaveBeenCalledTimes(1));

    rerenderBrief(items, false);

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(createNewThread).toHaveBeenCalledTimes(1);
  });

  it('re-fires on manual refresh button click', async () => {
    createNewThread
      .mockResolvedValueOnce({ id: 'brief-thread-o1', title: 'Brief' })
      .mockResolvedValueOnce({ id: 'brief-thread-o2', title: 'Brief' });

    renderBrief({ items: [makeItem({ id: 'o1' })], isFeedLoading: false });

    await waitFor(() => expect(chatSend).toHaveBeenCalled());

    // Complete the first brief so the refresh button appears
    emitSocket('text_delta', {
      thread_id: 'brief-thread-o1',
      request_id: 'req-1',
      round: 1,
      delta: 'Initial brief.',
    });
    emitSocket('chat_done', {
      thread_id: 'brief-thread-o1',
      request_id: 'req-1',
      full_response: 'Initial brief.',
      rounds_used: 1,
      total_input_tokens: 5,
      total_output_tokens: 3,
    });

    await waitFor(() => expect(screen.getByTestId('today-brief-refresh')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('today-brief-refresh'));

    await waitFor(() => expect(createNewThread).toHaveBeenCalledTimes(2));
  });

  it('skips brief on first mount when a user conversation is already active', async () => {
    renderBrief({
      items: [makeItem({ id: 'p1' })],
      isFeedLoading: false,
      activeThreadId: 'existing-user-thread',
    });

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(createNewThread).not.toHaveBeenCalled();
    expect(screen.queryByTestId('today-morning-brief')).not.toBeInTheDocument();
  });
});
