import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import { confetti, haptic, sfx } from '../../lib/fx';
import { navigate } from '../../lib/router';
import { completeLesson, recordAttempt, updateDay, type AttemptInput } from '../../lib/state';
import { useStore } from '../../lib/store';
import type { ErrorCategory } from '../../types';
import { GAMES, type GameInfo } from './registry';
import { useHomeworkCompletion } from '../../lib/platform/homework';

export interface Hud {
  score: number;
  combo: number;
  lives: number;
  timeLeft: number;
  level: number;
}

export interface LogItem { label: string; correct: boolean; detail?: string; category?: ErrorCategory }

export interface GameApi {
  hud: Hud;
  playing: boolean;
  /** Award points (multiplied by combo) and record a correct answer. */
  hit: (base: number, attempt?: Omit<AttemptInput, 'grade'> | null, log?: LogItem, at?: { x: number; y: number }) => void;
  /** Lose a life and record a mistake. */
  miss: (attempt?: Omit<AttemptInput, 'grade'> | null, log?: LogItem) => void;
  /** Bonus without affecting combo (e.g. tips). */
  bonus: (n: number) => void;
}

function Popup({ text, x, y }: { text: string; x: number; y: number }) {
  return (
    <motion.div className="pointer-events-none fixed z-[70] -translate-x-1/2 font-display text-3xl font-bold text-terracotta drop-shadow-[0_2px_0_white]" style={{ left: x, top: y }} initial={{ opacity: 0, y: 0, scale: 0.6 }} animate={{ opacity: [0, 1, 1, 0], y: -60, scale: 1.1 }} transition={{ duration: 0.9 }}>
      {text}
    </motion.div>
  );
}

