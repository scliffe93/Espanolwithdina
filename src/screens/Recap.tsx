import { motion } from 'motion/react';
import { BarChart } from '../components/BarChart';
import { Character } from '../components/Character';
import { Icon } from '../components/Icon';
import { CHARACTERS, SCENE_BY_ID } from '../data/story';
import { allVerbMastery, previousWeek, thisWeek } from '../lib/analytics';
import { challengeForWeek } from '../lib/challenges';
import { formatMinutes, formatRange, weekId, weekStart } from '../lib/dates';
import { rulesCoach } from '../lib/coach';
import { navigate } from '../lib/router';
import { buildTeacherReport, isValidEmail, mailtoHref, reportSubject, reportText } from '../lib/report';
import { useStore } from '../lib/store';
import { routeHref } from './World';
import { useEffect } from 'react';

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function Recap() {
  const { state, update } = useStore();
  const w = thisWeek(state);
  const prev = previousWeek(state);
  const p = state.profile!;
  const challenge = challengeForWeek(weekStart());
  const done = challenge.measure(w) >= challenge.target;
  const strong = allVerbMastery(state, 'present', p.region).filter((m) => (m.level === 'mastered' || m.level === 'familiar') && w.verbsPracticed.includes(m.inf));
  const weekAch = state.achievements.filter((a) => a.at >= weekStart().getTime());
  const recs = rulesCoach.recommend(state, Date.now()).slice(0, 3);
  const minutesDelta = Math.round((w.activeSeconds - prev.activeSeconds) / 60);
  const report = buildTeacherReport(state);

  useEffect(() => { update((s) => (s.seenRecapWeek === weekId() ? s : { ...s, seenRecapWeek: weekId() })); }, [update]);

  const pdf = async () => (await import('../lib/pdf')).downloadReportPdf(report);

  return (
    <div className="mx-auto max-w-3xl">
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-4xl bg-ink p-6 text-cream sm:p-8">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-terracotta/40 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <Character look={CHARACTERS.lucia.look} mood="happy" size={90} />
          <div>
            <p className="eyebrow !text-saffron-light">Tu semana · {formatRange(w.start)}</p>
            <h1 className="font-display text-3xl font-semibold sm:text-4xl">{w.activeSeconds > 0 ? `¡Qué semana, ${p.name}!` : `Tu semana empieza aquí, ${p.name}`}</h1>
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [formatMinutes(w.activeSeconds), 'active learning', minutesDelta ? `${minutesDelta > 0 ? '+' : ''}${minutesDelta} min vs last week` : ''],
            [`${w.studyDays}`, 'study days', ''],
            [`${w.verbsPracticed.length}`, 'verbs practised', `${strong.length} strong`],
            [`${w.scenesCompleted.length}`, 'chapters lived', ''],
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
        <button className="btn-primary" onClick={() => navigate('world')}><Icon name="map" size={18} /> Keep learning</button>
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
