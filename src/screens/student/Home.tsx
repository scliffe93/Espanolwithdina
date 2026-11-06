import { motion } from 'motion/react';
import { DinaArt } from '../../components/Dina';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/ui';
import { totalActiveSeconds } from '../../lib/analytics';
import { levelIndex } from '../../lib/assessmentScore';
import { formatMinutes } from '../../lib/dates';
import { usePlatform } from '../../lib/platform/context';
import { describeActivity, homeworkRoute } from '../../lib/platform/homework';
import { relative } from '../../lib/platform/time';
import type { Booking, Feedback } from '../../lib/platform/types';
import { resumeTarget } from '../../lib/resume';
import { navigate } from '../../lib/router';
import { mastery } from '../../lib/srs';
import { useStore } from '../../lib/store';
import { CEFR_LEVELS, SKILLS, type AppState } from '../../types';
import { downloadIcs, isMeetingLink } from './ics';
import { DemoChip, ErrorCard, FeedbackItem, HomeworkStatus, LessonDetails, Loading, Section, StudentNav, buildReminders, homeworkBuckets, nextLesson, useStudentData, type Reminder } from './shared';

// ───────────────────────────────────────────────────────────────
// Student home — "My lessons & homework": reminders, the next lesson,
// continue learning, homework at a glance, Dina's latest feedback and
// the headline numbers of the learner's journey.
// ───────────────────────────────────────────────────────────────

const NOTE = 'Reminders show here while the app is open. They can’t notify you when it’s closed — a separate notification service would be needed for that.';

