import { useT } from '../../lib/i18n';
import { motion } from 'motion/react';
import { useMemo, useRef, useState } from 'react';
import { VOCAB, vocabForm, vocabKey, type VocabItem } from '../../data/vocab';
import { shuffle } from '../../lib/exercises';
import { useSay } from '../../hooks/useSpeech';
import { withinLevel } from '../../lib/platform/level';
import { useLevelAccess } from '../../lib/platform/useLevelAccess';
import { useStore } from '../../lib/store';
import { GameShell, type GameApi } from './GameShell';

// Pairs: five Spanish words, five meanings, tap the partners. A matched pair is replaced by a new one, so the
// board never empties and the pace is the player's own. Words come from the learner's own deck first.

const SLOTS = 5;

function Board({ api }: { api: GameApi }) {
  const { state } = useStore();
  const say = useSay();
  const region = state.profile?.region ?? 'spain';
  const { t } = useT();
  const { maxLevel } = useLevelAccess();
  const pool = useMemo(() => {
    const ok = VOCAB.filter((v) => withinLevel(v.level, maxLevel) && v.en.length <= 26 && vocabForm(v, region).length <= 26);
    const mine = ok.filter((v) => state.srs[vocabKey(v.id)]);
    const liked = ok.filter((v) => (state.profile?.interests ?? []).includes(v.theme as never));
    const easy = ok.filter((v) => v.level === 'A1' || v.level === 'A2');
    // Their own words first, then their interests, then the everyday ones: at least forty to draw from.
    const out = [...new Set([...shuffle(mine), ...shuffle(liked), ...shuffle(easy), ...shuffle(ok)])];
    return out.slice(0, Math.max(40, mine.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxLevel, region]);
  const cursor = useRef(0);
  const draw = (avoid: VocabItem[]): VocabItem => {
    for (let i = 0; i < pool.length; i++) {
      const v = pool[cursor.current++ % pool.length];
      if (!avoid.some((a) => a.id === v.id || a.en === v.en)) return v;
    }
    return pool[cursor.current++ % pool.length];
  };
  const [left, setLeft] = useState<VocabItem[]>(() => { const first: VocabItem[] = []; while (first.length < SLOTS) first.push(draw(first)); return first; });
  const [right, setRight] = useState<VocabItem[]>(() => shuffle(left));
  const [sel, setSel] = useState<{ l: number | null; r: number | null }>({ l: null, r: null });
  const [flash, setFlash] = useState<{ l: number; r: number; ok: boolean } | null>(null);

  const tryMatch = (l: number, r: number, e: React.MouseEvent) => {
    const a = left[l], b = right[r];
    const ok = a.id === b.id;
    setFlash({ l, r, ok }); setSel({ l: null, r: null });
    const attempt = { key: vocabKey(a.id), exerciseType: 'game-pairs' };
    if (ok) {
      api.hit(80, attempt, { label: `${vocabForm(a, region)} = ${a.en}`, correct: true }, { x: e.clientX, y: e.clientY });
      void say(vocabForm(a, region));
      setTimeout(() => {
        const next = draw(left);
        setLeft((x) => x.map((v, i) => (i === l ? next : v)));
        setRight((x) => x.map((v, i) => (i === r ? next : v)));
        setFlash(null);
      }, 420);
    } else {
      api.miss({ ...attempt, mistake: { expected: a.en, given: b.en, category: 'vocabulary', context: 'Pairs' } }, { label: `${vocabForm(a, region)} = ${a.en}`, correct: false, detail: `not “${b.en}”`, category: 'vocabulary' });
      setTimeout(() => setFlash(null), 480);
    }
  };
  const tap = (side: 'l' | 'r', i: number, e: React.MouseEvent) => {
    if (!api.playing || flash) return;
    const next = { ...sel, [side]: sel[side] === i ? null : i };
    if (next.l !== null && next.r !== null) tryMatch(next.l, next.r, e); else setSel(next);
  };
  const cls = (side: 'l' | 'r', i: number) => {
    const hit = flash && flash[side] === i;
    if (hit) return flash!.ok ? 'bg-olive text-white ring-olive scale-[1.03]' : 'bg-terracotta text-white ring-terracotta';
    if (sel[side] === i) return 'bg-ink text-cream ring-ink scale-[1.03]';
    return 'bg-white text-ink ring-ink/10 active:scale-95';
  };

  return (
    <div className="rounded-4xl bg-azul p-4 shadow-lift sm:p-5">
      <p className="mb-3 text-center text-sm font-medium text-white/80">{t('Tap a word, then its meaning')}</p>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {[left, right].map((col, c) => (
          <div key={c} className="grid gap-2.5 sm:gap-3">
            {col.map((v, i) => {
              const side = c === 0 ? 'l' : 'r';
              const wrong = flash && !flash.ok && flash[side] === i;
              return (
                <motion.button key={`${side}${i}:${v.id}`} type="button" initial={{ opacity: 0, scale: 0.85 }} animate={wrong ? { opacity: 1, scale: 1, x: [0, -7, 7, -4, 0] } : { opacity: 1, scale: 1 }} transition={{ duration: 0.22 }}
                  onClick={(e) => tap(side, i, e)} aria-pressed={sel[side] === i} data-pair={v.id} lang={c === 0 ? 'es' : undefined}
                  className={`flex min-h-[3.6rem] items-center justify-center rounded-2xl px-2.5 py-2 text-center text-[15px] font-semibold leading-tight ring-2 transition-[background-color,color,transform] duration-150 sm:text-lg ${cls(side, i)}`}>
                  {c === 0 ? vocabForm(v, region) : v.en}
                </motion.button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Pairs() {
  return <GameShell id="pairs" duration={75} lives={4}>{(api) => <Board api={api} />}</GameShell>;
}
