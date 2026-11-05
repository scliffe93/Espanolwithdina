import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DinaArt, dinaGreeting, type DinaExpression } from './Dina';
import { hasSpanishVoice, speak, ttsSupported } from '../lib/speech';
import { useStore } from '../lib/store';
import { navigate } from '../lib/router';

// Brand colours stay Mediterranean whatever city theme is active.
const BRAND = { terracotta: '#C2593A', terracottaDark: '#963F26', cream: '#FBF6EE', olive: '#5E7149', gold: '#C9A24B', ink: '#1E1B18' };

export const BRAND_NAME = 'Learning with Dina';
export const TAGLINE_ES = 'Tu vida en español empieza aquí';
export const TAGLINE_EN = 'Your Spanish Life Starts Here';

// The entrance plays once per app load, not on every screen change.
let entrancePlayed = false;

function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <span className="block text-left leading-none">
      <span className="block font-display italic" style={{ color: BRAND.olive, fontSize: compact ? 12 : 14 }}>Learning with</span>
      <span className="block font-display font-semibold tracking-tight" style={{ color: BRAND.terracotta, fontSize: compact ? 24 : 34, lineHeight: 0.95 }}>
        Dina<span style={{ color: BRAND.gold }}>.</span>
      </span>
    </span>
  );
}

/**
 * The "Learning with Dina" logo with Dina peeking out from behind it.
 * variant: 'rail' (desktop sidebar), 'bar' (mobile header), 'hero' (welcome screen).
 */
