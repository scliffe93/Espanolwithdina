import { motion } from 'motion/react';
import { useRef, useState } from 'react';
import { DinaArt } from '../../components/Dina';
import { Icon } from '../../components/Icon';
import { Bar } from '../../components/ui';
import { VERB_BY_INF, TENSES, verbKey } from '../../data/verbs';
import { vocabKey } from '../../data/vocab';
import { useSay } from '../../hooks/useSpeech';
import { classifyVerbError, normalize, stripAccents } from '../../lib/answer';
import { confetti, haptic, sfx } from '../../lib/fx';
import { MATERIAL_KIND_LABEL, dictationScore, promptFor, type MaterialItem } from '../../lib/material';
import { usePlatform } from '../../lib/platform/context';
import { relative } from '../../lib/platform/time';
import type { Homework, ResultItem } from '../../lib/platform/types';
import { navigate } from '../../lib/router';
import { recordAttempt, updateDay } from '../../lib/state';
import { useStore } from '../../lib/store';
import { Marked } from './Marked';

// ───────────────────────────────────────────────────────────────
// Runs the exercises the teacher built from their own material, one at
// a time: gap-fills on the text's verbs, sentence building, dictation,
// vocabulary meaning, and the teacher's open questions (marked by the
// teacher). Every answer is kept for the marking sheet; verb and
// vocabulary answers also feed the learner's spaced repetition.
// ───────────────────────────────────────────────────────────────

interface Answer { ok: boolean | null; given: string; expected?: string; note?: string }

