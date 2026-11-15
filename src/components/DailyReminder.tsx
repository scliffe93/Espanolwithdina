import { useEffect, useState } from 'react';
import { useAccount } from '../lib/account';
import { currentStreak } from '../lib/analytics';
import { reminderApi, type Reminder } from '../lib/cloud';
import { pushStatus, type PushStatus } from '../lib/push';
import { useStore } from '../lib/store';
import { Icon } from './Icon';

const DISMISS_KEY = 'lwd-reminder-prompt-dismissed';
const zone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } };

/**
 * The daily practice reminder: the learner picks a time, and their phone gets one notification a day at that time
 * unless they have already practised. It names their streak. `compact` is the one-line offer on the home page;
 * the full control lives in Settings under Notifications.
 */
export function DailyReminder({ compact = false }: { compact?: boolean }) {
  const { session } = useAccount();
  const { state } = useStore();
  const token = session?.token;
  const [r, setR] = useState<Reminder | null>(null);
  const [push, setPush] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; } });
  const streak = currentStreak(state);

  useEffect(() => {
    let live = true;
    if (!token) return;
    reminderApi.get(token).then((x) => live && setR(x)).catch(() => live && setR(null));
    pushStatus().then((s) => live && setPush(s)).catch(() => live && setPush('off'));
    return () => { live = false; };
  }, [token]);

  if (!token || !r || r.available === false) return null;
  const save = async (next: { enabled: boolean; time: string }) => {
    setBusy(true); setError(null);
    const before = r;
    setR({ ...r, ...next });
    try { setR({ ...r, ...(await reminderApi.put(token, { ...next, tz: zone() })) }); } catch (e) { setR(before); setError(e instanceof Error ? e.message : 'Could not save the reminder.'); }
    setBusy(false);
  };

  if (compact) {
    if (r.enabled || push !== 'on' || dismissed) return null;
    return (
      <div className="relative mb-4 flex flex-wrap items-center gap-3 rounded-3xl bg-olive-50 p-4 pr-11 ring-1 ring-olive/20" data-testid="reminder-prompt">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-terracotta shadow-sm"><Icon name="flame" size={22} /></span>
        <div className="min-w-0 flex-1 basis-52"><p className="font-semibold leading-tight">A nudge each day?</p><p className="mt-0.5 text-sm text-ink-soft">Pick a time and I will remind you to practise{streak >= 2 ? ` and keep your ${streak}-day streak` : ''}.</p></div>
        <div className="flex items-center gap-2">
          <input type="time" aria-label="Reminder time" className="input !w-32 !py-2" value={r.time} onChange={(e) => e.target.value && setR({ ...r, time: e.target.value })} />
          <button type="button" className="btn-primary !py-2.5" disabled={busy} onClick={() => void save({ enabled: true, time: r.time })} data-testid="reminder-on">Remind me</button>
        </div>
        <button type="button" className="absolute right-2 top-2 rounded-full p-1.5 text-ink-mute hover:bg-white/60" aria-label="Hide this" onClick={() => { setDismissed(true); try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode */ } }}><Icon name="x" size={16} /></button>
        {error && <p className="w-full text-sm text-terracotta-dark" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-5 border-t border-ink/10 pt-5" data-testid="reminder-card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl shadow-sm ${r.enabled ? 'bg-terracotta text-white' : 'bg-cream-100 text-ink-mute'}`}><Icon name="flame" size={22} /></span>
          <div className="min-w-0">
            <p className="font-semibold leading-tight">Daily reminder</p>
            <p className="mt-1 text-sm leading-snug text-ink-soft">One notification a day at the time you choose, unless you have already practised. {streak >= 1 ? `You are on a ${streak}-day streak.` : 'Practise today to start a streak.'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input type="time" aria-label="Reminder time" className="input !w-32 !py-2" value={r.time} disabled={busy} onChange={(e) => e.target.value && void save({ enabled: r.enabled, time: e.target.value })} data-testid="reminder-time" />
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="h-5 w-5 accent-terracotta" checked={r.enabled} disabled={busy} onChange={(e) => void save({ enabled: e.target.checked, time: r.time })} data-testid="reminder-toggle" /> {r.enabled ? 'On' : 'Off'}</label>
        </div>
      </div>
      {r.enabled && push !== null && push !== 'on' && <p className="mt-3 rounded-xl bg-saffron-50 px-3 py-2 text-sm text-ink-soft" data-testid="reminder-needs-push">Notifications are off on this device, so the reminder cannot reach it. Turn them on above.</p>}
      {error && <p className="mt-3 text-sm text-terracotta-dark" role="alert">{error}</p>}
    </div>
  );
}
