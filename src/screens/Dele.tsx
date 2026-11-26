import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/ui';
import { DELE_BY_ID, DELE_FORMAT, DELE_LEVELS, DELE_TASKS, PART_LABEL, PASS, type DeleLevel, type DeleTask } from '../data/dele';
import { useSay, stopSpeaking } from '../hooks/useSpeech';
import { confetti, sfx } from '../lib/fx';
import { usePlatform } from '../lib/platform/context';
import { useHomeworkCompletion } from '../lib/platform/homework';
import { levelIdx } from '../lib/platform/level';
import { useLevelAccess } from '../lib/platform/useLevelAccess';
import { navigate } from '../lib/router';
import { ttsSupported } from '../lib/speech';
import { completeLesson } from '../lib/state';
import { useStore } from '../lib/store';
import { AccentBar, wordCount } from './student/HomeworkRunner';

// Exam practice in the style of the DELE. See data/dele.ts for what these tasks are and are not.

const key = (id: string) => `dele:${id}`;
const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

/** The clock of the real exam. It counts down and says when time would be up; it never stops the learner finishing. */
function Clock({ minutes, running }: { minutes: number; running: boolean }) {
  const [left, setLeft] = useState(minutes * 60);
  useEffect(() => { if (!running) return; const iv = setInterval(() => setLeft((x) => x - 1), 1000); return () => clearInterval(iv); }, [running]);
  const over = left <= 0;
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums ring-1 ${over ? 'bg-terracotta-50 text-terracotta-dark ring-terracotta/40' : 'bg-white ring-ink/10'}`} data-testid="dele-clock"><Icon name="clock" size={14} /> {over ? 'Time is up in the real exam' : mmss(left)}</span>;
}

function Questions({ task, onDone }: { task: DeleTask; onDone: (score: number, correct: number) => void }) {
  const qs = task.questions ?? [];
  const [picked, setPicked] = useState<(number | null)[]>(() => qs.map(() => null));
  const [checked, setChecked] = useState(false);
  const letters = ['a', 'b', 'c'];
  const correct = qs.filter((q, i) => picked[i] === q.answer).length;
  return (
    <div className="grid gap-3">
      {qs.map((q, i) => (
        <fieldset key={i} className="card p-4" data-testid="dele-question">
          <legend className="sr-only">Question {i + 1}</legend>
          <p className="font-semibold" lang="es"><span className="mr-1.5 text-ink-mute">{i + 1}.</span>{q.q}</p>
          <div className="mt-2 grid gap-1.5">
            {q.options.map((o, k) => {
              const chosen = picked[i] === k, right = q.answer === k;
              const cls = !checked ? (chosen ? 'bg-ink text-cream ring-ink' : 'bg-white ring-ink/10 hover:ring-ink/30') : right ? 'bg-olive-50 ring-olive' : chosen ? 'bg-terracotta-50 ring-terracotta' : 'bg-white text-ink-mute ring-ink/5';
              return <button key={k} type="button" disabled={checked} onClick={() => setPicked((p) => p.map((x, j) => (j === i ? k : x)))} aria-pressed={chosen} className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-left ring-2 transition-colors ${cls}`} lang="es" data-right={right || undefined}><b className="shrink-0">{letters[k]})</b><span>{o}</span></button>;
            })}
          </div>
          {checked && <p className={`mt-2 rounded-xl px-3 py-2 text-sm ${picked[i] === q.answer ? 'bg-olive-50' : 'bg-saffron-50'}`}><b>{picked[i] === q.answer ? 'Right. ' : `The answer is ${letters[q.answer]}. `}</b>{q.why}</p>}
        </fieldset>
      ))}
      {!checked && <button type="button" className="btn-primary justify-self-start" disabled={picked.some((x) => x === null)} onClick={() => { setChecked(true); onDone(qs.length ? correct / qs.length : 0, correct); }} data-testid="dele-check">Check my answers</button>}
      {!checked && picked.some((x) => x === null) && <p className="text-sm text-ink-mute">Answer every question to check. In the exam a blank scores nothing, so always choose one.</p>}
    </div>
  );
}

