import { motion } from 'motion/react';
import { BarChart } from '../components/BarChart';
import { Character } from '../components/Character';
import { Icon } from '../components/Icon';
import { Bar, PageHeader, ProgressRing, achievementIcon } from '../components/ui';
import { CHARACTERS, scenesForCity } from '../data/story';
import { CITY_THEMES } from '../data/cityThemes';
import { VERBS } from '../data/verbs';
import { ACHIEVEMENTS } from '../lib/achievements';
import { allVerbMastery, currentStreak, previousWeek, thisWeek, todaySeconds, totalActiveSeconds, weekSummary } from '../lib/analytics';
import { CATEGORY_LABEL, CATEGORY_TIP } from '../lib/answer';
import { challengeForWeek } from '../lib/challenges';
import { addDays, formatMinutes, formatRange, weekStart } from '../lib/dates';
import { rulesCoach } from '../lib/coach';
import { navigate } from '../lib/router';
import { useStore } from '../lib/store';
import { routeHref } from './World';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-ink-mute">{sub}</p>}
    </div>
  );
}

function pct(n: number | null) {
  return n === null ? '—' : `${Math.round(n * 100)}%`;
}

function trend(cur: number, prev: number, unit: string) {
  if (!prev && !cur) return 'no data yet';
  const d = cur - prev;
  return d === 0 ? 'same as last week' : `${d > 0 ? '▲' : '▼'} ${Math.abs(d)}${unit} vs last week`;
}

