import { motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { BarChart } from '../../components/BarChart';
import { Icon } from '../../components/Icon';
import { Bar, Empty, Segmented, achievementIcon } from '../../components/ui';
import { CITY_ORDER, CITY_THEMES } from '../../data/cityThemes';
import { scenesForCity } from '../../data/story';
import { TENSES } from '../../data/verbs';
import { ACHIEVEMENTS } from '../../lib/achievements';
import { allVerbMastery, currentStreak, totalActiveSeconds, weekSummary } from '../../lib/analytics';
import { addDays, dayKey, formatMinutes, weekStart } from '../../lib/dates';
import { usePlatform, usePlatformQuery, type AppState } from '../../lib/platform/context';
import { fmtDateTime, relative } from '../../lib/platform/time';
import type { Booking, Feedback, FeedbackKind, Homework, Role } from '../../lib/platform/types';
import { buildTeacherReport } from '../../lib/report';
import { navigate } from '../../lib/router';
import { mastery } from '../../lib/srs';
import { useStore } from '../../lib/store';
import { SKILLS } from '../../types';
import { BookingForm } from './BookingForm';
import { HomeworkAssignForm } from './HomeworkAssignForm';
import { HomeworkReview } from './HomeworkReview';
import { AnalyticsTab } from './AnalyticsTab';
import { DebriefForm } from './DebriefForm';
import { pct, studentInsight, studyAgo } from './insights';
import { ActivityList, Avatar, ConfirmButton, DemoChip, ErrorText, Field, HomeworkRow, LessonCard, Loading, Section, Stat, toneFor, useAction, useStudents, useViewZone } from './shared';

type Tab = 'journey' | 'analytics' | 'lessons' | 'homework' | 'feedback' | 'activity';
const TABS: { value: Tab; label: string }[] = [
  { value: 'journey', label: 'Journey' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'lessons', label: 'Lessons' },
  { value: 'homework', label: 'Homework' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'activity', label: 'Activity' },
];
const FEEDBACK_KIND: { value: FeedbackKind; label: string }[] = [
  { value: 'comment', label: 'Comment' },
  { value: 'correction', label: 'Correction' },
  { value: 'recommendation', label: 'Recommendation' },
];

/** One student in full: learning journey, lessons, homework, feedback and recent activity. */
export function StudentProfile({ id, params }: { id: string; params: URLSearchParams }) {
  const [zone] = useViewZone();
  const students = useStudents();
  const bookings = usePlatformQuery((b) => b.bookings({ studentId: id, includeCancelled: true }), [id]);
  const homework = usePlatformQuery((b) => b.homework({ studentId: id }), [id]);
  const feedback = usePlatformQuery((b) => b.feedback(id), [id]);
  const activity = usePlatformQuery((b) => b.activity({ studentId: id, limit: 40 }), [id]);
  const [booking, setBooking] = useState<{ open: boolean; edit?: Booking }>({ open: false });
  const [assign, setAssign] = useState(false);
  const [review, setReview] = useState<Homework | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [debrief, setDebrief] = useState(false);
  const downloadPdf = async () => {
    if (!state) return;
    setPdfBusy(true);
    try {
      const { downloadReportPdf } = await import('../../lib/pdf');
      downloadReportPdf(buildTeacherReport(state, Date.now(), { homework: homework.data ?? [] }));
    } finally { setPdfBusy(false); }
  };

  const tabParam = params.get('tab');
  const tab: Tab = TABS.some((t) => t.value === tabParam) ? (tabParam as Tab) : 'journey';
  const setTab = (t: Tab) => navigate(`teach/student/${id}${t === 'journey' ? '' : `?tab=${t}`}`);

  const people = students.data?.people ?? [];
  const person = people.find((p) => p.id === id);
  const state = students.data?.progress[id] ?? null;

  if (!students.data) return <Loading label="Loading student…" />;
  if (!person) return <Empty icon="user" title="Student not found" body="This student isn’t in your workspace." action={<button type="button" className="btn-dark" onClick={() => navigate('teach/students')}>All students</button>} />;

  const tone = toneFor(people, id);
  const insight = studentInsight(person, state, homework.data ?? [], bookings.data ?? []);
  const p = state?.profile ?? null;

  return (
    <div>
      <button type="button" className="ctrl mb-4" onClick={() => navigate('teach/students')}><Icon name="arrowLeft" size={14} /> All students</button>
      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`card overflow-hidden ring-1 ${tone.ring}`}>
        <div className={`flex flex-wrap items-center gap-4 p-5 ${tone.soft}`}>
          <Avatar name={person.firstName} tone={tone} size={64} />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Student{insight.cityName ? ` · ${insight.cityName}` : ''}{p ? ` · ${CITY_THEMES[p.city].varietyLabel}` : ''}</p>
            <h1 className="font-display text-4xl font-semibold leading-none">{person.firstName}</h1>
            <p className="mt-1.5 text-sm text-ink-soft">
              {insight.level ? <><b className={tone.text}>{insight.level}</b> overall</> : 'No learning data yet'}
              {p ? ` · goal ${p.dailyMinutes} min/day · last studied ${studyAgo(insight.daysSinceStudy)}` : ''}
              {state && insight.streak > 0 ? ` · ${insight.streak}-day streak` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DemoChip />
            <button type="button" className="btn-primary !py-2.5" onClick={() => setDebrief(true)} data-testid="lesson-debrief"><Icon name="edit" size={16} /> Lesson debrief &amp; week plan</button>
            <button type="button" className="btn-ghost !py-2.5" onClick={() => setBooking({ open: true })}><Icon name="calendar" size={16} /> Book a lesson</button>
            <button type="button" className="btn-ghost !py-2.5" onClick={() => setAssign(true)}><Icon name="book" size={16} /> Assign homework</button>
          </div>
        </div>
        {p && (
          <div className="grid grid-cols-3 gap-2 p-4 sm:grid-cols-6">
            {SKILLS.map((s) => (
              <div key={s} className="rounded-2xl bg-cream-100 p-2 text-center">
                <p className={`font-display text-xl font-semibold ${tone.text}`}>{p.levels[s]}</p>
                <p className="text-[10px] uppercase tracking-wider text-ink-mute">{s}</p>
              </div>
            ))}
          </div>
        )}
        {insight.support.length > 0 && (
          <ul className="mx-4 mb-4 grid gap-1 rounded-2xl bg-terracotta-50 p-3 text-sm text-ink-soft" aria-label="Needs support">
            {insight.support.map((s) => <li key={s} className="flex gap-2"><Icon name="info" size={15} className="mt-0.5 shrink-0 text-terracotta" /> {s}</li>)}
          </ul>
        )}
      </motion.header>

      <div className="my-5 overflow-x-auto scrollbar-none"><Segmented label="Profile section" value={tab} onChange={setTab} options={TABS} /></div>

      {tab === 'journey' && (state ? <JourneyTab state={state} name={person.firstName} /> : <Empty icon="chart" title={`No learning data for ${person.firstName} yet`} body="Their journey appears here as soon as they complete a chapter, a verb session or a game in the app." />)}
      {tab === 'analytics' && (state ? <AnalyticsTab state={state} homework={homework.data ?? []} name={person.firstName} onDownload={downloadPdf} busy={pdfBusy} /> : <Empty icon="chart" title={`No learning data for ${person.firstName} yet`} body="Analytics appear once they have used the app." />)}
      {tab === 'lessons' && <LessonsTab bookings={bookings.data} people={people} zone={zone} onEdit={(b) => setBooking({ open: true, edit: b })} onBook={() => setBooking({ open: true })} />}
      {tab === 'homework' && <HomeworkTab homework={homework.data} people={people} zone={zone} onOpen={setReview} onAssign={() => setAssign(true)} />}
      {tab === 'feedback' && <FeedbackTab studentId={id} name={person.firstName} feedback={feedback.data} zone={zone} />}
      {tab === 'activity' && (
        <Section title="Recent activity" eyebrow="From the app">
          {!activity.data ? <Loading /> : <ActivityList events={activity.data} people={people} showStudent={false} empty={`${person.firstName} hasn’t done anything on the platform yet.`} />}
        </Section>
      )}

      <BookingForm open={booking.open} onClose={() => setBooking({ open: false })} people={people} booking={booking.edit} prefill={{ studentId: id }} viewZone={zone} />
      <DebriefForm open={debrief} onClose={() => setDebrief(false)} student={person} state={state} homework={homework.data ?? []} />
      <HomeworkAssignForm open={assign} onClose={() => setAssign(false)} people={people} progress={students.data.progress} initialStudentIds={[id]} viewZone={zone} />
      <HomeworkReview homework={review} people={people} viewZone={zone} onClose={() => setReview(null)} />
    </div>
  );
}

// ── Journey ─────────────────────────────────────────────────────

function JourneyTab({ state, name }: { state: AppState; name: string }) {
  const p = state.profile;
  const days = Object.values(state.days);
  const seconds = totalActiveSeconds(state);
  const lessons = days.reduce((a, d) => a + d.lessonsCompleted, 0);
  const vocabCards = Object.values(state.srs).filter((c) => c.key.startsWith('vocab:'));
  const vocabMastered = vocabCards.filter((c) => mastery(c) === 'mastered').length;
  const vocabLearning = vocabCards.filter((c) => c.attempts > 0 && mastery(c) !== 'mastered').length;
  const speaking = days.reduce((a, d) => a + d.speakingAttempts, 0);
  const listening = days.reduce((a, d) => a + d.listeningSeconds, 0);
  const studyDays = days.filter((d) => d.activeSeconds >= 60).length;
  const region = p?.region ?? 'spain';
  const practised = allVerbMastery(state, 'present', region).filter((m) => m.attempts > 0);
  const rated = practised.filter((m) => m.attempts >= 3);
  const weakest = [...rated].sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0) || b.attempts - a.attempts).slice(0, 5);
  const strongest = [...rated].sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0) || b.attempts - a.attempts).slice(0, 5);
  const mastered = practised.filter((m) => m.level === 'mastered').length;
  const familiar = practised.filter((m) => m.level === 'familiar').length;
  const tenses = TENSES.map((t) => {
    const ms = allVerbMastery(state, t.id, region).filter((m) => m.attempts > 0);
    const attempts = ms.reduce((a, m) => a + m.attempts, 0);
    const correct = ms.reduce((a, m) => a + (m.accuracy ?? 0) * m.attempts, 0);
    return { ...t, verbs: ms.length, accuracy: attempts ? correct / attempts : null };
  }).filter((t) => t.verbs > 0);
  const report = buildTeacherReport(state);
  const history = [5, 4, 3, 2, 1, 0].map((b) => {
    const s = addDays(weekStart(), -7 * b);
    const w = weekSummary(state, s);
    return { label: b === 0 ? 'This wk' : s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), value: Math.round(w.activeSeconds / 60), note: w.accuracy !== null ? `${pct(w.accuracy)} accuracy` : undefined };
  });
  const cities = CITY_ORDER.filter((c) => c === p?.city || scenesForCity(c).some((s) => state.story.completedScenes.includes(s.id)));
  const unlocked = state.achievements.map((a) => ({ def: ACHIEVEMENTS.find((x) => x.id === a.id), at: a.at })).filter((a): a is { def: (typeof ACHIEVEMENTS)[number]; at: number } => !!a.def).sort((a, b) => b.at - a.at);
  const goal = (p?.dailyMinutes ?? 10) * 60;
  const todaySec = state.days[dayKey()]?.activeSeconds ?? 0;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Active learning" value={seconds < 3600 ? `${Math.round(seconds / 60)} min` : `${(seconds / 3600).toFixed(1)} h`} sub="focused study time only" />
        <Stat label="Lessons completed" value={String(lessons)} sub="chapters, sessions & games" />
        <Stat label="Vocabulary" value={String(vocabMastered)} sub={`mastered · ${vocabLearning} being learned`} />
        <Stat label="Verbs" value={String(practised.length)} sub={`${mastered} mastered · ${familiar} familiar`} />
        <Stat label="Speaking" value={String(speaking)} sub="recordings & spoken replies" />
        <Stat label="Listening" value={formatMinutes(listening)} sub="with audio playing" />
        <Stat label="Study days" value={String(studyDays)} sub={`${currentStreak(state)}-day streak`} />
        <Stat label="Achievements" value={`${state.achievements.length}/${ACHIEVEMENTS.length}`} sub={unlocked[0] ? `latest: ${unlocked[0].def.title}` : 'none yet'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Section title="Active minutes per week" eyebrow="Momentum">
          <BarChart title={`${name}’s active learning minutes per week, last six weeks`} unit="min" data={history} highlightLast height={130} />
          <div className="mt-4">
            <p className="eyebrow mb-1">Daily goal today · {Math.floor(todaySec / 60)} of {p?.dailyMinutes ?? 10} min</p>
            <Bar value={todaySec / goal} />
          </div>
        </Section>
        <Section title="This week" eyebrow={report.rangeLabel}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-ink-mute">Active time</dt><dd className="font-semibold tabular-nums">{formatMinutes(report.week.activeSeconds)}</dd>
            <dt className="text-ink-mute">Study days</dt><dd className="font-semibold tabular-nums">{report.week.studyDays}/7</dd>
            <dt className="text-ink-mute">Accuracy</dt><dd className="font-semibold tabular-nums">{pct(report.week.accuracy)} <span className="font-normal text-ink-mute">({report.week.exercisesAttempted} exercises)</span></dd>
            <dt className="text-ink-mute">Delayed recall</dt><dd className="font-semibold tabular-nums">{pct(report.week.retention)} <span className="font-normal text-ink-mute">({report.week.retentionAttempts} items)</span></dd>
            <dt className="text-ink-mute">Speaking</dt><dd className="font-semibold tabular-nums">{report.week.speakingAttempts}</dd>
            <dt className="text-ink-mute">New vocabulary</dt><dd className="font-semibold tabular-nums">{report.newVocab.length}</dd>
          </dl>
          {report.newVocab.length > 0 && <p className="mt-2 text-xs text-ink-mute">{report.newVocab.slice(0, 12).join(', ')}{report.newVocab.length > 12 ? '…' : ''}</p>}
        </Section>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Verbs to work on" eyebrow="Lowest accuracy · present tense">
          {weakest.length ? <VerbList items={weakest} /> : <p className="text-sm text-ink-mute">Not enough verb practice yet (3+ attempts per verb needed).</p>}
        </Section>
        <Section title="Strongest verbs" eyebrow="Highest accuracy · present tense">
          {strongest.length ? <VerbList items={strongest} /> : <p className="text-sm text-ink-mute">Not enough verb practice yet.</p>}
          {tenses.length > 0 && (
            <ul className="mt-3 grid gap-1 border-t border-ink/5 pt-3 text-sm">
              {tenses.map((t) => <li key={t.id} className="flex justify-between"><span>{t.label} <span className="text-ink-mute">({t.es})</span></span><span className="tabular-nums text-ink-soft">{t.verbs} verbs · {pct(t.accuracy)}</span></li>)}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Storyline progression" eyebrow="Chapters by city">
        <div className="grid gap-3 md:grid-cols-2">
          {cities.map((c) => {
            const sc = scenesForCity(c);
            const done = sc.filter((s) => state.story.completedScenes.includes(s.id)).length;
            return (
              <div key={c} className={`rounded-2xl p-3 ring-1 ${c === p?.city ? 'bg-terracotta-50 ring-terracotta/30' : 'bg-cream-100 ring-transparent'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{CITY_THEMES[c].name}{c === p?.city && <span className="ml-2 text-xs font-medium text-terracotta">current city</span>}</p>
                  <span className="text-sm text-ink-mute">{done}/{sc.length} chapters</span>
                </div>
                <div className="mt-2 flex gap-1.5">
                  {sc.map((s) => {
                    const ok = state.story.completedScenes.includes(s.id);
                    const score = state.story.sceneScores[s.id];
                    return <span key={s.id} title={`${s.title}${score !== undefined ? ` · ${Math.round(score * 100)}% natural replies` : ''}`} className={`flex-1 rounded-full px-2 py-1 text-center text-[11px] font-semibold ${ok ? 'bg-olive text-white' : 'bg-white text-ink-mute ring-1 ring-ink/10'}`}>{ok ? '✓ ' : ''}{s.titleEs}</span>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Strengths" eyebrow="This week">
          <ul className="grid gap-1.5 text-sm text-ink-soft">{report.strengths.map((s) => <li key={s} className="flex gap-2"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-olive" /> {s}</li>)}</ul>
        </Section>
        <Section title="To work on" eyebrow="This week">
          <ul className="grid gap-1.5 text-sm text-ink-soft">{report.weaknesses.map((s) => <li key={s} className="flex gap-2"><Icon name="info" size={16} className="mt-0.5 shrink-0 text-terracotta" /> {s}</li>)}</ul>
        </Section>
        <Section title="Recurring errors" eyebrow="This week">
          {report.recurringErrors.length ? (
            <ul className="grid gap-2 text-sm">
              {report.recurringErrors.slice(0, 5).map((e) => <li key={e.category} className="rounded-2xl bg-cream-100 p-3"><p className="font-medium">{e.label} <span className="text-ink-mute">· {e.count}×</span></p>{e.example && <p className="text-xs text-ink-soft">e.g. {e.example}</p>}</li>)}
            </ul>
          ) : <p className="text-sm text-ink-mute">No mistakes recorded this week.</p>}
        </Section>
        <Section title="Suggested priorities" eyebrow="For your next lesson">
          <ol className="grid gap-1.5 text-sm text-ink-soft">{report.priorities.map((s, i) => <li key={s} className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-bold text-cream">{i + 1}</span> {s}</li>)}</ol>
          {report.techniques.length > 0 && <p className="mt-3 text-xs text-ink-mute">Memory techniques used: {report.techniques.map((t) => `${t.label} (${t.used}×${t.delayedRate !== null ? `, ${pct(t.delayedRate)} recalled later` : ''})`).join('; ')}.</p>}
        </Section>
      </div>

      <Section title="Achievements" eyebrow={`${state.achievements.length} of ${ACHIEVEMENTS.length}`}>
        {unlocked.length ? (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {unlocked.map((a) => (
              <li key={a.def.id} className="flex items-center gap-3 rounded-2xl bg-saffron-50 p-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-saffron text-ink"><Icon name={achievementIcon(a.def.icon)} /></span>
                <span className="min-w-0"><b className="block">{a.def.title}</b><span className="block text-xs text-ink-mute">{a.def.description} · {relative(new Date(a.at).toISOString())}</span></span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-ink-mute">Nothing unlocked yet.</p>}
      </Section>
    </div>
  );
}

function VerbList({ items }: { items: ReturnType<typeof allVerbMastery> }) {
  return (
    <ul className="grid gap-2">
      {items.map((m) => (
        <li key={m.inf} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-sm">
          <span><b>{m.inf}</b> <span className="text-ink-mute">· {m.level}</span></span>
          <span className="tabular-nums text-ink-soft">{pct(m.accuracy)} · {m.attempts} tries</span>
          <Bar value={m.score} color={(m.accuracy ?? 0) >= 0.8 ? 'bg-olive' : (m.accuracy ?? 0) >= 0.6 ? 'bg-saffron' : 'bg-terracotta'} className="col-span-2 !h-1.5" />
        </li>
      ))}
    </ul>
  );
}

// ── Lessons ─────────────────────────────────────────────────────

function LessonsTab({ bookings, people, zone, onEdit, onBook }: { bookings: Booking[] | null; people: { id: string; firstName: string; username: string; role: Role }[]; zone: string; onEdit: (b: Booking) => void; onBook: () => void }) {
  const nowIso = new Date().toISOString();
  const [showCancelled, setShowCancelled] = useState(false);
  if (!bookings) return <Loading />;
  const visible = bookings.filter((b) => showCancelled || b.status !== 'cancelled');
  const upcoming = visible.filter((b) => b.status === 'scheduled' && b.startsAt >= nowIso);
  const past = visible.filter((b) => !(b.status === 'scheduled' && b.startsAt >= nowIso)).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const done = bookings.filter((b) => b.status === 'completed').length;
  return (
    <div className="grid gap-4">
      <Section title="Upcoming lessons" eyebrow={`${done} completed so far`} right={<div className="flex items-center gap-2"><label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-terracotta" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} /> Show cancelled</label><button type="button" className="btn-primary !py-2" onClick={onBook}><Icon name="calendar" size={16} /> Book a lesson</button></div>}>
        {upcoming.length ? <div className="grid gap-2">{upcoming.map((b) => <LessonCard key={b.id} b={b} people={people} zone={zone} onEdit={onEdit} />)}</div> : <p className="text-sm text-ink-mute">No upcoming lesson booked.</p>}
      </Section>
      <Section title="Past lessons" eyebrow="History">
        {past.length ? <div className="grid gap-2">{past.map((b) => <LessonCard key={b.id} b={b} people={people} zone={zone} onEdit={onEdit} compact />)}</div> : <p className="text-sm text-ink-mute">No past lessons yet.</p>}
      </Section>
    </div>
  );
}

// ── Homework ────────────────────────────────────────────────────

function HomeworkTab({ homework, people, zone, onOpen, onAssign }: { homework: Homework[] | null; people: { id: string; firstName: string; username: string; role: Role }[]; zone: string; onOpen: (h: Homework) => void; onAssign: () => void }) {
  if (!homework) return <Loading />;
  const groups: { status: Homework['status']; title: string; eyebrow: string; empty: string }[] = [
    { status: 'submitted', title: 'Awaiting your review', eyebrow: 'Submitted', empty: 'Nothing waiting for review.' },
    { status: 'assigned', title: 'Assigned', eyebrow: 'In progress', empty: 'No open homework — assign something for the next lesson.' },
    { status: 'reviewed', title: 'Reviewed', eyebrow: 'Done', empty: 'No reviewed homework yet.' },
  ];
  return (
    <div className="grid gap-4">
      {groups.map((g, i) => {
        const items = homework.filter((h) => h.status === g.status).sort((a, b) => (g.status === 'reviewed' ? b.dueAt.localeCompare(a.dueAt) : a.dueAt.localeCompare(b.dueAt)));
        return (
          <Section key={g.status} title={g.title} eyebrow={g.eyebrow} right={i === 0 ? <button type="button" className="btn-primary !py-2" onClick={onAssign}><Icon name="book" size={16} /> Assign homework</button> : undefined}>
            {items.length ? <div className="grid gap-2">{items.map((h) => <HomeworkRow key={h.id} h={h} people={people} zone={zone} onOpen={onOpen} showStudent={false} />)}</div> : <p className="text-sm text-ink-mute">{g.empty}</p>}
          </Section>
        );
      })}
    </div>
  );
}

// ── Feedback ────────────────────────────────────────────────────

function FeedbackTab({ studentId, name, feedback, zone }: { studentId: string; name: string; feedback: Feedback[] | null; zone: string }) {
  const { backend } = usePlatform();
  const { notify } = useStore();
  const { run, busy, error, setError } = useAction();
  const [kind, setKind] = useState<FeedbackKind>('comment');
  const [body, setBody] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!backend) return;
    if (!body.trim()) return setError('Write something first.');
    const saved = await run(() => backend.addFeedback({ studentId, kind, body }));
    if (saved) {
      notify('Feedback saved', `${name} will see it on their feedback page.`);
      setBody('');
    }
  };
  const remove = async (f: Feedback) => {
    if (!backend) return;
    await run(async () => { await backend.deleteFeedback(f.id); });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <Section title={`Write to ${name}`} eyebrow="Feedback">
        <form className="grid gap-3" onSubmit={submit} noValidate>
          <div className="grid gap-1 text-sm font-medium">
            <span>Type</span>
            <Segmented label="Feedback type" value={kind} onChange={setKind} options={FEEDBACK_KIND} />
          </div>
          <Field id="fb-body" label={kind === 'correction' ? 'The correction' : kind === 'recommendation' ? 'Your recommendation' : 'Your comment'} hint={kind === 'correction' ? 'What they said, what it should be, and why.' : kind === 'recommendation' ? 'Something concrete to do before the next lesson.' : 'Encouragement goes a long way.'}>
            <textarea id="fb-body" aria-describedby="fb-body-hint" className="input min-h-[120px]" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1500} placeholder={kind === 'correction' ? '“estoy de Londres” → “soy de Londres”: origin takes ser.' : '¡Muy bien! …'} />
          </Field>
          <ErrorText error={error} />
          <button type="submit" className="btn-primary" disabled={busy}><Icon name="send" size={16} /> {busy ? 'Saving…' : 'Save feedback'}</button>
          <p className="text-xs text-ink-mute">Saved to the workspace — {name} sees it in the app. No email or notification is sent.</p>
        </form>
      </Section>
      <Section title="Feedback so far" eyebrow={feedback ? `${feedback.length} item${feedback.length === 1 ? '' : 's'}` : undefined}>
        {!feedback ? <Loading /> : feedback.length ? (
          <ul className="grid gap-2">
            {feedback.map((f) => (
              <li key={f.id} className={`rounded-2xl p-3 ${f.kind === 'correction' ? 'bg-terracotta-50' : f.kind === 'recommendation' ? 'bg-azul-50' : 'bg-olive-50'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="eyebrow !text-[10px]">{f.kind} · {fmtDateTime(f.createdAt, zone)}</span>
                  <ConfirmButton confirmLabel="Delete" className="ctrl !px-2" disabled={busy} onConfirm={() => remove(f)}><Icon name="trash" size={14} /><span className="sr-only">Delete this feedback</span></ConfirmButton>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{f.body}</p>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-ink-mute">No feedback yet.</p>}
      </Section>
    </div>
  );
}
