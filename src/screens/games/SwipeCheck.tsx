import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { VERBS, getActiveVariety, parseExample, verbKey, type Verb } from '../../data/verbs';
import { regularPresent } from '../../lib/answer';
import { SER_ESTAR, shuffle } from '../../lib/exercises';
import { useSay } from '../../hooks/useSpeech';
import { GameShell, type GameApi } from './GameShell';

interface Card {
  id: number;
  shown: string;
  correctSentence: string;
  isCorrect: boolean;
  en: string;
  verb: string;
  person: number;
  wrongForm?: string;
  rightForm: string;
  why?: string;
}

const SUBJECTS = ['yo', 'tú', 'él', 'ella', 'usted', 'nosotros', 'nosotras', 'ellos', 'ellas', 'ustedes', 'vos'];

function capitalise(like: string, w: string) {
  return like[0] === like[0].toUpperCase() ? w[0].toUpperCase() + w.slice(1) : w;
}

/** Builds a deck of judgement cards. Wrong cards are only ones that are wrong in ANY context. */
export function buildDeck(): Omit<Card, 'id'>[] {
  const variety = getActiveVariety();
  const deck: Omit<Card, 'id'>[] = [];
  for (const v of VERBS as Verb[]) {
    for (const ex of v.examples) {
      if (ex.person < 0 || (variety !== 'spain' && ex.person === 4) || (variety === 'argentina' && ex.person === 1)) continue;
      const pe = parseExample(ex);
      const base = { en: ex.en, verb: v.inf, person: ex.person, rightForm: pe.answer, correctSentence: pe.plain };
      deck.push({ ...base, shown: pe.plain, isCorrect: true });
      // Wrong version 1: regularised irregular / stem-changing form (never a real word).
      if (!v.pronominal && v.group !== 'regular') {
        const reg = regularPresent(v.inf, ex.person);
        if (reg.toLowerCase() !== pe.answer.toLowerCase()) {
          const w = capitalise(pe.answer, reg);
          deck.push({ ...base, shown: pe.before + w + pe.after, isCorrect: false, wrongForm: w, why: 'This verb is irregular here.' });
          continue;
        }
      }
      // Wrong version 2: person mismatch, only with an explicit subject right before the verb.
      const prev = pe.before.trim().toLowerCase().split(/\s+/).pop() ?? '';
      if (!v.pronominal && SUBJECTS.includes(prev)) {
        const other = [0, 2, 3, 5].filter((p) => p !== ex.person && v.present[p] !== pe.answer)[0];
        if (other !== undefined) {
          deck.push({ ...base, shown: pe.before + v.present[other] + pe.after, isCorrect: false, wrongForm: v.present[other], why: `With “${prev}”, the verb must agree: ${pe.answer}.` });
        }
      }
    }
  }
  for (const it of SER_ESTAR) {
    if (variety !== 'spain' && it.person === 4) continue;
    const right = `${it.before} ${it.answer} ${it.after}`.trim().replace(/ \?/, '?');
    const wrongOpt = it.options.find((o) => o !== it.answer)!;
    const base = { en: it.en, verb: it.verb, person: it.person, rightForm: it.answer, correctSentence: right, why: it.why };
    deck.push({ ...base, shown: right, isCorrect: true });
    if (it.ambiguous) continue; // the other verb is also possible with a different meaning
    deck.push({ ...base, shown: `${it.before} ${wrongOpt} ${it.after}`.trim().replace(/ \?/, '?'), isCorrect: false, wrongForm: wrongOpt });
  }
  return deck;
}

