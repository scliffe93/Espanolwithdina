import { useEffect, useState } from 'react';
import { useAccount } from '../lib/account';
import { pushApi } from '../lib/cloud';
import { enablePush, disablePush, isIOS, pushStatus, pushSupport, refreshPush, type PushStatus } from '../lib/push';
import { Icon } from './Icon';

const DISMISS_KEY = 'lwd-push-prompt-dismissed';

/**
 * Phone notifications for the signed-in account: a switch where the device supports them, and
 * "add to Home Screen" steps on an iPhone or iPad that has not installed the app yet.
 * `compact` is the dismissible prompt on the home screens; the full card lives in settings.
 */
export function NotificationsCard({ compact = false }: { compact?: boolean }) {
  const { session } = useAccount();
  const who = session?.user.role === 'teacher' || session?.user.role === 'admin' ? 'teacher' : 'student';
  const support = pushSupport();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; } });
  const token = session?.token;
  // Whether the server can send notifications at all (null = still checking). Until it can, the prompt stays out of the way.
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    pushStatus().then((s) => { if (live) setStatus(s); if (s === 'on' && token) void refreshPush(token); }).catch(() => live && setStatus('off'));
    if (token) pushApi.key(token).then((r) => live && setAvailable(!!r.key)).catch(() => live && setAvailable(false));
    return () => { live = false; };
  }, [token]);

  if (!token) return compact ? null : <p className="text-sm text-ink-mute" data-testid="push-login">Log in to get notifications on this device.</p>;
  if (compact && (!available || dismissed || status === 'on' || status === null || support === 'unsupported')) return null;

  const dismiss = () => { setDismissed(true); try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode */ } };
  const turnOn = async () => {
    setBusy(true); setError(null);
    try { setStatus(await enablePush(token)); } catch (e) { setError(e instanceof Error ? e.message : 'Could not turn notifications on.'); }
    setBusy(false);
  };
  const turnOff = async () => { setBusy(true); setError(null); await disablePush(token).catch(() => undefined); setStatus('off'); setBusy(false); };
  const what = who === 'teacher' ? 'when a student hands in homework' : 'when Dina sets or marks homework, sends feedback, books or moves a lesson, or releases new verbs and words';

  const body = available === false ? (
    <p className="text-sm text-ink-soft" data-testid="push-unavailable">Notifications are not available right now. Please try again later.</p>
  ) : support === 'needs-install' ? (
    <div data-testid="push-install">
      <p className="font-semibold">Get notifications on your {isIOS() ? 'iPhone' : 'phone'}</p>
      <p className="mt-1 text-sm text-ink-soft">First add Learning with Dina to your Home Screen, then turn notifications on from there:</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-soft">
        <li>Open this page in <b>Safari</b>.</li>
        <li>Tap the <b>Share</b> button (the square with an arrow).</li>
        <li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li>
        <li>Open <b>Learning with Dina</b> from your Home Screen, log in, and tap <b>Turn on notifications</b>.</li>
      </ol>
    </div>
  ) : support === 'unsupported' ? (
    <p className="text-sm text-ink-soft" data-testid="push-unsupported">This browser cannot show notifications. Try Safari on iPhone (added to the Home Screen), or Chrome, Edge or Firefox.</p>
  ) : status === 'blocked' ? (
    <p className="text-sm text-ink-soft" data-testid="push-blocked">Notifications are blocked for this app on this device. Allow them in your device’s settings for Learning with Dina, then come back here.</p>
  ) : status === 'on' ? (
    <div className="flex flex-wrap items-center justify-between gap-3" data-testid="push-on">
      <p className="text-sm text-ink-soft"><b className="text-ink">Notifications are on</b> for this device. You’ll hear {what}.</p>
      <button type="button" className="ctrl" disabled={busy} onClick={turnOff} data-testid="push-turn-off">Turn off</button>
    </div>
  ) : (
    <div className="flex flex-wrap items-center justify-between gap-3" data-testid="push-off">
      <p className="text-sm text-ink-soft"><b className="text-ink">Get notifications on this device</b> {what}.</p>
      <button type="button" className="btn-dark !py-2" disabled={busy || status === null} onClick={turnOn} data-testid="push-turn-on"><Icon name="sparkle" size={14} /> {busy ? 'Turning on…' : 'Turn on notifications'}</button>
    </div>
  );

  return (
    <div className={compact ? 'card relative mb-4 p-4 pr-10' : ''} data-testid="push-card">
      {body}
      {error && <p className="mt-2 text-sm text-terracotta" role="alert">{error}</p>}
      {compact && <button type="button" className="absolute right-2 top-2 rounded-full p-1.5 text-ink-mute hover:bg-cream-100" aria-label="Hide this" onClick={dismiss} data-testid="push-dismiss"><Icon name="x" size={16} /></button>}
    </div>
  );
}
