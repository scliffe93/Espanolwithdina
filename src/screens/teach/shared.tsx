import { useCallback, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '../../components/Icon';
import { PlatformError } from '../../lib/platform/backend';
import { usePlatform, usePlatformQuery, type AppState } from '../../lib/platform/context';
import { describeActivity } from '../../lib/platform/homework';
import { COMMON_ZONES, addMinutes, browserZone, fmtDateTime, fmtTime, relative, zoneLabel } from '../../lib/platform/time';
import { HOMEWORK_KIND_LABEL, type ActivityEvent, type Booking, type BookingFormat, type BookingStatus, type Homework, type HomeworkStatus, type Person } from '../../lib/platform/types';
import { navigate } from '../../lib/router';
import { placeInZone, todayIn } from './calendarMath';

// ───────────────────────────────────────────────────────────────
// Small building blocks shared by Dina's teacher screens.
// ───────────────────────────────────────────────────────────────

const ZONE_KEY = 'lwd-teach-zone';

/** The zone Dina views her calendar in (remembered on this device; defaults to the browser's). */
export function useViewZone(): [string, (z: string) => void] {
  const [zone, setZoneState] = useState(() => {
    try {
      return localStorage.getItem(ZONE_KEY) || browserZone();
    } catch {
      return browserZone();
    }
  });
  const setZone = useCallback((z: string) => {
    setZoneState(z);
    try {
      localStorage.setItem(ZONE_KEY, z);
    } catch {
      /* private mode */
    }
  }, []);
  return [zone, setZone];
}

export function nameOf(people: Person[], id: string): string {
  return people.find((p) => p.id === id)?.firstName ?? 'Student';
}

export function errorMessage(e: unknown, people: Person[] = [], zone = browserZone()): string {
  if (e instanceof PlatformError) {
    if (e.code === 'overlap') {
      const clash = e.extra.clash as Booking | undefined;
      if (clash) return `That time clashes with ${nameOf(people, clash.studentId)}’s lesson “${clash.topic}” (${fmtDateTime(clash.startsAt, zone)}–${fmtTime(addMinutes(clash.startsAt, clash.durationMin), zone)}). Pick another slot or move that lesson first.`;
    }
    if (e.code === 'offline') return 'You’re offline — try again when you’re back online.';
    return e.message;
  }
  return (e as Error)?.message || 'Something went wrong.';
}

/** Runs a backend mutation, bumps the platform version on success and keeps an inline error. */
export function useAction() {
  const { bump } = usePlatform();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async <T,>(fn: () => Promise<T>, people: Person[] = [], zone?: string): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try {
      const v = await fn();
      bump();
      return v;
    } catch (e) {
      setError(errorMessage(e, people, zone));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, [bump]);
  return { run, busy, error, setError };
}

export interface StudentsData {
  people: Person[];
  progress: Record<string, AppState | null>;
}

/** Dina's students together with each one's saved learning progress. */
export function useStudents() {
  return usePlatformQuery<StudentsData>(async (b) => {
    const people = await b.people();
    const states = await Promise.all(people.map((p) => b.studentProgress(p.id).catch(() => null)));
    return { people, progress: Object.fromEntries(people.map((p, i) => [p.id, states[i]])) };
  });
}

// ── Student colours (by position, so Sam and Anneka stay consistent everywhere) ──
const TONES = [
  { bg: 'bg-azul', soft: 'bg-azul-50', text: 'text-azul', ring: 'ring-azul/30', fg: 'text-white' },
  { bg: 'bg-olive', soft: 'bg-olive-50', text: 'text-olive', ring: 'ring-olive/30', fg: 'text-white' },
  { bg: 'bg-terracotta', soft: 'bg-terracotta-50', text: 'text-terracotta', ring: 'ring-terracotta/30', fg: 'text-white' },
  { bg: 'bg-saffron', soft: 'bg-saffron-50', text: 'text-ink', ring: 'ring-saffron/40', fg: 'text-ink' },
];
export type Tone = (typeof TONES)[number];
export function toneFor(people: Person[], id: string): Tone {
  const i = people.findIndex((p) => p.id === id);
  return TONES[(i < 0 ? 0 : i) % TONES.length];
}

export function Avatar({ name, tone, size = 40 }: { name: string; tone: Tone; size?: number }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full font-display font-semibold ${tone.bg} ${tone.fg}`} style={{ width: size, height: size, fontSize: size * 0.45 }} aria-hidden>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function DemoChip() {
  const { backend } = usePlatform();
  if (backend?.kind !== 'demo') return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-saffron-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-ink ring-1 ring-saffron/40" title="Dina, Sam and Anneka are fictional; everything shown is sample data saved on this device.">
      <Icon name="sparkle" size={12} /> Demo data
    </span>
  );
}

export function Section({ title, eyebrow, right, children, className = '' }: { title: ReactNode; eyebrow?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-5 ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          {eyebrow && <p className="eyebrow mb-0.5">{eyebrow}</p>}
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="card p-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-ink-mute">{sub}</p>}
    </div>
  );
}

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 text-sm font-medium">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <span id={`${id}-hint`} className="text-xs font-normal text-ink-mute">{hint}</span>}
    </div>
  );
}

export function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return <p role="alert" className="rounded-xl bg-terracotta-50 px-3 py-2 text-sm text-terracotta-dark">{error}</p>;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <p className="card p-5 text-sm text-ink-mute" aria-live="polite">{label}</p>;
}

export function ZoneSelect({ id, value, onChange, label = 'Time zone' }: { id: string; value: string; onChange: (z: string) => void; label?: string }) {
  const zones = COMMON_ZONES.includes(value) ? COMMON_ZONES : [value, ...COMMON_ZONES];
  return (
    <Field id={id} label={label}>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {zones.map((z) => <option key={z} value={z}>{zoneLabel(z)}</option>)}
      </select>
    </Field>
  );
}

/** Two-step destructive button: first click asks, second confirms. */
export function ConfirmButton({ children, confirmLabel, onConfirm, className = 'ctrl', disabled }: { children: ReactNode; confirmLabel: string; onConfirm: () => void; className?: string; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  if (armed) {
    return (
      <span className="inline-flex items-center gap-1.5" role="group" aria-label={confirmLabel}>
        <button type="button" className="btn-dark !px-3 !py-2 !text-[13px]" disabled={disabled} onClick={() => { setArmed(false); onConfirm(); }}>{confirmLabel}</button>
        <button type="button" className="ctrl" onClick={() => setArmed(false)}>Keep</button>
      </span>
    );
  }
  return <button type="button" className={className} disabled={disabled} onClick={() => setArmed(true)}>{children}</button>;
}

export function StudentPicker({ people, value, onChange, multiple = false, label = 'Student' }: { people: Person[]; value: string[]; onChange: (ids: string[]) => void; multiple?: boolean; label?: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {people.map((p) => {
        const on = value.includes(p.id);
        const tone = toneFor(people, p.id);
        return (
          <button key={p.id} type="button" className="chip" aria-pressed={on} onClick={() => onChange(multiple ? (on ? value.filter((v) => v !== p.id) : [...value, p.id]) : [p.id])}>
            <span className={`h-2.5 w-2.5 rounded-full ${on ? 'bg-cream' : tone.bg}`} aria-hidden /> {p.firstName}
          </button>
        );
      })}
      {multiple && people.length > 1 && (
        <button type="button" className="chip" aria-pressed={value.length === people.length} onClick={() => onChange(value.length === people.length ? [] : people.map((p) => p.id))}>Both</button>
      )}
    </div>
  );
}

// ── Status & format ──
export const FORMAT_LABEL: Record<BookingFormat, string> = { online: 'Online', 'in-person': 'Face to face' };
export const formatIcon = (f: BookingFormat): IconName => (f === 'online' ? 'video' : 'pin');

const STATUS: Record<BookingStatus | HomeworkStatus, { label: string; cls: string; icon: IconName }> = {
  scheduled: { label: 'Scheduled', cls: 'bg-azul-50 text-azul', icon: 'calendar' },
  completed: { label: 'Completed', cls: 'bg-olive-50 text-olive', icon: 'check' },
  cancelled: { label: 'Cancelled', cls: 'bg-ink/5 text-ink-mute', icon: 'x' },
  assigned: { label: 'Assigned', cls: 'bg-cream-100 text-ink-soft', icon: 'book' },
  submitted: { label: 'Awaiting review', cls: 'bg-saffron-50 text-ink', icon: 'star' },
  reviewed: { label: 'Reviewed', cls: 'bg-olive-50 text-olive', icon: 'check' },
};
export function StatusChip({ status, extra }: { status: BookingStatus | HomeworkStatus; extra?: string }) {
  const s = STATUS[status];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}><Icon name={s.icon} size={11} /> {s.label}{extra ? ` · ${extra}` : ''}</span>;
}

export function isUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Time of a lesson in the viewer's zone, plus the zone it was scheduled in when that differs. */
export function LessonTime({ b, zone, withDate }: { b: Booking; zone: string; withDate?: boolean }) {
  const end = addMinutes(b.startsAt, b.durationMin);
  return (
    <span className="block">
      <span className="font-semibold tabular-nums">{withDate ? fmtDateTime(b.startsAt, zone) : fmtTime(b.startsAt, zone)}–{fmtTime(end, zone)}</span>
      {b.tz !== zone && <span className="block text-xs text-ink-mute">Scheduled as {fmtDateTime(b.startsAt, b.tz)} · {zoneLabel(b.tz)}</span>}
    </span>
  );
}

export function LessonCard({ b, people, zone, onEdit, actions, compact }: { b: Booking; people: Person[]; zone: string; onEdit?: (b: Booking) => void; actions?: ReactNode; compact?: boolean }) {
  const tone = toneFor(people, b.studentId);
  const name = nameOf(people, b.studentId);
  const link = b.format === 'online' && isUrl(b.location);
  const today = placeInZone(b.startsAt, zone).date === todayIn(zone);
  return (
    <article className={`rounded-2xl p-3 ring-1 ${b.status === 'cancelled' ? 'bg-cream-100 ring-transparent' : `bg-white ${tone.ring}`} ${compact ? '' : 'sm:p-4'}`} aria-label={`${name}: ${b.topic}`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 rounded-xl px-2.5 py-1.5 text-center ${tone.soft}`}>
          <span className="block text-sm font-bold tabular-nums">{fmtTime(b.startsAt, zone)}</span>
          <span className="block text-[11px] text-ink-mute">{today ? 'today' : fmtDateTime(b.startsAt, zone, { hour: undefined, minute: undefined })}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${tone.text}`}><span className={`h-2 w-2 rounded-full ${tone.bg}`} aria-hidden />{name}</span>
            <span className="inline-flex items-center gap-1 text-xs text-ink-mute"><Icon name={formatIcon(b.format)} size={13} /> {FORMAT_LABEL[b.format]} · {b.durationMin} min</span>
            {b.status !== 'scheduled' && <StatusChip status={b.status} />}
          </div>
          <p className={`mt-0.5 font-semibold ${b.status === 'cancelled' ? 'line-through text-ink-mute' : ''}`}>{b.topic}</p>
          {b.tz !== zone && <p className="text-xs text-ink-mute">Scheduled as {fmtTime(b.startsAt, b.tz)} · {zoneLabel(b.tz)}</p>}
          {!compact && b.location && (
            <p className="mt-1 truncate text-sm text-ink-soft">
              {link ? <a className="text-azul underline-offset-2 hover:underline" href={b.location} target="_blank" rel="noreferrer">{b.location}</a> : b.location}
            </p>
          )}
          {!compact && b.prepNotes && <p className="mt-1 rounded-xl bg-cream-100 px-3 py-2 text-sm text-ink-soft"><span className="eyebrow mr-1.5 !text-[10px]">Prep</span>{b.prepNotes}</p>}
          {(actions || onEdit) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {onEdit && <button type="button" className="ctrl" onClick={() => onEdit(b)}><Icon name="edit" size={14} /> {compact ? 'Open' : 'Edit · reschedule'}</button>}
              {actions}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function dueLabel(h: Homework, zone: string): { text: string; overdue: boolean } {
  const overdue = h.status === 'assigned' && new Date(h.dueAt).getTime() < Date.now();
  return { text: `${overdue ? 'Overdue — was due' : 'Due'} ${fmtDateTime(h.dueAt, zone)} (${relative(h.dueAt)})`, overdue };
}

export function HomeworkRow({ h, people, zone, onOpen, showStudent = true }: { h: Homework; people: Person[]; zone: string; onOpen: (h: Homework) => void; showStudent?: boolean }) {
  const tone = toneFor(people, h.studentId);
  const due = dueLabel(h, zone);
  return (
    <article className="flex items-start gap-3 rounded-2xl bg-white p-3 ring-1 ring-ink/5">
      <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tone.soft} ${tone.text}`}><Icon name={h.activity.kind === 'speaking' ? 'mic' : h.activity.kind === 'story' ? 'map' : h.activity.kind === 'listening' ? 'volume' : h.activity.kind === 'written' ? 'edit' : 'book'} size={18} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {showStudent && <span className={`text-sm font-semibold ${tone.text}`}>{nameOf(people, h.studentId)}</span>}
          <StatusChip status={h.status} />
          <span className="text-xs text-ink-mute">{HOMEWORK_KIND_LABEL[h.activity.kind]}</span>
        </div>
        <p className="mt-0.5 font-semibold">{h.activity.title}</p>
        <p className="text-sm text-ink-soft">{describeActivity(h.activity)}</p>
        <p className={`text-xs ${due.overdue ? 'font-semibold text-terracotta-dark' : 'text-ink-mute'}`}>{due.text}</p>
        {h.result?.summary && <p className="mt-1 text-xs text-ink-soft"><Icon name="check" size={12} className="mr-1 inline text-olive" />{h.result.summary}</p>}
      </div>
      <button type="button" className={h.status === 'submitted' ? 'btn-primary !px-4 !py-2 !text-sm' : 'ctrl'} onClick={() => onOpen(h)}>
        {h.status === 'submitted' ? 'Review' : 'Details'}
      </button>
    </article>
  );
}

