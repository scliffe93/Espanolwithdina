import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CITY_THEMES } from '../../data/cityThemes';
import { VERBS, conjugate, personsForRegion, verbKey, type Verb } from '../../data/verbs';
import { classifyVerbError } from '../../lib/answer';
import { formOptions, pronounFor } from '../../lib/exercises';
import { useSay } from '../../hooks/useSpeech';
import { useStore } from '../../lib/store';
import { GameShell, type GameApi } from './GameShell';

interface Round { id: number; verb: Verb; person: number; pronoun: string; options: string[]; answer: string }

function useVerbPool(): Verb[] {
  const { state } = useStore();
  const focus = (new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('focus') ?? '').split(',').filter(Boolean);
  return useMemo(() => {
    if (focus.length) { const f = VERBS.filter((v) => focus.includes(v.inf)); if (f.length) return f; }
    const started = VERBS.filter((v) => Object.keys(state.srs).some((k) => k.startsWith(`verb:${v.inf}|`)));
    const base = [...VERBS].sort((a, b) => a.frequencyRank - b.frequencyRank).slice(0, 16);
    const pool = [...new Set([...started, ...base])];
    return pool;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function Track({ api }: { api: GameApi }) {
  const { state } = useStore();
  const say = useSay();
  const reduced = useReducedMotion();
  const city = CITY_THEMES[state.profile?.city ?? 'madrid'];
  const cable = city.transit.style === 'cable';
  const pool = useVerbPool();
  const persons = personsForRegion();
  const idRef = useRef(0);
  const make = (): Round => {
    const verb = pool[Math.floor(Math.random() * pool.length)];
    const person = persons[Math.floor(Math.random() * persons.length)];
    return { id: ++idRef.current, verb, person, pronoun: pronounFor(verb, person), options: formOptions(verb, 'present', person, state.profile?.region ?? 'spain'), answer: conjugate(verb, 'present', person) };
  };
  const [round, setRound] = useState<Round>(make);
  const [result, setResult] = useState<{ picked: string; ok: boolean } | null>(null);
  const speed = 9 - Math.min(5, api.hud.level - 1) * 0.9; // seconds to cross
  const colors = city.transit.colors;

  const next = () => { setResult(null); setRound(make()); };

  const answer = (opt: string, e?: React.MouseEvent) => {
    if (result || !api.playing) return;
    const ok = opt === round.answer;
    setResult({ picked: opt, ok });
    const attempt = { key: verbKey(round.verb.inf, 'present', round.person), exerciseType: 'game-metro', verb: round.verb.inf, tense: 'present' };
    if (ok) {
      api.hit(100, attempt, { label: `${round.pronoun} ${round.answer}`, correct: true }, e ? { x: e.clientX, y: e.clientY } : undefined);
      say(`${round.pronoun} ${round.answer}`);
      setTimeout(next, 450);
    } else {
      const category = classifyVerbError(round.verb, 'present', round.person, opt);
      api.miss({ ...attempt, mistake: { expected: round.answer, given: opt, category, context: 'Metro Rush' } }, { label: `${round.pronoun} ${round.answer}`, correct: false, detail: `you picked “${opt}”`, category });
      setTimeout(next, 1300);
    }
  };

  const departed = () => {
    if (result) return;
    if (!api.playing) { next(); return; }
    setResult({ picked: '', ok: false });
    api.miss({ key: verbKey(round.verb.inf, 'present', round.person), exerciseType: 'game-metro', verb: round.verb.inf, tense: 'present', mistake: { expected: round.answer, given: '(too slow)', category: 'other', context: 'Metro Rush' } }, { label: `${round.pronoun} ${round.answer}`, correct: false, detail: 'the train left' });
    setTimeout(next, 1100);
  };

  // keyboard 1–4
  useEffect(() => {
    const on = (e: KeyboardEvent) => { const n = Number(e.key); if (n >= 1 && n <= round.options.length) answer(round.options[n - 1]); };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  return (
    <div className="overflow-hidden rounded-4xl bg-azul text-white shadow-lift">
      {/* prompt */}
      <div className="relative p-5 text-center sm:p-6">
        <p className="eyebrow !text-white/70">{city.transit.name} · {city.name} · Level {api.hud.level}</p>
        <motion.p key={round.id} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-1 font-display text-4xl font-semibold sm:text-5xl">
          <span className="text-saffron-light">{round.pronoun}</span> · {round.verb.inf}
        </motion.p>
        <p className="mt-1 text-sm text-white/75">{round.verb.en.split(' (')[0]}</p>
      </div>
      {/* track */}
      <div className="relative h-44 overflow-hidden bg-gradient-to-b from-azul to-[#0d1a2c] sm:h-48">
        {cable ? (
          <div className="absolute inset-x-0 top-6 h-0.5 bg-white/50" />
        ) : (
          <>
            <div className="absolute inset-x-0 bottom-8 h-1.5 bg-white/25" />
            <div className="absolute inset-x-0 bottom-4 h-1.5 bg-white/25" />
            <div className="absolute inset-x-0 bottom-3 flex gap-6 opacity-30">{Array.from({ length: 60 }).map((_, i) => <span key={i} className="h-6 w-2 shrink-0 bg-white/40" />)}</div>
          </>
        )}
        <motion.div
          key={round.id}
          className={`absolute flex gap-2 ${cable ? 'top-6' : 'bottom-9'}`}
          initial={{ left: '100%' }}
          animate={result ? undefined : { left: '-110%' }}
          transition={{ duration: reduced ? speed * 1.6 : speed, ease: 'linear' }}
          onAnimationComplete={departed}
          style={{ width: 'max-content' }}
        >
          {round.options.map((o, i) => {
            const isAns = o === round.answer;
            const state = !result ? 'idle' : isAns ? 'right' : o === result.picked ? 'wrong' : 'dim';
            return (
              <div key={o} className="flex flex-col items-center">
                {cable && <span className="h-6 w-0.5 bg-white/70" />}
                <button
                  onClick={(e) => answer(o, e)}
                  className={`relative min-w-[110px] rounded-2xl px-4 py-4 text-lg font-bold shadow-lift ring-4 transition sm:min-w-[130px] sm:text-xl ${state === 'right' ? 'scale-110 bg-white text-olive ring-olive' : state === 'wrong' ? 'bg-white text-terracotta ring-terracotta' : state === 'dim' ? 'opacity-40 ring-transparent' : 'ring-white/20 hover:-translate-y-1'}`}
                  style={state === 'idle' || state === 'dim' ? { background: colors[i % colors.length], color: '#fff' } : undefined}
                  aria-label={`Carriage ${i + 1}: ${o}`}
                >
                  <span className="absolute left-2 top-1.5 text-[10px] font-bold opacity-70">{i + 1}</span>
                  {o}
                  {!cable && <span className="absolute -bottom-3 left-4 h-4 w-4 rounded-full bg-ink ring-2 ring-white/60" />}
                  {!cable && <span className="absolute -bottom-3 right-4 h-4 w-4 rounded-full bg-ink ring-2 ring-white/60" />}
                </button>
              </div>
            );
          })}
        </motion.div>
      </div>
      <p className="p-3 text-center text-xs text-white/70">{result && !result.ok ? <>Correct: <b className="text-white">{round.pronoun} {round.answer}</b></> : 'Tap a carriage — or press 1–4'}</p>
    </div>
  );
}

export function MetroRush() {
  return <GameShell id="metro" duration={60}>{(api) => <Track api={api} />}</GameShell>;
}

