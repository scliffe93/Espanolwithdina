import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FOOTBALL, commentarySentences } from '../../data/football';
import { shuffle } from '../../lib/exercises';
import { useSay } from '../../hooks/useSpeech';
import { useStore } from '../../lib/store';
import { GameShell, type GameApi } from './GameShell';

// Line-up: hear a line of match commentary, then put the words in order,
// like naming the starting eleven. Trains listening and Spanish word order
// with the clubs and grounds of your city.

interface Round { id: number; es: string; en: string; words: string[]; order: number[] }

function Field({ api }: { api: GameApi }) {
  const { state } = useStore();
  const say = useSay();
  const region = state.profile?.region ?? 'spain';
  const cityId = state.profile?.city ?? 'madrid';
  const city = FOOTBALL[cityId];
  const sentences = useMemo(() => commentarySentences(cityId, region), [cityId, region]);
  const idRef = useRef(0);
  const used = useRef<number[]>([]);
  const make = (): Round => {
    if (used.current.length >= sentences.length) used.current = [];
    let i = Math.floor(Math.random() * sentences.length);
    while (used.current.includes(i)) i = (i + 1) % sentences.length;
    used.current.push(i);
    const s = sentences[i];
    const words = s.es.split(' ');
    return { id: ++idRef.current, es: s.es, en: s.en, words, order: shuffle(words.map((_, k) => k)) };
  };
  const [round, setRound] = useState<Round>(make);
  const [placed, setPlaced] = useState<number[]>([]);
  const [shake, setShake] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => { say(round.es); startedAt.current = Date.now(); }, [round, say]);

  const pick = (k: number, e?: React.MouseEvent) => {
    if (done || !api.playing || placed.includes(k)) return;
    const expected = placed.length;
    if (k === expected) {
      const next = [...placed, k];
      setPlaced(next);
      if (next.length === round.words.length) {
        setDone(true);
        const secs = (Date.now() - startedAt.current) / 1000;
        api.hit(150 + Math.max(0, Math.round((20 - secs) * 5)), { key: `sentence:fut-${round.es.length}-${round.words[0]}`, exerciseType: 'game-lineup' }, { label: round.es, correct: true, detail: round.en }, e ? { x: e.clientX, y: e.clientY } : undefined);
        say(round.es);
        setTimeout(() => { setPlaced([]); setDone(false); setRound(make()); }, 1500);
      }
    } else {
      setShake(k);
      setTimeout(() => setShake(null), 400);
      api.miss({ key: `sentence:fut-${round.es.length}-${round.words[0]}`, exerciseType: 'game-lineup', mistake: { expected: round.words[expected], given: round.words[k], category: 'other', context: 'Line-up word order' } }, { label: round.es, correct: false, detail: `“${round.words[k]}” does not come next`, category: 'other' });
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-semibold">{city.derby} · Listen, then line up the words</p>
        <button type="button" className="ctrl" onClick={() => say(round.es)}>Repeat</button>
      </div>
      <div className="min-h-[72px] rounded-3xl bg-cream-100 p-3" aria-live="polite">
        <p className="eyebrow !text-[10px]">Your line-up</p>
        <p className="mt-1 font-display text-2xl font-semibold leading-snug">
          {placed.map((k) => round.words[k]).join(' ')}{!done && <span className="text-ink-mute"> {placed.length ? '…' : '(tap the words in order)'}</span>}
        </p>
        {done && <p className="mt-1 text-sm text-olive" role="status">¡Golazo! {round.en}</p>}
      </div>
      <div className="rounded-4xl bg-[#2e8b3d] p-4" style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,.06) 0 28px, transparent 28px 56px)' }}>
        <div className="flex flex-wrap justify-center gap-2">
          {round.order.map((k) => {
            const isPlaced = placed.includes(k);
            return (
              <motion.button key={round.id + ':' + k} type="button" onClick={(e) => pick(k, e)} disabled={isPlaced || done} animate={shake === k ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }} whileTap={{ scale: 0.95 }} data-testid={`lineup-word-${k}`}
                className={`rounded-full px-4 py-2.5 font-semibold shadow-soft transition ${isPlaced ? 'bg-white/30 text-white/60' : 'bg-white text-ink'}`} style={!isPlaced ? { boxShadow: `inset 0 -4px 0 ${city.clubs[0].colors[1]}` } : undefined}>
                {round.words[k]}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function LineUp() {
  return <GameShell id="lineup" duration={90} lives={3}>{(api) => <Field api={api} />}</GameShell>;
}
