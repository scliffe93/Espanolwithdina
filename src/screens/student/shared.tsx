import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '../../components/Icon';
import { Segmented } from '../../components/ui';
import { usePlatform, usePlatformQuery } from '../../lib/platform/context';
import { describeActivity, homeworkRoute } from '../../lib/platform/homework';
import { addMinutes, browserZone, fmtDate, fmtDateTime, fmtTime, relative, utcIsoToZoned, zoneLabel } from '../../lib/platform/time';
import { HOMEWORK_KIND_LABEL, type Booking, type Feedback, type FeedbackKind, type Homework } from '../../lib/platform/types';
import { navigate } from '../../lib/router';
import { downloadIcs, isMeetingLink } from './ics';

// ───────────────────────────────────────────────────────────────
// Shared pieces of the student dashboard: data hook, date logic,
// reminders, status tags and the lesson / homework / feedback cards.
// ───────────────────────────────────────────────────────────────

export const HOUR = 3_600_000;
export const DAY = 86_400_000;

export interface StudentData {
  bookings: Booking[];
  homework: Homework[];
  feedback: Feedback[];
}

/** Everything the student's screens show, fetched together and refetched after any mutation (bump). */
export function useStudentData() {
  return usePlatformQuery<StudentData>(async (b) => {
    const [bookings, homework, feedback] = await Promise.all([b.bookings({ includeCancelled: true }), b.homework(), b.feedback()]);
    return { bookings, homework, feedback };
  });
}

// ── Dates & buckets ─────────────────────────────────────────────

export const bookingEnd = (b: Booking) => addMinutes(b.startsAt, b.durationMin);
const ms = (iso: string) => new Date(iso).getTime();

/** The earliest scheduled lesson that hasn't ended yet (a lesson in progress still counts). */
export function nextLesson(bookings: Booking[], now: number): Booking | undefined {
  return bookings.filter((b) => b.status === 'scheduled' && ms(bookingEnd(b)) > now).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
}

/** "today at 18:00", "tomorrow at 18:00" or "Thu 12 Nov, 18:00" — in the viewer's zone. */
export function whenPhrase(iso: string, now = Date.now(), zone = browserZone()): string {
  const day = utcIsoToZoned(iso, zone).date;
  const today = utcIsoToZoned(new Date(now).toISOString(), zone).date;
  const tomorrow = utcIsoToZoned(new Date(now + DAY).toISOString(), zone).date;
  if (day === today) return `today at ${fmtTime(iso, zone)}`;
  if (day === tomorrow) return `tomorrow at ${fmtTime(iso, zone)}`;
  return fmtDateTime(iso, zone);
}

export const isOverdue = (h: Homework, now: number) => h.status === 'assigned' && ms(h.dueAt) < now;
export const isDueSoon = (h: Homework, now: number) => {
  const left = ms(h.dueAt) - now;
  return h.status === 'assigned' && left >= 0 && left <= DAY;
};

export function homeworkBuckets(homework: Homework[], now: number) {
  const done = (h: Homework) => h.result?.completedAt ?? '';
  return {
    todo: homework.filter((h) => h.status === 'assigned').sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
    submitted: homework.filter((h) => h.status === 'submitted').sort((a, b) => done(b).localeCompare(done(a))),
    reviewed: homework.filter((h) => h.status === 'reviewed').sort((a, b) => (b.feedback?.at ?? '').localeCompare(a.feedback?.at ?? '')),
    overdue: homework.filter((h) => isOverdue(h, now)),
    dueSoon: homework.filter((h) => isDueSoon(h, now)),
  };
}

/** Lessons grouped by calendar month in the viewer's zone, keeping the input order. */
export function groupByMonth(bookings: Booking[], zone = browserZone()): { key: string; label: string; items: Booking[] }[] {
  const map = new Map<string, { label: string; items: Booking[] }>();
  for (const b of bookings) {
    const key = utcIsoToZoned(b.startsAt, zone).date.slice(0, 7);
    if (!map.has(key)) map.set(key, { label: new Date(b.startsAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: zone }), items: [] });
    map.get(key)!.items.push(b);
  }
  return [...map.entries()].map(([key, v]) => ({ key, ...v }));
}

// ── Reminders (computed while the app is open; nothing is pushed) ──

export interface Reminder {
  id: string;
  tone: 'now' | 'overdue' | 'soon';
  icon: IconName;
  text: string;
  cta: string;
  go: () => void;
}

