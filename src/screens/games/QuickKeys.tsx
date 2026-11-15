import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { conjugate, personsForRegion, verbKey, type Verb } from '../../data/verbs';
import { classifyVerbError } from '../../lib/answer';
import { pronounFor } from '../../lib/exercises';
import { useSay } from '../../hooks/useSpeech';
import { GameShell, type GameApi } from './GameShell';
import { useVerbPool } from './MetroRush';

// Quick Keys: type the verb form before the bar runs out. The answer is accepted the moment it is right, so there
// is nothing to press: the hands stay on the keyboard and the next verb arrives.

const ACCENTS = ['á', 'é', 'í', 'ó', 'ú', 'ñ'];
/** Accents are forgiven while typing against the clock (the right spelling is always shown afterwards). */
const plain = (t: string) => t.trim().toLowerCase().replace(/[áéíóúü]/g, (c) => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u' })[c] ?? c);

interface Round { id: number; verb: Verb; person: number; pronoun: string; answer: string }

function Keys({ api }: { api: GameApi }) {
  const say = useSay();
  const pool = useVerbPool();
  const persons = personsForRegion();
  const idRef = useRef(0);
  const make = (): Round => {
    for (let i = 0; i < 20; i++) {
      const verb = pool[Math.floor(Math.random() * pool.length)], person = persons[Math.floor(Math.random() * persons.length)];
      const answer = conjugate(verb, 'present', person);
      if (answer) return { id: ++idRef.current, verb, person, pronoun: pronounFor(verb, person), answer };
    }
    const verb = pool[0]; return { id: ++idRef.current, verb, person: 0, pronoun: pronounFor(verb, 0), answer: conjugate(verb, 'present', 0) };
  };
  const [round, setRound] = useState<Round>(make);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<'right' | 'wrong' | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const seconds = Math.max(5, 10 - (api.hud.level - 1) * 0.7);
  const attempt = { key: verbKey(round.verb.inf, 'present', round.person), exerciseType: 'game-type', verb: round.verb.inf, tense: 'present' };
  const label = `${round.pronoun} ${round.answer}`;

  const next = () => { setResult(null); setValue(''); setRound(make()); requestAnimationFrame(() => input.current?.focus()); };
  const fail = (given: string) => {
    if (result) return;
    setResult('wrong');
    const category = given ? classifyVerbError(round.verb, 'present', round.person, given) : 'other';
    api.miss({ ...attempt, mistake: { expected: round.answer, given: given || '(too slow)', category, context: `Quick Keys · ${round.verb.inf}` } }, { label, correct: false, detail: given ? `you typed “${given}”` : 'out of time', category });
    setTimeout(next, 1500);
  };
  const type = (v: string) => {
    if (result || !api.playing) return;
    setValue(v);
    if (plain(v) === plain(round.answer)) {
      setResult('right');
      const r = input.current?.getBoundingClientRect();
      api.hit(120, attempt, { label, correct: true }, r ? { x: r.left + r.width / 2, y: r.top } : undefined);
      void say(label);
      setTimeout(next, 520);
    }
  };
  // The clock for this verb.
  useEffect(() => {
    if (result || !api.playing) return;
    const t = setTimeout(() => fail(value.trim()), seconds * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.id, result, api.playing]);
  useEffect(() => { if (api.playing) input.current?.focus(); }, [api.playing]);

  return (
    <div className="overflow-hidden rounded-4xl bg-terracotta text-white shadow-lift">
      <div className="p-5 text-center sm:p-7">
        <p className="eyebrow !text-white/75">Present · level {api.hud.level}</p>
        <motion.p key={round.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="mt-1 font-display text-4xl font-semibold sm:text-5xl" lang="es"><span className="text-saffron-light">{round.pronoun}</span> · {round.verb.inf}</motion.p>
        <p className="mt-1 text-sm text-white/80">{round.verb.en.split(' (')[0]}</p>
      </div>
      <div className="bg-cream p-4 text-ink sm:p-5">
        <div className="h-2 overflow-hidden rounded-full bg-ink/10">
          <div key={`${round.id}:${result ?? ''}:${api.playing}`} className="h-full w-full origin-left bg-terracotta" style={result || !api.playing ? { transform: 'scaleX(0)' } : { animation: `lwd-drain ${seconds}s linear forwards`, willChange: 'transform' }} />
        </div>
        <input ref={input} value={result === 'right' ? round.answer : value} onChange={(e) => type(e.target.value)} readOnly={!!result} autoFocus autoCapitalize="off" autoComplete="off" autoCorrect="off" spellCheck={false} lang="es" enterKeyHint="go" aria-label="Type the form" placeholder="Type the form"
          className={`mt-3 w-full rounded-2xl px-4 py-3.5 text-center font-display text-3xl font-semibold ring-2 transition-colors focus:outline-none ${result === 'right' ? 'bg-olive-50 text-olive ring-olive' : result === 'wrong' ? 'bg-terracotta-50 ring-terracotta' : 'bg-white ring-ink/15 focus:ring-terracotta'}`} data-testid="keys-input" />
        <p className="mt-2 min-h-[1.6rem] text-center" role="status">{result === 'wrong' ? <>It is <b lang="es" data-testid="keys-answer">{label}</b></> : result === 'right' ? <span className="font-semibold text-olive">¡Eso es!</span> : <span className="text-sm text-ink-mute">It is accepted as soon as it is right</span>}</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
          {ACCENTS.map((c) => <button key={c} type="button" className="h-9 w-9 rounded-xl bg-white text-lg ring-1 ring-ink/10" onMouseDown={(e) => e.preventDefault()} onClick={() => type(value + c)}>{c}</button>)}
          <button type="button" className="ctrl ml-2" disabled={!!result} onClick={() => fail(value.trim())}>Skip</button>
        </div>
      </div>
    </div>
  );
}

export function QuickKeys() {
  return <GameShell id="type" duration={75} lives={4}>{(api) => <Keys api={api} />}</GameShell>;
}