function Reminders({ reminders }: { reminders: Reminder[] }) {
  if (!reminders.length) {
    return <p className="mb-4 text-sm text-ink-mute" data-testid="reminders-empty">Nothing due in the next 24 hours. {NOTE}</p>;
  }
  const tone = (t: Reminder['tone']) => (t === 'now' ? 'bg-terracotta text-white' : t === 'overdue' ? 'bg-terracotta-50 text-terracotta-dark' : 'bg-white text-ink ring-1 ring-ink/10');
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-4 rounded-3xl bg-saffron-50 p-4 ring-1 ring-saffron/40" aria-labelledby="reminders-title" data-testid="reminders">
      <p id="reminders-title" className="eyebrow mb-2 !text-ink-soft">Reminders</p>
      <ul className="grid gap-2">
        {reminders.map((r) => (
          <li key={r.id} className="flex items-center gap-3">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tone(r.tone)}`} aria-hidden><Icon name={r.icon} size={16} /></span>
            <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{r.text}</span>
            <button className="ctrl shrink-0" onClick={r.go}>{r.cta} <Icon name="arrowRight" size={13} /></button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-mute">{NOTE}</p>
    </motion.section>
  );
}

function NextLesson({ b, now }: { b?: Booking; now: number }) {
  if (!b) {
    return (
      <section className="card flex flex-col p-5" data-testid="next-lesson-empty">
        <p className="eyebrow">My next lesson</p>
        <h2 className="mt-1 text-xl font-semibold">Nothing booked yet</h2>
        <p className="mt-1 text-sm text-ink-soft">When Dina books your next lesson it appears here with the time, the link or address and what to prepare.</p>
        <button className="ctrl mt-4 self-start" onClick={() => navigate('student/calendar')}><Icon name="calendar" size={15} /> All lessons</button>
      </section>
    );
  }
  const live = new Date(b.startsAt).getTime() <= now;
  const link = isMeetingLink(b.location);
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-4xl bg-ink p-5 text-cream shadow-lift sm:p-6" aria-labelledby="next-lesson-title" data-testid="next-lesson">
      <div className="pointer-events-none absolute -right-3 -top-3 hidden opacity-90 sm:block" aria-hidden><DinaArt size={96} expression="beam" /></div>
      <p className="eyebrow !text-saffron-light">My next lesson · {live ? 'happening now' : relative(b.startsAt, now)}</p>
      <h2 id="next-lesson-title" className="mt-1 max-w-[20ch] font-display text-3xl font-semibold leading-tight sm:pr-24 sm:text-4xl">{b.topic}</h2>
      <div className="mt-4"><LessonDetails b={b} dark /></div>
      <div className="mt-5 flex flex-wrap gap-2">
        {link && <a className="btn-primary !py-2.5" href={b.location.trim()} target="_blank" rel="noopener noreferrer"><Icon name="video" size={16} /> Join the lesson</a>}
        <button className="btn-ghost !py-2.5" onClick={() => downloadIcs(b)} data-testid="add-to-calendar"><Icon name="download" size={16} /> Add to calendar</button>
        <button className="btn-ghost !py-2.5" onClick={() => navigate('student/calendar')}>All lessons <Icon name="arrowRight" size={14} /></button>
      </div>
    </motion.section>
  );
}

function ContinueLearning({ state }: { state: AppState }) {
  const resume = state.onboardingDone ? resumeTarget(state) : null;
  return (
    <section className="card flex flex-col p-5" data-testid="continue-learning">
      <p className="eyebrow">Continue learning</p>
      {resume ? (
        <>
          <h2 className="mt-1 text-xl font-semibold leading-snug">{resume.label}</h2>
          <p className="mt-1 text-sm text-ink-soft">Pick up where you left off, or the next chapter in your city.</p>
          <button className="btn-primary mt-4 self-start sm:mt-auto" onClick={() => navigate(resume.href)}><Icon name="play" size={18} filled /> Continue</button>
        </>
      ) : (
        <>
          <h2 className="mt-1 text-xl font-semibold">Set up your learner profile</h2>
          <p className="mt-1 text-sm text-ink-soft">A two-minute setup unlocks your city, the story chapters, the verb gym and the arcade.</p>
          <button className="btn-primary mt-4 self-start sm:mt-auto" onClick={() => navigate('welcome')}>Get started <Icon name="arrowRight" size={16} /></button>
        </>
      )}
    </section>
  );
}

function HomeworkGlance({ buckets, now }: { buckets: ReturnType<typeof homeworkBuckets>; now: number }) {
  const tiles = [
    { label: 'Due soon', value: buckets.dueSoon.length },
    { label: 'Overdue', value: buckets.overdue.length },
    { label: 'Awaiting feedback', value: buckets.submitted.length },
    { label: 'Reviewed', value: buckets.reviewed.length },
  ];
  return (
    <Section eyebrow="Deberes" title="My homework" right={<button className="ctrl" onClick={() => navigate('student/homework')}>All homework <Icon name="arrowRight" size={13} /></button>}>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl bg-cream-100 p-3">
            <dd className="font-display text-2xl font-semibold tabular-nums">{t.value}</dd>
            <dt className="text-xs text-ink-mute">{t.label}</dt>
          </div>
        ))}
      </dl>
      {buckets.todo.length ? (
        <ul className="mt-3 grid gap-2">
          {buckets.todo.slice(0, 3).map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/70 p-3 ring-1 ring-ink/5 sm:flex-nowrap">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{h.activity.title}</p>
                <p className="text-xs text-ink-mute">{describeActivity(h.activity)} · due {relative(h.dueAt, now)}</p>
              </div>
              <HomeworkStatus h={h} now={now} />
              <button className="btn-primary !px-4 !py-2 text-sm" onClick={() => navigate(homeworkRoute(h))} data-testid={`hw-start-${h.id}`}>Start</button>
            </li>
          ))}
          {buckets.todo.length > 3 && <li className="text-sm text-ink-mute">+ {buckets.todo.length - 3} more to do</li>}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-mute">Nothing to do right now. New homework from Dina appears here.</p>
      )}
    </Section>
  );
}

function LatestFeedback({ list, now }: { list: Feedback[]; now: number }) {
  return (
    <Section eyebrow="De Dina" title="Feedback from Dina" right={<button className="ctrl" onClick={() => navigate('student/feedback')}>All feedback <Icon name="arrowRight" size={13} /></button>}>
      {list.length ? <ul className="grid gap-2">{list.map((f, i) => <FeedbackItem key={f.id} f={f} now={now} index={i} />)}</ul> : <p className="text-sm text-ink-mute">No feedback yet. After a lesson or a reviewed homework, Dina’s notes appear here.</p>}
    </Section>
  );
}

function journeyNumbers(state: AppState) {
  const p = state.profile;
  const idx = p ? SKILLS.map((s) => levelIndex(p.levels[s])).sort((a, b) => a - b) : [];
  return {
    level: p ? CEFR_LEVELS[idx[Math.floor(idx.length / 2)]] : '—',
    active: formatMinutes(totalActiveSeconds(state)),
    lessons: Object.values(state.days).reduce((a, d) => a + d.lessonsCompleted, 0),
    vocab: Object.values(state.srs).filter((c) => c.key.startsWith('vocab:') && mastery(c) === 'mastered').length,
  };
}

function Journey({ state }: { state: AppState }) {
  const n = journeyNumbers(state);
  const nums = [
    { label: 'Current level', value: n.level },
    { label: 'Active learning', value: n.active },
    { label: 'Lessons completed', value: String(n.lessons) },
    { label: 'Vocabulary mastered', value: String(n.vocab) },
  ];
  return (
    <section className="card mt-4 p-5" data-testid="journey-summary">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Mi camino</p>
          <h2 className="text-xl font-semibold">My learning journey</h2>
        </div>
        <button className="btn-dark !py-2.5" onClick={() => navigate('journey')} disabled={!state.onboardingDone}>Open my journey <Icon name="arrowRight" size={16} /></button>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {nums.map((x) => (
          <div key={x.label} className="rounded-2xl bg-cream-100 p-4">
            <dt className="eyebrow">{x.label}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold tabular-nums">{x.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-ink-mute">Computed from what you’ve actually done in the app — chapters, the verb gym, memory reviews and games.</p>
    </section>
  );
}

export function Home() {
  const { me } = usePlatform();
  const { state } = useStore();
  const { data, loading, error, reload } = useStudentData();
  const now = Date.now();
  const name = me?.firstName?.trim() || 'there';

  return (
    <div data-testid="student-home">
      <PageHeader eyebrow="Mis clases · My lessons & homework" title={`Hola, ${name}`} subtitle="Your lessons with Dina, your homework and her feedback — all in one place." right={<DemoChip />} />
      <StudentNav page="home" />
      {error && <ErrorCard error={error} retry={reload} />}
      {!error && loading && !data && <Loading />}
      {data && (
        <>
          <Reminders reminders={buildReminders(data, now)} />
          <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
            <NextLesson b={nextLesson(data.bookings, now)} now={now} />
            <ContinueLearning state={state} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <HomeworkGlance buckets={homeworkBuckets(data.homework, now)} now={now} />
            <LatestFeedback list={data.feedback.slice(0, 3)} now={now} />
          </div>
          <Journey state={state} />
        </>
      )}
    </div>
  );
}
