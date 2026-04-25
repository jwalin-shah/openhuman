/**
 * useTodayBrief — fires an automatic morning brief on mount, and re-fires
 * whenever the visible feed item IDs change materially.
 *
 * Key design choice on the `activeThreadId` global lock
 * ──────────────────────────────────────────────────────
 * `useTodayAgent` calls `dispatch(setActiveThread(threadId))` which sets the
 * global Redux lock and disables the composer while a request is in-flight.
 * We intentionally DO NOT do that here: the brief is a background ambient
 * insight, not a user-initiated action. It must never block the composer.
 *
 * Instead the hook:
 *   1. Creates its own ephemeral thread (direct `threadApi.createNewThread`).
 *   2. Calls `chatSend` — which streams events back over the socket.
 *   3. Subscribes to socket events via `subscribeChatEvents`, filtered to
 *      the brief's thread ID — all local state, no global Redux lock.
 *   4. Skips firing if the global `activeThreadId` is already set on mount
 *      (i.e. the user is already mid-conversation).
 */
import debug from 'debug';
import { useCallback, useEffect, useRef, useState } from 'react';

import { threadApi } from '../../services/api/threadApi';
import {
  chatCancel,
  type ChatDoneEvent,
  type ChatErrorEvent,
  chatSend,
  type ChatTextDeltaEvent,
  subscribeChatEvents,
} from '../../services/chatService';
import { useAppSelector } from '../../store/hooks';
import type { TodayFeedItem } from './todayAgentUtils';

const log = debug('[today-brief]');
const logError = debug('[today-brief]:error');

const BRIEF_MODEL_ID = 'reasoning-v1';
const MAX_PREVIEW_CHARS = 80;

// ─── Item-id hash ─────────────────────────────────────────────────────────────

/**
 * Produces a stable string key from the sorted set of visible item IDs.
 * The brief re-fires only when this key changes.
 */