export function buildReminders(data: StudentData, now: number): Reminder[] {
  const out: Reminder[] = [];
  for (const b of data.bookings) {
    if (b.status !== 'scheduled') continue;
    const start = ms(b.startsAt);
    if (ms(bookingEnd(b)) <= now) continue;
    const go = () => navigate('student/calendar');
    if (start <= now) out.push({ id: `b-${b.id}`, tone: 'now', icon: 'video', text: `Lesson with Dina is on now (started ${fmtTime(b.startsAt)}, your time) · ${b.topic}`, cta: 'Details', go });
    else if (start - now <= HOUR) out.push({ id: `b-${b.id}`, tone: 'now', icon: 'clock', text: `Lesson with Dina in ${Math.max(1, Math.round((start - now) / 60_000))} min (${fmtTime(b.startsAt)}, your time) · ${b.topic}`, cta: 'Details', go });
    else if (start - now <= DAY) out.push({ id: `b-${b.id}`, tone: 'soon', icon: 'calendar', text: `Lesson with Dina ${whenPhrase(b.startsAt, now)} (your time) · ${b.topic}`, cta: 'Details', go });
  }
  for (const h of data.homework) {
    if (h.status !== 'assigned') continue;
    const go = () => navigate(homeworkRoute(h));
    if (isOverdue(h, now)) out.push({ id: `h-${h.id}`, tone: 'overdue', icon: 'book', text: `Overdue homework: ${h.activity.title} — was due ${relative(h.dueAt, now)}`, cta: 'Start', go });
    else if (isDueSoon(h, now)) out.push({ id: `h-${h.id}`, tone: 'soon', icon: 'book', text: `Homework due ${whenPhrase(h.dueAt, now)} · ${h.activity.title}`, cta: 'Start', go });
  }
  const rank: Record<Reminder['tone'], number> = { now: 0, overdue: 1, soon: 2 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
}

// ── Small UI pieces ─────────────────────────────────────────────

/** Shown wherever fictional sample data is on screen. */
export function DemoChip() {
  const { backend } = usePlatform();
  if (backend?.kind !== 'demo') return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-saffron-50 px-3 py-1.5 text-xs font-bold text-ink ring-1 ring-saffron/50" title="Dina, Sam and Anneka are fictional. Everything here is sample data saved on this device.">
      <Icon name="sparkle" size={13} /> Demo data
    </span>
  );
}

export type StudentPage = 'home' | 'calendar' | 'homework' | 'feedback';

export function StudentNav({ page }: { page: StudentPage }) {
  return (
    <div className="-mx-4 mb-5 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0" data-testid="student-nav">
      <Segmented
        label="Student pages"
        value={page}
        onChange={(p) => navigate(p === 'home' ? 'student' : `student/${p}`)}
        options={[{ value: 'home', label: 'Overview' }, { value: 'calendar', label: 'Lessons' }, { value: 'homework', label: 'Homework' }, { value: 'feedback', label: 'Feedback' }]}
      />
    </div>
  );
}

export function Tag({ icon, label, cls }: { icon: IconName; label: string; cls: string }) {
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}><Icon name={icon} size={12} /> {label}</span>;
}

const BOOKING_STATUS: Record<Booking['status'], { label: string; icon: IconName; cls: string }> = {
  scheduled: { label: 'Scheduled', icon: 'calendar', cls: 'bg-azul-50 text-azul' },
  completed: { label: 'Completed', icon: 'check', cls: 'bg-olive-50 text-olive' },
  cancelled: { label: 'Cancelled', icon: 'x', cls: 'bg-ink/[0.06] text-ink-mute' },
};
export function BookingStatus({ status }: { status: Booking['status'] }) {
  return <Tag {...BOOKING_STATUS[status]} />;
}

export function HomeworkStatus({ h, now }: { h: Homework; now: number }) {
  if (isOverdue(h, now)) return <Tag icon="clock" label="Overdue" cls="bg-terracotta-50 text-terracotta-dark" />;
  if (h.status === 'assigned') return isDueSoon(h, now) ? <Tag icon="clock" label="Due soon" cls="bg-saffron-50 text-ink" /> : <Tag icon="book" label="To do" cls="bg-azul-50 text-azul" />;
  if (h.status === 'submitted') return <Tag icon="send" label="Awaiting feedback" cls="bg-cream-200 text-ink-soft" />;
  return <Tag icon="star" label="Reviewed" cls="bg-olive-50 text-olive" />;
}

