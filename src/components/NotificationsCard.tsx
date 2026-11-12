import { useEffect, useState } from 'react';
import { useAccount } from '../lib/account';
import { pushApi } from '../lib/cloud';
import { canInstall, enablePush, disablePush, installApp, isIOS, onInstallChange, pushStatus, pushSupport, refreshPush, type PushStatus } from '../lib/push';
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
  const [installable, setInstallable] = useState(canInstall());
  useEffect(() => onInstallChange(() => setInstallable(canInstall())), []);
  // Whether the server can send notifications at all (null = still checking). Until it can, the prompt stays out of the way.
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    pushStatus().then((s) => { if (live) setStatus(s); if (s === 'on' && token) void refreshPush(token); }).catch(() => live && setStatus('off'));
    if (token) pushApi.key(token).then((r) => live && setAvailable(!!r.key)).catch(() => live && setAvailable(false));
    return () => { live = false; };
  }, [token]);

  if (!token) return compact ? null : <p className="text-sm text-ink-mute" data-testid="push-login">Log in to get notifications on this device.</p>;
  if (compact && (!available || dismissed || status === 'blocked' || status === 'on' || status === null || support === 'unsupported')) return null;

  const dismiss = () => { setDismissed(true); try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode */ } };
  const turnOn = async () => {
    setBusy(true); setError(null);
    try { setStatus(await enablePush(token)); } catch (e) { setError(e instanceof Error ? e.message : 'Could not turn notifications on.'); }
    setBusy(false);
  };
  const turnOff = async () => { setBusy(true); setError(null); await disablePush(token).catch(() => undefined); setStatus('off'); setBusy(false); };
  const what = who === 'teacher' ? 'when a student hands in homework' : 'when Dina sets or marks homework, sends feedback, changes a lesson or releases new verbs and words';

  const Bell = ({ off = false }: { off?: boolean }) => (
    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${off ? 'bg-cream-100 text-ink-mute' : 'bg-saffron text-ink'} shadow-sm`} aria-hidden>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7 2.5 7h-17S6 15 6 9Z" /><path d="M10 20a2.2 2.2 0 0 0 4 0" />{off && <path d="M4 4l16 16" />}</svg>
    </span>
  );
  const ShareGlyph = () => (
    <svg className="mx-0.5 inline-block align-[-3px] text-azul" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 15V3" /><path d="M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" /></svg>
  );
  const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
    <li className="flex items-start gap-3"><span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-terracotta text-xs font-bold text-white">{n}</span><span className="text-sm leading-snug text-ink-soft">{children}</span></li>
  );
  const Row = ({ off, title, text, action, testid }: { off?: boolean; title: string; text: React.ReactNode; action?: React.ReactNode; testid: string }) => (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3" data-testid={testid}>
      <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
        <Bell off={off} />
        <div className="min-w-0"><p className="font-semibold leading-tight text-ink">{title}</p><p className="mt-1 text-sm leading-snug text-ink-soft">{text}</p></div>
      </div>
      {action && <div className="flex w-full flex-wrap gap-2 sm:w-auto">{action}</div>}
    </div>
  );
  const installButton = installable ? <button type="button" className="ctrl w-full justify-center sm:w-auto" onClick={() => void installApp()} data-testid="app-install"><Icon name="download" size={15} /> Install the app</button> : null;

  const body = available === false ? (
    <Row off testid="push-unavailable" title="Notifications" text="Not available right now. Please try again later." action={installButton} />
  ) : support === 'needs-install' ? (
    <div data-testid="push-install">
      <div className="flex items-start gap-3">
        <Bell />
        <div><p className="font-semibold leading-tight text-ink">Get notifications on your {isIOS() ? 'iPhone' : 'phone'}</p><p className="mt-1 text-sm leading-snug text-ink-soft">Add Learning with Dina to your Home Screen first. It takes about ten seconds.</p></div>
      </div>
      <ol className="mt-4 grid gap-2.5 rounded-2xl bg-white/70 p-3.5 ring-1 ring-ink/5">
        <Step n={1}>Open this page in <b className="text-ink">Safari</b>.</Step>
        <Step n={2}>Tap <b className="text-ink">Share</b> <ShareGlyph /> at the bottom of the screen.</Step>
        <Step n={3}>Choose <b className="text-ink">Add to Home Screen</b>, then <b className="text-ink">Add</b>.</Step>
        <Step n={4}>Open <b className="text-ink">Dina</b> from your Home Screen, log in and tap <b className="text-ink">Turn on notifications</b>.</Step>
      </ol>
    </div>
  ) : support === 'unsupported' ? (
    <Row off testid="push-unsupported" title="Notifications" text="This browser cannot show notifications. Try Safari on iPhone (added to the Home Screen), or Chrome, Edge or Firefox." />
  ) : status === 'blocked' ? (
    <Row off testid="push-blocked" title="Notifications are blocked" text="Allow them for Learning with Dina in this device’s settings, then come back here." action={installButton} />
  ) : status === 'on' ? (
    <Row testid="push-on" title="Notifications are on" text={<>This device will tell you {what}.</>} action={<>{installButton}<button type="button" className="ctrl w-full justify-center sm:w-auto" disabled={busy} onClick={turnOff} data-testid="push-turn-off">Turn off</button></>} />
  ) : (
    <Row testid="push-off" title="Never miss a thing" text={<>Get a notification on this device {what}.</>}
      action={<><button type="button" className="btn-primary w-full justify-center !py-2.5 sm:w-auto" disabled={busy || status === null} onClick={turnOn} data-testid="push-turn-on">{busy ? 'Turning on…' : 'Turn on notifications'}</button>{installButton}</>} />
  );

  return (
    <div className={compact ? 'relative mb-4 rounded-3xl bg-gradient-to-br from-saffron-50 to-terracotta-50 p-4 pr-11 ring-1 ring-terracotta/15 shadow-sm' : ''} data-testid="push-card">
      {body}
      {error && <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-sm text-terracotta-dark" role="alert">{error}</p>}
      {compact && <button type="button" className="absolute right-2 top-2 rounded-full p-1.5 text-ink-mute hover:bg-white/60" aria-label="Hide this" onClick={dismiss} data-testid="push-dismiss"><Icon name="x" size={16} /></button>}
    </div>
  );
}
