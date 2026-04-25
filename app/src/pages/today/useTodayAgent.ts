/**
 * useTodayAgent — encapsulates "create thread → send message → track state"
 * for the Today page agent integration.
 */
import debug from 'debug';
import { useCallback, useState } from 'react';

import { threadApi } from '../../services/api/threadApi';
import { chatCancel, chatSend } from '../../services/chatService';
import { beginInferenceTurn, setToolTimelineForThread } from '../../store/chatRuntimeSlice';
import { useAppDispatch } from '../../store/hooks';
import { setActiveThread } from '../../store/threadSlice';
import {
  buildActionPrompt,
  buildComposerPrompt,
  type TodayActionKind,
  type TodayFeedItem,
} from './todayAgentUtils';

const log = debug('[today-agent]');
const logError = debug('[today-agent]:error');

const CHAT_MODEL_ID = 'reasoning-v1';

export interface UseTodayAgentState {
  activeThreadId: string | null;
  contextLabel: string;
  actionKind: TodayActionKind | 'composer' | null;
  isOpen: boolean;
  error: string | null;
  sendAction(action: TodayActionKind, item: TodayFeedItem): Promise<void>;
  sendComposer(instruction: string, items: TodayFeedItem[]): Promise<void>;
  close(): void;
}

export function useTodayAgent(): UseTodayAgentState {
  const dispatch = useAppDispatch();

  const [activeThreadId, setLocalThreadId] = useState<string | null>(null);
  const [contextLabel, setContextLabel] = useState<string>('');
  const [actionKind, setActionKind] = useState<TodayActionKind | 'composer' | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAgent = useCallback(
    async (prompt: string, label: string, kind: TodayActionKind | 'composer') => {
      log('startAgent enter label=%s kind=%s', label, kind);
      setError(null);

      // Cancel any previous thread before starting a new one
      if (activeThreadId) {
        log('cancelling previous thread=%s', activeThreadId);
        await chatCancel(activeThreadId);
      }

      // Create a fresh thread
      let threadId: string;
      try {
        log('creating new thread');
        const thread = await threadApi.createNewThread();
        threadId = thread.id;
        log('thread created thread_id=%s', threadId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create thread';
        logError('thread creation failed error=%s', msg);
        setError(msg);
        return;
      }

      setLocalThreadId(threadId);
      setContextLabel(label);
      setActionKind(kind);
      setIsOpen(true);

      // Arm the Redux runtime state (mirrors Conversations.tsx handleSendMessage)
      dispatch(setToolTimelineForThread({ threadId, entries: [] }));
      dispatch(beginInferenceTurn({ threadId }));
      dispatch(setActiveThread(threadId));

      try {
        log('sending message thread_id=%s model=%s', threadId, CHAT_MODEL_ID);
        await chatSend({ threadId, message: prompt, model: CHAT_MODEL_ID });
        log('chatSend returned thread_id=%s', threadId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to send message';
        logError('chatSend failed thread_id=%s error=%s', threadId, msg);
        setError(msg);
        // Clean up Redux state on send error
        dispatch(setActiveThread(null));
      }
    },
    [activeThreadId, dispatch]
  );

  const sendAction = useCallback(
    async (action: TodayActionKind, item: TodayFeedItem) => {
      log('sendAction action=%s item_id=%s source=%s', action, item.id, item.source);
      const prompt = buildActionPrompt(action, item);

      const sourceLabel =
        item.source === 'imessage' ? 'iMessage' : item.source === 'gmail' ? 'Gmail' : 'Calendar';
      const label = item.sender
        ? `${ACTION_LABELS[action]} — ${item.sender} (${sourceLabel})`
        : `${ACTION_LABELS[action]} — ${item.title} (${sourceLabel})`;

      await startAgent(prompt, label, action);
    },
    [startAgent]
  );

  const sendComposer = useCallback(
    async (instruction: string, items: TodayFeedItem[]) => {
      log('sendComposer instruction_len=%d item_count=%d', instruction.length, items.length);
      const prompt = buildComposerPrompt(instruction, items);
      await startAgent(prompt, 'Today Assistant', 'composer');
    },
    [startAgent]
  );

  const close = useCallback(() => {
    log('close drawer thread_id=%s', activeThreadId);
    // threadId stays in Redux for history; clear local UI state only
    setIsOpen(false);
    setLocalThreadId(null);
    setContextLabel('');
    setActionKind(null);
    setError(null);
  }, [activeThreadId]);

  return {
    activeThreadId,
    contextLabel,
    actionKind,
    isOpen,
    error,
    sendAction,
    sendComposer,
    close,
  };
}

// Needed inside sendAction for labels — import locally here for convenience
const ACTION_LABELS: Record<TodayActionKind, string> = {
  reply: 'Reply',
  draft: 'Draft',
  summarize: 'Summarize',
};
