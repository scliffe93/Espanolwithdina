import { motion } from 'motion/react';
import { useState } from 'react';
import { FocusAreas, FocusDetail } from '../components/FocusAreas';
import { MovingUp } from '../components/MovingUp';
import { TENSE_USE, focusAreas, lessonPrep } from '../lib/focus';
import { DinaArt } from '../components/Dina';
import { Icon } from '../components/Icon';
import { Bar, Sheet, achievementIcon } from '../components/ui';
import { CitySkyline } from '../components/CitySkyline';
import { CITY_ORDER, CITY_THEMES } from '../data/cityThemes';
import { scenesForCity } from '../data/story';
import { TENSES } from '../data/verbs';
import { ACHIEVEMENTS } from '../lib/achievements';
import { allVerbMastery, consistency, currentStreak, dailySeries, errorBreakdown, tenseMastery, totalActiveSeconds, weeklyHistory, type TenseStat, type WeekPoint } from '../lib/analytics';
import { Heatmap, Sparkline } from '../components/Charts';
import { levelIndex } from '../lib/assessmentScore';
import { rulesCoach } from '../lib/coach';
import { dayKey, weekStart } from '../lib/dates';
import { navigate } from '../lib/router';
import { buildTeacherReport } from '../lib/report';
import { resumeTarget } from '../lib/resume';
import { mastery } from '../lib/srs';
import { useStore } from '../lib/store';
import { CEFR_LEVELS, SKILLS } from '../types';
import { routeHref } from './World';

function Tile({ label, value, sub, delay = 0 }: { label: string; value: string; sub?: string; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="card p-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-ink-mute">{sub}</p>}
    </motion.div>
  );
}

type TrendKind = 'minutes' | 'accuracy' | 'words';
const TREND_INFO: Record<TrendKind, { title: string; color: string }> = {
  minutes: { title: 'Minutes per week', color: '#C45536' },
  accuracy: { title: 'Accuracy per week', color: '#5B7F3A' },
  words: { title: 'Words learned', color: '#2E5C8A' },
};

