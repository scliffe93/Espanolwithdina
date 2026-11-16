import { motion } from 'motion/react';
import { BarChart } from '../components/BarChart';
import { DinaArt } from '../components/Dina';
import { FocusAreas } from '../components/FocusAreas';
import { MovingUp } from '../components/MovingUp';
import { focusAreas, lessonPrep } from '../lib/focus';
import { usePlatform, usePlatformQuery } from '../lib/platform/context';
import { Icon } from '../components/Icon';
import { SCENE_BY_ID } from '../data/story';
import { allVerbMastery, errorBreakdown, weekSummary } from '../lib/analytics';
import { challengeForWeek } from '../lib/challenges';
import { addDays, formatMinutes, formatRange, weekId, weekStart } from '../lib/dates';
import { rulesCoach } from '../lib/coach';
import { navigate } from '../lib/router';
import { buildTeacherReport, isValidEmail, mailtoHref, reportSubject, reportText } from '../lib/report';
import { useStore } from '../lib/store';
import { routeHref } from './World';
import { useEffect, useState } from 'react';

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function Recap() {
  const { state, update } = useStore();
  // The review is of a finished week. Monday to Saturday it shows last week; on Sunday the week just ending is
  // published as the review. The button looks at the other one.
  const sunday = new Date().getDay() === 0;
  const [which, setWhich] = useState<'last' | 'this'>(sunday ? 'this' : 'last');
  const back = which === 'this' ? 0 : 1;
  const start = addDays(weekStart(), -7 * back);
  const end = addDays(start, 7).getTime();
  const w = weekSummary(state, start);
  const prev = weekSummary(state, addDays(start, -7));
  // Lessons with the teacher: the ones in this week, and how many there have been in all.
  const lessonsQ = usePlatformQuery((b) => (b.actor.role === 'student' ? b.bookings({}) : Promise.resolve([])), []);
  const held = (lessonsQ.data ?? []).filter((b) => b.status !== 'cancelled' && Date.parse(b.startsAt) < Date.now());
  const lessonsThisWeek = (lessonsQ.data ?? []).filter((b) => b.status !== 'cancelled' && Date.parse(b.startsAt) >= start.getTime() && Date.parse(b.startsAt) < end);
  const nextLessonAt = (lessonsQ.data ?? []).filter((b) => b.status === 'scheduled' && Date.parse(b.startsAt) > Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const { me } = usePlatform();
  // A student who has not set up the storyline still has a week to look back on.
  const p = { name: state.profile?.name || me?.firstName || '', region: state.profile?.region ?? ('spain' as const), dailyMinutes: state.profile?.dailyMinutes ?? 10 };
  const challenge = challengeForWeek(start);
  const done = challenge.measure(w) >= challenge.target;
  const strong = allVerbMastery(state, 'present', p.region).filter((m) => (m.level === 'mastered' || m.level === 'familiar') && w.verbsPracticed.includes(m.inf));
  const weekAch = state.achievements.filter((a) => a.at >= start.getTime() && a.at < end);
  const recs = rulesCoach.recommend(state, Date.now()).slice(0, 3);
  const minutesDelta = Math.round((w.activeSeconds - prev.activeSeconds) / 60);
  const report = buildTeacherReport(state);
  const focus = focusAreas(state, Date.now(), 3);
  // What got better, in sentences: this week against last week.
  const better: string[] = [], watch: string[] = [];
  const pct = (v: number | null) => (v === null ? null : Math.round(v * 100));
  const acc = pct(w.accuracy), accPrev = pct(prev.accuracy);
  if (acc !== null && accPrev !== null) { if (acc >= accPrev + 3) better.push(`You got ${acc}% right, up from ${accPrev}% the week before.`); else if (acc <= accPrev - 5) watch.push(`You got ${acc}% right, down from ${accPrev}% the week before. That often happens in a week with something new in it.`); else better.push(`Your accuracy held steady at ${acc}%.`); }
  else if (acc !== null) better.push(`You got ${acc}% of your answers right.`);
  if (minutesDelta >= 5) better.push(`You studied ${minutesDelta} minutes more than the week before.`); else if (minutesDelta <= -10 && prev.activeSeconds > 0) watch.push(`You studied ${-minutesDelta} minutes less than the week before.`);
  if (w.studyDays > prev.studyDays && w.studyDays >= 2) better.push(`You practised on ${w.studyDays} days, ${w.studyDays - prev.studyDays} more than the week before.`);
  for (const e of errorBreakdown(state, 7, Math.min(end, Date.now()))) { if (e.previous >= 3 && e.count <= e.previous / 2) better.push(`${e.label}: ${e.count} slip${e.count === 1 ? '' : 's'} this week, down from ${e.previous}.`); else if (e.count >= 4 && e.count >= e.previous * 2) watch.push(`${e.label} came up ${e.count} times, more than the week before.`); }
  if (strong.length) better.push(`${strong.length} verb${strong.length === 1 ? ' is' : 's are'} now sticking: ${strong.slice(0, 5).map((m) => m.inf).join(', ')}.`);
  if (w.newVocab.length) better.push(`You met ${w.newVocab.length} new word${w.newVocab.length === 1 ? '' : 's'}.`);

  useEffect(() => { update((s) => (s.seenRecapWeek === weekId() ? s : { ...s, seenRecapWeek: weekId() })); }, [update]);

  const pdf = async () => (await import('../lib/pdf')).downloadReportPdf(report);

  return (
    <div className="mx-auto max-w-3xl">
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-4xl bg-ink p-6 text-cream sm:p-8">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-terracotta/40 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <DinaArt size={96} expression="beam" />
          <div>
            <p className="eyebrow !text-saffron-light">{which === 'last' ? 'La semana pasada · Last week' : sunday ? 'Tu semana · This week’s review' : 'Esta semana · This week so far'} · {formatRange(w.start)}</p>
            <h1 className="font-display text-3xl font-semibold sm:text-4xl">{w.activeSeconds > 0 ? `¡Qué semana, ${p.name}!` : `Tu semana empieza aquí, ${p.name}`}</h1>
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [formatMinutes(w.activeSeconds), 'active learning', minutesDelta ? `${minutesDelta > 0 ? '+' : ''}${minutesDelta} min vs last week` : ''],
            [`${w.studyDays}`, 'study days', ''],
            [`${w.verbsPracticed.length}`, 'verbs practised', `${strong.length} strong`],
            lessonsQ.data && (held.length || lessonsThisWeek.length) ? [`${lessonsThisWeek.length}`, `lesson${lessonsThisWeek.length === 1 ? '' : 's'} with Dina`, `${held.length} in total`] : [`${w.scenesCompleted.length}`, 'chapters lived', ''],
          ].map(([v, l, s]) => (
            <div key={l} className="rounded-2xl bg-cream/10 p-3 ring-1 ring-cream/10">
              <p className="font-display text-2xl font-semibold">{v}</p>
              <p className="text-xs text-cream/70">{l}</p>
              {s && <p className="mt-0.5 text-[11px] text-saffron-light">{s}</p>}
            </div>
          ))}
        </div>
        <div className="relative mt-5 rounded-2xl bg-cream p-3 text-ink">
          <BarChart title="Active minutes per day" unit="min" data={w.minutesByDay.map((v, i) => ({ label: DAYS[i], value: Math.round(v) }))} height={90} />
        </div>
      </motion.section>

      <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="recap-switch">
        <button type="button" className="ctrl" onClick={() => setWhich(which === 'last' ? 'this' : 'last')} data-testid="recap-toggle"><Icon name="calendar" size={15} /> {which === 'last' ? 'See this week so far' : 'See last week'}</button>
        <span className="text-sm text-ink-mute">{which === 'last' ? (sunday ? '' : 'This week’s review is published on Sunday.') : sunday ? 'Published today. From Monday a new week starts.' : 'Not finished yet: the review is published on Sunday.'}</span>
      </div>

      {lessonsQ.data && (held.length > 0 || nextLessonAt) && (
        <section className="card mt-4 flex flex-wrap items-center gap-4 p-5" data-testid="recap-lessons">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-terracotta-50 text-terracotta"><Icon name="calendar" size={22} /></span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Clases con Dina · Lessons with Dina</p>
            <p className="font-semibold">{lessonsThisWeek.length ? `${lessonsThisWeek.length} lesson${lessonsThisWeek.length === 1 ? '' : 's'} ${which === 'last' ? 'last week' : 'this week'}${lessonsThisWeek.some((b) => b.topic) ? `: ${lessonsThisWeek.map((b) => b.topic).filter(Boolean).join('; ')}` : ''}` : `No lesson ${which === 'last' ? 'last week' : 'this week'}`}</p>
            <p className="text-sm text-ink-soft">You have had <b data-testid="recap-lessons-total">{held.length}</b> lesson{held.length === 1 ? '' : 's'} with Dina so far{nextLessonAt ? `. Next: ${new Date(nextLessonAt.startsAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at ${new Date(nextLessonAt.startsAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}.</p>
          </div>
        </section>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <p className="eyebrow">Weekly challenge</p>
          <p className="mt-1 font-semibold">{challenge.title}</p>
          <p className="text-sm text-ink-soft">{done ? 'Completed — ¡enhorabuena!' : `${challenge.measure(w)} of ${challenge.target} ${challenge.unit} so far.`}</p>
        </div>
        <div className="card p-5">
          <p className="eyebrow">Story & achievements</p>
          <p className="mt-1 text-sm text-ink-soft">
            {w.scenesCompleted.length ? `Lived: ${w.scenesCompleted.map((s) => SCENE_BY_ID[s]?.titleEs).join(', ')}. ` : 'No chapters this week yet. '}
            {weekAch.length ? `${weekAch.length} achievement${weekAch.length > 1 ? 's' : ''} unlocked.` : ''}
          </p>
        </div>
        {strong.length > 0 && (
          <div className="card p-5 sm:col-span-2">
            <p className="eyebrow">Verbs that are sticking</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{strong.map((m) => <span key={m.inf} className="rounded-full bg-olive-50 px-3 py-1 text-sm font-medium text-olive">{m.inf}</span>)}</div>
          </div>
        )}
      </div>

      <section className="card mt-4 p-5" data-testid="recap-better">
        <p className="eyebrow">Lo que ha mejorado · What got better</p>
        {better.length ? <ul className="mt-2 grid gap-1.5 text-[15px]">{better.map((b) => <li key={b} className="flex gap-2"><Icon name="check" size={16} className="mt-1 shrink-0 text-olive" /> {b}</li>)}</ul> : <p className="mt-2 text-sm text-ink-soft">Nothing to compare yet. Practise a little this week and next Sunday will show what changed.</p>}
        {watch.length > 0 && <ul className="mt-3 grid gap-1.5 border-t border-ink/10 pt-3 text-[15px] text-ink-soft">{watch.map((b) => <li key={b} className="flex gap-2"><Icon name="info" size={16} className="mt-1 shrink-0 text-terracotta" /> {b}</li>)}</ul>}
      </section>

      {focus.length > 0 && (
        <section className="card mt-4 p-5" data-testid="recap-lesson">
          <p className="eyebrow">Para tu próxima clase · Take to your next lesson</p>
          <p className="mb-3 mt-1 text-[15px] leading-relaxed text-ink-soft">{lessonPrep(focus)}</p>
          <FocusAreas areas={focus} />
        </section>
      )}

      <MovingUp className="mt-4" />

      <section className="card mt-4 p-5">
        <p className="eyebrow">Goals for next week</p>
        <ul className="mt-2 grid gap-2">
          {recs.map((r) => (
            <li key={r.id}><button onClick={() => navigate(routeHref(r.route))} className="flex w-full items-center justify-between rounded-2xl bg-cream-100 px-4 py-3 text-left hover:bg-cream-200"><span><b className="block">{r.title}</b><span className="text-xs text-ink-mute">{r.why}</span></span><Icon name="arrowRight" size={16} /></button></li>
          ))}
          <li className="rounded-2xl bg-cream-100 px-4 py-3 text-sm">Aim for {p.dailyMinutes} active minutes on at least {Math.max(4, Math.min(7, w.studyDays + 1))} days.</li>
        </ul>
      </section>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button className="btn-primary" onClick={() => navigate(state.onboardingDone ? 'world' : 'student')}><Icon name="play" size={18} filled /> Keep learning</button>
        <button className="btn-ghost" onClick={pdf}><Icon name="download" size={18} /> Download report</button>
        {isValidEmail(state.teacher.email) ? (
          <a className="btn-ghost" href={mailtoHref(state.teacher.email, reportSubject(report), reportText(report))}><Icon name="mail" size={18} /> Email my teacher</a>
        ) : (
          <button className="btn-ghost" onClick={() => navigate('teacher')}><Icon name="mail" size={18} /> Set up teacher email</button>
        )}
      </div>
    </div>
  );
}