export function BrandLogo({ variant = 'rail' }: { variant?: 'rail' | 'bar' | 'hero' }) {
  const { state } = useStore();
  const reduced = !!useReducedMotion();
  // Every logo mounted during the app's first render pass (sidebar + mobile header) plays the entrance;
  // logos mounted later (e.g. after onboarding) simply appear.
  const playEntrance = useRef(!entrancePlayed && !reduced).current;
  const [entered, setEntered] = useState(!playEntrance);
  const [expression, setExpression] = useState<DinaExpression>('smile');
  const [waving, setWaving] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [bubble, setBubble] = useState(false);
  const bubbleTimer = useRef<number>();
  const greeting = dinaGreeting(state.profile?.gender);
  const audioOk = ttsSupported && hasSpanishVoice();

  const wave = useCallback((ms = 1700) => {
    setWaving(true);
    window.setTimeout(() => setWaving(false), ms);
  }, []);

  // Playful entrance on first mount after the app opens.
  useEffect(() => {
    entrancePlayed = true;
    if (!playEntrance) { setEntered(true); return; }
    const t1 = window.setTimeout(() => { setEntered(true); setExpression('beam'); wave(); }, 350);
    const t2 = window.setTimeout(() => setExpression('smile'), 2400);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [playEntrance, wave]);

  // Idle life: an occasional broad smile and, now and then, a small wave.
  useEffect(() => {
    if (reduced) return;
    let alive = true;
    let t: number;
    const loop = () => {
      t = window.setTimeout(() => {
        if (!alive) return;
        if (Math.random() < 0.22) wave(1500);
        setExpression('beam');
        window.setTimeout(() => alive && setExpression('smile'), 2000);
        loop();
      }, 7000 + Math.random() * 6000);
    };
    loop();
    return () => { alive = false; window.clearTimeout(t); };
  }, [reduced, wave]);

  const greet = async () => {
    window.clearTimeout(bubbleTimer.current);
    setBubble(true);
    setExpression('beam');
    wave(1800);
    if (ttsSupported) {
      setSpeaking(true);
      try {
        await speak(greeting.es, { region: 'argentina', rate: 0.95 });
      } finally {
        setSpeaking(false);
      }
    }
    setExpression('smile');
    bubbleTimer.current = window.setTimeout(() => setBubble(false), 5500);
  };
  useEffect(() => () => window.clearTimeout(bubbleTimer.current), []);

  const size = variant === 'bar' ? 48 : variant === 'hero' ? 104 : 90;

  const dina = (
    <motion.button
      type="button"
      onClick={greet}
      className="group relative block cursor-pointer rounded-full focus-visible:outline-offset-4"
      aria-label={`Dina, your Spanish tutor. Tap to hear: ${greeting.es}`}
      initial={!playEntrance ? false : variant === 'bar' ? { x: -26, opacity: 0, rotate: -12 } : { y: 52, opacity: 0, rotate: -10 }}
      animate={entered ? { x: 0, y: 0, opacity: 1, rotate: variant === 'bar' ? -6 : -4 } : undefined}
      transition={{ type: 'spring', stiffness: 260, damping: 14, mass: 0.8 }}
      whileHover={reduced ? undefined : { y: -3, rotate: 0 }}
      whileTap={reduced ? undefined : { scale: 0.96 }}
    >
      <DinaArt size={size} expression={expression} speaking={speaking} waving={waving} animate={!reduced} />
    </motion.button>
  );

  const speechBubble = (
    <AnimatePresence>
      {bubble && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -6, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.95 }}
          className={`absolute z-50 w-64 rounded-2xl bg-white p-3 text-left shadow-lift ring-1 ring-black/5 ${variant === 'bar' ? 'left-0 top-full mt-2' : 'left-0 top-full mt-3'}`}
          onClick={() => setBubble(false)}
        >
          <span className="absolute -top-1.5 left-10 h-3 w-3 rotate-45 bg-white" aria-hidden />
          <p className="font-display text-lg font-semibold leading-snug" style={{ color: BRAND.terracotta }} lang="es">{greeting.es}</p>
          <p className="text-sm text-ink-soft">{greeting.en}</p>
          {!audioOk && <p className="mt-1 text-xs text-ink-mute">{ttsSupported ? 'No Spanish voice is installed on this device, so the greeting is shown as text.' : 'Audio isn’t available in this browser — here’s what Dina says.'}</p>}
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (variant === 'bar') {
    return (
      <div className="relative flex items-end gap-1">
        <button onClick={() => navigate('world')} className="relative rounded-xl pb-0.5" aria-label={`${BRAND_NAME} — home`} title={`${TAGLINE_ES} · ${TAGLINE_EN}`}>
          <Wordmark compact />
        </button>
        {/* Dina peeks up from behind the header's lower edge, right beside the wordmark */}
        <div className="relative -my-2.5 h-[56px] w-[50px] overflow-hidden">
          <div className="absolute -bottom-3 left-0">{dina}</div>
        </div>
        {speechBubble}
      </div>
    );
  }

  // Geometry: the card's top edge sits at Dina's collarbone so her whole head shows above it.
  const dinaH = (size * 170) / 160;
  const cardTop = Math.round(dinaH * 0.77);
  const dinaRight = variant === 'hero' ? 12 : 8;

  return (
    <div className="relative" style={{ paddingTop: cardTop }}>
      {/* Dina sits behind the card: head and neck above its top edge, shoulders hidden */}
      <div className="absolute top-0 z-0" style={{ right: dinaRight }}>{dina}</div>
      <button
        onClick={() => navigate(state.onboardingDone ? 'world' : 'welcome')}
        className="relative z-10 block w-full rounded-3xl p-4 text-left shadow-soft ring-1"
        style={{ background: BRAND.cream, boxShadow: `0 1px 0 ${BRAND.gold}55, 0 10px 24px -14px ${BRAND.terracottaDark}66`, ['--tw-ring-color' as string]: `${BRAND.gold}66` }}
        aria-label={`${BRAND_NAME} — ${TAGLINE_EN}`}
      >
        <Wordmark />
        <span className="mt-2 block h-px w-12" style={{ background: BRAND.gold }} aria-hidden />
        <span className="mt-2 block font-display text-[13px] italic leading-snug" style={{ color: BRAND.ink }} lang="es">{TAGLINE_ES}</span>
        <span className="block text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: BRAND.olive }}>{TAGLINE_EN}</span>
      </button>
      {speechBubble}
    </div>
  );
}
