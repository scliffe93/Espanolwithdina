import { useT } from '../lib/i18n';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from '../components/Icon';
import { HelpMeRemember, type MemorySource } from '../components/HelpMeRemember';
import { Bar, ProgressRing, Sheet } from '../components/ui';
import { personLabel, PERSONS_EN, ROADMAP_TENSES, TENSES, VERBS, VERB_BY_INF, conjugate, groupLabel, parseExample, personsForRegion, type Tense, type Verb } from '../data/verbs';
import { useSay, stopSpeaking } from '../hooks/useSpeech';
import { VerbGrid } from './VerbGrid';
import { VerbFamilies } from './VerbFamilies';
import { recognitionSupported, recognize, regionLang, type RecognitionHandle } from '../lib/speech';
import { allVerbMastery } from '../lib/analytics';
import { CATEGORY_LABEL, CATEGORY_TIP, checkAnswer, classifyVerbError, normalize } from '../lib/answer';
import { levelIndex } from '../lib/assessmentScore';
import { LADDER_BY_ID, SENTENCE_STEPS, parseRung } from '../data/ladders';
import { TOPICS, matchTopics, ownTopics, toggleOwnTopic, topicsOf } from '../data/topics';
import { EX_LABEL, buildSession, cardKeyFor, pronounFor, shuffle, type Exercise } from '../lib/exercises';
import { navigate } from '../lib/router';
import { addSpeakingAttempt, completeLesson, recordAttempt } from '../lib/state';
import { useStore } from '../lib/store';
import { confetti, haptic, sfx } from '../lib/fx';
import { logIssue } from '../lib/diagnostics';
import { useHomeworkCompletion } from '../lib/platform/homework';
import { useLevelAccess } from '../lib/platform/useLevelAccess';
import { GRAMMAR_MODES, type GrammarMode } from '../data/grammar';
import type { FocusTag } from '../lib/platform/types';
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
  /** The debrief tag a grammar-drill slip maps to (por/para → prepositions, tense choice…). */
  focus?: FocusTag;
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
    // The sentence itself goes on the answer sheet, as the student saw it, so the teacher can see the question.
    case 'context': { const pe = parseExample(ex.example); return `Fill the gap: ${pe.before}___${pe.after} (${ex.verb}) · ${ex.example.en}`; }
    case 'build': return `Build the sentence: ${ex.tiles.join(' / ')} · ${ex.example.en}`;
    case 'fix': { const pe = parseExample(ex.example); const wrong = pe.answer[0] === pe.answer[0].toUpperCase() ? ex.wrong[0].toUpperCase() + ex.wrong.slice(1) : ex.wrong; return `Fix the mistake: ${pe.before}«${wrong}»${pe.after} · ${ex.example.en}`; }
    case 'translate': return `Translate: ${ex.example.en}`;
    case 'match': return `Match each pronoun with its form of ${ex.verb} (${tenseLabel(ex.tense)}): ${ex.pronouns.join(', ')}`;
    case 'serEstar': return `${ex.item.before} ___ ${ex.item.after}`.trim();
    case 'grammar': return `${ex.item.before} ___ ${ex.item.after}${ex.item.hint ? ` (${ex.item.hint})` : ''}`.trim();
    case 'extend': { const rung = LADDER_BY_ID[ex.ladder].rungs[ex.rung]; const pr = parseRung(rung); return `Grow the sentence: ${pr.before}___${pr.after} (${rung.en})`; }
  }
}

type LogRow = { verb: string; correct: boolean; category?: ErrorCategory; focus?: FocusTag; expected: string; given: string; prompt: string };

// A session in progress is kept for this tab, so a reload or the phone putting the app to sleep does not lose it.
const SAVED = 'lwd-verb-session';
interface SavedSession { queue: Exercise[]; i: number; log: LogRow[]; tense: Tense; at: number }
function loadSaved(): SavedSession | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(SAVED) ?? 'null') as SavedSession | null;
    if (!v || !Array.isArray(v.queue) || !v.queue[v.i] || Date.now() - v.at > 6 * 3600_000) return null;
    // Only resume exercises this copy of the app can still draw.
    return v.queue.every((e) => e && (e.kind === 'serEstar' || e.kind === 'grammar' ? !!e.item : !!VERB_BY_INF[e.verb])) ? v : null;
  } catch { return null; }
}
function clearSaved() { try { sessionStorage.removeItem(SAVED); } catch { /* ignore */ } }

