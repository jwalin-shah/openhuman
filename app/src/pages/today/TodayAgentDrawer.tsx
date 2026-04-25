/**
 * TodayAgentDrawer — right-side slide-in panel that streams agent responses
 * for the Today page action menu and composer bar.
 */
import debug from 'debug';
import { useEffect } from 'react';

import { chatCancel } from '../../services/chatService';
import { useAppSelector } from '../../store/hooks';
import type { TodayActionKind } from './todayAgentUtils';

const log = debug('[today-ui]');

interface TodayAgentDrawerProps {
  isOpen: boolean;
  onClose(): void;
  onRetry?(): void;
  threadId: string | null;
  contextLabel: string;
  actionKind: TodayActionKind | 'composer' | null;
}

// ─── Three-dot loading indicator ─────────────────────────────────────────────

function ThreeDots() {
  return (
    <div className="flex items-center gap-1 py-2">
      <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:0ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:150ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:300ms]" />
    </div>
  );
}

// ─── Drawer component ─────────────────────────────────────────────────────────

export function TodayAgentDrawer({
  isOpen,
  onClose,
  onRetry,
  threadId,
  contextLabel,
  actionKind: _actionKind,
}: TodayAgentDrawerProps) {
  // Read live streaming state from Redux
  const streamingAssistant = useAppSelector(state =>
    threadId ? (state.chatRuntime.streamingAssistantByThread[threadId] ?? null) : null
  );
  const lifecycle = useAppSelector(state =>
    threadId ? (state.chatRuntime.inferenceTurnLifecycleByThread[threadId] ?? null) : null
  );
  const messages = useAppSelector(state =>
    threadId ? (state.thread.messagesByThreadId[threadId] ?? []) : []
  );

  // Derive phase
  const isStreaming = lifecycle === 'streaming';
  const isPending = lifecycle === 'started';
  const isComplete = !lifecycle && messages.some(m => m.sender === 'agent');
  const isIdle = !lifecycle && !isComplete;

  const latestAgentMessage = [...messages].reverse().find(m => m.sender === 'agent');
  const streamingText = streamingAssistant?.content ?? '';
  const displayText = isComplete ? (latestAgentMessage?.content ?? '') : streamingText;
  const hasText = displayText.length > 0;

  log(
    'render isOpen=%s threadId=%s lifecycle=%s isComplete=%s hasText=%s',
    isOpen,
    threadId,
    lifecycle,
    isComplete,
    hasText
  );

  // Escape key closes
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        log('escape key pressed — closing drawer');
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleCopy = async () => {
    if (!displayText) return;
    try {
      await navigator.clipboard.writeText(displayText);
      log('copied text to clipboard chars=%d', displayText.length);
    } catch {
      // Clipboard not available — silently ignore
    }
  };

  const handleCancel = () => {
    if (threadId) {
      log('cancel requested thread_id=%s', threadId);
      void chatCancel(threadId);
    }
  };

  return (
    <>
      {/* Backdrop (mobile/overlay behaviour) */}
      {isOpen && <div className="fixed inset-0 z-20 bg-black/10" aria-hidden onClick={onClose} />}

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={contextLabel || 'Today Assistant'}
        data-testid="today-agent-drawer"
        className={[
          'fixed top-0 right-0 h-full z-30',
          'w-full max-w-[400px]',
          'bg-white border-l border-stone-200 shadow-strong',
          'flex flex-col',
          'transition-transform duration-200 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 flex-shrink-0">
          <p className="text-sm font-semibold text-stone-800 truncate flex-1 mr-2">
            {contextLabel || 'Today Assistant'}
          </p>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors flex-shrink-0"
            aria-label="Close drawer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {(isIdle || isPending) && !hasText && <ThreeDots />}

          {hasText && (
            <div className="prose prose-sm text-stone-800 whitespace-pre-wrap break-words text-sm leading-relaxed">
              {displayText}
            </div>
          )}

          {isStreaming && !hasText && <ThreeDots />}

          {/* Error state rendered from parent via passed error prop is handled
              in Today.tsx; drawer itself only shows content/loading/streaming. */}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-stone-100 px-4 py-3 flex items-center gap-2">
          {/* Copy */}
          <button
            onClick={() => void handleCopy()}
            disabled={!hasText}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-600 border border-stone-200 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Copy
          </button>

          {/* Cancel during streaming */}
          {(isStreaming || isPending) && (
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-coral-600 border border-coral-200 hover:bg-coral-50 transition-colors">
              Cancel
            </button>
          )}

          {/* Close when done */}
          {isComplete && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-600 border border-stone-200 hover:bg-stone-50 transition-colors">
              Close
            </button>
          )}

          {/* Send preview (demo — always disabled) */}
          <div className="relative group ml-auto">
            <button
              disabled
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-primary-400 opacity-50 cursor-not-allowed transition-colors">
              Send
            </button>
            <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover:block z-10 pointer-events-none">
              <div className="bg-stone-900 text-white text-[10px] rounded-md px-2 py-1 whitespace-nowrap shadow-lg">
                Sending not available in demo
              </div>
            </div>
          </div>
        </div>

        {/* Error banner (from retry prop) */}
        {onRetry && (
          <div className="px-4 pb-3 flex-shrink-0">
            <div className="rounded-lg bg-coral-50 border border-coral-200 px-3 py-2 flex items-center justify-between gap-2">
              <p className="text-xs text-coral-700">Something went wrong.</p>
              <button
                onClick={onRetry}
                className="text-xs font-semibold text-coral-600 underline hover:text-coral-800">
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default TodayAgentDrawer;
