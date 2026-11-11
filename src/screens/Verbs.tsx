import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { HelpMeRemember, type MemorySource } from '../components/HelpMeRemember';
import { Bar, PageHeader, ProgressRing, Sheet } from '../components/ui';
import { personLabel, PERSONS_EN, ROADMAP_TENSES, TENSES, VERBS, VERB_BY_INF, conjugate, groupLabel, parseExample, personsForRegion, type Tense, type Verb } from '../data/verbs';
import { useSay } from '../hooks/useSpeech';
import { allVerbMastery } from '../lib/analytics';
import { CATEGORY_LABEL, CATEGORY_TIP, checkAnswer, classifyVerbError, normalize } from '../lib/answer';
import { levelIndex } from '../lib/assessmentScore';
import { EX_LABEL, buildSession, cardKeyFor, shuffle, type Exercise } from '../lib/exercises';
import { navigate } from '../lib/router';
import { completeLesson, recordAttempt } from '../lib/state';
import { useStore } from '../lib/store';
import { confetti, haptic, sfx } from '../lib/fx';
import { useHomeworkCompletion } from '../lib/platform/homework';
import { useLevelAccess } from '../lib/platform/useLevelAccess';
import type { ErrorCategory } from '../types';
import type { Grade } from '../lib/srs';

const ACCENTS = ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü'];

function memoryFor(verb: Verb, answer: string, key: string): MemorySource {
  const pattern =
    verb.group === 'regular' ? `Regular ${verb.inf.slice(-2)} verb — keep the stem "${verb.inf.slice(0, -2)}-" and add the ending.` :
    verb.group.startsWith('stem') ? `${groupLabel(verb.group)} — the "boot": yo, tú, él and ellos change; nosotros and vosotros don't.` :
    `${groupLabel(verb.group)}. ${verb.note ?? ''}`.trim();
  return { key, answer, en: verb.en, origin: verb.origin, trick: verb.trick, pattern };
}

interface Result {
  correct: boolean;
  expected: string;
  given: string;
  category?: ErrorCategory;
  accentOnly?: boolean;
  explain?: string;
  sayText?: string;
}

// ─────────────────────────── Session player ───────────────────────────

/** What the student was asked, in one line, for the teacher's answer sheet. */
function promptFor(ex: Exercise): string {
  const tenseLabel = (t: Tense) => TENSES.find((x) => x.id === t)?.label.toLowerCase() ?? t;
  switch (ex.kind) {
    case 'type': case 'choice': case 'listen': return `${ex.pronoun} + ${ex.verb} (${tenseLabel(ex.tense)})`;
    case 'context': return `Fill the gap: ${ex.example.en}`;
    case 'build': return `Build the sentence: ${ex.example.en}`;
    case 'fix': return `Fix the mistake: ${ex.example.en}`;
    case 'translate': return `Translate: ${ex.example.en}`;
    case 'match': return `Match the forms of ${ex.verb} (${tenseLabel(ex.tense)})`;
    case 'serEstar': return `${ex.item.before} ___ ${ex.item.after}`.trim();
  }
}