function Session({ exercises: initial, tense, onExit, onAgain, resume }: { exercises: Exercise[]; tense: Tense; onExit: () => void; onAgain?: () => void; resume?: { i: number; log: LogRow[] } }) {
  const { t, stage } = useT();
  const { update } = useStore();
  const say = useSay();
  const [queue, setQueue] = useState<Exercise[]>(initial);
  const [i, setI] = useState(resume?.i ?? 0);
  const sayTimer = useRef<number>();
  const [result, setResult] = useState<Result | null>(null);
  const [hintUsed, setHintUsed] = useState(false);
  const [log, setLog] = useState<LogRow[]>(resume?.log ?? []);
  const [done, setDone] = useState(false);
  const requeued = useRef(new Set<number>());
  const hw = useHomeworkCompletion();
  const ex = queue[i];

  useEffect(() => setHintUsed(false), [i]);
  useEffect(() => {
    if (hw.isHomework) return; // homework is submitted in one go; it is not resumed half-way
    try { if (done) sessionStorage.removeItem(SAVED); else sessionStorage.setItem(SAVED, JSON.stringify({ queue, i, log, tense, at: Date.now() } satisfies SavedSession)); } catch { /* ignore */ }
  }, [queue, i, log, done, tense, hw.isHomework]);
  useEffect(() => () => window.clearTimeout(sayTimer.current), []);

  const grade = (correct: boolean, accent: boolean): Grade => (!correct ? 0 : accent || hintUsed ? 1 : 2);

  const submit = (r: Result) => {
    if (result) return;
    const card = cardKeyFor(ex);
    const verbInf = ex.kind === 'serEstar' ? ex.item.verb : ex.kind === 'grammar' ? '' : ex.verb;
    update((s) =>
      card
        ? recordAttempt(s, {
            key: card.key,
            grade: grade(r.correct, !!r.accentOnly),
            exerciseType: ex.kind === 'grammar' ? `grammar-${ex.mode}` : ex.kind,
            verb: verbInf || undefined,
            tense: ex.kind === 'grammar' ? undefined : card.tense,
            mistake: !r.correct || r.accentOnly ? { expected: r.expected, given: r.given, category: r.category ?? 'other', context: ex.kind === 'grammar' ? `${GRAMMAR_MODES.find((m) => m.id === ex.mode)?.label} drill` : `${EX_LABEL[ex.kind]} · ${verbInf}` } : undefined,
          })
        : s,
    );
    setLog((l) => [...l, { verb: verbInf, correct: r.correct, category: r.category, focus: r.focus, expected: r.expected, given: r.given, prompt: promptFor(ex) }]);
    // Revisit mistakes automatically later in the session, as a production exercise.
    // Revisit a mistake once; a retry that is also wrong is left for spaced repetition (no endless loops).
    if (!r.correct && card && !requeued.current.has(i) && ex.kind !== 'serEstar' && ex.kind !== 'grammar' && ex.kind !== 'extend' && !(ex as { retry?: boolean }).retry) {
      requeued.current.add(i);
      setQueue((q) => [...q, { kind: 'type', verb: verbInf, tense: card.tense, person: card.person, pronoun: (ex as { pronoun?: string }).pronoun || pronounFor(VERB_BY_INF[verbInf], card.person), retry: true } as Exercise]);
    }
    if (r.correct) sfx.correct(); else { sfx.wrong(); haptic([30, 30, 30]); }
    // The answer is read out just after the chime, not on top of it: the two together made the voice cut out.
    if (r.correct && r.sayText) { const text = r.sayText; window.clearTimeout(sayTimer.current); sayTimer.current = window.setTimeout(() => void say(text), 340); }
    setResult(r);
  };

  const next = () => {
    window.clearTimeout(sayTimer.current);
    setResult(null);
    if (i + 1 < queue.length) setI(i + 1);
    else {
      update((s) => completeLesson(s));
      setDone(true);
      if (!hw.isHomework) hw.log('practice', `Verb session: ${log.filter((l) => l.correct).length}/${log.length} correct (${tense})`);
      if (hw.isHomework) {
        const correct = log.filter((l) => l.correct).length;
        const cats = [...new Set(log.filter((l) => !l.correct && l.category).map((l) => CATEGORY_LABEL[l.category!]))];
        hw.submit({ score: log.length ? correct / log.length : 0, attempts: log.length, correct, summary: `${correct}/${log.length} correct${cats.length ? ` · ${cats.slice(0, 2).join(', ').toLowerCase()}` : ''}`, items: log.slice(0, 60).map((l) => ({ prompt: l.prompt, expected: l.expected, given: l.given, correct: l.correct, ...(l.focus ? { category: l.focus } : l.category ? { category: l.category } : {}) })) });
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
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
            {onAgain && !hw.isHomework && <button className="btn-primary" onClick={onAgain} data-testid="session-again"><Icon name="play" size={18} filled /> {t('Keep going: 12 more')}</button>}
            {missedVerbs.length > 0 && <button className={onAgain && !hw.isHomework ? 'btn-ghost' : 'btn-primary'} onClick={() => navigate(`verbs?focus=${missedVerbs.join(',')}&tense=${tense}&start=1&t=${Date.now()}`)}><Icon name="refresh" size={18} /> {t('Practise my mistakes')}</button>}
            {hw.isHomework && <button className="btn-dark" onClick={hw.backToHomework}><Icon name="check" size={18} /> Homework done — back to my homework</button>}
            <button className="btn-ghost" onClick={onExit}>{t('Verb gym')}</button>
            <button className="btn-ghost" onClick={() => navigate('world')}><Icon name="map" size={18} /> Madrid</button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Nothing to ask (an empty list, or a verb this copy of the app does not know): say so instead of failing.
  if (!ex || (ex.kind !== 'serEstar' && ex.kind !== 'grammar' && !VERB_BY_INF[ex.verb])) {
    return (
      <div className="mx-auto max-w-xl"><div className="card p-6 text-center" data-testid="session-empty">
        <h2 className="text-2xl font-semibold">Nothing to practise here yet</h2>
        <p className="mt-2 text-ink-soft">There are no exercises for this choice. Pick another tense or verb.</p>
        <button className="btn-primary mt-4" onClick={onExit}>Back to the verb gym</button>
      </div></div>
    );
  }
  const verb = ex.kind === 'serEstar' ? VERB_BY_INF[ex.item.verb] : ex.kind === 'grammar' ? null : VERB_BY_INF[ex.verb];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <button className="ctrl !px-2" onClick={() => { clearSaved(); onExit(); }} aria-label="End session"><Icon name="x" size={18} /></button>
        <Bar value={(i + (result ? 1 : 0)) / queue.length} color="bg-olive" />
        <span className="text-sm tabular-nums text-ink-mute">{i + 1}/{queue.length}</span>
      </div>
      <AnimatePresence>
        <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
          <p className="eyebrow">{ex.kind === 'grammar' ? GRAMMAR_MODES.find((m) => m.id === ex.mode)?.[stage >= 2 ? 'es' : 'label'] : t(EX_LABEL[ex.kind])}{verb && <> · <span className="normal-case tracking-normal">{verb.inf} — {verb.en}</span></>}</p>
          <ExerciseView key={i} ex={ex} locked={!!result} onSubmit={submit} onHint={() => setHintUsed(true)} />
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`mt-6 rounded-3xl p-5 ring-1 ${result.correct ? (result.accentOnly ? 'bg-saffron-50 ring-saffron/40' : 'bg-olive-50 ring-olive/30') : 'bg-terracotta-50 ring-terracotta/30'}`} role="status">
            <p className="flex items-center gap-2 text-lg font-semibold">
              <Icon name={result.correct ? 'check' : 'info'} />
              {result.correct ? (result.accentOnly ? 'Correct — watch the accent' : hintUsed ? 'Correct (with a hint)' : '¡Correcto!') : t('Not quite')}
            </p>
            {(!result.correct || result.accentOnly) && <p className="mt-1">{t('Answer:')} <b>{result.expected}</b>{result.given && <span className="text-ink-mute"> · you wrote “{result.given}”</span>}</p>}
            {result.category && !result.correct && <p className="mt-2 text-sm"><b>{CATEGORY_LABEL[result.category]}.</b> {CATEGORY_TIP[result.category]}</p>}
            {result.explain && <p className="mt-2 text-sm text-ink-soft">{result.explain}</p>}
            {!result.correct && verb && cardKeyFor(ex) && (
              <div className="mt-3"><HelpMeRemember source={memoryFor(verb, result.expected, cardKeyFor(ex)!.key)} /></div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {result.sayText && <button className="ctrl" onClick={() => say(result.sayText!)}><Icon name="volume" size={16} /> {t('Listen')}</button>}
              <button className="btn-dark" autoFocus onClick={next}>{t('Continue')} <Icon name="arrowRight" size={18} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────── Exercise views ───────────────────────────

/**
 * What the phone heard, tidied for checking. People say the pronoun too ("yo hablo"), and speech recognition adds
 * capitals and full stops, so those are dropped; if any of its guesses is the right answer, that guess is used.
 */
export function bestHeard(alternatives: string[], answer: string): string {
  const clean = (t: string) => t.trim().replace(/[.,;:!?¡¿]+/g, '').replace(/\s+/g, ' ').toLowerCase();
  const pron = /^(yo|tú|tu|él|el|ella|usted|nosotros|nosotras|vosotros|vosotras|ellos|ellas|ustedes|vos)\s+/;
  const want = clean(answer);
  const tries = alternatives.flatMap((a) => { const c = clean(a); return [c, c.replace(pron, '')]; }).filter(Boolean);
  return tries.find((t) => t === want) ?? tries.find((t) => normalize(t) === normalize(want)) ?? tries[1] ?? tries[0] ?? '';
}

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
  const { t } = useT();
  const [v, setV] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const [showHelp, setShowHelp] = useState(false);
  // Saying the answer: the phone listens once, and what it heard is checked like a typed answer.
  const { state } = useStore();
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const mic = useRef<RecognitionHandle | null>(null);
  const micTimer = useRef<number>();
  // Some phones offer speech recognition and then refuse to run it (an iPhone app on the Home Screen, a blocked
  // microphone). After one refusal the button is put away for this visit, so nobody keeps tapping a dead button.
  const [micOk, setMicOk] = useState(() => { try { return sessionStorage.getItem('lwd-mic-off') !== '1'; } catch { return true; } });
  const micOff = () => { setMicOk(false); try { sessionStorage.setItem('lwd-mic-off', '1'); } catch { /* ignore */ } };
  useEffect(() => () => { window.clearTimeout(micTimer.current); mic.current?.stop(); }, []);
  const listen = () => {
    if (listening) { mic.current?.stop(); return; }
    stopSpeaking();
    setHeard(null);
    let best = '';
    const h = recognize(regionLang(state.profile?.region ?? 'spain'), (alts, isFinal) => {
      best = bestHeard(alts, answer);
      setV(best);
      if (isFinal) mic.current?.stop();
    }, (err) => {
      setListening(false); mic.current = null; window.clearTimeout(micTimer.current);
      const refused = err === 'not-allowed' || err === 'service-not-allowed' || err === 'audio-capture' || err === 'language-not-supported';
      if (refused && !best) { micOff(); logIssue('note', `Speaking answers is not available here (${err})`); }
      if (best) { update((x) => addSpeakingAttempt(x)); onSubmit(best); }
      else setHeard(refused ? 'Speaking is not available on this device right now, so type your answer. If the microphone is blocked, allow it for this site in your phone’s settings.' : 'I did not catch that. Tap the microphone and try again, or type it.');
    });
    if (!h) { micOff(); setHeard('Speaking is not available in this browser. Type your answer.'); return; }
    mic.current = h; setListening(true);
    // Never leave it listening for ever: some phones do not end the turn by themselves.
    micTimer.current = window.setTimeout(() => mic.current?.stop(), 9000);
  };
  const { update } = useStore();
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
        {recognitionSupported && micOk && <button type="button" className={`btn-ghost shrink-0 !px-3.5 ${listening ? '!bg-terracotta !text-white' : ''}`} disabled={locked} onClick={listen} aria-label={listening ? 'Stop listening' : 'Say your answer'} aria-pressed={listening} data-testid="say-answer"><Icon name="mic" size={20} /></button>}
        <button className="btn-primary shrink-0" disabled={locked || !v.trim()}>{t('Check')}</button>
      </div>
      {listening && <p className="mt-2 text-sm font-medium text-terracotta" role="status">Listening… say it in Spanish.</p>}
      {heard && !locked && <p className="mt-2 text-sm text-ink-soft" role="status">{heard}</p>}
      {!locked && <AccentBar onInsert={insert} />}
      {!locked && (
        <div className="mt-3">
          {showHelp ? <HelpMeRemember source={memoryFor(verb, answer, cardKey)} onHintUsed={onHint} onReveal={() => onSubmit('')} /> : <button type="button" className="ctrl" onClick={() => setShowHelp(true)}><Icon name="bulb" size={16} /> {t('Help me remember')}</button>}
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
  const { t } = useT();
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
          <TypeInput locked={locked} verb={verb} answer={answer} cardKey={cardKeyFor(ex)!.key} onHint={onHint} placeholder={t('Type the form')} onSubmit={(v) => onSubmit(conjResult(verb, ex.tense, ex.person, v, `${ex.pronoun} ${answer}`))} />
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
          <TypeInput locked={locked} verb={verb} answer={pe.answer} cardKey={cardKeyFor(ex)!.key} onHint={onHint} placeholder={t('Fill the gap')} onSubmit={(v) => {
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
              <button className="ctrl" onClick={() => say(spoken, { slow: true })}><Icon name="slow" size={16} /> {t('Slower')}</button>
              <p className="text-ink-soft">{t('Which form do you hear?')}</p>
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
          <p className="mt-4 font-medium">{t('Which form should replace the mistake?')}</p>
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
          <p className="mt-1 text-ink-mute">{t('Choose the correct Spanish.')}</p>
          <Options options={ex.options} locked={locked} answer={pe.plain} picked={picked} onPick={(o) => {
            setPicked(o);
            onSubmit(o === pe.plain ? { correct: true, expected: pe.plain, given: o, sayText: pe.plain } : { correct: false, expected: pe.plain, given: o, category: 'person-agreement', sayText: pe.plain });
          }} />
        </div>
      );
    }
    case 'grammar': {
      const it = ex.item;
      const focus = GRAMMAR_MODES.find((m) => m.id === ex.mode)?.focus;
      return (
        <div>
          <div className="mt-3 rounded-3xl bg-white p-5 shadow-soft">
            <p className="font-display text-2xl leading-relaxed" lang="es">{it.before} <span className="inline-block min-w-[4ch] border-b-2 border-dashed border-terracotta">&nbsp;</span>{it.hint && <span className="ml-1 align-middle text-sm text-ink-mute">({it.hint})</span>} {it.after}</p>
            <p className="mt-2 text-ink-mute">{it.en}</p>
          </div>
          <Options options={it.options} locked={locked} answer={it.answer} picked={picked} onPick={(o) => {
            setPicked(o);
            const full = `${it.before} ${it.answer} ${it.after}`.trim();
            onSubmit(o === it.answer ? { correct: true, expected: it.answer, given: o, explain: it.why, sayText: full } : { correct: false, expected: it.answer, given: o, category: 'other', focus, explain: it.why, sayText: full });
          }} />
        </div>
      );
    }
    case 'extend': {
      const ladder = LADDER_BY_ID[ex.ladder];
      const rung = ladder.rungs[ex.rung];
      const pr = parseRung(rung);
      const step = SENTENCE_STEPS[ex.rung];
      return (
        <div>
          <div className="mt-3 rounded-3xl bg-white p-5 shadow-soft" data-testid="extend">
            <div className="mb-3 flex items-center gap-1.5" aria-label={`Step ${ex.rung + 1} of this sentence`}>
              {ladder.rungs.map((_, k) => <span key={k} className={`h-1.5 flex-1 rounded-full ${k < ex.rung ? 'bg-olive' : k === ex.rung ? 'bg-terracotta' : 'bg-ink/10'}`} />)}
            </div>
            {ex.rung > 0 && <p className="text-sm text-ink-mute">{t('So far:')} <span lang="es" className="text-ink-soft">{parseRung(ladder.rungs[ex.rung - 1]).plain}</span></p>}
            <p className="mt-2 font-display text-2xl leading-relaxed" lang="es">{pr.before}<span className="mx-1 inline-block min-w-[6ch] border-b-2 border-dashed border-terracotta">&nbsp;</span>{pr.after}</p>
            <p className="mt-2 text-ink-mute">{rung.en}</p>
            <p className="mt-1 text-sm text-terracotta">{ex.rung === 0 ? `(${ex.verb})` : `${t('Add:')} ${step?.adds ?? ''}`}</p>
          </div>
          <ExtendInput locked={locked} placeholder={t('Type what is missing')} onSubmit={(v) => {
            const res = checkAnswer(v, [pr.add]);
            onSubmit(res === 'wrong'
              ? { correct: false, expected: pr.add, given: v, category: ex.rung === 0 ? 'other' : 'other', sayText: pr.plain }
              : { correct: true, accentOnly: res === 'accent', category: res === 'accent' ? 'accents' : undefined, expected: pr.add, given: v, sayText: pr.plain });
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

/** A plain answer box for adding to a growing sentence: several words, checked as written. */
function ExtendInput({ onSubmit, locked, placeholder }: { onSubmit: (v: string) => void; locked: boolean; placeholder: string }) {
  const { t } = useT();
  const [v, setV] = useState('');
  return (
    <form className="mt-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (!locked && v.trim()) onSubmit(v.trim()); }}>
      <input lang="es" aria-label="Your answer" className="input min-w-0 flex-1 text-lg" value={v} onChange={(e) => setV(e.target.value)} disabled={locked} placeholder={placeholder} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus data-testid="extend-input" />
      <button type="submit" className="btn-primary" disabled={locked || !v.trim()}>{t('Check')}</button>
      {!locked && <button type="button" className="ctrl" onClick={() => onSubmit('')}>{t('Skip')}</button>}
    </form>
  );
}

function MatchView({ ex, locked, onSubmit }: { ex: Extract<Exercise, { kind: 'match' }>; locked: boolean; onSubmit: (r: Result) => void }) {
  const { t } = useT();
  const { update } = useStore();
  const verb = VERB_BY_INF[ex.verb];
  const forms = useMemo(() => shuffle(ex.persons.map((p) => ({ p, f: conjugate(verb, ex.tense, p) }))), [ex, verb]);
  const [sel, setSel] = useState<number | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [wrongFlash, setWrongFlash] = useState<number | null>(null);
  const [misses, setMisses] = useState<number[]>([]);
  // Every wrong pairing tried, in order, so the teacher can see what was mixed up with what.
  const tries = useRef<string[]>([]);
  const say = useSay();

  const pickForm = (p: number) => {
    if (sel === null || locked) return;
    const key = `verb:${ex.verb}|${ex.tense}|${sel}`;
    if (p === sel || conjugate(verb, ex.tense, p) === conjugate(verb, ex.tense, sel)) {
      const firstTry = !misses.includes(sel);
      update((s) => recordAttempt(s, { key, grade: firstTry ? 2 : 1, exerciseType: 'match', verb: ex.verb, tense: ex.tense }));
      say(`${ex.pronouns[ex.persons.indexOf(sel)]} ${conjugate(verb, ex.tense, sel)}`);
      const m = [...matched, sel];
      setMatched(m);
      setSel(null);
      if (m.length === ex.persons.length) {
        const ok = misses.length === 0;
        onSubmit({ correct: ok, expected: ex.persons.map((q, i) => `${ex.pronouns[i]} → ${conjugate(verb, ex.tense, q)}`).join(' · '), given: ok ? 'Matched every pair first time' : `Mixed up: ${tries.current.slice(0, 8).join(', ')}`, category: ok ? undefined : 'person-agreement' });
      }
    } else {
      if (!misses.includes(sel)) {
        setMisses((x) => [...x, sel]);
        update((s) => recordAttempt(s, { key, grade: 0, exerciseType: 'match', verb: ex.verb, tense: ex.tense, mistake: { expected: conjugate(verb, ex.tense, sel), given: conjugate(verb, ex.tense, p), category: 'person-agreement', context: `Match · ${ex.verb}` } }));
      }
      tries.current.push(`${ex.pronouns[ex.persons.indexOf(sel)]} + ${conjugate(verb, ex.tense, p)}`);
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
      {sel === null && matched.length === 0 && <p className="mt-3 text-sm text-ink-mute">{t('Tap a pronoun, then its matching form.')}</p>}
    </div>
  );
}

function BuildView({ ex, locked, onSubmit }: { ex: Extract<Exercise, { kind: 'build' }>; locked: boolean; onSubmit: (r: Result) => void }) {
  const { t } = useT();
  const [used, setUsed] = useState<number[]>([]);
  const pe = parseExample(ex.example);
  const verb = VERB_BY_INF[ex.verb];
  const built = used.map((i) => ex.tiles[i]).join(' ');
  return (
    <div>
      <h2 className="mt-3 font-display text-2xl font-medium">“{ex.example.en}”</h2>
      <p className="mt-1 text-ink-mute">{t('Tap the words in order.')}</p>
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
      }}>{t('Check')}</button>
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
      <div className="mb-3 flex flex-wrap gap-1.5">
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

const GROUP_ORDER: Verb['group'][] = ['regular', 'stem-e-ie', 'stem-o-ue', 'stem-e-i', 'stem-u-ue', 'irregular-yo', 'irregular'];
const GROUP_HINT: Record<Verb['group'], string> = {
  regular: 'they follow the pattern of their ending', 'stem-e-ie': 'quiero, but queremos', 'stem-o-ue': 'puedo, but podemos', 'stem-e-i': 'pido, but pedimos', 'stem-u-ue': 'juego, but jugamos',
  'irregular-yo': 'only the yo form is special', irregular: 'learn these one by one',
};

/** One way of practising, as a card. */
function WayCard({ icon, tone = '', title, text, onClick, testid, primary, badge }: { icon: IconName; tone?: string; title: string; text: string; onClick: () => void; testid: string; primary?: boolean; badge?: string }) {
  return (
    <button type="button" onClick={onClick} data-testid={testid}
      className={`relative flex items-start gap-3 rounded-3xl p-4 text-left ring-1 transition hover:-translate-y-0.5 ${primary ? 'bg-terracotta text-white shadow-lift ring-terracotta' : 'bg-white ring-ink/10 hover:shadow-soft hover:ring-ink/20'}`}>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${primary ? 'bg-white/20 text-white' : tone}`}><Icon name={icon} size={20} filled={icon === 'play'} /></span>
      <span className="min-w-0"><b className="block text-[16px] leading-tight">{title}</b><span className={`mt-1 block text-sm leading-snug ${primary ? 'text-white/85' : 'text-ink-soft'}`}>{text}</span></span>
      {badge && <span className="absolute right-3 top-3 rounded-full bg-saffron px-2 py-0.5 text-[11px] font-bold text-ink">{badge}</span>}
    </button>
  );
}

/** The student says what they are into, in their own words. Their sentences follow it wherever the app has a topic for it. */
function Likes() {
  const { state, update } = useStore();
  const access = useLevelAccess();
  const saved = state.profile?.likes ?? '';
  const [text, setText] = useState(saved);
  const [open, setOpen] = useState(false);
  useEffect(() => { setText(saved); }, [saved]);
  if (!state.profile) return null;
  const found = matchTopics(saved);
  const picked = ownTopics(state.profile);
  const fromTeacher = (access.settings?.topics ?? []);
  const using = topicsOf(access.topics);
  const toggle = (id: string) => update((s) => (s.profile ? { ...s, profile: toggleOwnTopic(s.profile, id) } : s));
  const save = () => { const v = text.trim().slice(0, 300); update((s) => (s.profile ? { ...s, profile: { ...s.profile, likes: v } } : s)); };
  return (
    <section className="card mt-5 flex flex-wrap items-center gap-3 p-3.5" data-testid="likes">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-saffron/25 text-ink"><Icon name="star" size={16} /></span>
      <p className="min-w-0 flex-1 basis-48 text-sm">{using.length ? <><b>Your interests:</b> {using.map((t) => t.label).join(', ')}</> : <><b>What are you into?</b> <span className="text-ink-soft">Your sentences can be about it.</span></>}</p>
      <button type="button" className="ctrl" onClick={() => setOpen(true)} data-testid="likes-open">{using.length ? 'Change' : 'Tell us'}</button>
      <Sheet open={open} onClose={() => setOpen(false)} title="What you’re into">
        <p className="mb-2 text-sm text-ink-soft">Tap what you love. Your sentences, words and games will be about it.</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="What you love" data-testid="likes-topics">
          {TOPICS.map((t) => { const mine = picked.includes(t.id); const on = mine || fromTeacher.includes(t.id) || found.topics.includes(t.id); return (
            <button key={t.id} type="button" aria-pressed={on} onClick={() => toggle(t.id)} disabled={on && !mine} title={on && !mine ? (fromTeacher.includes(t.id) ? 'Chosen by your teacher' : 'From what you wrote') : undefined} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1 transition ${on ? 'bg-ink text-cream ring-ink' : 'bg-cream-100 text-ink ring-ink/10 hover:ring-ink/40'} ${on && !mine ? 'opacity-80' : ''}`} data-testid={`like-${t.id}`} data-on={on || undefined}>{on && <Icon name="check" size={13} />}{t.label}</button>
          ); })}
        </div>
        <form className="mt-4 border-t border-ink/5 pt-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <label className="text-sm font-semibold" htmlFor="likes-text">Anything else? In your own words</label>
          <textarea id="likes-text" className="input mt-1.5 min-h-[70px] w-full" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="For example: golf, old Jaguars, cooking for friends" data-testid="likes-text" />
          <div className="mt-2 flex flex-wrap items-center gap-2"><button type="submit" className="btn-primary !py-2" disabled={text.trim() === saved} data-testid="likes-save">Save</button><span className="text-xs text-ink-mute">Your teacher can see this.</span></div>
          {saved && <p className="mt-2 text-sm text-ink-soft" data-testid="likes-status">“{saved}”{found.topics.length > 0 && <> · your sentences are about {topicsOf(found.topics).map((t) => t.label.toLowerCase()).join(', ')}.</>}{found.unmatched.length > 0 && <> We do not have sentences about {found.unmatched.join(', ')} yet: it has been noted and they will be added.</>}</p>}
        </form>
      </Sheet>
    </section>
  );
}

export function Verbs({ params }: { params: URLSearchParams }) {
  const { t, stage } = useT();
  const { state } = useStore();
  const region = state.profile?.region ?? 'spain';
  const level = state.profile?.levels.verbs ?? 'A1';
  const focusParam = params.get('focus')?.split(',').filter((v) => VERB_BY_INF[v]) ?? [];
  const modeParam = params.get('mode');
  const mode = GRAMMAR_MODES.some((m) => m.id === modeParam) ? (modeParam as GrammarMode) : undefined;
  const [tense, setTense] = useState<Tense>((params.get('tense') as Tense) || 'present');
  const [focus, setFocus] = useState<string[]>(focusParam);
  const [session, setSession] = useState<{ ex: Exercise[]; tense: Tense; resume?: { i: number; log: LogRow[] }; again?: { focus?: string[]; mode?: GrammarMode } } | null>(null);
  const [saved, setSaved] = useState<SavedSession | null>(() => (params.toString() ? null : loadSaved()));
  const [round, setRound] = useState(0);
  const [grid, setGrid] = useState(params.get('grid') === '1');
  const [families, setFamilies] = useState(params.get('families') === '1');
  const [byFamily, setByFamily] = useState(true);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Verb | null>(null);
  const [filter, setFilter] = useState<'all' | 'learning' | 'new' | 'mastered'>('all');
  const mastery = useMemo(() => allVerbMastery(state, tense, region), [state, tense, region]);
  const masteryBy = Object.fromEntries(mastery.map((m) => [m.inf, m]));
  // The teacher's level ceiling: tenses above it are locked, unless this is homework the teacher set (?hw=).
  const access = useLevelAccess();
  const ceiling = params.get('hw') ? null : access.maxLevel;
  // Gradual release: only the verb blocks the teacher has released (homework is never restricted).
  const released = params.get('hw') ? null : access.verbs;
  const myVerbs = useMemo(() => (released ? VERBS.filter((v) => released.has(v.inf)) : VERBS), [released]);
  const tenseLocked = (t: (typeof TENSES)[number]) => !!ceiling && levelIndex(t.minLevel) > levelIndex(ceiling);
  useEffect(() => {
    if (tenseLocked(TENSES.find((t) => t.id === tense)!)) setTense('present');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ceiling]);

  const start = (opts: { focus?: string[]; mode?: GrammarMode; tense?: Tense } = {}) => {
    const t = opts.tense ?? tense;
    if (!opts.mode && tenseLocked(TENSES.find((x) => x.id === t)!)) return;
    const f = opts.focus ?? (focus.length ? focus : undefined);
    setSaved(null); setRound((r) => r + 1);
    setSession({ ex: buildSession({ state, focus: f, tense: t, mode: opts.mode, maxLevel: ceiling, allowed: released, sentence: access.sentence, topics: access.topics }), tense: t, again: { focus: f, mode: opts.mode } });
  };

  // Deep links (coach, scene completion) start a session immediately.
  const linked = useRef<string | null>(null);
  useEffect(() => {
    if (access.loading) return; // wait for the teacher's settings (level, released verbs, sentence length)
    if (linked.current === params.toString()) return; // one start for each link, however often the settings refresh
    linked.current = params.toString();
    if (mode) start({ mode });
    else if (focusParam.length && (params.get('start') || params.toString().includes('focus'))) start({ focus: focusParam });
    else if (params.get('start')) start({ tense: (params.get('tense') as Tense) || tense });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString(), access.loading]);

  if (grid && !session) return <VerbGrid tense={tenseLocked(TENSES.find((t) => t.id === tense)!) ? 'present' : tense} focus={focus.length ? focus : undefined} maxLevel={ceiling} allowed={released} onExit={() => { setGrid(false); navigate('verbs'); }} />;
  if (families && !session) return <VerbFamilies vosotros={region === 'spain'} onExit={() => { setFamilies(false); navigate('verbs'); }} />;
  if (session) return <Session key={round} exercises={session.ex} tense={session.tense} resume={session.resume} onAgain={() => start({ ...session.again, tense: session.tense })} onExit={() => { setSession(null); navigate('verbs'); }} />;

  const tenseAllowed = (t: (typeof TENSES)[number]) => levelIndex(level) >= levelIndex(t.minLevel);
  const tenseNow = TENSES.find((x) => x.id === tense)!;
  // Tenses set out by level. Levels above the learner's own are folded away under "More tenses".
  const tenseLevels = [...new Set(TENSES.map((x) => x.minLevel))].map((lv) => ({ level: lv, tenses: TENSES.filter((x) => x.minLevel === lv), later: levelIndex(lv) > levelIndex(access.level) && levelIndex(lv) > levelIndex(level) }));
  const TenseRow = ({ g }: { g: (typeof tenseLevels)[number] }) => (
    <div className="flex flex-wrap items-center gap-2">
      <span className="grid h-8 w-10 shrink-0 place-items-center rounded-xl bg-cream-100 text-xs font-bold text-ink-soft">{g.level}</span>
      {g.tenses.map((tn) => (
        <button key={tn.id} className="chip" aria-pressed={tense === tn.id} disabled={tenseLocked(tn)} title={tenseLocked(tn) ? `Locked by your teacher (from ${tn.minLevel})` : undefined} onClick={() => setTense(tn.id)} data-testid={`tense-${tn.id}`}>
          {stage >= 2 ? tn.es : tn.label}{tenseLocked(tn) ? <span className="text-xs opacity-70"> · locked</span> : null}
        </button>
      ))}
    </div>
  );
  const mine = released ? mastery.filter((m) => released.has(m.inf)) : mastery;
  const counts = { mastered: mine.filter((m) => m.level === 'mastered').length, familiar: mine.filter((m) => m.level === 'familiar').length, learning: mine.filter((m) => m.level === 'learning').length };
  const shown = myVerbs.filter((v) => {
    const m = masteryBy[v.inf];
    if (filter === 'all') return true;
    if (filter === 'new') return m.level === 'new';
    if (filter === 'mastered') return m.level === 'mastered' || m.level === 'familiar';
    return m.level === 'learning';
  });

  return (
    <div>
      {/* The start: one clear thing to do, and where you stand. */}
      <section className="relative overflow-hidden rounded-4xl bg-ink p-6 text-cream shadow-lift sm:p-8" data-testid="verbs-hero">
        <div className="absolute -right-10 -top-12 h-56 w-56 rounded-full bg-terracotta/40 blur-2xl" />
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="min-w-0 flex-1 basis-72">
            <p className="eyebrow !text-saffron-light">Verbos</p>
            <h1 className="mt-1 font-display text-4xl font-semibold leading-tight sm:text-5xl">{t('Verb gym')}</h1>
            <p className="mt-2 max-w-xl text-cream/80">{focus.length ? <>Next session: <b className="text-cream" lang="es">{focus.join(', ')}</b> in the {tenseNow.label.toLowerCase()}.</> : <>Next session: the {tenseNow.label.toLowerCase()}, on the forms you are due to see again and up to two new verbs.</>}</p>
            {topicsOf(access.topics).length > 0 && <p className="mt-2 inline-flex flex-wrap items-center gap-1.5 rounded-full bg-cream/10 px-3 py-1 text-sm text-cream/90 ring-1 ring-cream/15" data-testid="verbs-topics"><Icon name="star" size={14} /> Made for you: sentences about {topicsOf(access.topics).map((t) => t.blurb).join(', ').replace(/, ([^,]*)$/, ' and $1')}.</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              {saved ? (
                <span className="flex flex-wrap items-center gap-2" data-testid="session-resume">
                  <button className="inline-flex items-center gap-2 rounded-full bg-saffron px-6 py-3 font-bold text-ink shadow-lift transition hover:scale-[1.02]" onClick={() => { setRound((r) => r + 1); setSession({ ex: saved.queue, tense: saved.tense, resume: { i: saved.i, log: saved.log } }); setSaved(null); }}><Icon name="play" size={18} filled /> Carry on</button>
                  <button className="rounded-full bg-cream/10 px-5 py-3 font-semibold text-cream ring-1 ring-cream/20 hover:bg-cream/15" onClick={() => { clearSaved(); setSaved(null); }}>Start fresh</button>
                  <span className="basis-full text-sm text-cream/75"><b className="text-cream">You were on question {saved.i + 1} of {saved.queue.length}.</b> Pick up where you left off?</span>
                </span>
              ) : (
                <button className="inline-flex items-center gap-2 rounded-full bg-saffron px-6 py-3 font-bold text-ink shadow-lift transition hover:scale-[1.02]" onClick={() => start()}><Icon name="play" size={18} filled /> {t('Start 12-exercise session')}</button>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-4 rounded-3xl bg-cream/10 p-4 ring-1 ring-cream/10">
            <ProgressRing value={(counts.mastered + counts.familiar * 0.5) / myVerbs.length} size={92} stroke={9} color="rgb(var(--c-tertiary))">
              <span className="text-center text-xs leading-tight text-cream"><b className="block font-display text-2xl">{counts.mastered}</b>mastered</span>
            </ProgressRing>
            <div className="text-sm text-cream/85">
              <p><b className="text-cream">{counts.familiar}</b> familiar</p>
              <p><b className="text-cream">{counts.learning}</b> learning</p>
              <p><b className="text-cream">{myVerbs.length - counts.mastered - counts.familiar - counts.learning}</b> not started</p>
              <p className="mt-1 text-xs text-cream/60">{tenseNow.label} tense</p>
            </div>
          </div>
        </div>
      </section>

      <Likes />

      {/* Step 1: the tense, set out by level so only what suits you is in front of you. */}
      <section className="card mt-5 p-5" data-testid="verbs-tense">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold"><span className="mr-2 inline-grid h-7 w-7 place-items-center rounded-full bg-terracotta text-sm font-bold text-white">1</span>{t('Tense')}</h2>
          <p className="text-sm text-ink-mute">Now: <b className="text-ink">{stage >= 2 ? tenseNow.es : tenseNow.label}</b></p>
        </div>
        <div className="grid gap-2">
          {tenseLevels.filter((g) => !g.later).map((g) => <TenseRow key={g.level} g={g} />)}
        </div>
        {tenseLevels.some((g) => g.later) && (
          <details className="mt-2" open={tenseLevels.some((g) => g.later && g.tenses.some((x) => x.id === tense))}>
            <summary className="cursor-pointer text-sm font-semibold text-ink-soft">More tenses, from {tenseLevels.find((g) => g.later)!.level} up</summary>
            <div className="mt-2 grid gap-2">{tenseLevels.filter((g) => g.later).map((g) => <TenseRow key={g.level} g={g} />)}</div>
          </details>
        )}
        {released && <p className="mt-3 text-sm text-ink-mute" data-testid="release-note">Your teacher releases verbs in blocks: you have {myVerbs.length} so far, and more arrive as you progress.</p>}
        {ceiling && <p className="mt-3 text-sm text-ink-mute" data-testid="level-note">Your teacher has set your level to {ceiling}: tenses above it are locked until they raise it.</p>}
        {!tenseAllowed(tenseNow) && <p className="mt-3 text-sm text-ink-mute">Recommended from {tenseNow.minLevel}. You can still try it — your verbs level is {level}.</p>}
        <div className="mt-4 border-t border-ink/5 pt-3">
          <p className="eyebrow mb-2">{t('Focus')}</p>
          {focus.length ? (
            <div className="flex flex-wrap items-center gap-2">
              {focus.map((f) => <button key={f} className="chip" aria-pressed onClick={() => setFocus(focus.filter((x) => x !== f))}>{f} <Icon name="x" size={14} /></button>)}
              <button className="ctrl" onClick={() => setFocus([])}>Clear — let the app choose</button>
            </div>
          ) : (
            <p className="text-sm text-ink-soft">The app picks for you. Tap the star on a verb below to choose your own.</p>
          )}
        </div>
      </section>

      {/* Step 2: the ways to practise. */}
      <section className="mt-5" data-testid="verbs-ways">
        <h2 className="mb-3 text-xl font-semibold"><span className="mr-2 inline-grid h-7 w-7 place-items-center rounded-full bg-terracotta text-sm font-bold text-white">2</span>Ways to practise</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <WayCard primary icon="play" title="Session" text={`Twelve mixed questions in the ${tenseNow.label.toLowerCase()}, ending with a sentence that grows.`} onClick={() => start()} testid="way-session" />
          <WayCard icon="edit" tone="bg-azul-50 text-azul" title={t('Grid drill: fill in the table')} text="Several verbs side by side. Fill in every person, with regular and irregular marked." onClick={() => setGrid(true)} testid="open-grid" />
          <WayCard icon="sparkle" tone="bg-olive-50 text-olive" title="Verb families" text="Verbs that change the same way, grouped: e → ie, o → ue, e → i, and the special yo forms. With a game." onClick={() => setFamilies(true)} testid="open-families" badge="New" />
        </div>
        <p className="eyebrow mb-2 mt-5">{t('Grammar drills')}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GRAMMAR_MODES.map((m) => {
            const locked = !!ceiling && levelIndex(m.minLevel) > levelIndex(ceiling);
            return (
              <button key={m.id} type="button" disabled={locked} title={locked ? `Locked by your teacher (from ${m.minLevel})` : undefined} onClick={() => start({ mode: m.id, tense: 'present' })} data-testid={`drill-${m.id}`}
                className="flex items-start gap-3 rounded-3xl bg-white p-4 text-left ring-1 ring-ink/10 transition hover:-translate-y-0.5 hover:shadow-soft hover:ring-ink/20 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-saffron-50 text-xs font-bold text-ink">{m.minLevel}</span>
                <span className="min-w-0"><b className="block leading-tight" lang={stage >= 2 ? 'es' : undefined}>{stage >= 2 ? m.es : m.label}{locked ? <span className="ml-1 text-xs font-normal opacity-70">· locked</span> : null}</b><span className="mt-0.5 block text-sm leading-snug text-ink-soft">{m.blurb}</span></span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold"><span className="mr-2 inline-grid h-7 w-7 place-items-center rounded-full bg-terracotta text-sm font-bold text-white">3</span><span data-testid="verb-count">{released ? `${myVerbs.length} verbs released by your teacher` : `${VERBS.length} essential verbs`}</span></h2>
        <div className="flex flex-wrap gap-1.5">
          <button className="chip !py-1.5 text-xs" aria-pressed={byFamily} onClick={() => setByFamily(!byFamily)} data-testid="verbs-by-family">Grouped by how they change</button>
          {(['all', 'learning', 'mastered', 'new'] as const).map((f) => <button key={f} className="chip !py-1.5 text-xs capitalize" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === 'mastered' ? 'strong' : f}</button>)}
        </div>
      </div>
      {(byFamily ? GROUP_ORDER.map((g) => ({ g, list: shown.filter((v) => v.group === g) })).filter((x) => x.list.length) : [{ g: null, list: shown }]).map(({ g, list }) => (
      <div key={g ?? 'all'} className={g ? 'mb-5' : ''} data-testid={g ? `verb-group-${g}` : undefined}>
      {g && <p className="mb-2 flex items-baseline gap-2"><b className="text-[15px]">{groupLabel(g)}</b><span className="text-sm text-ink-mute">{list.length} verb{list.length === 1 ? '' : 's'} · {GROUP_HINT[g]}</span></p>}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {(openGroups.has(g ?? 'all') ? list : list.slice(0, 4)).map((v) => {
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
              <button className="-m-1 rounded-full p-2.5 text-ink-mute hover:bg-cream-100" aria-pressed={inFocus} aria-label={inFocus ? `Remove ${v.inf} from focus` : `Add ${v.inf} to focus`} onClick={() => setFocus(inFocus ? focus.filter((x) => x !== v.inf) : [...focus, v.inf])}>
                <Icon name={inFocus ? 'check' : 'sparkle'} size={16} />
              </button>
            </div>
          );
        })}
      </div>
      {list.length > 4 && <button type="button" className="ctrl mt-2.5" onClick={() => setOpenGroups((o) => { const n = new Set(o); const key = g ?? 'all'; if (n.has(key)) n.delete(key); else n.add(key); return n; })} data-testid={`verb-more-${g ?? 'all'}`}>{openGroups.has(g ?? 'all') ? 'Show fewer' : `Show all ${list.length}`}</button>}
      </div>
      ))}

      {ROADMAP_TENSES.length > 0 && (
      <div className="card mt-8 p-5">
        <h3 className="text-lg font-semibold">Coming next in the verb curriculum</h3>
        <p className="mt-1 text-sm text-ink-soft">The engine supports any tense; these will be added as validated content:</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ROADMAP_TENSES.map((t) => <span key={t} className="rounded-full bg-cream-100 px-3 py-1 text-sm text-ink-soft">{t}</span>)}
        </div>
      </div>
      )}

      <VerbSheet verb={detail} onClose={() => setDetail(null)} onPractise={(inf) => { setDetail(null); start({ focus: [inf] }); }} />
    </div>
  );
}