export function computeItemHash(items: TodayFeedItem[]): string {
  const sorted = [...items].map(i => i.id).sort();
  return sorted.join('|');
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

export function buildBriefPrompt(items: TodayFeedItem[]): string {
  const summary = items
    .slice(0, 15)
    .map(item => {
      const sourceLabel =
        item.source === 'imessage' ? 'iMessage' : item.source === 'gmail' ? 'Gmail' : 'Calendar';
      const preview =
        item.preview.length > MAX_PREVIEW_CHARS
          ? `${item.preview.slice(0, MAX_PREVIEW_CHARS)}…`
          : item.preview;
      const senderPart = item.sender ? ` (from ${item.sender})` : '';
      const unreadMark = item.is_unread ? ' [UNREAD]' : '';
      return `- [${sourceLabel}]${unreadMark} ${item.title}${senderPart}: ${preview}`;
    })
    .join('\n');

  return `You are the user's calm, concise morning/day assistant. Based on their Today feed below, write 1–3 sentences that:
- Call out anything time-sensitive (unread messages, meetings starting soon, cross-source overlaps).
- Be warm but brief. Plain prose. No bullets, no emoji, no headers.
- If the feed is quiet, say so naturally.

Current feed:
${summary}`;
}

// ─── State types ──────────────────────────────────────────────────────────────

export type BriefStatus = 'idle' | 'pending' | 'streaming' | 'complete' | 'error';

export interface UseTodayBriefState {
  status: BriefStatus;
  text: string;
  /** Manually re-trigger the brief. */
  refresh(): void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTodayBrief(items: TodayFeedItem[], isFeedLoading: boolean): UseTodayBriefState {
  const [status, setStatus] = useState<BriefStatus>('idle');
  const [text, setText] = useState('');

  // Track the ephemeral thread so we can cancel on re-fire
  const briefThreadIdRef = useRef<string | null>(null);
  // Track the last item hash we fired for — prevents re-firing on unchanged data
  const lastFiredHashRef = useRef<string>('');
  // Manual refresh trigger
  const [refreshTick, setRefreshTick] = useState(0);

  // Read global activeThreadId — if a user-initiated request is already running
  // on first mount we skip the brief entirely (see design decision in JSDoc).
  const globalActiveThreadId = useAppSelector(state => state.thread.activeThreadId);
  // Capture the initial value at hook construction time for the skip guard.
  const initialActiveThreadIdRef = useRef(globalActiveThreadId);

  const fireBrief = useCallback(async (feedItems: TodayFeedItem[], forcedByRefresh = false) => {
    const hash = computeItemHash(feedItems);

    // Skip if hash unchanged and not a forced refresh
    if (!forcedByRefresh && hash === lastFiredHashRef.current) {
      log('skip — item hash unchanged hash=%s', hash);
      return;
    }

    // Cancel any in-flight brief
    if (briefThreadIdRef.current) {
      log('cancelling previous brief thread=%s', briefThreadIdRef.current);
      await chatCancel(briefThreadIdRef.current);
      briefThreadIdRef.current = null;
    }

    log('firing brief item_count=%d hash=%s forced=%s', feedItems.length, hash, forcedByRefresh);
    lastFiredHashRef.current = hash;
    setStatus('pending');
    setText('');

    // Create a fresh ephemeral thread for this brief
    let threadId: string;
    try {
      const thread = await threadApi.createNewThread();
      threadId = thread.id;
      log('brief thread created thread_id=%s', threadId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create brief thread';
      logError('thread creation failed error=%s', msg);
      setStatus('error');
      return;
    }

    briefThreadIdRef.current = threadId;

    // Accumulate text locally — no Redux involvement for the brief's streaming state
    let accumulatedText = '';

    // Subscribe to socket events, filtered to this thread
    const unsub = subscribeChatEvents({
      onTextDelta: (event: ChatTextDeltaEvent) => {
        if (event.thread_id !== threadId) return;
        accumulatedText += event.delta;
        setText(accumulatedText);
        setStatus('streaming');
      },
      onDone: (event: ChatDoneEvent) => {
        if (event.thread_id !== threadId) return;
        log('brief done thread_id=%s total_chars=%d', threadId, event.full_response?.length ?? 0);
        // Use full_response if we somehow missed deltas (e.g. non-streaming model)
        if (!accumulatedText && event.full_response) {
          setText(event.full_response);
        }
        setStatus('complete');
        unsub();
      },
      onError: (event: ChatErrorEvent) => {
        if (event.thread_id !== threadId) return;
        logError(
          'brief error thread_id=%s error_type=%s message=%s',
          threadId,
          event.error_type,
          event.message
        );
        setStatus('error');
        unsub();
      },
    });

    // Send the prompt — errors are caught silently, per spec
    try {
      const prompt = buildBriefPrompt(feedItems);
      log('sending brief prompt thread_id=%s model=%s', threadId, BRIEF_MODEL_ID);
      await chatSend({ threadId, message: prompt, model: BRIEF_MODEL_ID });
      log('chatSend returned for brief thread_id=%s', threadId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send brief';
      logError('chatSend failed thread_id=%s error=%s', threadId, msg);
      setStatus('error');
      unsub();
    }
  }, []);

  // ── Auto-fire on mount / item-id change ──────────────────────────────────────

  const itemHash = computeItemHash(items);

  useEffect(() => {
    // Wait until feed has finished its initial load
    if (isFeedLoading) {
      log('skip — feed still loading');
      return;
    }

    // Skip if no items
    if (items.length === 0) {
      log('skip — no items');
      return;
    }

    // Skip on first mount if a user-initiated conversation is already running
    if (initialActiveThreadIdRef.current && lastFiredHashRef.current === '') {
      log(
        'skip — user conversation already in-flight on first mount activeThreadId=%s',
        initialActiveThreadIdRef.current
      );
      return;
    }

    // refreshTick forces re-fire even if hash is unchanged
    const forcedByRefresh = refreshTick > 0 && itemHash === lastFiredHashRef.current;

    void fireBrief(items, forcedByRefresh);
  }, [isFeedLoading, itemHash, refreshTick, fireBrief, items]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (briefThreadIdRef.current) {
        log('unmount — cancelling brief thread=%s', briefThreadIdRef.current);
        void chatCancel(briefThreadIdRef.current);
      }
    };
  }, []);

  const refresh = useCallback(() => {
    log('manual refresh requested');
    setRefreshTick(t => t + 1);
  }, []);

  return { status, text, refresh };
}