export function GameShell({ id, duration = 60, lives: startLives = 3, children }: { id: GameInfo['id']; duration?: number; lives?: number; children: (api: GameApi) => ReactNode }) {
  const info = GAMES.find((g) => g.id === id)!;
  const { state, update } = useStore();
  const [phase, setPhase] = useState<'intro' | 'countdown' | 'play' | 'paused' | 'over'>('intro');
  const [count, setCount] = useState(3);
  const [hud, setHud] = useState<Hud>({ score: 0, combo: 0, lives: startLives, timeLeft: duration, level: 1 });
  const [log, setLog] = useState<LogItem[]>([]);
  const [popups, setPopups] = useState<{ id: number; text: string; x: number; y: number }[]>([]);
  const [shake, setShake] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const popId = useRef(0);
  const hudRef = useRef(hud);
  hudRef.current = hud;
  const setH = (h: Hud) => { hudRef.current = h; setHud(h); };
  const record = state.games[id];
  const [newBest, setNewBest] = useState(false);
  const hw = useHomeworkCompletion();
  const logRef = useRef(log);
  logRef.current = log;

  // countdown
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (count === 0) { setPhase('play'); sfx.coin(); return; }
    sfx.tick();
    const t = setTimeout(() => setCount((c) => c - 1), 650);
    return () => clearTimeout(t);
  }, [phase, count]);

  // clock
  useEffect(() => {
    if (phase !== 'play') return;
    const iv = setInterval(() => setH({ ...hudRef.current, timeLeft: Math.max(0, hudRef.current.timeLeft - 1) }), 1000);
    return () => clearInterval(iv);
  }, [phase]);

  const finish = useCallback(() => {
    setPhase('over');
    const h = hudRef.current;
    const prev = state.games[id];
    const best = Math.max(prev?.best ?? 0, h.score);
    const isBest = h.score > 0 && h.score > (prev?.best ?? 0);
    setNewBest(isBest);
    if (isBest) { sfx.win(); confetti({ count: 140 }); haptic([30, 40, 30]); } else sfx.lose();
    update((s) => completeLesson({ ...s, games: { ...s.games, [id]: { best, plays: (prev?.plays ?? 0) + 1, lastAt: Date.now(), bestCombo: Math.max(prev?.bestCombo ?? 0, bestCombo) } } }));
    if (hw.isHomework) {
      const l = logRef.current;
      const correct = l.filter((x) => x.correct).length;
      hw.submit({ score: l.length ? correct / l.length : 0, attempts: l.length, correct, summary: `${info.title}: ${h.score} points · ${correct}/${l.length} correct · best streak ${bestCombo}` });
    }
  }, [id, update, state.games, bestCombo, hw, info.title]);

  useEffect(() => {
    if (phase === 'play' && (hud.timeLeft <= 0 || hud.lives <= 0)) finish();
  }, [phase, hud.timeLeft, hud.lives, finish]);

  // Pause when tab hidden
  useEffect(() => {
    const on = () => document.visibilityState === 'hidden' && setPhase((p) => (p === 'play' ? 'paused' : p));
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  const pop = (text: string, at?: { x: number; y: number }) => {
    const id2 = ++popId.current;
    const x = at?.x ?? window.innerWidth / 2;
    const y = at?.y ?? window.innerHeight / 3;
    setPopups((p) => [...p, { id: id2, text, x, y }]);
    setTimeout(() => setPopups((p) => p.filter((q) => q.id !== id2)), 950);
  };

  const hit: GameApi['hit'] = (base, attempt, item, at) => {
    const h = hudRef.current;
    const combo = h.combo + 1;
    const mult = 1 + Math.floor(combo / 3);
    const pts = base * mult;
    pop(`+${pts}${mult > 1 ? ` ×${mult}` : ''}`, at);
    if (combo % 5 === 0) { sfx.combo(combo); confetti({ count: 40, x: at?.x, y: at?.y, spread: 0.6 }); } else sfx.correct();
    setBestCombo((b) => Math.max(b, combo));
    setH({ ...h, score: h.score + pts, combo, level: 1 + Math.floor(combo / 4) });
    haptic(10);
    if (attempt) update((s) => recordAttempt(s, { ...attempt, grade: 2 }));
    else update((s) => updateDay(s, (d) => ({ ...d, exercisesAttempted: d.exercisesAttempted + 1, exercisesCorrect: d.exercisesCorrect + 1 })));
    if (item) setLog((l) => [...l, item]);
  };

  const miss: GameApi['miss'] = (attempt, item) => {
    const h = hudRef.current;
    setH({ ...h, combo: 0, lives: h.lives - 1, level: Math.max(1, h.level - 1) });
    sfx.wrong();
    haptic([40, 30, 40]);
    setShake((n) => n + 1);
    if (attempt) update((s) => recordAttempt(s, { ...attempt, grade: 0 }));
    else update((s) => updateDay(s, (d) => ({ ...d, exercisesAttempted: d.exercisesAttempted + 1 })));
    if (item) setLog((l) => [...l, item]);
  };

  const bonus = (n: number) => setH({ ...hudRef.current, score: hudRef.current.score + n });

  const restart = () => {
    setH({ score: 0, combo: 0, lives: startLives, timeLeft: duration, level: 1 });
    setLog([]);
    setBestCombo(0);
    setCount(3);
    setPhase('countdown');
  };

  const mistakes = log.filter((l) => !l.correct);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header / HUD */}
      <div className="mb-3 flex items-center gap-3">
        <button className="ctrl !px-2" onClick={() => (phase === 'play' ? setPhase('paused') : navigate('games'))} aria-label={phase === 'play' ? 'Pause' : 'Back to arcade'}>
          <Icon name={phase === 'play' ? 'pause' : 'arrowLeft'} size={18} />
        </button>
        <div className="flex-1">
          <p className="font-display text-xl font-semibold leading-none">{info.title}</p>
          <p className="text-xs text-ink-mute">{info.es}{record ? ` · best ${record.best}` : ''}</p>
        </div>
        {(phase === 'play' || phase === 'paused') && (
          <div className="flex items-center gap-2 text-sm font-bold" aria-live="polite">
            <span className="rounded-full bg-white px-3 py-1.5 shadow-soft tabular-nums">{hud.score}</span>
            {hud.combo >= 2 && <motion.span key={hud.combo} initial={{ scale: 1.6 }} animate={{ scale: 1 }} className="rounded-full bg-saffron px-2.5 py-1.5 tabular-nums">🔥 {hud.combo}</motion.span>}
            <span className="rounded-full bg-white px-2.5 py-1.5 shadow-soft" aria-label={`${hud.lives} lives`}>{'❤️'.repeat(Math.max(0, hud.lives))}{'🤍'.repeat(Math.max(0, startLives - hud.lives))}</span>
          </div>
        )}
      </div>
      {(phase === 'play' || phase === 'paused') && (
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuenow={hud.timeLeft} aria-valuemax={duration} aria-label="Time left">
          <motion.div className={`h-full ${hud.timeLeft <= 10 ? 'bg-terracotta' : 'bg-olive'}`} animate={{ width: `${(hud.timeLeft / duration) * 100}%` }} transition={{ duration: 1, ease: 'linear' }} />
        </div>
      )}

      <motion.div key={shake} animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : undefined} transition={{ duration: 0.35 }} className="relative">
        {phase === 'play' || phase === 'paused' ? children({ hud, playing: phase === 'play', hit, miss, bonus }) : null}

        <AnimatePresence>
          {phase === 'intro' && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`relative overflow-hidden rounded-4xl ${info.bg} p-6 text-white shadow-lift sm:p-8`}>
              <motion.span className="absolute -right-6 -top-8 text-[140px] opacity-20" animate={{ rotate: [0, 8, 0] }} transition={{ duration: 4, repeat: Infinity }} aria-hidden>{info.emoji}</motion.span>
              <p className="eyebrow !text-white/80">How to play</p>
              <h1 className="mt-1 font-display text-4xl font-semibold">{info.title}</h1>
              <ol className="mt-4 grid gap-2">
                {info.how.map((h, i) => <li key={i} className="flex items-start gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/25 text-sm font-bold">{i + 1}</span><span className="pt-0.5">{h}</span></li>)}
              </ol>
              <p className="mt-4 rounded-2xl bg-black/15 p-3 text-sm"><b>Trains:</b> {info.trains}</p>
              <button className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-lg font-bold text-ink shadow-lift transition hover:scale-[1.03] active:scale-95" onClick={() => { setCount(3); setPhase('countdown'); }} autoFocus>
                <Icon name="play" size={20} filled /> ¡Vamos!
              </button>
            </motion.div>
          )}
          {phase === 'countdown' && (
            <motion.div className="grid h-80 place-items-center rounded-4xl bg-ink text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <AnimatePresence mode="wait">
                <motion.span key={count} className="font-display text-[120px] font-semibold" initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>{count || '¡Ya!'}</motion.span>
              </AnimatePresence>
            </motion.div>
          )}
          {phase === 'paused' && (
            <motion.div className="absolute inset-0 z-20 grid place-items-center rounded-4xl bg-ink/80 backdrop-blur" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="text-center text-white">
                <p className="font-display text-4xl font-semibold">Pausa</p>
                <div className="mt-4 flex gap-2">
                  <button className="btn bg-white text-ink" onClick={() => setPhase('play')} autoFocus><Icon name="play" size={18} filled /> Resume</button>
                  <button className="btn bg-white/15 text-white" onClick={finish}>End game</button>
                </div>
              </div>
            </motion.div>
          )}
          {phase === 'over' && (
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="card overflow-hidden">
              <div className={`${info.bg} p-6 text-center text-white`}>
                <p className="eyebrow !text-white/80">{hud.lives <= 0 ? 'Out of lives' : '¡Tiempo!'}</p>
                <motion.p className="font-display text-7xl font-semibold" initial={{ scale: 0.5 }} animate={{ scale: [0.5, 1.15, 1] }}>{hud.score}</motion.p>
                {newBest ? <p className="mt-1 inline-flex rounded-full bg-white px-3 py-1 text-sm font-bold text-ink">🏆 New personal best!</p> : record && <p className="text-sm opacity-90">Best: {record.best}</p>}
              </div>
              <div className="grid grid-cols-3 gap-2 p-5 text-center">
                <div className="rounded-2xl bg-cream-100 p-3"><b className="block text-2xl">{log.filter((l) => l.correct).length}</b><span className="text-xs text-ink-mute">correct</span></div>
                <div className="rounded-2xl bg-cream-100 p-3"><b className="block text-2xl">{log.length ? Math.round((log.filter((l) => l.correct).length / log.length) * 100) : 0}%</b><span className="text-xs text-ink-mute">accuracy</span></div>
                <div className="rounded-2xl bg-cream-100 p-3"><b className="block text-2xl">{bestCombo}</b><span className="text-xs text-ink-mute">best streak</span></div>
              </div>
              {mistakes.length > 0 && (
                <div className="px-5 pb-2">
                  <p className="eyebrow mb-2">Learn from these</p>
                  <ul className="grid gap-1.5">
                    {mistakes.slice(-6).map((m, i) => (
                      <li key={i} className="rounded-xl bg-terracotta-50 px-3 py-2 text-sm"><b>{m.label}</b>{m.detail && <span className="text-ink-soft"> — {m.detail}</span>}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-ink-mute">Missed verb forms are scheduled in your memory deck automatically.</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2 p-5 pt-3">
                <button className="btn-primary" onClick={restart} autoFocus><Icon name="refresh" size={18} /> Play again</button>
                {hw.isHomework && <button className="btn-dark" onClick={hw.backToHomework}><Icon name="check" size={18} /> Homework done</button>}
                <button className="btn-ghost" onClick={() => navigate('games')}>Arcade</button>
                {mistakes.some((m) => m.category) && <button className="btn-ghost" onClick={() => navigate('review')}>Review</button>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      {popups.map((p) => <Popup key={p.id} text={p.text} x={p.x} y={p.y} />)}
    </div>
  );
}
