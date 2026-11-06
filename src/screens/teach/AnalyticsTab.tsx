import { Heatmap, Meters, Sparkline } from '../../components/Charts';
import { Icon } from '../../components/Icon';
import { consistency, dailySeries, deckHealth, errorBreakdown, skillBreakdown, tenseMastery, weeklyHistory } from '../../lib/analytics';
import type { AppState } from '../../lib/platform/context';
import type { Homework } from '../../lib/platform/types';
import { HOMEWORK_KIND_LABEL } from '../../lib/platform/types';
import { buildTeacherReport } from '../../lib/report';
import { homeworkStats, pct } from './insights';
import { Section, Stat } from './shared';

/** Four weeks of evidence: consistency, accuracy by skill, mistakes, tenses, vocabulary and homework. */
export function AnalyticsTab({ state, homework, name, onDownload, busy }: { state: AppState; homework: Homework[]; name: string; onDownload: () => void; busy: boolean }) {
  const region = state.profile?.region ?? 'spain';
  const days = dailySeries(state, 28);
  const c = consistency(state, 28);
  const weekly = weeklyHistory(state, 8);
  const skills = skillBreakdown(state);
  const errors = errorBreakdown(state, 28);
  const tenses = tenseMastery(state, region);
  const deck = deckHealth(state);
  const hw = homeworkStats(homework);
  const report = buildTeacherReport(state, Date.now(), { homework });
  const goal = state.profile?.dailyMinutes ?? 10;
  const trend = (cur: number, prev: number) => (prev === 0 && cur === 0 ? '' : cur > prev ? `↑ from ${prev}` : cur < prev ? `↓ from ${prev}` : 'same as before');

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-soft">Everything here is computed from {name}’s recorded activity in the app over the last four weeks.</p>
        <button type="button" className="btn-dark !py-2" onClick={onDownload} disabled={busy} data-testid="download-report"><Icon name="download" size={16} /> {busy ? 'Preparing…' : 'Download PDF report'}</button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Study days (28)" value={`${c.studyDays}/28`} sub={`longest run ${c.longestStreak} day${c.longestStreak === 1 ? '' : 's'}`} />
        <Stat label="Minutes (28)" value={String(c.minutes)} sub={`${c.avgMinutesPerStudyDay} min per study day · goal ${goal}`} />
        <Stat label="Most active" value={c.bestWeekday ?? '—'} sub="weekday with most minutes" />
        <Stat label="Homework" value={hw.assigned ? `${hw.submitted}/${hw.assigned}` : '—'} sub={hw.assigned ? `${hw.onTime} on time · ${hw.overdue} overdue${hw.avgScore !== null ? ` · avg ${pct(hw.avgScore)}` : ''}` : 'none assigned yet'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Section title="Consistency" eyebrow="Last 28 days">
          <Heatmap days={days} goalMinutes={goal} title={`${name}'s study minutes per day, last 28 days`} />
        </Section>
        <Section title="Trends" eyebrow="Last 8 weeks">
          <div className="grid gap-4 sm:grid-cols-3">
            <div><p className="eyebrow !text-[10px]">Minutes per week</p><Sparkline points={weekly.map((w) => ({ label: w.label, value: w.minutes }))} unit=" min" title="Minutes per week" /></div>
            <div><p className="eyebrow !text-[10px]">Accuracy</p><Sparkline points={weekly.map((w) => ({ label: w.label, value: w.accuracy }))} unit="" percent title="Accuracy per week" color="#5B7F3A" /></div>
            <div><p className="eyebrow !text-[10px]">Vocabulary learned</p><Sparkline points={weekly.map((w) => ({ label: w.label, value: w.cumulativeVocab }))} unit="" title="Cumulative vocabulary" color="#2E5C8A" /></div>
          </div>
          <p className="mt-3 text-xs text-ink-mute">Delayed recall this week: {pct(weekly[weekly.length - 1]?.retention)} · speaking attempts: {weekly[weekly.length - 1]?.speaking ?? 0}</p>
        </Section>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Accuracy by exercise type" eyebrow="All time · 3+ attempts">
          {skills.length ? <Meters items={skills.slice(0, 8).map((s) => ({ label: s.label, value: s.accuracy, note: `${s.attempts} attempts`, color: s.accuracy >= 0.85 ? 'bg-olive' : s.accuracy >= 0.6 ? 'bg-saffron' : 'bg-terracotta' }))} max={1} format={(v) => pct(v)} /> : <p className="text-sm text-ink-mute">No scored exercises yet.</p>}
        </Section>
        <Section title="Mistakes by type" eyebrow="Last 28 days vs the 28 before">
          {errors.length ? (
            <ul className="grid gap-3">
              {errors.slice(0, 6).map((e) => (
                <li key={e.category} className="text-sm">
                  <div className="flex items-center justify-between gap-2"><span className="font-semibold">{e.label}</span><span className="tabular-nums text-ink-soft">{e.count}× <span className="text-ink-mute">{trend(e.count, e.previous)}</span></span></div>
                  {e.examples.length > 0 && <p className="text-xs text-ink-mute">{e.examples.join(' · ')}</p>}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-ink-mute">No mistakes recorded in the last four weeks.</p>}
        </Section>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Tenses" eyebrow="Verbs practised · accuracy · mastered">
          {tenses.length ? (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-mute"><th className="py-1 font-semibold">Tense</th><th className="py-1 text-right font-semibold">Verbs</th><th className="py-1 text-right font-semibold">Accuracy</th><th className="py-1 text-right font-semibold">Mastered</th></tr></thead>
              <tbody>{tenses.map((t) => <tr key={t.id} className="border-t border-ink/5"><td className="py-1.5">{t.label} <span className="text-ink-mute">({t.es})</span></td><td className="py-1.5 text-right tabular-nums">{t.verbs}</td><td className="py-1.5 text-right tabular-nums">{pct(t.accuracy)}</td><td className="py-1.5 text-right tabular-nums">{t.mastered} <span className="text-ink-mute">+{t.familiar} familiar</span></td></tr>)}</tbody>
            </table>
          ) : <p className="text-sm text-ink-mute">No verb practice yet.</p>}
        </Section>
        <Section title="Vocabulary deck" eyebrow="Spaced repetition">
          <Meters items={[{ label: 'Mastered', value: deck.mastered, color: 'bg-olive' }, { label: 'In progress', value: deck.learning, color: 'bg-saffron' }, { label: 'Not started', value: deck.fresh, color: 'bg-ink/20' }, { label: 'Overdue for review', value: deck.overdue, color: 'bg-terracotta' }]} max={Math.max(1, deck.total)} />
          {hw.byKind.length > 0 && (
            <div className="mt-4 border-t border-ink/5 pt-3">
              <p className="eyebrow !text-[10px]">Homework by type</p>
              <ul className="mt-1 grid gap-1 text-sm">{hw.byKind.map((k) => <li key={k.kind} className="flex justify-between"><span>{HOMEWORK_KIND_LABEL[k.kind as keyof typeof HOMEWORK_KIND_LABEL] ?? k.kind}</span><span className="tabular-nums text-ink-soft">{k.count} · {k.avgScore !== null ? `avg ${pct(k.avgScore)}` : 'no score'}</span></li>)}</ul>
            </div>
          )}
        </Section>
      </div>

      <Section title="Focus for the next lesson" eyebrow="Generated from the data above">
        <ol className="grid gap-1.5 text-sm">{report.priorities.map((p, i) => <li key={i} className="flex gap-2"><span className="font-display text-lg font-semibold text-terracotta">{i + 1}</span><span>{p}</span></li>)}</ol>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div><p className="eyebrow !text-[10px]">Strengths</p><ul className="mt-1 grid gap-1 text-ink-soft">{report.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>
          <div><p className="eyebrow !text-[10px]">To work on</p><ul className="mt-1 grid gap-1 text-ink-soft">{report.weaknesses.map((s) => <li key={s}>{s}</li>)}</ul></div>
        </div>
      </Section>
    </div>
  );
}