function Deck({ api }: { api: GameApi }) {
  const say = useSay();
  const all = useMemo(() => shuffle(buildDeck()), []);
  const idx = useRef(0);
  const idRef = useRef(0);
  const draw = (): Card => ({ ...all[idx.current++ % all.length], id: ++idRef.current });
  const [card, setCard] = useState<Card>(draw);
  const [feedback, setFeedback] = useState<{ ok: boolean; card: Card } | null>(null);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-14, 14]);
  const yesOpacity = useTransform(x, [20, 120], [0, 1]);
  const noOpacity = useTransform(x, [-120, -20], [1, 0]);

  const judge = (saysCorrect: boolean) => {
    if (feedback || !api.playing) return;
    const ok = saysCorrect === card.isCorrect;
    const attempt = { key: verbKey(card.verb, 'present', card.person), exerciseType: 'game-swipe', verb: card.verb, tense: 'present' };
    if (ok) api.hit(card.isCorrect ? 80 : 120, attempt, { label: card.correctSentence, correct: true });
    else api.miss({ ...attempt, mistake: { expected: card.rightForm, given: card.wrongForm ?? card.rightForm, category: card.why?.includes('estar') || card.why?.includes('ser') ? 'ser-estar' : 'person-agreement', context: '¿Sí o no?' } }, { label: card.correctSentence, correct: false, detail: card.isCorrect ? 'this one was correct' : `“${card.wrongForm}” was the mistake`, category: 'other' });
    if (!card.isCorrect || !ok) say(card.correctSentence);
    setFeedback({ ok, card });
    setTimeout(() => { setFeedback(null); x.set(0); setCard(draw()); }, ok && card.isCorrect ? 350 : 1500);
  };

  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') judge(true); if (e.key === 'ArrowLeft') judge(false); };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 110) judge(true);
    else if (info.offset.x < -110) judge(false);
  };

  return (
    <div className="overflow-hidden rounded-4xl bg-olive p-4 shadow-lift sm:p-6">
      <div className="relative mx-auto h-[300px] max-w-md">
        <div className="absolute inset-x-6 top-4 h-[260px] rotate-3 rounded-3xl bg-white/40" />
        <div className="absolute inset-x-3 top-2 h-[270px] -rotate-2 rounded-3xl bg-white/60" />
        <AnimatePresence>
          <motion.div
            key={card.id}
            drag={feedback ? false : 'x'}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.9}
            onDragEnd={onDragEnd}
            style={{ x, rotate }}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ x: feedback?.card.id === card.id ? 0 : 400, opacity: 0, transition: { duration: 0.2 } }}
            className="absolute inset-0 flex cursor-grab touch-pan-y flex-col justify-center rounded-3xl bg-white p-6 text-center shadow-lift active:cursor-grabbing"
          >
            <motion.span style={{ opacity: yesOpacity }} className="absolute left-5 top-5 rotate-[-12deg] rounded-xl border-4 border-olive px-3 py-1 text-2xl font-black text-olive">SÍ ✓</motion.span>
            <motion.span style={{ opacity: noOpacity }} className="absolute right-5 top-5 rotate-[12deg] rounded-xl border-4 border-terracotta px-3 py-1 text-2xl font-black text-terracotta">NO ✗</motion.span>
            <p className="eyebrow">Is this correct?</p>
            <p className="mt-3 font-display text-[28px] font-medium leading-snug" lang="es">{card.shown}</p>
            {feedback && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`mt-4 rounded-2xl p-3 text-sm ${feedback.ok ? 'bg-olive-50 text-olive' : 'bg-terracotta-50 text-terracotta-dark'}`}>
                <p className="font-bold">{feedback.ok ? '¡Bien visto!' : '¡Ojo!'} {card.isCorrect ? 'It was correct.' : 'It had a mistake.'}</p>
                {!card.isCorrect && <p className="mt-1 text-ink">✓ {card.correctSentence}</p>}
                <p className="mt-1 text-ink-soft">{card.en}</p>
              </motion.div>
            )}
            {!feedback && <p className="mt-4 text-sm text-ink-mute">Drag the card, tap a button, or use ← →</p>}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-5 flex justify-center gap-6">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => judge(false)} className="grid h-16 w-16 place-items-center rounded-full bg-white text-terracotta shadow-lift" aria-label="Incorrect"><Icon name="x" size={30} /></motion.button>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => judge(true)} className="grid h-16 w-16 place-items-center rounded-full bg-white text-olive shadow-lift" aria-label="Correct"><Icon name="check" size={30} /></motion.button>
      </div>
    </div>
  );
}

export function SwipeCheck() {
  return <GameShell id="swipe" duration={60}>{(api) => <Deck api={api} />}</GameShell>;
}
