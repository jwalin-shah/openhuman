/**
 * TodayComposerBar — always-visible input bar at the top of /today.
 * "What do you want to do today?"
 *
 * Uses an internal useRef for the input (Cmd/Ctrl+K focus shortcut).
 * Today.tsx does not need a ref to this input — the shortcut is registered
 * here via a document listener, which is simpler and avoids forwardRef.
 */
import debug from 'debug';
import { useEffect, useRef, useState } from 'react';

const log = debug('[today-ui]');

interface TodayComposerBarProps {
  onSubmit(prompt: string): void;
  disabled: boolean;
}

function TodayComposerBar({ onSubmit, disabled }: TodayComposerBarProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl+K focuses the composer
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        log('cmd/ctrl+k — focusing composer');
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    log('composer submit instruction_len=%d', trimmed.length);
    onSubmit(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="px-4 py-3 border-b border-stone-100">
      <div
        className={[
          'flex items-center gap-2 rounded-xl border px-3 py-2',
          'bg-white transition-all',
          disabled
            ? 'border-stone-200 opacity-60'
            : 'border-stone-200 focus-within:border-primary-500/50 focus-within:ring-1 focus-within:ring-primary-500/50',
        ].join(' ')}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="What do you want to do today?"
          data-testid="today-composer-input"
          className="flex-1 bg-transparent text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          data-testid="today-composer-submit"
          className="w-7 h-7 flex items-center justify-center rounded-full bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default TodayComposerBar;