function Listening({ task, shown }: { task: DeleTask; shown: boolean }) {
  const say = useSay();
  const [plays, setPlays] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => stopSpeaking(), []);
  const play = async () => { if (playing || plays >= 2) return; setPlaying(true); setPlays((n) => n + 1); await say(task.text ?? '', { rate: task.level === 'A1' ? 0.8 : task.level === 'A2' ? 0.88 : 0.95 }); setPlaying(false); };
  return (
    <div className="card p-5">
      {!ttsSupported ? <p className="text-sm text-terracotta-dark">This browser cannot read aloud, so the text is shown below. Read it once, then answer.</p> : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-dark h-14 w-14 !rounded-full !p-0" onClick={() => void play()} disabled={playing || plays >= 2} aria-label="Play the recording" data-testid="dele-play"><Icon name="play" size={22} filled /></button>
          <div><p className="font-semibold">{playing ? 'Playing…' : plays === 0 ? 'Play the recording' : plays === 1 ? 'Play it a second time' : 'You have heard it twice'}</p><p className="text-sm text-ink-mute">As in the exam, you hear it twice. {2 - plays} play{2 - plays === 1 ? '' : 's'} left.</p></div>
        </div>
      )}
      {(shown || !ttsSupported) && <blockquote className="mt-4 whitespace-pre-wrap rounded-2xl bg-cream-100 p-4 text-[15px] leading-relaxed" lang="es" data-testid="dele-script"><span className="eyebrow mb-1 block">What was said</span>{task.text}</blockquote>}
    </div>
  );
}