export function MaterialRunner({ h, now, readOnly }: { h: Homework; now: number; readOnly: boolean }) {
  const { backend, bump } = usePlatform();
  const { update } = useStore();
  const say = useSay();
  const set = h.activity.material;
  const [started, setStarted] = useState(!h.result);
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [typed, setTyped] = useState('');
  const [tiles, setTiles] = useState<{ word: string; used: boolean }[]>([]);
  const [built, setBuilt] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const results = useRef<ResultItem[]>([]);
  const items = set?.items ?? [];
  const item = items[i];

  if (!set) return <p className="mt-4 text-sm text-ink-mute">This homework has no exercises attached.</p>;

  const record = (it: MaterialItem, a: Answer) => {
    results.current.push({ prompt: promptFor(it), given: a.given, ...(a.expected ? { expected: a.expected } : {}), correct: a.ok !== false, ...(a.note ? { category: a.note } : {}) });
    if (it.kind === 'cloze' && a.ok !== null) {
      const verb = VERB_BY_INF[it.inf];
      const category = a.ok ? undefined : classifyVerbError(verb, it.tense, it.person, a.given);
      if (category) results.current[results.current.length - 1].category = category;
      update((s) => recordAttempt(s, { key: verbKey(it.inf, it.tense, it.person), grade: a.ok ? 2 : 0, exerciseType: 'material-cloze', verb: it.inf, tense: it.tense, mistake: a.ok ? undefined : { expected: it.answer, given: a.given, category: category ?? 'other', context: `Lesson material: ${set.title}` } }));
    } else if (it.kind === 'vocab' && a.ok !== null) {
      results.current[results.current.length - 1].category = a.ok ? undefined : 'vocabulary';
      update((s) => recordAttempt(s, { key: vocabKey(it.id), grade: a.ok ? 2 : 0, exerciseType: 'material-vocab', mistake: a.ok ? undefined : { expected: it.en, given: a.given, category: 'vocabulary', context: `Lesson material: ${set.title}` } }));
    } else if (a.ok !== null) {
      update((s) => updateDay(s, (d) => ({ ...d, exercisesAttempted: d.exercisesAttempted + 1, exercisesCorrect: d.exercisesCorrect + (a.ok ? 1 : 0) })));
    }
    if (a.ok) sfx.correct(); else if (a.ok === false) { sfx.wrong(); haptic([30, 30, 30]); }
    setAnswer(a);
  };

  const next = async () => {
    setAnswer(null);
    setTyped('');
    setBuilt([]);
    setTiles([]);
    if (i + 1 < items.length) { setI(i + 1); return; }
    // Finished: score over the auto-scored items, then submit.
    const scored = results.current.filter((r) => !r.prompt.startsWith('Q: '));
    const correct = scored.filter((r) => r.correct).length;
    const questions = results.current.length - scored.length;
    const summary = `${correct}/${scored.length} correct${questions ? ` · ${questions} answer${questions === 1 ? '' : 's'} for Dina to mark` : ''}`;
    if (!backend) return;
    setBusy(true);
    setError(null);
    try {
      await backend.submitHomework(h.id, { completedAt: new Date().toISOString(), score: scored.length ? correct / scored.length : 1, attempts: scored.length, correct, summary, items: results.current.slice(0, 60) });
      bump();
      setDone(summary);
      sfx.win();
      if (scored.length && correct / scored.length >= 0.7) confetti({ count: 120 });
    } catch (e) {
      setError((e as Error).message || 'Couldn’t submit. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <motion.section initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="card mt-4 flex flex-col items-center gap-3 p-8 text-center" role="status" data-testid="hw-submitted">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-olive text-white" aria-hidden><Icon name="check" size={28} /></span>
        <h2 className="font-display text-2xl font-semibold">¡Muy bien! Homework submitted</h2>
        <p className="max-w-md text-ink-soft">{done}. {backend?.kind === 'demo' ? 'Saved on this device — switch to Dina in the Demo menu to see it on her dashboard.' : 'Dina will see every answer and can mark it.'}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn-primary" onClick={() => navigate(`student/homework?done=${encodeURIComponent(h.id)}`)} data-testid="hw-back">Back to my homework</button>
          <button className="btn-ghost" onClick={() => navigate('student')}>My lessons</button>
        </div>
      </motion.section>
    );
  }

  if (readOnly || !started) {
    return (
      <>
        <section className="card mt-4 flex gap-4 p-5" aria-label="The material">
          <div className="hidden shrink-0 sm:block" aria-hidden><DinaArt size={72} expression="smile" /></div>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">From “{set.title}”</p>
            <p lang="es" className="mt-1 text-sm leading-relaxed text-ink-soft">{set.excerpt}{set.excerpt.length >= 600 ? '…' : ''}</p>
            {h.instructions.trim() && <p className="mt-2 text-sm"><b>Dina says:</b> {h.instructions}</p>}
          </div>
        </section>
        {h.result && (
          <section className="card mt-4 p-5" aria-label="Your previous submission">
            <p className="eyebrow">{h.status === 'reviewed' ? 'Reviewed by Dina' : 'Already submitted'} · {relative(h.result.completedAt, now)}</p>
            {h.result.summary && <p className="mt-1 text-sm font-medium">{h.result.summary}</p>}
            {h.feedback && <div className="mt-3 rounded-2xl bg-olive-50 p-3 text-sm"><p className="eyebrow !text-olive">Dina’s feedback · {relative(h.feedback.at, now)}</p><p className="mt-1 leading-relaxed">{h.feedback.body}</p></div>}
            <Marked h={h} />
            {!h.marking && h.result.items && (
              <details className="mt-3 rounded-2xl bg-white/70 p-3 ring-1 ring-ink/5"><summary className="cursor-pointer text-sm font-semibold">Your answers</summary>
                <ol className="mt-2 grid gap-1 text-sm">{h.result.items.map((it, k) => <li key={k} className={`rounded-lg px-2.5 py-1.5 ${it.correct ? '' : 'bg-terracotta-50'}`}><span className="mr-1 text-xs text-ink-mute">{k + 1}.</span><span className="text-ink-soft">{it.prompt}</span> <span lang="es" className={`font-semibold ${it.correct ? 'text-olive' : 'text-terracotta-dark'}`}>{it.given || '—'}</span>{!it.correct && it.expected && <span lang="es" className="text-ink-soft"> → <b className="text-ink">{it.expected}</b></span>}</li>)}</ol>
              </details>
            )}
          </section>
        )}
        <section className="card mt-4 p-5">
          <p className="text-ink-soft">{items.length} exercise{items.length === 1 ? '' : 's'}: {[...new Set(items.map((x) => MATERIAL_KIND_LABEL[x.kind].toLowerCase()))].join(', ')}. Each answer goes to Dina.</p>
          {!readOnly && <button className="btn-primary mt-4" onClick={() => { results.current = []; setI(0); setStarted(true); }} data-testid={`hw-start-${h.id}`}><Icon name="play" size={18} filled /> {h.result ? 'Do it again' : 'Start'}</button>}
        </section>
      </>
    );
  }

  const check = (ok: boolean | null, given: string, expected?: string) => record(item, { ok, given, expected });

  return (
    <section className="card mt-4 p-5" data-testid="material-runner">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">{i + 1}/{items.length} · {MATERIAL_KIND_LABEL[item.kind]}</p>
        <div className="w-32"><Bar value={(i + (answer ? 1 : 0)) / items.length} /></div>
      </div>
      <div className="mt-4">
        {item.kind === 'cloze' && (
          <div>
            <p lang="es" className="font-display text-2xl font-semibold leading-snug">{item.before} <span className="inline-block min-w-[5ch] border-b-2 border-dashed border-ink/40 px-1 text-terracotta">{answer ? item.answer : ' '}</span> {item.after}</p>
            <p className="mt-1 text-sm text-ink-mute">{item.inf} — {item.en} · {TENSES.find((t) => t.id === item.tense)?.label.toLowerCase()}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2" role="group" aria-label="Choose the form">
              {item.options.map((o) => <button key={o} type="button" lang="es" className={`rounded-2xl px-4 py-3 text-left text-lg font-medium ring-1 transition ${answer ? (o === item.answer ? 'bg-olive-50 ring-olive' : o === answer.given ? 'bg-terracotta-50 ring-terracotta' : 'ring-ink/10 opacity-60') : 'bg-white ring-ink/10 hover:ring-ink/40'}`} disabled={!!answer} onClick={() => check(normalize(o) === normalize(item.answer), o, item.answer)} data-testid="material-option">{o}</button>)}
            </div>
          </div>
        )}
        {item.kind === 'vocab' && (
          <div>
            <p className="text-sm text-ink-mute">What does this mean?</p>
            <p lang="es" className="font-display text-3xl font-semibold">{item.es}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2" role="group" aria-label="Choose the meaning">
              {item.options.map((o) => <button key={o} type="button" className={`rounded-2xl px-4 py-3 text-left font-medium ring-1 transition ${answer ? (o === item.en ? 'bg-olive-50 ring-olive' : o === answer.given ? 'bg-terracotta-50 ring-terracotta' : 'ring-ink/10 opacity-60') : 'bg-white ring-ink/10 hover:ring-ink/40'}`} disabled={!!answer} onClick={() => check(o === item.en, o, item.en)} data-testid="material-option">{o}</button>)}
            </div>
          </div>
        )}
        {item.kind === 'build' && (
          <div>
            <p className="text-sm text-ink-mute">Tap the words in order to rebuild the sentence from the text.</p>
            <div className="mt-3 min-h-[52px] rounded-2xl bg-cream-100 p-3 font-display text-xl" lang="es" aria-live="polite" data-testid="material-built">{built.join(' ') || ' '}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(tiles.length ? tiles : item.tiles.map((w) => ({ word: w, used: false }))).map((t, k) => <button key={k} type="button" lang="es" className={`chip !py-2 ${t.used ? 'invisible' : ''}`} disabled={!!answer || t.used} onClick={() => { const cur = tiles.length ? tiles : item.tiles.map((w) => ({ word: w, used: false })); const nt = cur.map((x, j) => (j === k ? { ...x, used: true } : x)); setTiles(nt); setBuilt([...built, t.word]); }}>{t.word}</button>)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="ctrl" disabled={!!answer || !built.length} onClick={() => { const last = built[built.length - 1]; const idx = tiles.map((t) => t.word).lastIndexOf(last); setTiles(tiles.map((t, j) => (j === idx ? { ...t, used: false } : t))); setBuilt(built.slice(0, -1)); }}>Undo</button>
              <button type="button" className="btn-primary" disabled={!!answer || built.length !== item.tiles.length} onClick={() => check(stripAccents(normalize(built.join(' '))) === stripAccents(normalize(item.sentence)), built.join(' '), item.sentence)} data-testid="material-check">Check</button>
            </div>
          </div>
        )}
        {item.kind === 'dictation' && (
          <div>
            <p className="text-sm text-ink-mute">Listen, then type what you hear. Accents and punctuation are forgiven.</p>
            <button type="button" className="btn-soft mt-2" onClick={() => say(item.sentence)}><Icon name="volume" size={16} /> Listen</button>
            <textarea lang="es" className="input mt-3 min-h-[80px]" value={typed} onChange={(e) => setTyped(e.target.value)} disabled={!!answer} placeholder="Escribe la frase…" data-testid="material-typed" />
            <button type="button" className="btn-primary mt-3" disabled={!!answer || !typed.trim()} onClick={() => { const r = dictationScore(typed, item.sentence); check(r.ok, typed.trim(), item.sentence); }} data-testid="material-check">Check</button>
          </div>
        )}
        {item.kind === 'question' && (
          <div>
            <p className="eyebrow">Dina asks</p>
            <p lang="es" className="font-display text-2xl font-semibold leading-snug">{item.prompt}</p>
            <textarea lang="es" className="input mt-3 min-h-[100px]" value={typed} onChange={(e) => setTyped(e.target.value)} disabled={!!answer} placeholder="Escribe tu respuesta…" data-testid="material-typed" />
            <button type="button" className="btn-primary mt-3" disabled={!!answer || !typed.trim()} onClick={() => check(null, typed.trim())} data-testid="material-check">Save answer</button>
            <p className="mt-1 text-xs text-ink-mute">Dina marks this one.</p>
          </div>
        )}
      </div>
      {answer && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`mt-4 rounded-2xl p-4 ${answer.ok === null ? 'bg-azul-50' : answer.ok ? 'bg-olive-50' : 'bg-terracotta-50'}`} role="status" data-testid="material-feedback">
          <p className="font-semibold">{answer.ok === null ? 'Saved for Dina.' : answer.ok ? '¡Eso es!' : 'Not quite.'}{answer.ok === false && answer.expected && <> The text says: <span lang="es" className="font-display text-lg">{answer.expected}</span></>}</p>
          <button className="btn-dark mt-3" onClick={next} disabled={busy} autoFocus data-testid="material-next">{busy ? 'Submitting…' : i + 1 < items.length ? 'Next' : 'Finish and send to Dina'} <Icon name="arrowRight" size={16} /></button>
          {error && <p role="alert" className="mt-2 text-sm text-terracotta-dark">{error}</p>}
        </motion.div>
      )}
    </section>
  );
}