export function Progress() {
  const { state } = useStore();
  const p = state.profile!;
  const week = thisWeek(state);
  const prev = previousWeek(state);
  const challenge = challengeForWeek(weekStart());
  const chProgress = challenge.measure(week);
  const mastery = allVerbMastery(state, 'present', p.region);
  const mastered = mastery.filter((m) => m.level === 'mastered').length;
  const familiar = mastery.filter((m) => m.level === 'familiar').length;
  const unlocked = new Set(state.achievements.map((a) => a.id));
  const history = [5, 4, 3, 2, 1, 0].map((b) => {
    const s = addDays(weekStart(), -7 * b);
    const w = weekSummary(state, s);
    return { label: b === 0 ? 'This wk' : s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), value: Math.round(w.activeSeconds / 60), note: w.accuracy !== null ? `${pct(w.accuracy)} accuracy` : undefined };
  });
  const goal = p.dailyMinutes * 60;
  const today = todaySeconds(state);
  const nextRec = rulesCoach.recommend(state, Date.now())[0];

  return (
    <div>
      <PageHeader
        eyebrow="Momentum"
        title="Your progress"
        subtitle="Every number here comes from what you actually did — active minutes only, never time with the tab just open."
        right={<button className="btn-ghost hidden sm:inline-flex" onClick={() => navigate('recap')}><Icon name="sparkle" size={18} /> Weekly recap</button>}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="card flex items-center gap-5 p-5">
          <ProgressRing value={today / goal} size={110} stroke={11} label={`${Math.floor(today / 60)} of ${p.dailyMinutes} minutes today`}>
            <span className="text-center leading-tight"><b className="block font-display text-3xl">{Math.floor(today / 60)}</b><span className="text-xs text-ink-mute">of {p.dailyMinutes} min</span></span>
          </ProgressRing>
          <div>
            <p className="eyebrow">Today’s goal</p>
            <p className="mt-1 text-lg font-semibold">{today >= goal ? '¡Objetivo cumplido! Goal reached.' : `${Math.max(1, Math.ceil((goal - today) / 60))} min to go`}</p>
            {state.settings.streaksEnabled && <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft"><Icon name="flame" size={16} className="text-terracotta" /> {currentStreak(state)}-day streak</p>}
            {nextRec && <button className="btn-primary mt-3 !py-2.5" onClick={() => navigate(routeHref(nextRec.route))}>{nextRec.cta}</button>}
          </div>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="font-semibold">Active minutes this week</p>
            <p className="text-sm text-ink-mute">{formatRange(week.start)}</p>
          </div>
          <BarChart title="Active learning minutes per day this week" unit="min" data={week.minutesByDay.map((v, i) => ({ label: DAY_LABELS[i], value: Math.round(v) }))} height={130} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="This week" value={formatMinutes(week.activeSeconds)} sub={trend(Math.round(week.activeSeconds / 60), Math.round(prev.activeSeconds / 60), ' min')} />
        <Stat label="Study days" value={`${week.studyDays}/7`} sub={trend(week.studyDays, prev.studyDays, '')} />
        <Stat label="Accuracy" value={pct(week.accuracy)} sub={`${week.exercisesAttempted} exercises`} />
        <Stat label="Delayed recall" value={pct(week.retention)} sub={week.retentionAttempts ? `${week.retentionAttempts} items after 12h+` : 'needs a day between sessions'} />
        <Stat label="Lessons" value={String(week.lessonsCompleted)} sub="sessions & chapters" />
        <Stat label="Verbs practised" value={String(week.verbsPracticed.length)} sub={`${week.tensesPracticed.length} tense${week.tensesPracticed.length === 1 ? '' : 's'}`} />
        <Stat label="Speaking" value={String(week.speakingAttempts)} sub="recordings & spoken replies" />
        <Stat label="Listening" value={formatMinutes(week.listeningSeconds)} sub="audio playing" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <p className="eyebrow">Weekly challenge</p>
          <h2 className="mt-1 text-xl font-semibold">{challenge.title}</h2>
          <p className="text-ink-soft">{challenge.description}</p>
          <div className="mt-4 flex items-center gap-3">
            <Bar value={chProgress / challenge.target} />
            <span className="shrink-0 text-sm font-semibold tabular-nums">{Math.min(chProgress, challenge.target)}/{challenge.target}</span>
          </div>
          {chProgress >= challenge.target && <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-olive"><Icon name="check" size={16} /> Challenge complete</p>}
        </section>
        <section className="card p-5">
          <p className="eyebrow">Mastery milestones</p>
          <div className="mt-2 flex items-center gap-4">
            <ProgressRing value={mastered / 10} size={72} stroke={8} color="rgb(var(--c-tertiary))"><b className="font-display text-xl">{mastered}</b></ProgressRing>
            <div className="text-sm">
              <p><b>{mastered}</b> of {VERBS.length} verbs mastered (all persons, present)</p>
              <p><b>{familiar}</b> familiar</p>
              <p className="text-ink-mute">Next milestone: {mastered < 5 ? 5 : mastered < 10 ? 10 : mastered < 20 ? 20 : VERBS.length} mastered</p>
            </div>
          </div>
        </section>
      </div>

      <section className="card mt-6 p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Improvement over time</h2>
          <span className="text-sm text-ink-mute">Active minutes per week</span>
        </div>
        <BarChart title="Active minutes per week, last six weeks" unit="min" data={history} highlightLast height={140} />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-2xl font-semibold">Your {CITY_THEMES[p.city].name} story</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {scenesForCity(p.city).map((s) => {
            const done = state.story.completedScenes.includes(s.id);
            return (
              <button key={s.id} onClick={() => navigate(`scene/${s.id}`)} disabled={!!s.requires && !state.story.completedScenes.includes(s.requires)} className="card flex items-center gap-3 p-4 text-left disabled:opacity-50">
                <Character look={CHARACTERS[s.cast[s.cast.length - 1]].look} size={52} />
                <span>
                  <span className="block font-semibold">{s.titleEs}</span>
                  <span className="flex items-center gap-1 text-sm text-ink-mute">{done ? <><Icon name="check" size={14} /> Completed</> : s.requires && !state.story.completedScenes.includes(s.requires) ? <><Icon name="lock" size={14} /> Locked</> : 'Ready to play'}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {week.mistakesByCategory.length > 0 && (
        <section className="card mt-6 p-5">
          <h2 className="text-xl font-semibold">Recurring mistakes this week</h2>
          <div className="mt-3 grid gap-2">
            {week.mistakesByCategory.slice(0, 5).map(([c, n]) => (
              <div key={c} className="rounded-2xl bg-cream-100 p-3">
                <p className="font-medium">{CATEGORY_LABEL[c]} <span className="text-ink-mute">· {n}×</span></p>
                <p className="text-sm text-ink-soft">{CATEGORY_TIP[c]}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-3 text-2xl font-semibold">Achievements <span className="text-base font-normal text-ink-mute">{unlocked.size}/{ACHIEVEMENTS.length}</span></h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {ACHIEVEMENTS.map((a, i) => {
            const got = unlocked.has(a.id);
            return (
              <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className={`card p-4 ${got ? '' : 'opacity-55'}`}>
                <span className={`grid h-11 w-11 place-items-center rounded-2xl ${got ? 'bg-saffron text-ink' : 'bg-ink/5 text-ink-mute'}`}><Icon name={got ? achievementIcon(a.icon) : 'lock'} /></span>
                <p className="mt-2 font-semibold">{a.title}</p>
                <p className="text-xs text-ink-mute">{a.description}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-mute">{got ? 'Unlocked' : 'Locked'}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      <p className="mt-6 text-sm text-ink-mute">Total active learning time: {formatMinutes(totalActiveSeconds(state))}. The timer counts only while you’re on a learning screen, the tab is visible and focused, and you’ve interacted in the last 45 seconds — or audio is playing.</p>
      <div className="mt-4 flex flex-wrap gap-2 sm:hidden"><button className="btn-ghost" onClick={() => navigate('recap')}><Icon name="sparkle" size={18} /> Weekly recap</button><button className="btn-ghost" onClick={() => navigate('teacher')}><Icon name="mail" size={18} /> Teacher report</button></div>
    </div>
  );
}
