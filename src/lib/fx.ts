// ───────────────────────────────────────────────────────────────
// Game feel: synthesized sound effects (Web Audio, no assets),
// confetti bursts (canvas) and haptics. All optional and cheap.
// ───────────────────────────────────────────────────────────────

let soundOn = true;
let ctx: AudioContext | null = null;

export function setSoundEnabled(on: boolean) {
  soundOn = on;
}

function audio(): AudioContext | null {
  if (!soundOn || typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new C();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.18, slideTo?: number) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export const sfx = {
  correct() { tone(660, 0, 0.12, 'triangle'); tone(990, 0.08, 0.18, 'triangle'); },
  wrong() { tone(220, 0, 0.22, 'sawtooth', 0.08, 140); },
  tap() { tone(520, 0, 0.05, 'square', 0.04); },
  combo(level: number) {
    const base = 520 * Math.pow(1.06, Math.min(level, 12));
    [0, 4, 7, 12].forEach((st, i) => tone(base * Math.pow(2, st / 12), i * 0.05, 0.12, 'triangle', 0.12));
  },
  whoosh() { tone(900, 0, 0.18, 'sine', 0.05, 200); },
  coin() { tone(988, 0, 0.08, 'square', 0.07); tone(1319, 0.07, 0.2, 'square', 0.07); },
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.28, 'triangle', 0.14)); },
  lose() { [392, 330, 262].forEach((f, i) => tone(f, i * 0.14, 0.3, 'triangle', 0.1)); },
  tick() { tone(1200, 0, 0.03, 'square', 0.03); },
};

export function haptic(pattern: number | number[] = 12) {
  try {
    if (soundOn) navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Confetti burst from a point (defaults to centre). Uses the active city palette. */
export function confetti(opts: { x?: number; y?: number; count?: number; spread?: number } = {}) {
  if (typeof document === 'undefined' || reduced()) return;
  const canvas = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '80' });
  document.body.appendChild(canvas);
  const c = canvas.getContext('2d')!;
  c.scale(dpr, dpr);
  const css = getComputedStyle(document.documentElement);
  const colors = ['--c-primary', '--c-secondary', '--c-tertiary', '--c-deep', '--c-rose'].map((v) => `rgb(${css.getPropertyValue(v).trim().replace(/ /g, ',')})`);
  const x0 = opts.x ?? window.innerWidth / 2;
  const y0 = opts.y ?? window.innerHeight / 2.6;
  const spread = opts.spread ?? 1;
  const parts = Array.from({ length: opts.count ?? 90 }, () => {
    const a = Math.random() * Math.PI * 2;
    const v = (4 + Math.random() * 9) * spread;
    return { x: x0, y: y0, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, r: 3 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, color: colors[(Math.random() * colors.length) | 0], shape: Math.random() < 0.5 ? 0 : 1 };
  });
  const t0 = performance.now();
  const frame = (t: number) => {
    const age = t - t0;
    c.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of parts) {
      p.vy += 0.32;
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      c.save();
      c.globalAlpha = Math.max(0, 1 - age / 1800);
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.fillStyle = p.color;
      if (p.shape) c.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      else { c.beginPath(); c.arc(0, 0, p.r * 0.7, 0, Math.PI * 2); c.fill(); }
      c.restore();
    }
    if (age < 1800) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
