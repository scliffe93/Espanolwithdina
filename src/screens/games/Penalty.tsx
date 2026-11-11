import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useRef, useState } from 'react';
import { FOOTBALL, footballWords } from '../../data/football';
import type { CityId } from '../../data/storyTypes';
import type { Region } from '../../types';
import { VERBS, conjugate, personsForRegion, verbKey, type Tense, type Verb } from '../../data/verbs';
import { classifyVerbError } from '../../lib/answer';
import { formOptions, pronounFor, shuffle } from '../../lib/exercises';
import { useSay } from '../../hooks/useSpeech';
import { useStore } from '../../lib/store';
import { GameShell, type GameApi } from './GameShell';

// Penalty shoot-out: each verb form is a shot. Pick the right conjugation
// (left post, centre, right post) and you beat the rival club's keeper.
// Every shot is recorded as a verb attempt, like any other practice.

interface Shot { id: number; verb: Verb; person: number; pronoun: string; options: string[]; answer: string }
const ZONES = ['Palo izquierdo', 'Centro', 'Palo derecho'];

function useVerbPool(): Verb[] {
  const { state } = useStore();
  const focus = (new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('focus') ?? '').split(',').filter(Boolean);
  return useMemo(() => {
    if (focus.length) { const f = VERBS.filter((v) => focus.includes(v.inf)); if (f.length) return f; }
    const started = VERBS.filter((v) => Object.keys(state.srs).some((k) => k.startsWith(`verb:${v.inf}|`)));
    const base = [...VERBS].sort((a, b) => a.frequencyRank - b.frequencyRank).slice(0, 16);
    return [...new Set([...started, ...base])];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function Pitch({ api, city: cityOverride, region: regionOverride }: { api: GameApi; city?: CityId; region?: Region }) {
  const { state } = useStore();
  const say = useSay();
  const reduced = useReducedMotion();
  const region = regionOverride ?? state.profile?.region ?? 'spain';
  const city = FOOTBALL[cityOverride ?? state.profile?.city ?? 'madrid'];
  const [mine, rival] = city.clubs;
  const words = footballWords(region);
  const tense = ((new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('tense') as Tense) || 'present') as Tense;
  const pool = useVerbPool();
  const persons = personsForRegion(region);
  const idRef = useRef(0);
  const make = (): Shot => {
    const verb = pool[Math.floor(Math.random() * pool.length)];
    const person = persons[Math.floor(Math.random() * persons.length)];
    const answer = conjugate(verb, tense, person, region);
    const opts = shuffle([answer, ...formOptions(verb, tense, person, region).filter((o) => o !== answer)].slice(0, 3));
    return { id: ++idRef.current, verb, person, pronoun: pronounFor(verb, person), options: opts, answer };
  };
  const [shot, setShot] = useState<Shot>(make);
  const [result, setResult] = useState<{ zone: number; ok: boolean } | null>(null);
  const [goals, setGoals] = useState(0);
  const [saves, setSaves] = useState(0);
  const next = () => { setResult(null); setShot(make()); };

  const kick = (zone: number, e?: React.MouseEvent) => {
    if (result || !api.playing) return;
    const opt = shot.options[zone];
    const ok = opt === shot.answer;
    setResult({ zone, ok });
    const attempt = { key: verbKey(shot.verb.inf, tense, shot.person), exerciseType: 'game-penalty', verb: shot.verb.inf, tense };
    if (ok) {
      setGoals((g) => g + 1);
      api.hit(120, attempt, { label: `${shot.pronoun} ${shot.answer}`, correct: true }, e ? { x: e.clientX, y: e.clientY } : undefined);
      say(`¡Gol! ${shot.pronoun} ${shot.answer}`);
      setTimeout(next, 700);
    } else {
      setSaves((s) => s + 1);
      const category = classifyVerbError(shot.verb, tense, shot.person, opt);
      api.miss({ ...attempt, mistake: { expected: shot.answer, given: opt, category, context: 'Penalty shoot-out' } }, { label: `${shot.pronoun} ${shot.answer}`, correct: false, detail: `you shot “${opt}”`, category });
      setTimeout(next, 1400);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="inline-flex items-center gap-2 font-semibold"><Kit colors={mine.colors} /> {mine.name} <span className="text-ink-mute">(tú)</span></span>
        <span className="font-display text-2xl tabular-nums">{goals} – {saves}</span>
        <span className="inline-flex items-center gap-2 font-semibold"><span className="text-ink-mute">{words.keeper} de</span> {rival.short} <Kit colors={rival.colors} /></span>
      </div>
      <div className="relative overflow-hidden rounded-4xl bg-[#2e8b3d] p-4 pt-6 text-white" style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,.06) 0 28px, transparent 28px 56px)' }}>
        <p className="text-center text-xs uppercase tracking-[0.2em] text-white/80">{words.penalty} · {shot.pronoun} · <b>{shot.verb.inf}</b> <span className="normal-case tracking-normal text-white/70">({shot.verb.en})</span></p>
        <p className="mt-1 text-center font-display text-4xl font-semibold">{shot.pronoun} <span className="text-saffron-light">___</span></p>
        {/* goal */}
        <div className="relative mx-auto mt-4 max-w-md rounded-t-2xl border-4 border-b-0 border-white/90 bg-white/10 p-2" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px)', backgroundSize: '14px 14px' }}>
          <motion.div aria-hidden className="pointer-events-none absolute -top-1 left-1/2 z-10 h-16 w-10 -translate-x-1/2 rounded-full" style={{ background: rival.colors[0], boxShadow: `inset 0 0 0 4px ${rival.colors[1]}` }} animate={result && !reduced ? { x: (result.zone - 1) * 120 - 20, rotate: (result.zone - 1) * 25 } : { x: -20 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} />
          <div className="relative grid grid-cols-3 gap-2 pt-14">
            {shot.options.map((opt, i) => {
              const picked = result?.zone === i;
              return (
                <motion.button key={shot.id + ':' + i} type="button" onClick={(e) => kick(i, e)} disabled={!!result} whileTap={{ scale: 0.95 }} aria-label={`${ZONES[i]}: ${opt}`} data-testid={`shot-${i}`}
                  className={`rounded-2xl px-2 py-4 text-center font-display text-xl font-semibold shadow-soft transition ${picked ? (result?.ok ? 'bg-saffron text-ink' : 'bg-terracotta text-white') : result && opt === shot.answer ? 'bg-olive text-white' : 'bg-white text-ink'}`}>
                  {opt}
                </motion.button>
              );
            })}
          </div>
        </div>
        <motion.div aria-hidden className="mx-auto mt-3 h-7 w-7 rounded-full bg-white shadow-lift" style={{ backgroundImage: 'radial-gradient(circle at 35% 35%, #fff 0 30%, #222 31% 42%, #fff 43%)' }} animate={result && !reduced ? { y: -150, x: (result.zone - 1) * 130, scale: 0.6, opacity: result.ok ? 1 : 0.6 } : { y: 0, x: 0, scale: 1, opacity: 1 }} transition={{ duration: 0.45 }} />
        {result && <p className="mt-2 text-center font-display text-2xl font-semibold" role="status">{result.ok ? '¡GOL!' : `¡Parada! Era “${shot.answer}”`}</p>}
      </div>
      <p className="text-center text-xs text-ink-mute">{city.derby}: {mine.short} contra {rival.short}. Each correct form beats the keeper.</p>
    </div>
  );
}

function Kit({ colors }: { colors: [string, string] }) {
  return <span aria-hidden className="inline-block h-4 w-4 rounded-full ring-1 ring-ink/20" style={{ background: `linear-gradient(90deg, ${colors[0]} 50%, ${colors[1]} 50%)` }} />;
}

/** `city`/`region` override the learner's profile (the pitch page plays for the prospect's city); `onExit` replaces the arcade links. */
export function Penalty({ city, region, onExit }: { city?: CityId; region?: Region; onExit?: () => void } = {}) {
  return <GameShell id="penalty" duration={60} lives={3} onExit={onExit}>{(api) => <Pitch api={api} city={city} region={region} />}</GameShell>;
}
