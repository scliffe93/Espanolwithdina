import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GRAMMAR_DRILLS, GRAMMAR_MODE_BY_ID, type GrammarItem, type GrammarMode } from '../../data/grammar';
import { shuffle } from '../../lib/exercises';
import { useSay } from '../../hooks/useSpeech';
import { GameShell, type GameApi } from './GameShell';
import type { GameInfo } from './registry';

// The level games: one quick-fire game per grammar point, each opening at the level where that point is taught.
// A sentence with a gap, two or three ways to fill it, a bar draining. The reason is shown after every miss.

type Mode = Exclude<GrammarMode, 'ser-estar'>;

function Dash({ api, mode }: { api: GameApi; mode: Mode }) {
  const say = useSay();
  const items = useMemo(() => shuffle(GRAMMAR_DRILLS[mode]), [mode]);
  const idx = useRef(0);
  const [round, setRound] = useState<{ id: number; it: GrammarItem; options: string[] }>(() => ({ id: 0, it: items[0], options: shuffle(items[0].options) }));
  const [picked, setPicked] = useState<string | null>(null);
  const seconds = Math.max(6, 12 - (api.hud.level - 1) * 0.8);
  const it = round.it;
  const full = `${it.before} ${it.answer} ${it.after}`.replace(/\s+/g, ' ').trim();
  const next = () => { idx.current++; const n = items[idx.current % items.length]; setPicked(null); setRound({ id: idx.current, it: n, options: shuffle(n.options) }); };

  const answer = (opt: string | null, e?: React.MouseEvent) => {
    if (picked !== null || !api.playing) return;
    setPicked(opt ?? '');
    const attempt = { key: `grammar:${mode}|${GRAMMAR_DRILLS[mode].indexOf(it)}`, exerciseType: `game-grammar-${mode}` };
    if (opt === it.answer) { api.hit(110, attempt, { label: full, correct: true }, e ? { x: e.clientX, y: e.clientY } : undefined); void say(full); setTimeout(next, 750); }
    else { api.miss({ ...attempt, mistake: { expected: it.answer, given: opt ?? '(too slow)', category: 'other', context: `${GRAMMAR_MODE_BY_ID[mode].label} game` } }, { label: full, correct: false, detail: it.why }); setTimeout(next, 2600); }
  };
  useEffect(() => {
    if (picked !== null || !api.playing) return;
    const t = setTimeout(() => answer(null), seconds * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.id, picked, api.playing]);

  const right = picked === it.answer;
  return (
    <div className="overflow-hidden rounded-4xl bg-ink text-cream shadow-lift">
      <div className="h-2 bg-white/10"><div key={`${round.id}:${picked ?? ''}:${api.playing}`} className="h-full w-full origin-left bg-saffron" style={picked !== null || !api.playing ? { transform: 'scaleX(0)' } : { animation: `lwd-drain ${seconds}s linear forwards`, willChange: 'transform' }} /></div>
      <div className="p-5 sm:p-7">
        <p className="eyebrow !text-saffron-light">{GRAMMAR_MODE_BY_ID[mode].es}</p>
        <motion.p key={round.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="mt-2 font-display text-[26px] font-medium leading-snug sm:text-3xl" lang="es">
          {it.before} {picked !== null ? <b className={right ? 'text-saffron-light' : 'text-terracotta-light underline decoration-2 underline-offset-4'}>{it.answer}</b> : <span className="inline-block min-w-[4ch] border-b-[3px] border-dashed border-cream/50">&nbsp;</span>}{it.hint && picked === null && <span className="ml-1 align-middle font-sans text-sm text-cream/60">({it.hint})</span>} {it.after}
        </motion.p>
        <p className="mt-2 text-sm text-cream/70">{it.en}</p>
        <p className="mt-3 min-h-[2.8rem] text-sm" role="status">{picked !== null && <span className={right ? 'font-semibold text-saffron-light' : 'text-cream'}>{right ? '¡Eso es! ' : picked ? 'Not quite. ' : 'Out of time. '}{it.why}</span>}</p>
      </div>
      <div className={`grid gap-2.5 bg-cream p-4 ${round.options.length > 2 ? 'sm:grid-cols-3' : 'grid-cols-2'}`}>
        {round.options.map((o) => {
          const cls = picked === null ? 'bg-white text-ink ring-ink/10 active:scale-95' : o === it.answer ? 'bg-olive text-white ring-olive' : o === picked ? 'bg-terracotta text-white ring-terracotta' : 'bg-white text-ink-mute ring-ink/5';
          return <button key={round.id + o} type="button" disabled={picked !== null} onClick={(e) => answer(o, e)} className={`rounded-2xl px-3 py-4 text-center font-display text-xl font-semibold ring-2 transition-[background-color,color,transform] duration-150 ${cls}`} lang="es" data-right={o === it.answer || undefined}>{o}</button>;
        })}
      </div>
    </div>
  );
}

export function GrammarDash({ id, mode }: { id: GameInfo['id']; mode: Mode }) {
  return <GameShell id={id} duration={75} lives={4}>{(api) => <Dash api={api} mode={mode} />}</GameShell>;
}