function Session({ exercises: initial, tense, onExit }: { exercises: Exercise[]; tense: Tense; onExit: () => void }) {
  const { update } = useStore();
  const say = useSay();
  const [queue, setQueue] = useState<Exercise[]>(initial);
  const [i, setI] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [hintUsed, setHintUsed] = useState(false);
  const [log, setLog] = useState<{ verb: string; correct: boolean; category?: ErrorCategory; expected: string; given: string; prompt: string }[]>([]);
  const [done, setDone] = useState(false);
  const requeued = useRef(new Set<number>());
  const hw = useHomeworkCompletion();
  const ex = queue[i];

  useEffect(() => setHintUsed(false), [i]);

  const grade = (correct: boolean, accent: boolean): Grade => (!correct ? 0 : accent || hintUsed ? 1 : 2);

  const submit = (r: Result) => {
    if (result) return;
    const card = cardKeyFor(ex);
    const verbInf = ex.kind === 'serEstar' ? ex.item.verb : ex.verb;
    update((s) =>
      card
        ? recordAttempt(s, {
            key: card.key,
            grade: grade(r.correct, !!r.accentOnly),
            exerciseType: ex.kind,
            verb: verbInf,
            tense: card.tense,
            mistake: !r.correct || r.accentOnly ? { expected: r.expected, given: r.given, category: r.category ?? 'other', context: `${EX_LABEL[ex.kind]} · ${verbInf}` } : undefined,
          })
        : s,
    );
    setLog((l) => [...l, { verb: verbInf, correct: r.correct, category: r.category, expected: r.expected, given: r.given, prompt: promptFor(ex) }]);
    // Revisit mistakes automatically later in the session, as a production exercise.
    // Revisit a mistake once; a retry that is also wrong is left for spaced repetition (no endless loops).
    if (!r.correct && card && !requeued.current.has(i) && ex.kind !== 'serEstar' && !(ex as { retry?: boolean }).retry) {
      requeued.current.add(i);
      setQueue((q) => [...q, { kind: 'type', verb: verbInf, tense: card.tense, person: card.person, pronoun: (ex as { pronoun?: string }).pronoun || personLabel(card.person).split(' ')[0], retry: true } as Exercise]);
    }
    if (r.correct && r.sayText) say(r.sayText);
    if (r.correct) sfx.correct(); else { sfx.wrong(); haptic([30, 30, 30]); }
    setResult(r);
  };

  const next = () => {
    setResult(null);
    if (i + 1 < queue.length) setI(i + 1);
    else {
      update((s) => completeLesson(s));
      setDone(true);
      if (!hw.isHomework) hw.log('practice', `Verb session: ${log.filter((l) => l.correct).length}/${log.length} correct (${tense})`);
      if (hw.isHomework) {
        const correct = log.filter((l) => l.correct).length;
        const cats = [...new Set(log.filter((l) => !l.correct && l.category).map((l) => CATEGORY_LABEL[l.category!]))];
        hw.submit({ score: log.length ? correct / log.length : 0, attempts: log.length, correct, summary: `${correct}/${log.length} correct${cats.length ? ` · ${cats.slice(0, 2).join(', ').toLowerCase()}` : ''}`, items: log.slice(0, 60).map((l) => ({ prompt: l.prompt, expected: l.expected, given: l.given, correct: l.correct, ...(l.category ? { category: l.category } : {}) })) });
      }
      sfx.win();
      if (log.filter((l) => l.correct).length / Math.max(1, log.length) >= 0.7) confetti({ count: 120 });
    }
  };

  if (done) {
    const correct = log.filter((l) => l.correct).length;
    const cats = new Map<ErrorCategory, number>();
    for (const l of log) if (!l.correct && l.category) cats.set(l.category, (cats.get(l.category) ?? 0) + 1);
    const missedVerbs = [...new Set(log.filter((l) => !l.correct).map((l) => l.verb))];
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-xl">
        <div className="card p-6 text-center">
          <ProgressRing value={correct / Math.max(1, log.length)} size={110} stroke={10} color="rgb(var(--c-tertiary))">
            <span className="font-display text-2xl font-semibold">{Math.round((correct / Math.max(1, log.length)) * 100)}%</span>
          </ProgressRing>
          <h2 className="mt-3 text-3xl font-semibold">{correct === log.length ? '¡Perfecto!' : correct / log.length > 0.7 ? '¡Muy bien!' : 'Buen trabajo'}</h2>
          <p className="text-ink-soft">{correct} of {log.length} correct · {[...new Set(log.map((l) => l.verb))].length} verbs · {TENSES.find((t) => t.id === tense)?.label}</p>
          {cats.size > 0 && (
            <div className="mt-5 grid gap-2 text-left">
              {[...cats.entries()].map(([c, n]) => (
                <div key={c} className="rounded-2xl bg-cream-100 p-3">
                  <p className="font-semibold">{CATEGORY_LABEL[c]} <span className="font-normal text-ink-mute">×{n}</span></p>
                  <p className="text-sm text-ink-soft">{CATEGORY_TIP[c]}</p>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-sm text-ink-mute">Missed forms are scheduled to come back in your review deck.</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {missedVerbs.length > 0 && <button className="btn-primary" onClick={() => navigate(`verbs?focus=${missedVerbs.join(',')}&tense=${tense}&start=1&t=${Date.now()}`)}><Icon name="refresh" size={18} /> Practise my mistakes</button>}
            {hw.isHomework && <button className="btn-dark" onClick={hw.backToHomework}><Icon name="check" size={18} /> Homework done — back to my homework</button>}
            <button className="btn-ghost" onClick={onExit}>Verb gym</button>
            <button className="btn-ghost" onClick={() => navigate('world')}><Icon name="map" size={18} /> Madrid</button>
          </div>
        </div>
      </motion.div>
    );
  }

  const verb = ex.kind === 'serEstar' ? VERB_BY_INF[ex.item.verb] : VERB_BY_INF[ex.verb];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <button className="ctrl !px-2" onClick={onExit} aria-label="End session"><Icon name="x" size={18} /></button>
        <Bar value={(i + (result ? 1 : 0)) / queue.length} color="bg-olive" />
        <span className="text-sm tabular-nums text-ink-mute">{i + 1}/{queue.length}</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
          <p className="eyebrow">{EX_LABEL[ex.kind]}{ex.kind !== 'serEstar' && <> · <span className="normal-case tracking-normal">{verb.inf} — {verb.en}</span></>}</p>
          <ExerciseView key={i} ex={ex} locked={!!result} onSubmit={submit} onHint={() => setHintUsed(true)} />
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`mt-6 rounded-3xl p-5 ring-1 ${result.correct ? (result.accentOnly ? 'bg-saffron-50 ring-saffron/40' : 'bg-olive-50 ring-olive/30') : 'bg-terracotta-50 ring-terracotta/30'}`} role="status">
            <p className="flex items-center gap-2 text-lg font-semibold">
              <Icon name={result.correct ? 'check' : 'info'} />
              {result.correct ? (result.accentOnly ? 'Correct — watch the accent' : hintUsed ? 'Correct (with a hint)' : '¡Correcto!') : 'Not quite'}
            </p>
            {(!result.correct || result.accentOnly) && <p className="mt-1">Answer: <b>{result.expected}</b>{result.given && <span className="text-ink-mute"> · you wrote “{result.given}”</span>}</p>}
            {result.category && !result.correct && <p className="mt-2 text-sm"><b>{CATEGORY_LABEL[result.category]}.</b> {CATEGORY_TIP[result.category]}</p>}
            {result.explain && <p className="mt-2 text-sm text-ink-soft">{result.explain}</p>}
            {!result.correct && cardKeyFor(ex) && (
              <div className="mt-3"><HelpMeRemember source={memoryFor(verb, result.expected, cardKeyFor(ex)!.key)} /></div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {result.sayText && <button className="ctrl" onClick={() => say(result.sayText!)}><Icon name="volume" size={16} /> Listen</button>}
              <button className="btn-dark" autoFocus onClick={next}>Continue <Icon name="arrowRight" size={18} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────── Exercise views ───────────────────────────

function AccentBar({ onInsert }: { onInsert: (c: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Insert accented letter">
      {ACCENTS.map((c) => (
        <button key={c} type="button" className="h-9 w-9 rounded-xl bg-white text-lg ring-1 ring-ink/10 hover:ring-ink/30" onMouseDown={(e) => e.preventDefault()} onClick={() => onInsert(c)}>{c}</button>
      ))}
    </div>
  );
}

function TypeInput({ onSubmit, locked, placeholder, verb, answer, cardKey, onHint }: { onSubmit: (v: string) => void; locked: boolean; placeholder: string; verb: Verb; answer: string; cardKey: string; onHint: () => void }) {
  const [v, setV] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const [showHelp, setShowHelp] = useState(false);
  const insert = (c: string) => {
    const el = ref.current;
    if (!el) return setV((x) => x + c);
    const s = el.selectionStart ?? v.length, e = el.selectionEnd ?? v.length;
    const nv = v.slice(0, s) + c + v.slice(e);
    setV(nv);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + 1, s + 1); });
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) onSubmit(v); }} className="mt-5">
      <div className="flex gap-2">
        <input ref={ref} autoFocus disabled={locked} className="input text-xl" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} autoCapitalize="off" autoComplete="off" autoCorrect="off" spellCheck={false} lang="es" aria-label="Your answer" />
        <button className="btn-primary shrink-0" disabled={locked || !v.trim()}>Check</button>
      </div>
      {!locked && <AccentBar onInsert={insert} />}
      {!locked && (
        <div className="mt-3">
          {showHelp ? <HelpMeRemember source={memoryFor(verb, answer, cardKey)} onHintUsed={onHint} onReveal={() => onSubmit('')} /> : <button type="button" className="ctrl" onClick={() => setShowHelp(true)}><Icon name="bulb" size={16} /> Help me remember</button>}
        </div>
      )}
    </form>
  );
}