/** A trend opened up: every week as a bar with its number, and what the numbers mean in plain sentences. */
function TrendDetail({ kind, weeks, goalMinutes }: { kind: TrendKind; weeks: WeekPoint[]; goalMinutes: number }) {
  const value = (w: WeekPoint): number | null => (kind === 'minutes' ? w.minutes : kind === 'accuracy' ? w.accuracy : w.newVocab);
  const show = (v: number | null) => (v === null ? 'no practice' : kind === 'minutes' ? `${v} min` : kind === 'accuracy' ? `${Math.round(v * 100)}%` : `${v} new`);
  const vals = weeks.map(value);
  const max = kind === 'accuracy' ? 1 : Math.max(1, ...vals.map((v) => v ?? 0));
  const cur = vals[vals.length - 1], prev = vals[vals.length - 2];
  const real = vals.filter((v): v is number => v !== null && (kind !== 'minutes' || v > 0));
  const best = real.length ? Math.max(...real) : null;
  const bestWeek = best === null ? null : weeks[vals.indexOf(best)];
  const avg = real.length ? real.reduce((a, b) => a + b, 0) / real.length : null;
  const lines: string[] = [];
  if (kind === 'minutes') {
    const goal = goalMinutes * 7;
    lines.push(cur ? `This week you have studied ${cur} minutes${prev ? `, ${cur > prev ? `${cur - prev} more than` : cur < prev ? `${prev - cur} fewer than` : 'the same as'} last week` : ''}.` : 'You have not studied yet this week.');
    lines.push(`Your goal of ${goalMinutes} minutes a day is ${goal} minutes a week. ${cur !== null && cur >= goal ? 'You have reached it this week.' : cur ? `You are ${goal - cur} minutes short so far, which is ${Math.ceil((goal - cur) / goalMinutes)} more day${Math.ceil((goal - cur) / goalMinutes) === 1 ? '' : 's'} at your usual pace.` : 'One short session today gets it started.'}`);
    if (bestWeek && best) lines.push(`Your best week in the last eight was ${bestWeek.label === 'This wk' ? 'this week' : `the week of ${bestWeek.label}`}, with ${best} minutes. Your average in weeks you studied is ${Math.round(avg!)} minutes.`);
    const empty = vals.filter((v) => !v).length;
    if (empty >= 2) lines.push(`${empty} of the eight weeks had no practice. Regular short sessions matter more than the total: a gap of a week means part of the next session goes on relearning.`);
  } else if (kind === 'accuracy') {
    lines.push(cur === null || cur === undefined ? 'There are no answers yet this week.' : `This week ${Math.round(cur * 100)}% of your answers were right${prev !== null && prev !== undefined ? `, ${cur > prev + 0.02 ? 'up from' : cur < prev - 0.02 ? 'down from' : 'about the same as'} ${Math.round(prev * 100)}% last week` : ''}.`);
    if (avg !== null) lines.push(`Your average over the weeks you practised is ${Math.round(avg * 100)}%.`);
    lines.push(cur !== null && cur !== undefined && cur >= 0.9 ? 'Above 90% usually means the material is comfortable. It is a good moment to try a new tense or more typed and spoken answers.' : cur !== null && cur !== undefined && cur < 0.65 ? 'Below about 65% the material is a stretch. Slow down, stay on fewer verbs, and use the section "What to concentrate on" below.' : 'Between 70% and 90% is the range where you learn fastest: hard enough to stretch you, easy enough to keep going.');
    lines.push('A dip is normal in a week when you start something new. What matters is that it climbs back over the following two or three weeks.');
  } else {
    const total = weeks[weeks.length - 1]?.cumulativeVocab ?? 0;
    lines.push(`You have met ${total} words in all. ${cur ? `${cur} of them are new this week${prev ? `, compared with ${prev} last week` : ''}.` : 'None are new this week yet.'}`);
    if (avg !== null && avg > 0) lines.push(`In weeks when you learn new words you add about ${Math.round(avg)}.`);
    lines.push('New words only count once you can recall them, so keep up the Memory reviews: a steady five to ten new words a week that you still know a month later beats thirty that fade.');
  }
  return (
    <div className="grid gap-4" data-testid="trend-detail">
      <ul className="grid gap-1.5">
        {weeks.map((w, i) => { const v = vals[i]; return (
          <li key={w.label} className="grid grid-cols-[4.5rem_1fr_5rem] items-center gap-2 text-sm">
            <span className={`text-ink-mute ${i === weeks.length - 1 ? 'font-semibold text-ink' : ''}`}>{w.label === 'This wk' ? 'This week' : w.label}</span>
            <span className="h-3.5 overflow-hidden rounded-full bg-ink/5"><span className="block h-full rounded-full" style={{ width: `${v ? Math.max(3, (v / max) * 100) : 0}%`, background: TREND_INFO[kind].color }} /></span>
            <span className="text-right tabular-nums text-ink-soft">{show(v)}</span>
          </li>
        ); })}
      </ul>
      {kind === 'words' && <p className="text-xs text-ink-mute">Bars show new words each week. Total so far: {weeks[weeks.length - 1]?.cumulativeVocab ?? 0}.</p>}
      <div className="grid gap-2 text-[15px] leading-relaxed text-ink-soft">{lines.map((l) => <p key={l}>{l}</p>)}</div>
    </div>
  );
}

