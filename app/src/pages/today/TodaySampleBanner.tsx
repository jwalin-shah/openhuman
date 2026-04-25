/**
 * TodaySampleBanner — one-line notice shown above the feed when the page is
 * displaying seeded demo data rather than real account activity.
 *
 * Kept intentionally calm: stone-100 background, small text, two inline link-
 * style CTAs that navigate to /settings/connections.
 */
import { useNavigate } from 'react-router-dom';

interface TodaySampleBannerProps {
  /** Called before navigation so the parent can do any cleanup (optional). */
  onConnect?: () => void;
}

export function TodaySampleBanner({ onConnect }: TodaySampleBannerProps) {
  const navigate = useNavigate();

  const handleConnect = () => {
    onConnect?.();
    navigate('/settings/connections');
  };

  return (
    <div
      className="bg-stone-100 px-4 py-3 flex items-center gap-1 flex-wrap text-xs text-stone-600"
      data-testid="today-sample-banner"
      role="status"
      aria-label="Showing sample data">
      <span>Showing sample data. Connect your accounts to see your real Today feed.</span>

      <button
        type="button"
        onClick={handleConnect}
        data-testid="today-sample-connect-gmail"
        className="underline text-primary-700 hover:text-primary-800 font-medium whitespace-nowrap">
        Connect Gmail
      </button>

      <span className="text-stone-400" aria-hidden="true">
        ·
      </span>

      <button
        type="button"
        onClick={handleConnect}
        data-testid="today-sample-connect-calendar"
        className="underline text-primary-700 hover:text-primary-800 font-medium whitespace-nowrap">
        Connect Calendar
      </button>
    </div>
  );
}

// ─── Per-source inline nudge ──────────────────────────────────────────────────

type NudgeSource = 'gmail' | 'calendar' | 'imessage';

interface TodaySourceNudgeProps {
  source: NudgeSource;
  isMacOS: boolean;
  onConnect?: () => void;
}

/**
 * Small inline nudge rendered inside a filtered tab when there are no items
 * for that source.
 */
export function TodaySourceNudge({ source, isMacOS, onConnect }: TodaySourceNudgeProps) {
  const navigate = useNavigate();

  const handleConnect = () => {
    onConnect?.();
    navigate('/settings/connections');
  };

  if (source === 'imessage') {
    if (!isMacOS) {
      return (
        <div className="px-6 py-8 text-center" data-testid="today-nudge-imessage" role="status">
          <p className="text-sm text-stone-500">iMessage is macOS-only.</p>
        </div>
      );
    }
    // On macOS — could be connected but empty; just show generic clear state
    return (
      <div className="px-6 py-8 text-center" data-testid="today-nudge-imessage" role="status">
        <p className="text-sm text-stone-500">No new iMessages today.</p>
      </div>
    );
  }

  const label = source === 'gmail' ? 'Gmail' : 'Calendar';

  return (
    <div
      className="px-6 py-8 text-center space-y-1"
      data-testid={`today-nudge-${source}`}
      role="status">
      <p className="text-sm text-stone-500">
        No {label} connected yet —{' '}
        <button
          type="button"
          onClick={handleConnect}
          data-testid={`today-nudge-${source}-connect`}
          className="underline text-primary-700 hover:text-primary-800 font-medium">
          Connect
        </button>
      </p>
    </div>
  );
}