export const FEEDBACK_META: Record<FeedbackKind, { label: string; plural: string; icon: IconName; cls: string; blurb: string }> = {
  comment: { label: 'Comment', plural: 'Comments', icon: 'chat', cls: 'bg-azul-50 text-azul', blurb: 'Notes from your lessons' },
  correction: { label: 'Correction', plural: 'Corrections', icon: 'edit', cls: 'bg-terracotta-50 text-terracotta-dark', blurb: 'Slips to watch out for' },
  recommendation: { label: 'Recommendation', plural: 'Recommendations', icon: 'bulb', cls: 'bg-olive-50 text-olive', blurb: 'What to practise next' },
};

export function Section({ eyebrow, title, right, children, className = '' }: { eyebrow?: string; title: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-5 ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Loading({ what = 'your lessons' }: { what?: string }) {
  return <div className="card p-6 text-ink-mute" role="status">Loading {what}…</div>;
}

export function ErrorCard({ error, retry }: { error: string; retry: () => void }) {
  return (
    <div className="card p-6" role="alert">
      <p className="font-semibold">Couldn’t load this.</p>
      <p className="mt-1 text-sm text-ink-soft">{error}</p>
      <button className="ctrl mt-3" onClick={retry}><Icon name="refresh" size={15} /> Try again</button>
    </div>
  );
}

// ── Lesson details ──────────────────────────────────────────────

function Row({ icon, label, mute, children }: { icon: IconName; label: string; mute: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className={`mt-0.5 shrink-0 ${mute}`}><Icon name={icon} size={16} /></span>
      <div className="min-w-0">
        <dt className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${mute}`}>{label}</dt>
        <dd className="text-sm">{children}</dd>
      </div>
    </div>
  );
}

/** Date, time (viewer's zone + scheduling zone when different), duration, format, place, prep notes. */
export function LessonDetails({ b, dark, hideDate }: { b: Booking; dark?: boolean; hideDate?: boolean }) {
  const zone = browserZone();
  const foreign = b.tz !== zone;
  const end = bookingEnd(b);
  const mute = dark ? 'text-cream/65' : 'text-ink-mute';
  const link = isMeetingLink(b.location);
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {!hideDate && <Row icon="calendar" label="When" mute={mute}>{fmtDate(b.startsAt, zone)}</Row>}
      <Row icon="clock" label="Time · your time zone" mute={mute}>
        {fmtTime(b.startsAt, zone)}–{fmtTime(end, zone)} · {b.durationMin} min
        {foreign && <span className={`block text-xs ${mute}`}>Scheduled as {fmtTime(b.startsAt, b.tz)} in {zoneLabel(b.tz)}</span>}
      </Row>
      <Row icon={b.format === 'online' ? 'video' : 'pin'} label={b.format === 'online' ? 'Online lesson' : 'Face to face'} mute={mute}>
        {b.location.trim() ? (
          link ? <a href={b.location.trim()} target="_blank" rel="noopener noreferrer" className="break-all underline decoration-1 underline-offset-2">{b.location.trim()}</a> : b.location
        ) : <span className={mute}>{b.format === 'online' ? 'Link to be confirmed' : 'Place to be confirmed'}</span>}
      </Row>
      <Row icon="book" label="Topic" mute={mute}>{b.topic}</Row>
      {b.prepNotes.trim() && <Row icon="bulb" label="Prepare" mute={mute}>{b.prepNotes}</Row>}
    </dl>
  );
}

/** A lesson in the calendar list. */
export function LessonCard({ b, now, index = 0 }: { b: Booking; now: number; index?: number }) {
  const zone = browserZone();
  const d = new Date(b.startsAt);
  const cancelled = b.status === 'cancelled';
  const link = b.status === 'scheduled' && isMeetingLink(b.location);
  return (
    <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 6) * 0.04 }} className={`card flex gap-4 p-4 sm:p-5 ${cancelled ? 'opacity-70' : ''}`} aria-label={`${b.topic}, ${fmtDateTime(b.startsAt, zone)}, ${BOOKING_STATUS[b.status].label}`}>
      <div className="flex w-14 shrink-0 flex-col items-center justify-center self-start rounded-2xl bg-cream-100 py-2.5 text-center" aria-hidden>
        <span className="font-display text-2xl font-semibold leading-none">{d.toLocaleDateString('en-GB', { day: 'numeric', timeZone: zone })}</span>
        <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-mute">{d.toLocaleDateString('en-GB', { month: 'short', timeZone: zone })}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className={`text-lg font-semibold leading-snug ${cancelled ? 'line-through decoration-1' : ''}`}>{b.topic}</h3>
            <p className="text-sm text-ink-soft">{fmtDate(b.startsAt, zone)} · {relative(b.startsAt, now)}</p>
          </div>
          <BookingStatus status={b.status} />
        </div>
        <div className="mt-3"><LessonDetails b={b} hideDate /></div>
        {!cancelled && (
          <div className="mt-3 flex flex-wrap gap-2">
            {link && <a className="ctrl" href={b.location.trim()} target="_blank" rel="noopener noreferrer"><Icon name="video" size={15} /> Join the lesson</a>}
            <button className="ctrl" onClick={() => downloadIcs(b)}><Icon name="download" size={15} /> Add to calendar (.ics)</button>
          </div>
        )}
      </div>
    </motion.li>
  );
}

// ── Homework & feedback cards ───────────────────────────────────

export function HomeworkCard({ h, now, highlight, index = 0 }: { h: Homework; now: number; highlight?: boolean; index?: number }) {
  const kind = h.activity.kind;
  const viewable = kind === 'written' || kind === 'speaking';
  const start = () => navigate(homeworkRoute(h));
  return (
    <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 6) * 0.04 }} className={`card flex flex-col p-4 sm:p-5 ${highlight ? 'ring-2 ring-olive' : ''}`} aria-label={h.activity.title} data-testid={`hw-card-${h.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="eyebrow">{HOMEWORK_KIND_LABEL[kind]}</p>
          <h3 className="mt-0.5 text-lg font-semibold leading-snug">{h.activity.title}</h3>
          <p className="text-sm text-ink-soft">{describeActivity(h.activity)}</p>
        </div>
        <HomeworkStatus h={h} now={now} />
      </div>
      {h.activity.prompt && <p lang="es" className="mt-3 rounded-2xl bg-cream-100 px-4 py-3 font-display text-lg leading-snug">{h.activity.prompt}</p>}
      {h.instructions.trim() && <p className="mt-3 text-sm text-ink-soft"><b className="text-ink">Dina says:</b> {h.instructions}</p>}
      <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-ink-mute"><Icon name="clock" size={14} /> Due {relative(h.dueAt, now)} · {fmtDateTime(h.dueAt)}</p>
      {h.result && (
        <div className="mt-3 rounded-2xl bg-white/70 p-3 text-sm ring-1 ring-ink/5">
          <p className="eyebrow">Your result · {relative(h.result.completedAt, now)}</p>
          <p className="mt-1 font-medium">{h.result.summary ?? 'Completed'}</p>
          {h.result.text && <p lang="es" className="mt-1 line-clamp-3 text-ink-soft">{h.result.text}</p>}
        </div>
      )}
      {h.feedback && (
        <div className="mt-3 rounded-2xl bg-olive-50 p-3 text-sm">
          <p className="eyebrow !text-olive">Dina’s feedback · {relative(h.feedback.at, now)}</p>
          <p className="mt-1">{h.feedback.body}</p>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2 pt-1">
        {h.status === 'assigned' ? (
          <button className="btn-primary !py-2.5" onClick={start} data-testid={`hw-start-${h.id}`}><Icon name="play" size={16} filled /> Start</button>
        ) : (
          <>
            {viewable && <button className="btn-ghost !py-2.5" onClick={() => navigate(`homework/${h.id}`)}><Icon name="eye" size={16} /> View</button>}
            <button className="btn-soft !py-2.5" onClick={start}><Icon name="refresh" size={16} /> Redo</button>
          </>
        )}
      </div>
    </motion.article>
  );
}

export function FeedbackItem({ f, now, index = 0 }: { f: Feedback; now: number; index?: number }) {
  const m = FEEDBACK_META[f.kind];
  return (
    <motion.li initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 8) * 0.03 }} className="flex gap-3 rounded-2xl bg-white/70 p-3 ring-1 ring-ink/5">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${m.cls}`} aria-hidden><Icon name={m.icon} size={16} /></span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-ink-mute">{m.label} · {fmtDateTime(f.createdAt)} · {relative(f.createdAt, now)}</p>
        <p className="mt-0.5 text-sm leading-relaxed">{f.body}</p>
      </div>
    </motion.li>
  );
}