/** A tense opened up: what it is for, how you are doing, and which verbs to work on. */
function TenseDetail({ t, onPractise }: { t: TenseStat; onPractise: (href: string) => void }) {
  const { state } = useStore();
  const ms = allVerbMastery(state, t.id, state.profile?.region ?? 'spain').filter((m) => m.attempts > 0 && m.accuracy !== null);
  const weak = [...ms].sort((a, b) => a.accuracy! - b.accuracy!).filter((m) => m.accuracy! < 0.8).slice(0, 5);
  const strong = [...ms].sort((a, b) => b.accuracy! - a.accuracy!).filter((m) => m.accuracy! >= 0.8 && m.attempts >= 2).slice(0, 5);
  const pct = t.accuracy === null ? null : Math.round(t.accuracy * 100);
  return (
    <div className="grid gap-4 text-[15px] leading-relaxed" data-testid="tense-detail">
      <p className="text-ink-soft"><b className="text-ink" lang="es">{t.es}.</b> {TENSE_USE[t.id]}</p>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-cream-100 p-2.5"><p className="font-display text-2xl font-semibold">{t.verbs}</p><p className="text-[10px] uppercase tracking-wider text-ink-mute">verbs tried</p></div>
        <div className="rounded-xl bg-cream-100 p-2.5"><p className="font-display text-2xl font-semibold">{pct === null ? '–' : `${pct}%`}</p><p className="text-[10px] uppercase tracking-wider text-ink-mute">correct of {t.attempts}</p></div>
        <div className="rounded-xl bg-cream-100 p-2.5"><p className="font-display text-2xl font-semibold">{t.mastered}</p><p className="text-[10px] uppercase tracking-wider text-ink-mute">mastered</p></div>
      </div>
      <p className="text-ink-soft">{pct === null ? 'You have not answered enough in this tense to say yet.' : pct >= 85 ? `You are solid here: ${pct}% right. Keep it alive with an occasional session and move your effort to a weaker tense.` : pct >= 70 ? `You are getting there: ${pct}% right. The forms are mostly in place and the verbs below are what is holding the number down.` : `This tense needs work: ${pct}% right. Stay on a few verbs until they feel easy before you add more.`}</p>
      {weak.length > 0 && <div><p className="font-semibold">Verbs to work on</p><ul className="mt-1.5 grid gap-1">{weak.map((m) => <li key={m.inf} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-ink/5"><span><b lang="es">{m.inf}</b></span><span className="tabular-nums text-ink-soft">{Math.round(m.accuracy! * 100)}% of {m.attempts}</span></li>)}</ul></div>}
      {strong.length > 0 && <p className="text-ink-soft"><b className="text-ink">Going well:</b> {strong.map((m) => m.inf).join(', ')}.</p>}
      <button type="button" className="btn-primary w-full justify-center sm:w-auto sm:justify-self-start" onClick={() => onPractise(`verbs?${weak.length >= 2 ? `focus=${weak.map((m) => m.inf).join(',')}&` : ''}tense=${t.id}&start=1`)}><Icon name="play" size={18} filled /> Practise {weak.length >= 2 ? 'these verbs' : `the ${t.label.toLowerCase()}`}</button>
    </div>
  );
}

export function Journey() {
  const { state } = useStore();
  const p = state.profile!;
  const days = Object.values(state.days);
  const seconds = totalActiveSeconds(state);
  const hours = seconds / 3600;
  const lessons = days.reduce((a, d) => a + d.lessonsCompleted, 0);
  const vocabCards = Object.values(state.srs).filter((c) => c.key.startsWith('vocab:'));
  const vocabMastered = vocabCards.filter((c) => mastery(c) === 'mastered').length;
  const vocabLearning = vocabCards.filter((c) => c.attempts > 0).length;
  const verbs = new Set(days.flatMap((d) => d.verbsPracticed));
  const tenses = new Set(days.flatMap((d) => d.tensesPracticed));
  const speaking = days.reduce((a, d) => a + d.speakingAttempts, 0);
  const listening = days.reduce((a, d) => a + d.listeningSeconds, 0);
  const levelsSorted = SKILLS.map((s) => levelIndex(p.levels[s])).sort((a, b) => a - b);
  const overall = CEFR_LEVELS[levelsSorted[Math.floor(levelsSorted.length / 2)]];
  const weekAch = state.achievements.filter((a) => a.at >= weekStart().getTime()).map((a) => ACHIEVEMENTS.find((x) => x.id === a.id)).filter(Boolean);
  const report = buildTeacherReport(state);
  const analytics = { days: dailySeries(state, 28), c: consistency(state, 28), weekly: weeklyHistory(state, 8), errors: errorBreakdown(state, 28), tenses: tenseMastery(state, p.region) };
  const recs = rulesCoach.recommend(state, Date.now()).slice(0, 3);
  const focus = focusAreas(state);
  const allFocus = focusAreas(state, Date.now(), 99, 1);
  const [open, setOpen] = useState<{ kind: 'trend'; which: TrendKind } | { kind: 'slip'; id: string } | { kind: 'tense'; id: string } | null>(null);
  const openSlip = open?.kind === 'slip' ? allFocus.find((a) => a.id === open.id) : undefined;
  const openTense = open?.kind === 'tense' ? analytics.tenses.find((t) => t.id === open.id) : undefined;
  const resume = resumeTarget(state);
  const startedCities = CITY_ORDER.filter((c) => c === p.city || scenesForCity(c).some((s) => state.story.completedScenes.includes(s.id)));
  const fmtHours = hours < 1 ? `${Math.round(seconds / 60)} min` : `${hours.toFixed(1)} h`;

  return (
    <div>
      {/* Hero */}
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-4xl bg-ink text-cream shadow-lift">
        <div className="absolute inset-x-0 bottom-0 opacity-40"><CitySkyline city={p.city} height={160} /></div>
        <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-end sm:p-8">
          <div className="shrink-0 self-center sm:self-end"><DinaArt size={120} expression="beam" /></div>
          <div className="flex-1">
            <p className="eyebrow !text-saffron-light">Mi camino · My Learning Journey</p>
            <h1 className="mt-1 font-display text-4xl font-semibold leading-tight sm:text-5xl">¡Vas muy bien, {p.name || 'amigo'}!</h1>
            <p className="mt-1 text-cream/80">Everything below comes from what you’ve actually done in the app.</p>
            <button className="btn-primary mt-4 px-6 py-3.5 text-base" onClick={() => navigate(resume.href)} data-testid="continue-learning">
              <Icon name="play" size={18} filled /> Continue learning
            </button>
            <p className="mt-2 text-sm text-cream/75">Next: {resume.label}</p>
          </div>
          <div className="flex shrink-0 flex-col items-center rounded-3xl bg-cream/10 px-6 py-4 ring-1 ring-cream/15">
            <span className="text-xs uppercase tracking-widest text-cream/70">Current level</span>
            <span className="font-display text-6xl font-semibold text-saffron-light">{overall}</span>
            <span className="text-xs text-cream/70">{p.levelSource === 'assessment' ? 'from your placement' : p.levelSource === 'zero' ? 'started from zero' : 'self-selected'}</span>
          </div>
        </div>
      </motion.section>

      {/* Skills */}
      <section className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {SKILLS.map((s) => (
          <div key={s} className="card p-3 text-center">
            <p className="font-display text-2xl font-semibold text-terracotta">{p.levels[s]}</p>
            <p className="text-[11px] uppercase tracking-wider text-ink-mute">{s}</p>
          </div>
        ))}
      </section>

      {/* Totals */}
      <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Active learning" value={fmtHours} sub="focused study time only" />
        <Tile label="Lessons completed" value={String(lessons)} sub="chapters, sessions & games" delay={0.03} />
        <Tile label="Vocabulary" value={String(vocabMastered)} sub={`mastered · ${vocabLearning} being learned`} delay={0.06} />
        <Tile label="Verbs practised" value={String(verbs.size)} sub={`${tenses.size} tense${tenses.size === 1 ? '' : 's'}: ${[...tenses].map((t) => TENSES.find((x) => x.id === t)?.label ?? t).join(', ') || '—'}`} delay={0.09} />
        <Tile label="Speaking" value={String(speaking)} sub="recordings & spoken replies" delay={0.12} />
        <Tile label="Listening" value={`${Math.round(listening / 60)} min`} sub="with audio playing" delay={0.15} />
        <Tile label="Study days" value={String(days.filter((d) => d.activeSeconds >= 60).length)} sub={state.settings.streaksEnabled ? `${currentStreak(state)}-day streak` : 'days with 1+ minute'} delay={0.18} />
        <Tile label="Achievements" value={`${state.achievements.length}/${ACHIEVEMENTS.length}`} sub={`${weekAch.length} this week`} delay={0.21} />
      </section>

      {/* Analytics: trends across the top, then consistency beside slips and tenses */}
      <section className="card mt-5 p-5" data-testid="journey-trends">
        <p className="eyebrow">Últimas 8 semanas · Trends</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {([['minutes', analytics.weekly.map((w) => ({ label: w.label, value: w.minutes })), ' min', false], ['accuracy', analytics.weekly.map((w) => ({ label: w.label, value: w.accuracy })), '', true], ['words', analytics.weekly.map((w) => ({ label: w.label, value: w.cumulativeVocab })), '', false]] as const).map(([kind, points, unit, percent]) => (
            <button key={kind} type="button" className="rounded-2xl bg-cream-100 p-4 text-left transition hover:bg-cream-200 focus-visible:ring-2 focus-visible:ring-terracotta" onClick={() => setOpen({ kind: 'trend', which: kind })} data-testid={`trend-${kind}`}>
              <Sparkline label={kind === 'minutes' ? 'Minutes per week' : kind === 'accuracy' ? 'Accuracy' : 'Words learned'} points={[...points]} unit={unit} percent={percent} title={TREND_INFO[kind].title} color={TREND_INFO[kind].color} />
              <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-terracotta">Week by week <Icon name="arrowRight" size={14} /></span>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="card p-5" data-testid="journey-consistency">
          <p className="eyebrow">Últimos 28 días · Consistency</p>
          <h2 className="mt-1 text-xl font-semibold">{analytics.c.studyDays} study days, {analytics.c.minutes} minutes</h2>
          <p className="mb-4 text-sm text-ink-mute">Longest run {analytics.c.longestStreak} day{analytics.c.longestStreak === 1 ? '' : 's'}{analytics.c.bestWeekday ? ` · you study most on ${analytics.c.bestWeekday}s` : ''}</p>
          <div className="max-w-[20rem]"><Heatmap days={analytics.days} goalMinutes={p.dailyMinutes} title="Your study minutes per day over the last 28 days" /></div>
        </div>
        <div className="card grid content-start gap-5 p-5" data-testid="journey-focus">
          {analytics.errors.length > 0 && (
            <div>
              <p className="eyebrow">Your most common slips</p>
              <ul className="mt-3 grid gap-2.5">
                {analytics.errors.slice(0, 4).map((e) => (
                  <li key={e.category}><button type="button" className="-m-1.5 block w-[calc(100%+0.75rem)] rounded-xl p-1.5 text-left transition hover:bg-cream-100" onClick={() => setOpen({ kind: 'slip', id: `err-${e.category}` })} data-testid={`slip-${e.category}`}>
                    <div className="flex items-baseline justify-between gap-3 text-sm"><span className="font-medium">{e.label}</span><span className="shrink-0 tabular-nums text-ink-soft">{e.count}×{e.previous ? (e.count < e.previous ? ' ↓' : e.count > e.previous ? ' ↑' : '') : ''}</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/5"><div className="h-full rounded-full bg-terracotta/70" style={{ width: `${Math.max(6, (e.count / Math.max(1, analytics.errors[0].count)) * 100)}%` }} /></div>
                    <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-terracotta">Why, and how to fix it <Icon name="arrowRight" size={12} /></span>
                  </button></li>
                ))}
              </ul>
            </div>
          )}
          {analytics.tenses.length > 0 && (
            <div>
              <p className="eyebrow">Tenses</p>
              <ul className="mt-3 grid gap-2">
                {analytics.tenses.map((t) => (
                  <li key={t.id}><button type="button" className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl bg-cream-100 px-3 py-2 text-left text-sm transition hover:bg-cream-200" onClick={() => setOpen({ kind: 'tense', id: t.id })} data-testid={`tense-row-${t.id}`}>
                    <span className="font-medium">{t.label} <Icon name="arrowRight" size={12} className="inline text-terracotta" /></span>
                    <span className="flex flex-wrap gap-1.5 text-xs text-ink-soft">
                      <span className="rounded-full bg-white px-2 py-0.5 tabular-nums">{t.verbs} verbs</span>
                      <span className="rounded-full bg-white px-2 py-0.5 tabular-nums">{t.accuracy !== null ? `${Math.round(t.accuracy * 100)}%` : '—'} correct</span>
                      <span className="rounded-full bg-white px-2 py-0.5 tabular-nums">{t.mastered} mastered</span>
                    </span>
                  </button></li>
                ))}
              </ul>
            </div>
          )}
          {analytics.errors.length === 0 && analytics.tenses.length === 0 && <p className="text-sm text-ink-mute">Your most common slips and your tenses appear here once you have practised a little.</p>}
        </div>
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* Story progression */}
        <section className="card p-5">
          <h2 className="text-xl font-semibold">Your storylines</h2>
          <div className="mt-3 grid gap-3">
            {startedCities.map((c) => {
              const sc = scenesForCity(c);
              const done = sc.filter((s) => state.story.completedScenes.includes(s.id)).length;
              return (
                <div key={c} className={`rounded-2xl p-3 ring-1 ${c === p.city ? 'bg-terracotta-50 ring-terracotta/30' : 'bg-cream-100 ring-transparent'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{CITY_THEMES[c].name}{c === p.city && <span className="ml-2 text-xs font-medium text-terracotta">current city</span>}</p>
                    <span className="text-sm text-ink-mute">{done}/3 chapters</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {sc.map((s) => {
                      const ok = state.story.completedScenes.includes(s.id);
                      return <span key={s.id} title={s.title} className={`flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-center text-xs font-semibold ${ok ? 'bg-olive text-white' : 'bg-white text-ink-mute ring-1 ring-ink/10'}`}>{ok ? '✓ ' : ''}{s.titleEs}</span>;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <button className="ctrl mt-3" onClick={() => navigate('world')}><Icon name="map" size={15} /> Open the map</button>
        </section>

        {/* This week */}
        <section className="card p-5">
          <h2 className="text-xl font-semibold">This week’s achievements</h2>
          {weekAch.length ? (
            <ul className="mt-3 grid gap-2">
              {weekAch.map((a) => (
                <li key={a!.id} className="flex items-center gap-3 rounded-2xl bg-saffron-50 p-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-saffron text-ink"><Icon name={achievementIcon(a!.icon)} /></span>
                  <span><b className="block">{a!.title}</b><span className="text-xs text-ink-mute">{a!.description}</span></span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-ink-mute">No new achievements yet this week — one chapter or game is often enough to unlock one.</p>}
          <div className="mt-4">
            <p className="eyebrow mb-1">Daily goal today</p>
            <Bar value={(state.days[dayKey()]?.activeSeconds ?? 0) / (p.dailyMinutes * 60)} />
          </div>
        </section>
      </div>

      <section className="card mt-4 p-5" data-testid="journey-concentrate">
        <p className="eyebrow">Para tu próxima clase · Before your next lesson</p>
        <h2 className="mt-1 text-xl font-semibold">What to concentrate on</h2>
        {focus.length ? (
          <>
            <p className="mb-4 mt-1 text-[15px] leading-relaxed text-ink-soft">{lessonPrep(focus)}</p>
            <FocusAreas areas={focus} />
          </>
        ) : <p className="mt-2 text-sm text-ink-soft">Nothing stands out yet. Once you have practised a little more, this section explains exactly what you are finding hard, why, and how to fix it before your next lesson.</p>}
      </section>

      <MovingUp className="mt-4" />

      <section className="card mt-4 p-5">
        <h2 className="text-xl font-semibold">Strengths</h2>
        <ul className="mt-2 grid gap-1.5 text-sm text-ink-soft">{report.strengths.map((s) => <li key={s} className="flex gap-2"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-olive" /> {s}</li>)}</ul>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="text-xl font-semibold">Recommended next</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {recs.map((r) => (
            <button key={r.id} onClick={() => navigate(routeHref(r.route))} className="flex flex-col items-start gap-1 rounded-2xl bg-cream-100 p-4 text-left transition hover:bg-cream-200">
              <b>{r.title}</b>
              <span className="text-xs text-ink-mute">{r.why}</span>
              <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-terracotta">{r.cta} <Icon name="arrowRight" size={14} /></span>
            </button>
          ))}
        </div>
      </section>

      <Sheet open={open?.kind === 'trend'} onClose={() => setOpen(null)} title={open?.kind === 'trend' ? TREND_INFO[open.which].title : ''}>
        {open?.kind === 'trend' && <TrendDetail kind={open.which} weeks={analytics.weekly} goalMinutes={p.dailyMinutes} />}
      </Sheet>
      <Sheet open={!!openSlip} onClose={() => setOpen(null)} title={openSlip?.title ?? ''}>
        {openSlip && <FocusDetail area={openSlip} />}
      </Sheet>
      <Sheet open={!!openTense} onClose={() => setOpen(null)} title={openTense?.label ?? ''}>
        {openTense && <TenseDetail t={openTense} onPractise={(href) => { setOpen(null); navigate(href); }} />}
      </Sheet>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn-ghost" onClick={() => navigate('progress')}><Icon name="chart" size={18} /> Detailed statistics</button>
        <button className="btn-ghost" onClick={() => navigate('teacher')}><Icon name="mail" size={18} /> Teacher report</button>
      </div>
    </div>
  );
}
