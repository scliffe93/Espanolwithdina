import { Icon } from './Icon';
import { statusLabel, useAccount } from '../lib/account';
import { navigate } from '../lib/router';

/** Small, honest sync indicator. Never says "saved online" until the server confirmed it. */
export function SyncBadge({ compact }: { compact?: boolean }) {
  const acc = useAccount();
  if (!acc.configured) return null;
  if (!acc.session) {
    return (
      <button onClick={() => navigate('account')} className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-terracotta ring-1 ring-terracotta/30" aria-label="Log in or create an account to save progress on every device">
        <Icon name="user" size={14} /> {compact ? 'Log in' : 'Log in · save everywhere'}
      </button>
    );
  }
  const l = statusLabel(acc.status, acc.lastSyncedAt);
  const dot = l.tone === 'ok' ? 'bg-olive' : l.tone === 'warn' ? 'bg-terracotta' : 'bg-saffron animate-pulse';
  return (
    <button onClick={() => navigate('account')} title={l.text} aria-label={`Account ${acc.session.user.username}: ${l.text}`} className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium ring-1 ring-ink/10" data-testid="sync-badge">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
      <span className="truncate">{compact ? (l.tone === 'ok' ? 'Synced' : l.tone === 'warn' ? 'Not synced' : 'Saving…') : l.text}</span>
    </button>
  );
}
