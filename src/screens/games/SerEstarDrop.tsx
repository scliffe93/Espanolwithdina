import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getActiveVariety, verbKey } from '../../data/verbs';
import { SER_ESTAR, shuffle, type SerEstarItem } from '../../lib/exercises';
import { useSay } from '../../hooks/useSpeech';
import { GameShell, type GameApi } from './GameShell';

function full(it: SerEstarItem) {
  return `${it.before} ${it.answer} ${it.after}`.trim().replace(/ \?/, '?');
}

function Field({ api }: { api: GameApi }) {
  const say = useSay();
  const reduced = useReducedMotion();
  const items = useMemo(() => shuffle(SER_ESTAR.filter((i) => getActiveVariety() === 'spain' || i.person !== 4)), []);
  const idx = useRef(0);
  const [round, setRound] = useState(() => ({ id: 0, it: items[0] }));
  const [res, setRes] = useState<{ pick: 'ser' | 'estar' | null; ok: boolean } | null>(null);
  const fall = Math.max(3.2, 7.5 - (api.hud.level - 1) * 0.7) * (reduced ? 1.5 : 1);

  const next = () => { setRes(null); idx.current++; setRound({ id: idx.current, it: items[idx.current % items.length] }); };

  const answer = (pick: 'ser' | 'estar' | null) => {
    if (res) return;
    if (!api.playing && pick === null) { next(); return; }
    if (!api.playing) return;
    const it = round.it;
    const ok = pick === it.verb;
    setRes({ pick, ok });
    const attempt = { key: verbKey(it.verb, 'present', it.person), exerciseType: 'game-serestar', verb: it.verb, tense: 'present' };
    if (ok) api.hit(100, attempt, { label: full(it), correct: true });
    else api.miss({ ...attempt, mistake: { expected: it.answer, given: pick === null ? '(too slow)' : it.options.find((o) => o !== it.answer) ?? '', category: 'ser-estar', context: 'Ser o Estar' } }, { label: full(it), correct: false, detail: it.why, category: 'ser-estar' });
    say(full(it));
    setTimeout(next, ok ? 700 : 1900);
  };

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 's') answer('ser');
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'e') answer('estar');
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  const it = round.it;
  return (
    <div className="overflow-hidden rounded-4xl bg-gradient-to-b from-saffron-50 via-saffron-light to-saffron shadow-lift">
      <div className="relative h-[340px] overflow-hidden sm:h-[380px]">
        {/* drifting background shapes */}
        {!reduced && [0, 1, 2, 3].map((i) => (
          <motion.span key={i} className="absolute h-16 w-16 rounded-full bg-white/30" style={{ left: `${10 + i * 24}%` }} animate={{ y: [400, -80] }} transition={{ duration: 9 + i * 2, repeat: Infinity, ease: 'linear', delay: i * 1.7 }} />
        ))}
        <AnimatePresence>
          <motion.div
            key={round.id}
            className="absolute inset-x-4 mx-auto max-w-md rounded-3xl bg-white p-5 text-center shadow-lift"
            initial={{ top: -140, rotate: -2 }}
            animate={res ? { top: 110, rotate: 0, x: res.pick === 'ser' ? -40 : res.pick === 'estar' ? 40 : 0, scale: 1.04 } : { top: '72%', rotate: 2 }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
            transition={res ? { type: 'spring', stiffness: 260, damping: 20 } : { duration: fall, ease: 'linear' }}
            onAnimationComplete={() => { if (!res) answer(null); }}
          >
            <p className="font-display text-2xl font-medium leading-snug sm:text-[28px]" lang="es">
              {it.before} {res ? <span className={res.ok ? 'text-olive' : 'text-terracotta'}><b>{it.answer}</b></span> : <span className="inline-block min-w-[3.5ch] border-b-[3px] border-dashed border-ink/30">&nbsp;</span>} {it.after}
            </p>
            <p className="mt-1 text-sm text-ink-mute">{it.en}</p>
            {res && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`mt-2 text-sm font-semibold ${res.ok ? 'text-olive' : 'text-terracotta-dark'}`}>
                {res.ok ? '¡Exacto! ' : res.pick ? '¡Ojo! ' : 'Too slow! '}{it.why}
                {it.ambiguous && <span className="block font-normal text-ink-mute">Note: “{it.options.find((o) => o !== it.answer)}” is also possible, with a different meaning.</span>}
              </motion.p>
            )}
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-x-0 bottom-0 h-3 bg-ink/15" />
      </div>
      <div className="grid grid-cols-2 gap-3 bg-white/40 p-4">
        <motion.button whileTap={{ scale: 0.94 }} onClick={() => answer('ser')} className="rounded-3xl bg-azul py-5 font-display text-3xl font-semibold text-white shadow-lift" aria-label="Ser">SER <span className="block text-xs font-sans font-medium opacity-75">identity · origin · time · traits</span></motion.button>
        <motion.button whileTap={{ scale: 0.94 }} onClick={() => answer('estar')} className="rounded-3xl bg-terracotta py-5 font-display text-3xl font-semibold text-white shadow-lift" aria-label="Estar">ESTAR <span className="block text-xs font-sans font-medium opacity-75">location · states · feelings</span></motion.button>
      </div>
    </div>
  );
}

export function SerEstarDrop() {
  return <GameShell id="serestar" duration={60}>{(api) => <Field api={api} />}</GameShell>;
}
