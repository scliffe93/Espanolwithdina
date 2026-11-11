import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/ui';
import { INTERESTS } from '../../data/profileOptions';
import { scenesForCity } from '../../data/story';
import { TENSES, VERBS } from '../../data/verbs';
import { errorBreakdown } from '../../lib/analytics';
import type { AppState } from '../../lib/platform/context';
import { usePlatform, usePlatformQuery } from '../../lib/platform/context';
import { describeActivity } from '../../lib/platform/homework';
import { dueFor, generatePlan, planWeekFor, type PlanItem } from '../../lib/platform/plan';
import { markedSlips } from '../../lib/platform/marking';
import { FOCUS_TAG_LABEL, type FocusTag, type Homework, type LessonDebrief, type Person } from '../../lib/platform/types';
import { homeworkStats, pct } from './insights';
import { Field, useAction } from './shared';

const TAGS = Object.keys(FOCUS_TAG_LABEL) as FocusTag[];
const DAY = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** After a lesson: what was covered, what to fix, goals → a generated, editable week of homework. */
export function DebriefForm({ open, onClose, student, state, homework }: { open: boolean; onClose: () => void; student: Person; state: AppState | null; homework: Homework[] }) {
  const { backend } = usePlatform();
  const { run, busy, error, setError } = useAction();
  const [step, setStep] = useState<'notes' | 'plan' | 'done'>('notes');
  const [lessonDate, setLessonDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tenses, setTenses] = useState<LessonDebrief['covered']['tenses']>(['present']);
  const [verbText, setVerbText] = useState('');
  const [themes, setThemes] = useState<string[]>([]);
  const [sceneId, setSceneId] = useState('');
  const [wentWell, setWentWell] = useState('');
  const [toFix, setToFix] = useState<FocusTag[]>([]);
  const [goals, setGoals] = useState(['', '', '']);
  const [minutes, setMinutes] = useState(state?.profile?.dailyMinutes ?? 15);
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const planWeek = useMemo(() => planWeekFor(), []);
  const settings = usePlatformQuery((b) => b.studentSettings(student.id), [student.id]);

  // Last plan, for evidence at the top.
  const lastWeek = useMemo(() => {
    const planned = homework.filter((h) => h.plan);
    if (!planned.length) return null;
    const week = planned.map((h) => h.plan!.week).sort().reverse()[0];
    const items = planned.filter((h) => h.plan!.week === week);
    return { week, stats: homeworkStats(items), items, errors: state ? errorBreakdown(state, 14).slice(0, 3) : [] };
  }, [homework, state]);

  // Slips marked in homework over the last 14 days (the teacher's corrections and the app's diagnoses) pre-tick "what to fix".
  const slips = useMemo(() => markedSlips(homework, new Date(Date.now() - 14 * 86_400_000).toISOString()), [homework]);
  useEffect(() => {
    if (open) setToFix((cur) => (cur.length ? cur : slips.slice(0, 2).map((s) => s.tag)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const verbs = useMemo(() => verbText.split(/[,\s]+/).map((v) => v.trim().toLowerCase()).filter(Boolean), [verbText]);
  const unknownVerbs = verbs.filter((v) => !VERBS.some((x) => x.inf === v));
  const suggestions = useMemo(() => { const last = verbText.split(/[,\s]+/).pop()?.toLowerCase() ?? ''; return last.length >= 2 ? VERBS.filter((v) => v.inf.startsWith(last) && !verbs.includes(v.inf)).slice(0, 6) : []; }, [verbText, verbs]);
  const scenes = state?.profile ? scenesForCity(state.profile.city) : [];

  const debrief = (): LessonDebrief => ({ lessonDate, covered: { tenses, verbs: verbs.filter((v) => !unknownVerbs.includes(v)), themes, sceneId: sceneId || undefined }, wentWell: wentWell.trim(), toFix, goals: goals.map((g) => g.trim()).filter(Boolean), minutesPerDay: minutes, planWeek });

  const toPlan = () => {
    if (!wentWell.trim() && !toFix.length && !verbs.length) { setError('Add at least what you covered or what to fix.'); return; }
    setError(null);
    setPlan(generatePlan(debrief(), state));
    setStep('plan');
  };

  const send = async () => {
    if (!backend) return;
    const d = debrief();
    const note = [d.wentWell, d.goals.length ? `Goals for the week: ${d.goals.join(' · ')}` : '', `Aim: ${d.minutesPerDay} min a day.`].filter(Boolean).join('\n');
    const r = await run(async () => {
      await backend.addFeedback({ studentId: student.id, kind: 'debrief', body: note || 'Lesson notes', debrief: d });
      for (const it of plan) await backend.assignHomework({ studentIds: [student.id], activity: it.activity, instructions: it.instructions, dueAt: dueFor(planWeek, it.day), plan: { week: planWeek, goal: it.goal, day: it.day } });
      return true;
    });
    if (r) setStep('done');
  };

  const reset = () => { setStep('notes'); setPlan([]); setWentWell(''); setToFix([]); setGoals(['', '', '']); setVerbText(''); setThemes([]); setSceneId(''); setError(null); onClose(); };
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <Sheet open={open} onClose={reset} title={step === 'done' ? 'Plan sent' : step === 'plan' ? `This week’s plan for ${student.firstName}` : `Lesson debrief · ${student.firstName}`} wide>
      {step === 'notes' && (
        <div className="grid gap-4">
          {lastWeek && (
            <div className="rounded-2xl bg-cream-100 p-3 text-sm" data-testid="last-plan">
              <p className="eyebrow !text-[10px]">Last plan · week of {lastWeek.week}</p>
              <p className="mt-1"><b>{lastWeek.stats.submitted}/{lastWeek.stats.assigned}</b> done · {lastWeek.stats.onTime} on time{lastWeek.stats.avgScore !== null ? ` · average ${pct(lastWeek.stats.avgScore)}` : ''}{lastWeek.stats.overdue ? ` · ${lastWeek.stats.overdue} overdue` : ''}</p>
              {lastWeek.errors.length > 0 && <p className="mt-1 text-ink-soft">Recurring slips (14 days): {lastWeek.errors.map((e) => `${e.label} ${e.count}×`).join(', ')}</p>}
            </div>
          )}
          {slips.length > 0 && <p className="rounded-2xl bg-olive-50 p-3 text-sm" data-testid="marked-slips"><b>From your marking (14 days):</b> {slips.slice(0, 4).map((s) => `${FOCUS_TAG_LABEL[s.tag]} ${s.count}×`).join(', ')}{slips[0].examples[0] ? ` — e.g. ${slips[0].examples[0]}` : ''}. The top ones are ticked below.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="db-date" label="Lesson date"><input id="db-date" type="date" className="input" value={lessonDate} onChange={(e) => setLessonDate(e.target.value)} /></Field>
            <Field id="db-min" label="Minutes a day to aim for"><input id="db-min" type="number" min={5} max={90} step={5} className="input" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></Field>
          </div>
          <fieldset><legend className="mb-1 text-sm font-medium">Tenses covered</legend><div className="flex flex-wrap gap-2">{TENSES.map((t) => <Chip key={t.id} on={tenses.includes(t.id)} onClick={() => setTenses((l) => toggle(l, t.id) as typeof tenses)}>{t.label}</Chip>)}</div>{settings.data?.maxLevel && <p className="mt-1 text-xs text-ink-mute">{student.firstName}’s level ceiling is {settings.data.maxLevel}. Tenses above it are still sent when you choose them here.</p>}</fieldset>
          <Field id="db-verbs" label="Verbs covered" hint={unknownVerbs.length ? `Not in the app’s verb bank (will be skipped): ${unknownVerbs.join(', ')}` : 'Infinitives, separated by commas or spaces.'}>
            <input id="db-verbs" className="input" value={verbText} onChange={(e) => setVerbText(e.target.value)} placeholder="querer, poder, salir" autoComplete="off" />
            {suggestions.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{suggestions.map((v) => <button key={v.inf} type="button" className="rounded-full bg-cream-100 px-2.5 py-1 text-xs" onClick={() => setVerbText((t) => t.replace(/[^,\s]*$/, v.inf + ', '))}>{v.inf} <span className="text-ink-mute">{v.en}</span></button>)}</div>}
          </Field>
          <fieldset><legend className="mb-1 text-sm font-medium">Themes talked about</legend><div className="flex flex-wrap gap-2">{INTERESTS.map((i) => <Chip key={i.value} on={themes.includes(i.label)} onClick={() => setThemes((l) => toggle(l, i.label))}>{i.label}</Chip>)}</div></fieldset>
          {scenes.length > 0 && <Field id="db-scene" label="Storyline chapter used in the lesson (optional)"><select id="db-scene" className="input" value={sceneId} onChange={(e) => setSceneId(e.target.value)}><option value="">None</option>{scenes.map((s) => <option key={s.id} value={s.id}>{s.title}{state?.story.completedScenes.includes(s.id) ? ' ✓' : ''}</option>)}</select></Field>}
          <Field id="db-well" label="Notes for the student: what went well, what we did"><textarea id="db-well" className="input min-h-[88px]" value={wentWell} onChange={(e) => setWentWell(e.target.value)} placeholder="Great progress with poder and querer today. You described your weekend in the past for the first time." /></Field>
          <fieldset><legend className="mb-1 text-sm font-medium">What to fix this week</legend><div className="flex flex-wrap gap-2">{TAGS.map((t) => <Chip key={t} on={toFix.includes(t)} onClick={() => setToFix((l) => toggle(l, t))} testid={`fix-${t}`}>{FOCUS_TAG_LABEL[t]}</Chip>)}</div></fieldset>
          <div className="grid gap-2 sm:grid-cols-3">{goals.map((g, i) => <Field key={i} id={`db-goal-${i}`} label={`Goal ${i + 1}${i ? ' (optional)' : ''}`}><input id={`db-goal-${i}`} className="input" value={g} onChange={(e) => setGoals((gs) => gs.map((x, k) => (k === i ? e.target.value : x)))} placeholder={['Use ser/estar correctly in speech', 'Present tense of 10 common verbs', 'Order confidently in a café'][i]} /></Field>)}</div>
          {error && <p role="alert" className="rounded-xl bg-terracotta-50 px-3 py-2 text-sm text-terracotta-dark">{error}</p>}
          <div className="flex flex-wrap gap-2"><button type="button" className="btn-primary" onClick={toPlan} data-testid="generate-plan"><Icon name="sparkle" size={16} /> Generate the week’s plan</button><button type="button" className="ctrl" onClick={reset}>Cancel</button></div>
        </div>
      )}
      {step === 'plan' && (
        <div className="grid gap-3">
          <p className="text-sm text-ink-soft">Week of {planWeek}. Built from your notes and {student.firstName}’s own data (weak verbs, next chapter, interests). Remove anything you do not want, then send.</p>
          <ul className="grid gap-2" data-testid="plan-items">
            {plan.map((it, i) => (
              <li key={i} className="flex items-start gap-3 rounded-2xl bg-cream-100 p-3 text-sm">
                <span className="w-9 shrink-0 rounded-lg bg-white px-1.5 py-1 text-center text-xs font-bold">{DAY[it.day]}</span>
                <div className="min-w-0 flex-1"><p className="font-semibold">{it.activity.title}</p><p className="text-xs text-ink-mute">{describeActivity(it.activity)}{it.goal ? ` · goal: ${it.goal}` : ''}</p><p className="mt-0.5 text-xs text-ink-soft">{it.instructions}</p></div>
                <select aria-label="Day" className="input !w-20 !py-1 text-xs" value={it.day} onChange={(e) => setPlan((p) => p.map((x, k) => (k === i ? { ...x, day: Number(e.target.value) } : x)).sort((a, b) => a.day - b.day))}>{[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{DAY[d]}</option>)}</select>
                <button type="button" className="ctrl !px-2" aria-label="Remove" onClick={() => setPlan((p) => p.filter((_, k) => k !== i))}><Icon name="x" size={14} /></button>
              </li>
            ))}
          </ul>
          {plan.length === 0 && <p className="text-sm text-ink-mute">Nothing left in the plan. Go back and add something, or send just the notes.</p>}
          <p className="text-xs text-ink-mute">During the week the app adapts on its own: a score under 60% adds a shorter re-try two days later; 90% or more on a verb drill adds a stretch task in the next tense.</p>
          {error && <p role="alert" className="rounded-xl bg-terracotta-50 px-3 py-2 text-sm text-terracotta-dark">{error}</p>}
          <div className="flex flex-wrap gap-2"><button type="button" className="btn-primary" onClick={send} disabled={busy} data-testid="send-plan"><Icon name="send" size={16} /> {busy ? 'Sending…' : `Send notes and ${plan.length} task${plan.length === 1 ? '' : 's'}`}</button><button type="button" className="ctrl" onClick={() => setStep('notes')}>Back</button></div>
        </div>
      )}
      {step === 'done' && (
        <div className="grid gap-3 text-sm">
          <p>{student.firstName} will see your notes and the week’s tasks on their home page and homework list, with reminders as each is due.</p>
          <button type="button" className="btn-primary" onClick={reset}>Done</button>
        </div>
      )}
    </Sheet>
  );
}

function Chip({ on, onClick, children, testid }: { on: boolean; onClick: () => void; children: React.ReactNode; testid?: string }) {
  return <button type="button" aria-pressed={on} onClick={onClick} data-testid={testid} className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${on ? 'bg-ink text-white' : 'bg-cream-100 text-ink hover:bg-cream-200'}`}>{children}</button>;
}
