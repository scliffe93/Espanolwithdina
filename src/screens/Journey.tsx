import { motion } from 'motion/react';
import { DinaArt } from '../components/Dina';
import { Icon } from '../components/Icon';
import { Bar, achievementIcon } from '../components/ui';
import { CitySkyline } from '../components/CitySkyline';
import { CITY_ORDER, CITY_THEMES } from '../data/cityThemes';
import { scenesForCity } from '../data/story';
import { TENSES } from '../data/verbs';
import { ACHIEVEMENTS } from '../lib/achievements';
import { currentStreak, totalActiveSeconds } from '../lib/analytics';
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
  const recs = rulesCoach.recommend(state, Date.now()).slice(0, 3);
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

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
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
                  <div className="mt-2 flex gap-1.5">
                    {sc.map((s) => {
                      const ok = state.story.completedScenes.includes(s.id);
                      return <span key={s.id} title={s.title} className={`flex-1 rounded-full px-2 py-1 text-center text-[11px] font-semibold ${ok ? 'bg-olive text-white' : 'bg-white text-ink-mute ring-1 ring-ink/10'}`}>{ok ? '✓ ' : ''}{s.titleEs}</span>;
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

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="text-xl font-semibold">Strengths</h2>
          <ul className="mt-2 grid gap-1.5 text-sm text-ink-soft">{report.strengths.map((s) => <li key={s} className="flex gap-2"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-olive" /> {s}</li>)}</ul>
        </section>
        <section className="card p-5">
          <h2 className="text-xl font-semibold">To work on</h2>
          <ul className="mt-2 grid gap-1.5 text-sm text-ink-soft">{report.weaknesses.map((s) => <li key={s} className="flex gap-2"><Icon name="info" size={16} className="mt-0.5 shrink-0 text-terracotta" /> {s}</li>)}</ul>
        </section>
      </div>

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

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn-ghost" onClick={() => navigate('progress')}><Icon name="chart" size={18} /> Detailed statistics</button>
        <button className="btn-ghost" onClick={() => navigate('teacher')}><Icon name="mail" size={18} /> Teacher report</button>
      </div>
    </div>
  );
}
