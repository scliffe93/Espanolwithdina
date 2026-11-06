import { motion } from 'motion/react';
import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/ui';
import { usePlatformQuery } from '../../lib/platform/context';
import { fmtDateTime } from '../../lib/platform/time';
import { BookingForm } from './BookingForm';
import { HomeworkAssignForm } from './HomeworkAssignForm';
import { pct, studentInsight, studyAgo } from './insights';
import { Avatar, DemoChip, Loading, openStudent, toneFor, useStudents, useViewZone } from './shared';

/** Both students at a glance. */
export function Students() {
  const [zone] = useViewZone();
  const students = useStudents();
  const homework = usePlatformQuery((b) => b.homework());
  const bookings = usePlatformQuery((b) => b.bookings({ from: new Date(Date.now() - 86_400_000).toISOString() }));
  const [booking, setBooking] = useState<string | null>(null);
  const [assign, setAssign] = useState<string | null>(null);
  const people = students.data?.people ?? [];
  const progress = students.data?.progress ?? {};
  const ready = students.data && homework.data && bookings.data;

  return (
    <div>
      <PageHeader eyebrow="Alumnos" title="Students" subtitle={<span className="inline-flex flex-wrap items-center gap-2">How each learner is doing this week, from their own app activity. <DemoChip /></span>} />
      {!ready ? <Loading label="Loading students…" /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {people.map((p, idx) => {
            const i = studentInsight(p, progress[p.id] ?? null, homework.data ?? [], bookings.data ?? []);
            const tone = toneFor(people, p.id);
            return (
              <motion.article key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className={`card overflow-hidden ring-1 ${tone.ring}`} aria-label={p.firstName}>
                <div className={`flex items-center gap-4 p-5 ${tone.soft}`}>
                  <Avatar name={p.firstName} tone={tone} size={56} />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-3xl font-semibold leading-none">{p.firstName}</h2>
                    <p className="mt-1 text-sm text-ink-soft">{i.level ? <b className={tone.text}>{i.level}</b> : 'No level yet'}{i.cityName ? ` · ${i.cityName}` : ''}{i.state?.profile ? ` · goal ${i.state.profile.dailyMinutes} min/day` : ''}</p>
                  </div>
                  {i.support.length > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-terracotta px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white"><Icon name="info" size={12} /> Needs support</span>}
                </div>
                <div className="grid grid-cols-2 gap-3 p-5 text-sm">
                  <Mini label="Last study day" value={studyAgo(i.daysSinceStudy)} sub={i.streak ? `${i.streak}-day streak` : undefined} />
                  <Mini label="This week" value={`${i.weekMinutes} min`} sub={i.weekAccuracy !== null ? `${pct(i.weekAccuracy)} accuracy · ${i.weekStudyDays} day${i.weekStudyDays === 1 ? '' : 's'}` : 'no exercises yet'} />
                  <Mini label="Homework" value={`${i.pending.length} pending`} sub={`${i.awaiting.length} awaiting review${i.overdue.length ? ` · ${i.overdue.length} overdue` : ''}`} />
                  <Mini label="Next lesson" value={i.nextLesson ? fmtDateTime(i.nextLesson.startsAt, zone) : 'none booked'} sub={i.nextLesson?.topic} />
                </div>
                {i.support.length > 0 && (
                  <ul className="mx-5 mb-4 grid gap-1 rounded-2xl bg-terracotta-50 p-3 text-sm text-ink-soft">
                    {i.support.map((s) => <li key={s} className="flex gap-2"><Icon name="info" size={15} className="mt-0.5 shrink-0 text-terracotta" /> {s}</li>)}
                  </ul>
                )}
                <div className="flex flex-wrap gap-2 px-5 pb-5">
                  <button type="button" className="btn-dark !py-2.5" onClick={() => openStudent(p.id)} data-testid={`open-student-${p.firstName.toLowerCase()}`}>Open profile <Icon name="arrowRight" size={16} /></button>
                  <button type="button" className="ctrl" onClick={() => setBooking(p.id)}><Icon name="calendar" size={14} /> Book a lesson</button>
                  <button type="button" className="ctrl" onClick={() => setAssign(p.id)}><Icon name="book" size={14} /> Assign homework</button>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
      <BookingForm open={!!booking} onClose={() => setBooking(null)} people={people} prefill={{ studentId: booking ?? undefined }} viewZone={zone} />
      <HomeworkAssignForm open={!!assign} onClose={() => setAssign(null)} people={people} progress={progress} initialStudentIds={assign ? [assign] : undefined} viewZone={zone} />
    </div>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-cream-100 p-3">
      <p className="eyebrow !text-[10px]">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
      {sub && <p className="text-xs text-ink-mute">{sub}</p>}
    </div>
  );
}