function Options({ options, onPick, locked, answer, picked }: { options: string[]; onPick: (o: string) => void; locked: boolean; answer: string; picked: string | null }) {
  return (
    <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
      {options.map((o) => {
        const st = !locked ? 'idle' : o === answer ? 'right' : o === picked ? 'wrong' : 'dim';
        return (
          <button key={o} disabled={locked} onClick={() => onPick(o)} className={`rounded-2xl px-5 py-4 text-left text-lg font-medium ring-1 transition ${st === 'right' ? 'bg-olive text-white ring-olive' : st === 'wrong' ? 'bg-terracotta-50 text-terracotta-dark ring-terracotta' : st === 'dim' ? 'bg-white/50 text-ink-mute ring-ink/5' : 'bg-white ring-ink/10 hover:ring-ink/30'}`}>{o}</button>
        );
      })}
    </div>
  );
}

function ExerciseView({ ex, locked, onSubmit, onHint }: { ex: Exercise; locked: boolean; onSubmit: (r: Result) => void; onHint: () => void }) {
  const say = useSay();
  const [picked, setPicked] = useState<string | null>(null);

  const conjResult = (verb: Verb, tense: Tense, person: number, given: string, sayText: string): Result => {
    const answer = conjugate(verb, tense, person);
    const res = checkAnswer(given, [answer]);
    if (res === 'correct') return { correct: true, expected: answer, given, sayText };
    if (res === 'accent') return { correct: true, accentOnly: true, expected: answer, given, category: 'accents', sayText };
    return { correct: false, expected: answer, given, category: given ? classifyVerbError(verb, tense, person, given) : 'other', sayText };
  };

  switch (ex.kind) {
    case 'type': {
      const verb = VERB_BY_INF[ex.verb];
      const answer = conjugate(verb, ex.tense, ex.person);
      return (
        <div>
          <h2 className="mt-3 font-display text-3xl font-medium">
            <span className="text-ink-mute">{ex.pronoun}</span> <span className="inline-block min-w-[5ch] border-b-2 border-dashed border-ink/30">&nbsp;</span>
            {verb.pronominal && <span className="text-ink-mute"> el café</span>} <span className="text-lg text-terracotta">({verb.inf} · {TENSES.find((t) => t.id === ex.tense)?.label.toLowerCase()})</span>
          </h2>
          <p className="mt-1 text-ink-mute">{PERSONS_EN[ex.person]}</p>
          <TypeInput locked={locked} verb={verb} answer={answer} cardKey={cardKeyFor(ex)!.key} onHint={onHint} placeholder="Type the form" onSubmit={(v) => onSubmit(conjResult(verb, ex.tense, ex.person, v, `${ex.pronoun} ${answer}`))} />
        </div>
      );
    }
    case 'context': {
      const verb = VERB_BY_INF[ex.verb];
      const pe = parseExample(ex.example);
      return (
        <div>
          <div className="mt-3 rounded-3xl bg-white p-5 shadow-soft">
            <p className="font-display text-2xl leading-relaxed">{pe.before}<span className="mx-1 inline-block min-w-[4ch] border-b-2 border-dashed border-terracotta">&nbsp;</span>{pe.after}</p>
            <p className="mt-2 text-ink-mute">{ex.example.en}</p>
            <p className="mt-1 text-sm text-terracotta">({verb.inf})</p>
          </div>
          <TypeInput locked={locked} verb={verb} answer={pe.answer} cardKey={cardKeyFor(ex)!.key} onHint={onHint} placeholder="Fill the gap" onSubmit={(v) => {
            const res = checkAnswer(v, [pe.answer]);
            const r = res === 'wrong'
              ? { correct: false, expected: pe.answer, given: v, category: v ? classifyVerbError(verb, 'present', ex.person, v) : ('other' as ErrorCategory), sayText: pe.plain }
              : { correct: true, accentOnly: res === 'accent', category: res === 'accent' ? ('accents' as ErrorCategory) : undefined, expected: pe.answer, given: v, sayText: pe.plain };
            onSubmit(r);
          }} />
        </div>
      );
    }
    case 'choice':
    case 'listen': {
      const verb = VERB_BY_INF[ex.verb];
      const answer = conjugate(verb, ex.tense, ex.person);
      const spoken = `${ex.pronoun} ${answer}`;
      return (
        <div>
          {ex.kind === 'listen' ? (
            <div className="mt-4 flex items-center gap-3">
              <button className="btn-dark h-16 w-16 !rounded-full !p-0" onClick={() => say(spoken)} aria-label="Play"><Icon name="play" size={26} filled /></button>
              <button className="ctrl" onClick={() => say(spoken, { slow: true })}><Icon name="slow" size={16} /> Slower</button>
              <p className="text-ink-soft">Which form do you hear?</p>
              <AutoPlay text={spoken} />
            </div>
          ) : (
            <h2 className="mt-3 font-display text-3xl font-medium"><span className="text-ink-mute">{ex.pronoun}</span> ___ <span className="text-lg text-terracotta">({verb.inf})</span></h2>
          )}
          <Options options={ex.options!} locked={locked} answer={answer} picked={picked} onPick={(o) => {
            setPicked(o);
            onSubmit(o === answer ? { correct: true, expected: answer, given: o, sayText: spoken } : { correct: false, expected: answer, given: o, category: classifyVerbError(verb, ex.tense, ex.person, o), sayText: spoken });
          }} />
        </div>
      );
    }
    case 'match':
      return <MatchView ex={ex} locked={locked} onSubmit={onSubmit} />;
    case 'build': {
      return <BuildView ex={ex} locked={locked} onSubmit={onSubmit} />;
    }
    case 'fix': {
      const verb = VERB_BY_INF[ex.verb];
      const pe = parseExample(ex.example);
      const right = verb.present[ex.example.person];
      const wrongShown = pe.answer[0] === pe.answer[0].toUpperCase() ? ex.wrong[0].toUpperCase() + ex.wrong.slice(1) : ex.wrong;
      return (
        <div>
          <div className="mt-3 rounded-3xl bg-white p-5 shadow-soft">
            <p className="font-display text-2xl leading-relaxed">{pe.before}<span className="rounded-lg bg-terracotta-50 px-1.5 text-terracotta-dark line-through decoration-2">{wrongShown}</span>{pe.after}</p>
            <p className="mt-2 text-ink-mute">{ex.example.en}</p>
          </div>
          <p className="mt-4 font-medium">Which form should replace the mistake?</p>
          <Options options={ex.options} locked={locked} answer={right} picked={picked} onPick={(o) => {
            setPicked(o);
            onSubmit(o === right ? { correct: true, expected: right, given: o, sayText: pe.plain } : { correct: false, expected: right, given: o, category: classifyVerbError(verb, 'present', ex.example.person, o), sayText: pe.plain });
          }} />
        </div>
      );
    }
    case 'translate': {
      const pe = parseExample(ex.example);
      return (
        <div>
          <h2 className="mt-3 font-display text-2xl font-medium">“{ex.example.en}”</h2>
          <p className="mt-1 text-ink-mute">Choose the correct Spanish.</p>
          <Options options={ex.options} locked={locked} answer={pe.plain} picked={picked} onPick={(o) => {
            setPicked(o);
            onSubmit(o === pe.plain ? { correct: true, expected: pe.plain, given: o, sayText: pe.plain } : { correct: false, expected: pe.plain, given: o, category: 'person-agreement', sayText: pe.plain });
          }} />
        </div>
      );
    }
    case 'serEstar': {
      const it = ex.item;
      return (
        <div>
          <div className="mt-3 rounded-3xl bg-white p-5 shadow-soft">
            <p className="font-display text-2xl leading-relaxed">{it.before} <span className="inline-block min-w-[4ch] border-b-2 border-dashed border-terracotta">&nbsp;</span> {it.after}</p>
            <p className="mt-2 text-ink-mute">{it.en}</p>
          </div>
          <Options options={it.options} locked={locked} answer={it.answer} picked={picked} onPick={(o) => {
            setPicked(o);
            const full = `${it.before} ${it.answer} ${it.after}`.trim();
            onSubmit(o === it.answer ? { correct: true, expected: it.answer, given: o, explain: it.why, sayText: full } : { correct: false, expected: it.answer, given: o, category: 'ser-estar', explain: it.why, sayText: full });
          }} />
        </div>
      );
    }
  }
}

