import { motion } from 'motion/react';
import { InvoiceNudge } from './InvoiceNudge';
import { useMemo, useState } from 'react';
import { DinaArt } from '../../components/Dina';
import { Icon } from '../../components/Icon';
import { usePlatform, usePlatformQuery } from '../../lib/platform/context';
import { fmtDate, utcIsoToZoned, zoneLabel } from '../../lib/platform/time';
import type { Booking, Homework } from '../../lib/platform/types';
import { navigate } from '../../lib/router';
import { useStore } from '../../lib/store';
import { BookingForm, type BookingPrefill } from './BookingForm';
import { HomeworkAssignForm } from './HomeworkAssignForm';
import { HomeworkReview } from './HomeworkReview';
import { dayRangeUtc, placeInZone, shiftDate, todayIn } from './calendarMath';
import { studentInsight, studyAgo } from './insights';
import { ActivityList, Avatar, ConfirmButton, DemoChip, ErrorText, HomeworkRow, LessonCard, Loading, Section, openStudent, toneFor, useAction, useStudents, useViewZone } from './shared';

function greeting(hour: number): string {
  if (hour < 6) return 'Buenas noches';
  if (hour < 13) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Dina's home: today's lessons, the week ahead, homework to review, who needs support, what students did. */
export function Today() {
  const { backend, me } = usePlatform();
  const { notify } = useStore();
  const [zone] = useViewZone();
  const nowIso = new Date().toISOString();
  const today = todayIn(zone);
  const range = useMemo(() => dayRangeUtc(today, shiftDate(today, 7), zone), [today, zone]);
  const students = useStudents();
  const bookings = usePlatformQuery((b) => b.bookings({ from: range.from, to: range.to }), [range.from, range.to]);
  const homework = usePlatformQuery((b) => b.homework());
  const activity = usePlatformQuery((b) => b.activity({ limit: 12 }));
  const { run, busy, error } = useAction();
  const [booking, setBooking] = useState<{ open: boolean; edit?: Booking; prefill?: BookingPrefill }>({ open: false });
  const [assign, setAssign] = useState<{ open: boolean; ids?: string[] }>({ open: false });
  const [review, setReview] = useState<Homework | null>(null);

  const people = students.data?.people ?? [];
  const progress = students.data?.progress ?? {};
  const todays = (bookings.data ?? []).filter((b) => placeInZone(b.startsAt, zone).date === today);
  const upcoming = (bookings.data ?? []).filter((b) => placeInZone(b.startsAt, zone).date > today && b.status === 'scheduled');
  const awaiting = (homework.data ?? []).filter((h) => h.status === 'submitted').sort((a, b) => (b.result?.completedAt ?? '').localeCompare(a.result?.completedAt ?? ''));
  const insights = people.map((p) => studentInsight(p, progress[p.id] ?? null, homework.data ?? [], bookings.data ?? []));
  const needSupport = insights.filter((i) => i.support.length);
  const hour = Number(utcIsoToZoned(nowIso, zone).time.slice(0, 2));

  const setStatus = async (b: Booking, status: Booking['status'], title: string) => {
    if (!backend) return;
    const saved = await run(() => (status === 'cancelled' ? backend.cancelBooking(b.id) : backend.updateBooking(b.id, { status })), people, zone);
    if (saved) notify(title, saved.topic);
  };

  const lessonActions = (b: Booking) => (
    <>
      <button type="button" className="ctrl" onClick={() => openStudent(b.studentId)}><Icon name="user" size={14} /> Open student</button>
      {b.status === 'scheduled' && <button type="button" className="ctrl" disabled={busy} onClick={() => setStatus(b, 'completed', 'Lesson marked as completed')}><Icon name="check" size={14} /> Mark completed</button>}
      {b.status === 'scheduled' && <ConfirmButton confirmLabel="Yes, cancel" disabled={busy} onConfirm={() => setStatus(b, 'cancelled', 'Lesson cancelled')}><Icon name="x" size={14} /> Cancel</ConfirmButton>}
    </>
  );

  return (
    <div>
      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <DinaArt size={76} expression="beam" />
          <div>
            <p className="eyebrow mb-1">{fmtDate(nowIso, zone)} · {zoneLabel(zone)}</p>
            <h1 className="text-[32px] font-semibold leading-[1.05] sm:text-[40px]">{greeting(hour)}, {me?.firstName ?? 'Dina'}</h1>
            <p className="mt-1 text-ink-soft" aria-live="polite">
              {bookings.data ? `${todays.length} lesson${todays.length === 1 ? '' : 's'} today` : 'Loading your day…'}
              {homework.data ? ` · ${awaiting.length} homework to review` : ''}
              {needSupport.length ? ` · ${needSupport.length} student${needSupport.length === 1 ? '' : 's'} to check on` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DemoChip />
          <button type="button" className="btn-primary" onClick={() => setBooking({ open: true })} data-testid="book-lesson"><Icon name="calendar" size={18} /> Book a lesson</button>
          <button type="button" className="btn-ghost" onClick={() => setAssign({ open: true })} data-testid="assign-homework"><Icon name="book" size={18} /> Assign homework</button>
        </div>
      </motion.header>
      <InvoiceNudge />

      <ErrorText error={error} />

      <div className="mt-2 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="grid content-start gap-4">
          <Section title="Today’s lessons" eyebrow="Hoy" right={<button type="button" className="ctrl" onClick={() => navigate('teach/calendar')}><Icon name="calendar" size={14} /> Calendar</button>}>
            {!bookings.data ? <Loading /> : todays.length ? (
              <div className="grid gap-2">
                {todays.map((b) => <LessonCard key={b.id} b={b} people={people} zone={zone} onEdit={(x) => setBooking({ open: true, edit: x })} actions={lessonActions(b)} />)}
              </div>
            ) : (
              <p className="text-sm text-ink-mute">No lessons today. <button type="button" className="font-semibold text-terracotta underline-offset-2 hover:underline" onClick={() => setBooking({ open: true })}>Book one</button> or enjoy the quiet.</p>
            )}
          </Section>

          <Section title="Next 7 days" eyebrow="Upcoming">
            {!bookings.data ? <Loading /> : upcoming.length ? (
              <div className="grid gap-2">
                {upcoming.map((b) => <LessonCard key={b.id} b={b} people={people} zone={zone} compact onEdit={(x) => setBooking({ open: true, edit: x })} />)}
              </div>
            ) : <p className="text-sm text-ink-mute">Nothing booked for the coming week yet.</p>}
          </Section>

          <Section title="Homework awaiting review" eyebrow="Deberes" right={awaiting.length ? <span className="rounded-full bg-saffron px-2.5 py-1 text-xs font-bold text-ink">{awaiting.length}</span> : undefined}>
            {!homework.data ? <Loading /> : awaiting.length ? (
              <div className="grid gap-2">{awaiting.map((h) => <HomeworkRow key={h.id} h={h} people={people} zone={zone} onOpen={setReview} />)}</div>
            ) : <p className="text-sm text-ink-mute">All caught up — nothing submitted that you haven’t reviewed. <button type="button" className="font-semibold text-terracotta underline-offset-2 hover:underline" onClick={() => navigate('teach/homework')}>See all homework</button></p>}
          </Section>
        </div>

        <div className="grid content-start gap-4">
          <Section title="Students needing support" eyebrow="Check in">
            {!students.data || !homework.data || !bookings.data ? <Loading /> : needSupport.length ? (
              <ul className="grid gap-2">
                {needSupport.map((i) => {
                  const tone = toneFor(people, i.person.id);
                  return (
                    <li key={i.person.id} className={`rounded-2xl p-3 ring-1 ${tone.ring} bg-white`}>
                      <div className="flex items-center gap-3">
                        <Avatar name={i.person.firstName} tone={tone} size={36} />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{i.person.firstName} <span className="text-xs font-medium text-ink-mute">· last studied {studyAgo(i.daysSinceStudy)}</span></p>
                        </div>
                        <button type="button" className="ctrl" onClick={() => openStudent(i.person.id)} aria-label={`Open ${i.person.firstName}’s profile`}><Icon name="arrowRight" size={14} /></button>
                      </div>
                      <ul className="mt-2 grid gap-1 text-sm text-ink-soft">
                        {i.support.map((s) => <li key={s} className="flex gap-2"><Icon name="info" size={15} className="mt-0.5 shrink-0 text-terracotta" /> {s}</li>)}
                      </ul>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button type="button" className="ctrl" onClick={() => setAssign({ open: true, ids: [i.person.id] })}><Icon name="book" size={14} /> Assign homework</button>
                        <button type="button" className="ctrl" onClick={() => setBooking({ open: true, prefill: { studentId: i.person.id } })}><Icon name="calendar" size={14} /> Book a lesson</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-sm text-ink-mute"><Icon name="check" size={14} className="mr-1 inline text-olive" />Everyone is on track: studying regularly, accuracy above 60%, no overdue homework.</p>}
          </Section>

          <Section title="Recent student activity" eyebrow="Live from the app">
            {!activity.data ? <Loading /> : <ActivityList events={activity.data} people={people} />}
          </Section>
        </div>
      </div>

      <BookingForm open={booking.open} onClose={() => setBooking({ open: false })} people={people} booking={booking.edit} prefill={booking.prefill} viewZone={zone} />
      <HomeworkAssignForm open={assign.open} onClose={() => setAssign({ open: false })} people={people} progress={progress} initialStudentIds={assign.ids} viewZone={zone} />
      <HomeworkReview homework={review} people={people} viewZone={zone} onClose={() => setReview(null)} />
    </div>
  );
}