function Writing({ task, onSent }: { task: DeleTask; onSent: (words: number) => void }) {
  const w = task.writing!;
  const { backend, me } = usePlatform();
  const ref = useRef<HTMLTextAreaElement>(null);
  const draftKey = `lwd-dele-${task.id}`;
  const [text, setText] = useState(() => { try { return localStorage.getItem(draftKey) ?? ''; } catch { return ''; } });
  const [done, setDone] = useState(false);
  const [ticks, setTicks] = useState<boolean[]>(() => w.checklist.map(() => false));
  const [sent, setSent] = useState<'no' | 'sending' | 'yes'>('no');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { try { localStorage.setItem(draftKey, text); } catch { /* ignore */ } }, [text, draftKey]);
  const n = wordCount(text);
  const state = n < w.minWords ? 'short' : n > w.maxWords ? 'long' : 'ok';
  const canSend = me?.role === 'student' && !!backend;
  const send = async () => {
    if (!backend) return;
    setSent('sending'); setError(null);
    try { await backend.sendWriting({ title: `Exam practice ${task.level} · ${task.title}`, prompt: `${task.instructions} ${w.points.join(' ')}`, text, minWords: w.minWords }); setSent('yes'); try { localStorage.removeItem(draftKey); } catch { /* ignore */ } }
    catch (e) { setSent('no'); setError(e instanceof Error ? e.message : 'Could not send it. Try again.'); }
  };
  return (
    <div className="grid gap-3">
      <div className="card p-5">
        <p className="font-semibold" lang="es">{w.prompt}</p>
        <p className="mt-2 text-sm text-ink-soft" lang="es">En su texto debe:</p>
        <ul className="mt-1 grid gap-1 text-[15px]" lang="es">{w.points.map((x) => <li key={x} className="flex gap-2"><span className="text-terracotta">•</span>{x}</li>)}</ul>
        <p className="mt-3 text-sm font-semibold" lang="es">Número de palabras: entre {w.minWords} y {w.maxWords}.</p>
      </div>
      <div className="card p-5">
        <div className="flex items-center justify-between gap-2"><label htmlFor="dele-text" className="font-semibold">Your answer, in Spanish</label><span className={`text-sm font-semibold tabular-nums ${state === 'ok' ? 'text-olive' : state === 'long' ? 'text-terracotta-dark' : 'text-ink-mute'}`} data-testid="dele-words">{n} / {w.minWords}–{w.maxWords} words</span></div>
        <div className="mt-2"><AccentBar target={ref} value={text} onChange={setText} disabled={done} /></div>
        <textarea id="dele-text" ref={ref} className="input mt-2 min-h-[220px] w-full text-base leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} readOnly={done} lang="es" spellCheck={false} autoCapitalize="sentences" data-testid="dele-text" />
        {!done && <p className="mt-1 text-sm text-ink-mute">{state === 'short' ? `${w.minWords - n} more word${w.minWords - n === 1 ? '' : 's'} to reach the minimum.` : state === 'long' ? `${n - w.maxWords} over the limit: the exam marks down texts that are too long.` : 'Inside the word range.'}</p>}
        {!done && <button type="button" className="btn-primary mt-3" disabled={n < Math.min(10, w.minWords)} onClick={() => { setDone(true); onSent(n); }} data-testid="dele-finish">I have finished</button>}
      </div>
      {done && (
        <div className="card p-5" data-testid="dele-selfcheck">
          <p className="eyebrow">Before you hand it in</p>
          <h3 className="text-lg font-semibold">Check it the way an examiner would</h3>
          <ul className="mt-2 grid gap-1.5">{w.checklist.map((c, i) => <li key={c}><label className="flex cursor-pointer items-start gap-2.5 text-[15px]"><input type="checkbox" className="mt-1 h-4 w-4 accent-olive" checked={ticks[i]} onChange={(e) => setTicks((t) => t.map((x, j) => (j === i ? e.target.checked : x)))} /> {c}</label></li>)}</ul>
          <p className="mt-3 text-sm text-ink-soft">Writing cannot be marked by the app: an examiner looks at whether you did what was asked, how it hangs together, your grammar and your vocabulary. {canSend ? 'Send it to Dina and she will mark it with corrections on your own words.' : 'Show it to your teacher in your next lesson.'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {canSend && sent !== 'yes' && <button type="button" className="btn-primary" disabled={sent === 'sending'} onClick={() => void send()} data-testid="dele-send"><Icon name="mail" size={18} /> {sent === 'sending' ? 'Sending…' : 'Send to Dina to mark'}</button>}
            {sent === 'yes' && <p className="rounded-xl bg-olive-50 px-3 py-2 text-sm font-semibold text-olive" role="status" data-testid="dele-sent">Sent. It is in your homework list, and Dina’s marking will appear there.</p>}
            <button type="button" className="btn-ghost" onClick={() => { setDone(false); }}>Keep editing</button>
          </div>
          {error && <p className="mt-2 text-sm text-terracotta-dark" role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}

function Run({ task }: { task: DeleTask }) {
  const { state, update } = useStore();
  const hw = useHomeworkCompletion();
  const [score, setScore] = useState<{ pct: number; correct: number } | null>(null);
  const [wrote, setWrote] = useState<number | null>(null);
  const part = PART_LABEL[task.part];
  const rec = state.games[key(task.id)];
  const finish = (pct: number, correct: number) => {
    setScore({ pct, correct });
    const best = Math.max(rec?.best ?? 0, Math.round(pct * 100));
    update((s) => completeLesson({ ...s, games: { ...s.games, [key(task.id)]: { best, plays: (rec?.plays ?? 0) + 1, lastAt: Date.now(), bestCombo: 0 } } }));
    hw.log('practice', `Exam practice ${task.level} ${part.en.toLowerCase()}: ${correct}/${task.questions?.length ?? 0} (${task.title})`);
    if (pct >= PASS) { sfx.win(); confetti({ count: 90 }); } else sfx.wrong();
  };
  const wroteIt = (words: number) => {
    setWrote(words);
    update((s) => completeLesson({ ...s, games: { ...s.games, [key(task.id)]: { best: rec?.best ?? 0, plays: (rec?.plays ?? 0) + 1, lastAt: Date.now(), bestCombo: 0 } } }));
    hw.log('practice', `Exam practice ${task.level} writing: ${words} words (${task.title})`);
  };
  return (
    <div className="mx-auto max-w-3xl" data-testid="dele-run">
      <button type="button" className="ctrl mb-4" onClick={() => navigate('dele')}><Icon name="arrowLeft" size={14} /> Exam practice</button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><p className="eyebrow">{task.level} · {part.es}</p><h1 className="font-display text-3xl font-semibold leading-tight" lang="es">{task.title}</h1></div>
        <Clock minutes={task.minutes} running={score === null && wrote === null} />
      </div>
      <div className="mt-3 rounded-2xl bg-saffron-50 p-4 ring-1 ring-saffron/40"><p className="font-semibold" lang="es">{task.instructions}</p><p className="mt-1 text-sm text-ink-soft">{task.instructionsEn}</p></div>

      <div className="mt-4 grid gap-4">
        {task.part === 'reading' && <article className="card whitespace-pre-wrap p-5 text-[16px] leading-relaxed" lang="es" data-testid="dele-text-read">{task.text}</article>}
        {task.part === 'listening' && <Listening task={task} shown={score !== null} />}
        {task.part === 'writing' ? <Writing task={task} onSent={wroteIt} /> : <Questions task={task} onDone={finish} />}
      </div>

      {score && (
        <div className={`mt-4 rounded-3xl p-5 ring-1 ${score.pct >= PASS ? 'bg-olive-50 ring-olive/40' : 'bg-saffron-50 ring-saffron/50'}`} role="status" data-testid="dele-result">
          <p className="font-display text-2xl font-semibold">{score.correct} of {task.questions!.length} · {Math.round(score.pct * 100)}%</p>
          <p className="mt-1 text-ink-soft">{score.pct >= PASS ? 'That is above the 60% the real exam asks for in this part.' : 'The real exam asks for 60%. Read the explanation under each question: they show where in the text the answer was.'}</p>
          <div className="mt-3 flex flex-wrap gap-2"><button className="btn-primary" onClick={() => navigate('dele')}>More exam practice</button>{hw.isHomework && <button className="btn-dark" onClick={hw.backToHomework}>Back to my homework</button>}</div>
        </div>
      )}
    </div>
  );
}

export function Dele({ id }: { id?: string }) {
  const { state } = useStore();
  const { me } = usePlatform();
  const { level } = useLevelAccess();
  const task = id ? DELE_BY_ID[id] : undefined;
  const teacher = me?.role === 'teacher' || me?.role === 'admin';
  // A learner sees the papers of their level and the ones below. The teacher sees them all.
  const levels = useMemo(() => DELE_LEVELS.filter((l) => teacher || levelIdx(l) <= Math.max(0, levelIdx(level))), [teacher, level]);
  const [open, setOpen] = useState<DeleLevel>(() => levels[levels.length - 1] ?? 'A1');
  useEffect(() => { if (!levels.includes(open)) setOpen(levels[levels.length - 1] ?? 'A1'); }, [levels, open]);
  if (task) return <Run key={task.id} task={task} />;
  const f = DELE_FORMAT[open];
  return (
    <div data-testid="dele-home">
      <PageHeader eyebrow="Examen · Exam practice" title="Exam practice" subtitle="Practice in the style of the DELE exam: reading, listening and writing." />
      <div className="mb-4 flex flex-wrap items-center gap-2">{levels.map((l) => <button key={l} className="chip" aria-pressed={open === l} onClick={() => setOpen(l)} data-testid={`dele-level-${l}`}>{l}</button>)}</div>
      <div className="grid gap-3 sm:grid-cols-3">
        {DELE_TASKS.filter((t) => t.level === open).map((t) => {
          const rec = state.games[key(t.id)]; const p = PART_LABEL[t.part];
          return (
            <button key={t.id} type="button" onClick={() => navigate(`dele/${t.id}`)} className="card flex flex-col items-start gap-1 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lift" data-testid={`dele-${t.id}`}>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-cream-100 text-terracotta"><Icon name={p.icon} size={20} /></span>
              <span className="eyebrow mt-2">{p.en} · {t.minutes} min</span>
              <span className="font-display text-xl font-semibold leading-tight" lang="es">{t.title}</span>
              <span className="text-sm text-ink-soft">{t.part === 'writing' ? `${t.writing!.minWords} to ${t.writing!.maxWords} words` : `${t.questions!.length} questions`}</span>
              <span className="mt-2 text-sm font-semibold text-terracotta">{rec ? (t.part === 'writing' ? `Done ${rec.plays} time${rec.plays === 1 ? '' : 's'}` : `Best ${rec.best}%`) : 'Start'} <Icon name="arrowRight" size={14} className="inline" /></span>
            </button>
          );
        })}
      </div>
      <section className="card mt-5 p-5">
        <p className="eyebrow">The real {open} exam</p>
        <h2 className="text-lg font-semibold">What you sit on the day</h2>
        <dl className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
          {([['Reading', f.reading], ['Listening', f.listening], ['Writing', f.writing], ['Speaking', f.speaking]] as const).map(([k, v]) => <div key={k} className="rounded-xl bg-cream-100 px-3 py-2"><dt className="font-semibold">{k}</dt><dd className="text-ink-soft">{v}</dd></div>)}
        </dl>
        <p className="mt-3 text-sm text-ink-soft">Pass mark: 60% in reading and writing together, and 60% in listening and speaking. Speaking is practised in your lessons. Check dates and fees with the Instituto Cervantes before you enter.</p>
      </section>
    </div>
  );
}