const ACTIVITY_ICON: Record<ActivityEvent['type'], IconName> = { chapter: 'map', practice: 'dumbbell', game: 'sparkle', review: 'brain', homework: 'book', lesson: 'calendar', login: 'user' };

export function ActivityList({ events, people, showStudent = true, empty = 'Nothing yet — activity appears here as students work.' }: { events: ActivityEvent[]; people: Person[]; showStudent?: boolean; empty?: string }) {
  if (!events.length) return <p className="text-sm text-ink-mute">{empty}</p>;
  return (
    <ol className="grid gap-1.5">
      {events.map((ev) => {
        const tone = toneFor(people, ev.studentId);
        return (
          <li key={ev.id} className="flex items-start gap-2.5 text-sm">
            <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${tone.soft} ${tone.text}`}><Icon name={ACTIVITY_ICON[ev.type]} size={14} /></span>
            <span className="min-w-0 flex-1">
              {showStudent && <b className={tone.text}>{nameOf(people, ev.studentId)} · </b>}
              <span>{ev.label}</span>
              <span className="block text-xs text-ink-mute" title={fmtDateTime(ev.at)}>{relative(ev.at)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function openStudent(id: string, tab?: string) {
  navigate(`teach/student/${id}${tab ? `?tab=${tab}` : ''}`);
}