function AutoPlay({ text }: { text: string }) {
  const say = useSay();
  useEffect(() => { const t = setTimeout(() => say(text), 300); return () => clearTimeout(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function MatchView({ ex, locked, onSubmit }: { ex: Extract<Exercise, { kind: 'match' }>; locked: boolean; onSubmit: (r: Result) => void }) {
  const { update } = useStore();
  const verb = VERB_BY_INF[ex.verb];
  const forms = useMemo(() => shuffle(ex.persons.map((p) => ({ p, f: conjugate(verb, ex.tense, p) }))), [ex, verb]);
  const [sel, setSel] = useState<number | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [wrongFlash, setWrongFlash] = useState<number | null>(null);
  const [misses, setMisses] = useState<number[]>([]);
  const say = useSay();

  const pickForm = (p: number) => {
    if (sel === null || locked) return;
    const key = `verb:${ex.verb}|${ex.tense}|${sel}`;
    if (p === sel) {
      const firstTry = !misses.includes(sel);
      update((s) => recordAttempt(s, { key, grade: firstTry ? 2 : 1, exerciseType: 'match', verb: ex.verb, tense: ex.tense }));
      say(`${ex.pronouns[ex.persons.indexOf(sel)]} ${conjugate(verb, ex.tense, sel)}`);
      const m = [...matched, sel];
      setMatched(m);
      setSel(null);
      if (m.length === ex.persons.length) {
        const ok = misses.length === 0;
        onSubmit({ correct: ok, expected: ex.persons.map((q, i) => `${ex.pronouns[i]} ${conjugate(verb, ex.tense, q)}`).join(' · '), given: ok ? '' : `${misses.length} mismatch${misses.length > 1 ? 'es' : ''}`, category: ok ? undefined : 'person-agreement' });
      }
    } else {
      if (!misses.includes(sel)) {
        setMisses((x) => [...x, sel]);
        update((s) => recordAttempt(s, { key, grade: 0, exerciseType: 'match', verb: ex.verb, tense: ex.tense, mistake: { expected: conjugate(verb, ex.tense, sel), given: conjugate(verb, ex.tense, p), category: 'person-agreement', context: `Match · ${ex.verb}` } }));
      }
      setWrongFlash(p);
      setTimeout(() => setWrongFlash(null), 450);
    }
  };

  return (
    <div>
      <h2 className="mt-3 font-display text-2xl font-medium">Match each pronoun with its form of <span className="text-terracotta">{verb.inf}</span></h2>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          {ex.persons.map((p, i) => (
            <button key={p} disabled={matched.includes(p) || locked} onClick={() => setSel(p)} className={`rounded-2xl px-4 py-3.5 text-lg font-medium ring-1 transition ${matched.includes(p) ? 'bg-olive-50 text-olive ring-olive/30' : sel === p ? 'bg-ink text-cream ring-ink' : 'bg-white ring-ink/10 hover:ring-ink/30'}`}>{ex.pronouns[i]}</button>
          ))}
        </div>
        <div className="grid gap-2">
          {forms.map(({ p, f }) => (
            <motion.button key={p} animate={wrongFlash === p ? { x: [0, -6, 6, -4, 0] } : {}} disabled={matched.includes(p) || locked} onClick={() => pickForm(p)} className={`rounded-2xl px-4 py-3.5 text-lg font-medium ring-1 transition ${matched.includes(p) ? 'bg-olive-50 text-olive ring-olive/30' : wrongFlash === p ? 'bg-terracotta-50 ring-terracotta' : 'bg-white ring-ink/10 hover:ring-ink/30'}`}>{f}</motion.button>
          ))}
        </div>
      </div>
      {sel === null && matched.length === 0 && <p className="mt-3 text-sm text-ink-mute">Tap a pronoun, then its matching form.</p>}
    </div>
  );
}

function BuildView({ ex, locked, onSubmit }: { ex: Extract<Exercise, { kind: 'build' }>; locked: boolean; onSubmit: (r: Result) => void }) {
  const [used, setUsed] = useState<number[]>([]);
  const pe = parseExample(ex.example);
  const verb = VERB_BY_INF[ex.verb];
  const built = used.map((i) => ex.tiles[i]).join(' ');
  return (
    <div>
      <h2 className="mt-3 font-display text-2xl font-medium">“{ex.example.en}”</h2>
      <p className="mt-1 text-ink-mute">Tap the words in order.</p>
      <div className="mt-4 flex min-h-[64px] flex-wrap gap-2 rounded-2xl border-2 border-dashed border-ink/15 bg-white/60 p-3">
        {used.map((ti, k) => (
          <motion.button layout key={ti} disabled={locked} onClick={() => setUsed((u) => u.filter((_, j) => j !== k))} className="rounded-xl bg-ink px-3 py-2 text-lg text-cream">{ex.tiles[ti]}</motion.button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {ex.tiles.map((t, ti) => (
          <motion.button layout key={ti} disabled={used.includes(ti) || locked} onClick={() => setUsed((u) => [...u, ti])} className={`rounded-xl px-3 py-2 text-lg ring-1 ring-ink/10 ${used.includes(ti) ? 'invisible' : 'bg-white hover:ring-ink/30'}`}>{t}</motion.button>
        ))}
      </div>
      <button className="btn-primary mt-5" disabled={locked || used.length !== ex.tiles.length} onClick={() => {
        const ok = normalize(built) === normalize(pe.plain);
        onSubmit(ok ? { correct: true, expected: pe.plain, given: built, sayText: pe.plain } : { correct: false, expected: pe.plain, given: built, category: built.includes(pe.answer) ? 'other' : classifyVerbError(verb, 'present', ex.example.person, built), sayText: pe.plain, explain: 'Word order: in Spanish the subject pronoun is often dropped, and "no" goes right before the verb.' });
      }}>Check</button>
    </div>
  );
}

// ─────────────────────────── Verb detail ───────────────────────────

function VerbSheet({ verb, onClose, onPractise }: { verb: Verb | null; onClose: () => void; onPractise: (inf: string) => void }) {
  const { state } = useStore();
  const say = useSay();
  const region = state.profile?.region ?? 'spain';
  const persons = personsForRegion(region);
  const [tense, setTense] = useState<Tense>('present');
  if (!verb) return null;
  return (
    <Sheet open={!!verb} onClose={onClose} title={`${verb.inf} — ${verb.en}`}>
      <p className="eyebrow -mt-2 mb-3">{groupLabel(verb.group)}</p>
      <div className="mb-3 flex gap-1.5">
        {TENSES.map((t) => <button key={t.id} className="chip !py-1.5 text-xs" aria-pressed={tense === t.id} onClick={() => setTense(t.id)}>{t.label}</button>)}
      </div>
      <div className="grid gap-1.5">
        {persons.map((p) => {
          const f = conjugate(verb, tense, p);
          const pron = verb.pronominal ? '' : personLabel(p);
          return (
            <button key={p} onClick={() => say(`${verb.pronominal ? '' : personLabel(p).split(' ')[0]} ${f}`)} className="flex items-center justify-between rounded-xl bg-white px-4 py-2.5 text-left ring-1 ring-ink/5 hover:ring-ink/20">
              <span className="text-ink-mute">{pron}</span>
              <span className="flex items-center gap-2 font-semibold">{f} <Icon name="volume" size={16} className="text-ink-mute" /></span>
            </button>
          );
        })}
      </div>
      {region === 'mexico' && <p className="mt-2 text-xs text-ink-mute">Vosotros is hidden for Mexican Spanish — ustedes is used for "you all".</p>}
      {verb.note && <p className="mt-4 rounded-2xl bg-azul-50 p-3 text-sm"><b>Note.</b> {verb.note}</p>}
      {verb.origin && <p className="mt-2 rounded-2xl bg-olive-50 p-3 text-sm"><b className="text-olive">Real word origin.</b> {verb.origin}</p>}
      <p className="mt-2 rounded-2xl bg-saffron-50 p-3 text-sm"><b className="text-ink-soft">Memory trick (invented).</b> {verb.trick}</p>
      <div className="mt-4 grid gap-2">
        {verb.examples.map((e, i) => {
          const pe = parseExample(e);
          return (
            <button key={i} onClick={() => say(pe.plain)} className="rounded-xl bg-cream-100 p-3 text-left hover:bg-cream-200">
              <span className="block font-medium">{pe.before}<b className="text-terracotta">{pe.answer}</b>{pe.after}</span>
              <span className="block text-sm text-ink-mute">{e.en}</span>
            </button>
          );
        })}
      </div>
      <button className="btn-primary mt-5 w-full" onClick={() => onPractise(verb.inf)}>Practise {verb.inf}</button>
    </Sheet>
  );
}

// ─────────────────────────── Gym (entry) ───────────────────────────

export function Verbs({ params }: { params: URLSearchParams }) {
  const { state } = useStore();
  const region = state.profile?.region ?? 'spain';
  const level = state.profile?.levels.verbs ?? 'A1';
  const focusParam = params.get('focus')?.split(',').filter((v) => VERB_BY_INF[v]) ?? [];
  const mode = params.get('mode') === 'ser-estar' ? 'ser-estar' : undefined;
  const [tense, setTense] = useState<Tense>((params.get('tense') as Tense) || 'present');
  const [focus, setFocus] = useState<string[]>(focusParam);
  const [session, setSession] = useState<{ ex: Exercise[]; tense: Tense } | null>(null);
  const [detail, setDetail] = useState<Verb | null>(null);
  const [filter, setFilter] = useState<'all' | 'learning' | 'new' | 'mastered'>('all');
  const mastery = useMemo(() => allVerbMastery(state, tense, region), [state, tense, region]);
  const masteryBy = Object.fromEntries(mastery.map((m) => [m.inf, m]));
  // The teacher's level ceiling: tenses above it are locked, unless this is homework the teacher set (?hw=).
  const access = useLevelAccess();
  const ceiling = params.get('hw') ? null : access.maxLevel;
  const tenseLocked = (t: (typeof TENSES)[number]) => !!ceiling && levelIndex(t.minLevel) > levelIndex(ceiling);
  useEffect(() => {
    if (tenseLocked(TENSES.find((t) => t.id === tense)!)) setTense('present');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ceiling]);

  const start = (opts: { focus?: string[]; mode?: 'ser-estar'; tense?: Tense } = {}) => {
    const t = opts.tense ?? tense;
    if (!opts.mode && tenseLocked(TENSES.find((x) => x.id === t)!)) return;
    setSession({ ex: buildSession({ state, focus: opts.focus ?? (focus.length ? focus : undefined), tense: t, mode: opts.mode, maxLevel: ceiling }), tense: t });
  };

  // Deep links (coach, scene completion) start a session immediately.
  useEffect(() => {
    if (mode) start({ mode });
    else if (focusParam.length && (params.get('start') || params.toString().includes('focus'))) start({ focus: focusParam });
    else if (params.get('start')) start({ tense: (params.get('tense') as Tense) || tense });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString()]);

  if (session) return <Session key={JSON.stringify(session.ex.slice(0, 2))} exercises={session.ex} tense={session.tense} onExit={() => { setSession(null); navigate('verbs'); }} />;

  const tenseAllowed = (t: (typeof TENSES)[number]) => levelIndex(level) >= levelIndex(t.minLevel);
  const counts = { mastered: mastery.filter((m) => m.level === 'mastered').length, familiar: mastery.filter((m) => m.level === 'familiar').length, learning: mastery.filter((m) => m.level === 'learning').length };
  const shown = VERBS.filter((v) => {
    const m = masteryBy[v.inf];
    if (filter === 'all') return true;
    if (filter === 'new') return m.level === 'new';
    if (filter === 'mastered') return m.level === 'mastered' || m.level === 'familiar';
    return m.level === 'learning';
  });

  return (
    <div>
      <PageHeader eyebrow="Verbos" title="Verb gym" subtitle="Every verb, tense and person is tracked separately. Mistakes come back automatically until they stick." />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="card p-5">
          <p className="eyebrow mb-2">Tense</p>
          <div className="flex flex-wrap gap-2">
            {TENSES.map((t) => (
              <button key={t.id} className="chip" aria-pressed={tense === t.id} disabled={tenseLocked(t)} title={tenseLocked(t) ? `Locked by your teacher (from ${t.minLevel})` : undefined} onClick={() => setTense(t.id)} data-testid={`tense-${t.id}`}>
                {t.label}{tenseLocked(t) ? <span className="text-xs opacity-70"> · locked</span> : !tenseAllowed(t) && <span className="text-xs opacity-70">· from {t.minLevel}</span>}
              </button>
            ))}
          </div>
          {ceiling && <p className="mt-2 text-sm text-ink-mute" data-testid="level-note">Your teacher has set your level to {ceiling}: tenses above it are locked until they raise it.</p>}
          {!tenseAllowed(TENSES.find((t) => t.id === tense)!) && <p className="mt-2 text-sm text-ink-mute">Recommended from {TENSES.find((t) => t.id === tense)!.minLevel}. You can still try it — your verbs level is {level}.</p>}
          <p className="eyebrow mb-2 mt-5">Focus</p>
          {focus.length ? (
            <div className="flex flex-wrap items-center gap-2">
              {focus.map((f) => <button key={f} className="chip" aria-pressed onClick={() => setFocus(focus.filter((x) => x !== f))}>{f} <Icon name="x" size={14} /></button>)}
              <button className="ctrl" onClick={() => setFocus([])}>Clear — let the app choose</button>
            </div>
          ) : (
            <p className="text-sm text-ink-soft">The app picks for you: forms due for review, then weak verbs, then up to two new verbs. Tap verbs below to choose your own.</p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => start()}><Icon name="play" size={18} filled /> Start 12-exercise session</button>
            <button className="btn-ghost" onClick={() => start({ mode: 'ser-estar', tense: 'present' })}>Ser vs estar drill</button>
          </div>
        </div>
        <div className="card flex items-center gap-4 p-5">
          <ProgressRing value={(counts.mastered + counts.familiar * 0.5) / VERBS.length} size={92} stroke={9} color="rgb(var(--c-tertiary))">
            <span className="text-center text-xs leading-tight"><b className="block font-display text-2xl">{counts.mastered}</b>mastered</span>
          </ProgressRing>
          <div className="text-sm">
            <p><b>{counts.familiar}</b> familiar</p>
            <p><b>{counts.learning}</b> learning</p>
            <p><b>{VERBS.length - counts.mastered - counts.familiar - counts.learning}</b> not started</p>
            <p className="mt-1 text-xs text-ink-mute">{TENSES.find((t) => t.id === tense)?.label} tense</p>
          </div>
        </div>
      </div>

      <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">{VERBS.length} essential verbs</h2>
        <div className="flex gap-1.5">
          {(['all', 'learning', 'mastered', 'new'] as const).map((f) => <button key={f} className="chip !py-1.5 text-xs capitalize" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === 'mastered' ? 'strong' : f}</button>)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((v) => {
          const m = masteryBy[v.inf];
          const inFocus = focus.includes(v.inf);
          return (
            <div key={v.inf} className={`card flex items-center gap-3 p-3 ${inFocus ? 'ring-2 ring-terracotta' : ''}`}>
              <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setDetail(v)} aria-label={`${v.inf}: details`}>
                <ProgressRing value={m.score} size={40} stroke={5} color={m.level === 'mastered' ? 'rgb(var(--c-tertiary))' : 'rgb(var(--c-primary))'} label={`${v.inf} ${Math.round(m.score * 100)}% strength`} />
                <span className="min-w-0">
                  <span className="block font-semibold">{v.inf}</span>
                  <span className="block truncate text-xs text-ink-mute">{v.en.split(' (')[0]}</span>
                </span>
              </button>
              <button className="rounded-full p-1.5 text-ink-mute hover:bg-cream-100" aria-pressed={inFocus} aria-label={inFocus ? `Remove ${v.inf} from focus` : `Add ${v.inf} to focus`} onClick={() => setFocus(inFocus ? focus.filter((x) => x !== v.inf) : [...focus, v.inf])}>
                <Icon name={inFocus ? 'check' : 'sparkle'} size={16} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="card mt-8 p-5">
        <h3 className="text-lg font-semibold">Coming next in the verb curriculum</h3>
        <p className="mt-1 text-sm text-ink-soft">The engine supports any tense; these will be added as validated content:</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ROADMAP_TENSES.map((t) => <span key={t} className="rounded-full bg-cream-100 px-3 py-1 text-sm text-ink-soft">{t}</span>)}
        </div>
      </div>

      <VerbSheet verb={detail} onClose={() => setDetail(null)} onPractise={(inf) => { setDetail(null); start({ focus: [inf] }); }} />
    </div>
  );
}
