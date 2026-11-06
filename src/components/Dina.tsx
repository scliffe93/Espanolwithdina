import { motion } from 'motion/react';
import { useEffect, useId, useState } from 'react';

// ───────────────────────────────────────────────────────────────
// Dina — the tutor behind "Learning with Dina", with her Maltese, Toby.
// Painterly semi-realistic vector: soft gradients and blurred shadow
// shapes model the skin, hair is painted as overlapping strand masses,
// and edges stay soft. Motion is deliberately quiet: blinks, a breath,
// a tiny head tilt, and mouth/hand movement only when asked.
// ───────────────────────────────────────────────────────────────

export type DinaExpression = 'smile' | 'beam';

/** SVG viewBox of DinaArt (width × height). */
export const DINA_VIEWBOX: { w: number; h: number } = { w: 166, h: 182 };
const VX = 28; // viewBox x-origin (the art is drawn in a 0–200 space)
/** Fraction of the height where the logo card's top edge sits (everything below is hidden). */
export const DINA_CARD_LINE = 0.865;

const C = {
  hairDeep: '#1C100B', hair: '#33201A', hairMid: '#543527', hairHi: '#88593D', hairSheen: '#B5825F',
  skinHi: '#F6D6BD', skin: '#E8BC9A', skinMid: '#DAA581', skinSh: '#C18665', skinDeep: '#9E634A',
  blush: '#E0806F', lipHi: '#EDA899', top: '#1B1816', lace: '#E6D7BC',
  fur: '#FDFCF9', furSh: '#E6DED3', furDeep: '#CBBFAF',
};

const f = (n: number) => Math.round(n * 100) / 100;
const rnd = (i: number) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/** Irregular, natural blinking (off when motion is reduced). */
function useBlink(enabled: boolean, min: number, spread: number) {
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let t: number;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));
    const loop = () => {
      t = window.setTimeout(() => {
        setClosed(true);
        later(() => setClosed(false), 130);
        if (Math.random() < 0.15) later(() => { setClosed(true); later(() => setClosed(false), 110); }, 300);
        loop();
      }, min + Math.random() * spread);
    };
    loop();
    return () => { window.clearTimeout(t); timers.forEach((x) => window.clearTimeout(x)); };
  }, [enabled, min, spread]);
  return closed;
}

/** Mouth opening (0..1) while speaking; a still, mid-open mouth when motion is off. */
function useMouth(speaking: boolean, animate: boolean) {
  const [open, setOpen] = useState(speaking ? 0.55 : 0);
  useEffect(() => {
    if (!speaking) { setOpen(0); return; }
    setOpen(0.55);
    if (!animate) return;
    const iv = window.setInterval(() => setOpen(Math.random() < 0.18 ? 0.1 : 0.3 + Math.random() * 0.7), 125);
    return () => window.clearInterval(iv);
  }, [speaking, animate]);
  return open;
}

/** A fluffy outline: an ellipse whose edge breaks into soft, slightly drooping tufts. */
function tufts(cx: number, cy: number, rx: number, ry: number, n: number, amp: number, seed: number) {
  const pt = (a: number, r: number, droop = 0) => `${f(cx + Math.cos(a) * rx * r)} ${f(cy + Math.sin(a) * ry * r + droop)}`;
  let d = '';
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2, am = ((k + 0.5) / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
    if (!k) d = `M${pt(a0, 1 - amp * 0.4 * rnd(seed))}`;
    d += `Q${pt(am - 0.2, 1 + amp * 0.6)} ${pt(am + 0.12 * Math.cos(am), 1 + amp * (0.5 + 0.7 * rnd(seed + k + 40)), amp * ry * 0.5 * Math.abs(Math.cos(am)))}`;
    d += `Q${pt(am + 0.25, 1 + amp * 0.3)} ${pt(a1, 1 - amp * 0.4 * rnd(seed + ((k + 1) % n)))}`;
  }
  return d + 'Z';
}

/** Silky strands radiating from a centre and drooping with gravity. */
function strands(cx: number, cy: number, rx: number, ry: number, n: number, r0: number, r1: number, seed: number) {
  return Array.from({ length: n }, (_, k) => {
    const a = ((k + rnd(seed + k) * 0.6) / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const e = [cx + c * rx * r1, cy + s * ry * r1 + ry * 0.3 * (r1 - r0)];
    return `M${f(cx + c * rx * r0)} ${f(cy + s * ry * r0)}Q${f((cx + c * rx * r0 + e[0]) / 2 + s * 2)} ${f((cy + s * ry * r0 + e[1]) / 2 + 2)} ${f(e[0])} ${f(e[1])}`;
  });
}

/** A finger painted as three soft strokes (edge shadow, body, highlight) along a curved centreline. */
function Digit({ d, w, id }: { d: string; w: number; id: string }) {
  return (
    <g fill="none" strokeLinecap="round">
      <path d={d} stroke={C.skinMid} strokeWidth={w} />
      <path d={d} stroke={C.skin} strokeWidth={w - 1.1} filter={`url(#${id}-b03)`} />
      <path d={d} stroke={C.skinHi} strokeWidth={w * 0.32} transform="translate(-0.6 0)" opacity=".8" filter={`url(#${id}-b05)`} />
    </g>
  );
}

function Eye({ x, y, m, up, low, closed, id }: { x: number; y: number; m: 1 | -1; up: number; low: number; closed: boolean; id: string }) {
  const X = (v: number) => f(x + m * v), Y = (v: number) => f(y + v);
  const crease = <path d={`M${X(-6.8)} ${Y(-up - 1.3)}C${X(-4)} ${Y(-up - 4.6)} ${X(3.4)} ${Y(-up - 4.5)} ${X(7.3)} ${Y(-1.4)}`} stroke={C.skinDeep} strokeWidth=".75" fill="none" opacity=".42" filter={`url(#${id}-b03)`} />;
  if (closed) {
    return (
      <g>
        {crease}
        <path d={`M${X(-7.2)} ${Y(-0.5)}C${X(-3.8)} ${Y(low + 1.4)} ${X(3.2)} ${Y(low + 1.3)} ${X(6.8)} ${Y(0.7)}`} stroke="#2A1810" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      </g>
    );
  }
  const top = `M${X(-7.1)} ${Y(-0.5)}C${X(-4.6)} ${Y(-up * 1.3)} ${X(2.6)} ${Y(-up * 1.36)} ${X(6.8)} ${Y(0.8)}`;
  const lowL = `C${X(3.6)} ${Y(low * 1.3 + 0.7)} ${X(-4)} ${Y(low * 1.34)} ${X(-7.1)} ${Y(-0.5)}`;
  const shape = `${top}${lowL}Z`;
  const lash = `${top}L${X(7)} ${Y(0.4)}C${X(2.8)} ${Y(-up * 1.37 - 0.55)} ${X(-4.6)} ${Y(-up * 1.32 - 0.95)} ${X(-7.9)} ${Y(-1.25)}Q${X(-7.6)} ${Y(-0.8)} ${X(-7.1)} ${Y(-0.5)}Z`;
  const ix = x + m * 0.35, iy = y - 0.3;
  const cid = `${id}-eye${m > 0 ? 'l' : 'r'}`;
  return (
    <g>
      {crease}
      <clipPath id={cid}><path d={shape} /></clipPath>
      <g clipPath={`url(#${cid})`}>
        <path d={shape} fill={`url(#${id}-scl)`} />
        <circle cx={ix} cy={iy} r="3.55" fill={`url(#${id}-iris)`} />
        <circle cx={ix} cy={iy} r="3.3" fill="none" stroke="#24130B" strokeWidth=".6" opacity=".7" />
        <circle cx={ix} cy={iy} r="1.3" fill="#110905" />
        <path d={top} stroke="#3B2016" strokeWidth="2.8" fill="none" opacity=".55" filter={`url(#${id}-b08)`} />
        <circle cx={ix + 1.15} cy={iy - 1.25} r=".9" fill="#fff" opacity=".95" />
        <circle cx={ix - 1.3} cy={iy + 1.4} r=".45" fill="#fff" opacity=".4" />
      </g>
      <path d={`M${X(6.8)} ${Y(0.8)}${lowL}`} stroke="#6E4434" strokeWidth=".5" fill="none" opacity=".45" filter={`url(#${id}-b03)`} />
      <path d={lash} fill="#2A1910" filter={`url(#${id}-b03)`} />
    </g>
  );
}

/** Mouth: half-width W, corner lift, opening depth D, upper-teeth depth T, lower-lip thickness lt. */
function Mouth({ cx, my, W, lift, D, T, lt, lower, id }: { cx: number; my: number; W: number; lift: number; D: number; T: number; lt: number; lower: boolean; id: string }) {
  const cc = my - lift, L = f(cx - W), R = f(cx + W);
  const openTop = `C${f(cx + W * 0.55)} ${f(my + 0.8)} ${f(cx - W * 0.55)} ${f(my + 0.8)} ${L} ${f(cc)}`; // right → left
  const openBot = `C${f(cx - W * 0.62)} ${f(my + D)} ${f(cx + W * 0.62)} ${f(my + D)} ${R} ${f(cc)}`; // left → right
  const opening = `M${L} ${f(cc)}${openBot}${openTop}Z`;
  const upperLip = `M${f(cx - W - 0.3)} ${f(cc - 0.1)}C${f(cx - W * 0.6)} ${f(my - 2)} ${f(cx - 5)} ${f(my - 3.4)} ${f(cx - 2.4)} ${f(my - 3.5)}Q${f(cx - 1)} ${f(my - 3.4)} ${cx} ${f(my - 2.7)}Q${f(cx + 1)} ${f(my - 3.4)} ${f(cx + 2.4)} ${f(my - 3.5)}C${f(cx + 5)} ${f(my - 3.4)} ${f(cx + W * 0.6)} ${f(my - 2)} ${f(cx + W + 0.3)} ${f(cc - 0.1)}L${R} ${f(cc)}${openTop}Z`;
  const lowerLip = `M${L} ${f(cc)}${openBot}C${f(cx + W * 0.5)} ${f(my + D + lt * 1.35)} ${f(cx - W * 0.5)} ${f(my + D + lt * 1.35)} ${L} ${f(cc)}Z`;
  // Upper teeth: each tooth's edge gently rounded; teeth narrow toward the corners.
  const xs = [-1, -0.82, -0.63, -0.44, -0.22, 0, 0.22, 0.44, 0.63, 0.82, 1].map((t) => t * W * 0.94);
  const yb = (x: number) => my + T - (T + lift * 0.8) * (x / W) ** 2;
  let teeth = `M${f(cx - W)} ${f(cc - 3)}L${f(cx + W)} ${f(cc - 3)}L${f(cx + xs[10])} ${f(yb(xs[10]))}`;
  for (let i = 10; i > 0; i--) teeth += `Q${f(cx + (xs[i] + xs[i - 1]) / 2)} ${f(yb((xs[i] + xs[i - 1]) / 2) + 0.6)} ${f(cx + xs[i - 1])} ${f(yb(xs[i - 1]))}`;
  const B = (n: string) => `url(#${id}-${n})`;
  return (
    <g>
      <clipPath id={`${id}-mo`}><path d={opening} /></clipPath>
      <path d={opening} fill={B('mouth')} />
      <g clipPath={B('mo')}>
        {D > 5 && <ellipse cx={cx} cy={my + D * 0.8} rx={W * 0.5} ry="2.6" fill="#A9555A" />}
        {lower && <path d={`M${f(cx - W * 0.6)} ${f(my + D * 0.8)}Q${cx} ${f(my + D * 0.56)} ${f(cx + W * 0.6)} ${f(my + D * 0.8)}L${f(cx + W * 0.6)} ${f(my + D)}L${f(cx - W * 0.6)} ${f(my + D)}Z`} fill="#E4D9CC" opacity=".85" />}
        <path d={teeth + 'Z'} fill={B('teeth')} />
        {xs.slice(1, 10).map((x, i) => (
          <path key={i} d={`M${f(cx + x)} ${f(cc - 2)}L${f(cx + x * 0.97)} ${f(yb(x) + 0.25)}`} stroke="#B3A090" strokeWidth={i === 4 ? 0.42 : 0.32} opacity=".55" />
        ))}
        <path d={`M${R} ${f(cc)}${openTop}`} stroke="#7E3F38" strokeWidth="1.8" fill="none" opacity=".4" filter={B('b05')} />
        <g fill="#401818" opacity=".3" filter={B('b08')}>
          <circle cx={cx - W} cy={cc + 0.6} r="2.2" />
          <circle cx={cx + W} cy={cc + 0.6} r="2.2" />
        </g>
      </g>
      <g filter={B('b03')}>
        <path d={upperLip} fill={B('lipU')} />
        <path d={lowerLip} fill={B('lipL')} />
      </g>
      <ellipse cx={cx + 0.8} cy={my + D * 0.75 + lt * 0.6} rx={W * 0.3} ry=".9" fill={C.lipHi} opacity=".55" filter={B('b08')} />
      <path d={`M${f(cx - 4)} ${f(my - 4.2)}Q${cx} ${f(my - 3.2)} ${f(cx + 4)} ${f(my - 4.2)}`} stroke={C.skinHi} strokeWidth=".8" fill="none" opacity=".6" filter={B('b05')} />
      <g fill="#8A4A3C" opacity=".35" filter={B('b08')}>
        <circle cx={cx - W - 0.6} cy={cc + 0.4} r="1.3" />
        <circle cx={cx + W + 0.6} cy={cc + 0.4} r="1.3" />
      </g>
    </g>
  );
}

// Head geometry (before the head tilt). A long, soft oval with a delicate chin.
const HX = 122;
const WAVE_HAND = 'M-8.5 0C-9 -4 -9.5 -6 -10.5 -8C-13 -11 -16 -15 -18.4 -19.4C-19.8 -22.2 -17.4 -23.6 -15.8 -21.8C-14.4 -19.8 -12.6 -17.6 -11.2 -16.6C-11.2 -20 -11.4 -23 -11.2 -25C-11.2 -31 -11 -37 -10.5 -42C-10.1 -45.6 -6 -45.8 -5.7 -42.4C-5.5 -37 -5.4 -31 -5.3 -26.5C-5.3 -32 -5.2 -39 -5 -44.8C-4.7 -48.4 .1 -48.4 .3 -44.8C.4 -39 .3 -32 .2 -26.5C.3 -31 .5 -37 .8 -42C1.1 -45.4 5.2 -45.2 5.3 -41.8C5.3 -36 5.1 -30 5 -25.5C5.3 -29 5.7 -32 6.2 -34.6C6.8 -37.6 10.2 -36.8 9.9 -33.8C9.7 -30 9.7 -26.5 9.8 -23C10 -15 9.5 -7 8.5 0Z';
const FACE = 'M122 38C141 38 151.5 51 151.5 69C151.5 80 153.2 89 151.2 98C149.8 112.5 144.6 122.6 133.5 128C128.2 130.4 115.8 130.4 110.5 128C99.4 122.6 94.2 112.5 92.8 98C90.8 89 92.5 80 92.5 69C92.5 51 103 38 122 38Z';
const HAIR_BACK = 'M122 22.5C101 22.5 87 33 84.5 54C82.5 72 86 94 83.5 114C82 130 80 142 80 154C81.5 157.5 84 157.5 86 154L87.5 160.5C90 158 91.5 154 93 150C99 147 105 145.5 110 145L134 145C140 146 146 148 150.5 151.5L153 160C155 157 156 154 157 151L161.5 158C163.5 152 163 146 162 140C160.5 130 160 122 160 114C159.5 94 162.5 74 160.5 54C158 33 143 22.5 122 22.5Z';
const HAIR_CROWN = 'M85.5 64C84 42 99 25.5 121.5 25.2C145 25 160.5 39 160 64C157 52 150.5 43.5 142.5 39.5C135.5 36 127 34.6 119.8 35.4C113 37.6 106 42.6 100 48.6C93.5 55 89.5 60 85.5 64Z';
const HAIR_L = 'M103 39C91 46 86.5 61 86.5 80C86.5 101 84 120 84 138C83.5 146 83.5 152 84.5 158.5C87.5 153 91 147 93 142C94.5 136 95.5 130 96 124C96.5 113 96.3 104 96.3 94C96.3 80 95.5 67 103.5 53Z';
const HAIR_R = 'M140 36C153 42 159.5 57 159.5 78C159.5 100 161 118 161 134C161.5 144 163.5 151 167 157.5C163 157 159.5 156 156.5 158.5C155 155 153 157 150.5 160C150.5 150 149 142 148.5 134C148.5 120 149 106 149 94C149 80 149.8 66 142.5 51Z';
// Side-swept fringe from a parting just left of centre: [path, width of the upper part, width of the tail, fades?]
const SWEEP: [string, number, number, boolean][] = [
  ['M119 31C110 34 102 41 97 50C94.5 54.5 93 59 92.5 65', 9, 4.5, false],
  ['M121 36C113 40 106.5 47 102 56C100.5 59 99.5 62.5 99 67', 5, 2.4, true],
  ['M122.5 41C116.5 46 111.5 52.5 108.5 60C107.5 62.5 107 64.5 106.6 67', 2.2, 1, true],
  ['M121 31C130 33.5 138.5 40 143.5 48.5C146.5 53.5 148.5 58.5 149.5 65', 8, 4, false],
  ['M123 37C130.5 41 136.5 48 140.5 56C142 59 143 62.5 143.5 67', 4, 1.8, true],
  ['M125 42C131 47 136 53.5 139 61C139.6 62.8 140 64.5 140.3 66', 1.8, 0.9, true],
];
function Sweep({ id, shadow }: { id: string; shadow?: boolean }) {
  return (
    <g fill="none" strokeLinecap="round" transform={shadow ? 'translate(1 2.5)' : undefined} opacity={shadow ? 0.5 : 1}>
      {SWEEP.map(([d, w1, w2, fade], i) => (
        <g key={i} stroke={shadow ? '#5A2E1F' : `url(#${id}-${fade ? 'swB' : 'swA'})`}>
          <path d={d} strokeWidth={w1} pathLength={1} strokeDasharray=".62 1" />
          <path d={d} strokeWidth={w2} />
          {!shadow && w1 > 3 && <path d={d} stroke={C.hairHi} strokeWidth={w1 * 0.2} pathLength={1} strokeDasharray=".5 1" transform={`translate(0 ${-w1 * 0.22})`} opacity=".45" />}
        </g>
      ))}
    </g>
  );
}
const FRINGE = [
  // hair hugging the temples
  'M98 60C95.5 72 95 86 96.5 100C97 106 97.8 110 98.6 113C97.2 104 96.6 92 97.6 80C98.2 72 99 66 100 61Z',
  'M147 60C149.5 72 150 86 148.6 100C148 106 147.4 110 146.6 113C147.6 104 148.2 92 147.6 80C147.2 72 146.6 66 145.8 61Z',
];
const HAIR_LINES: [string, number, number, number][] = [
  // [path, 0 = highlight / 1 = shadow, width, opacity]
  ['M124 27.5C109 29.5 98 37 91 53', 0, 0.9, 0.5], ['M126 29.5C115 33 105 39 98 48', 0, 0.7, 0.45], ['M117 27C104 30.5 94 39 88.5 55', 0, 0.6, 0.35],
  ['M130 27.5C142 30.5 151 37 155.5 51', 0, 0.9, 0.45], ['M129 31C139 34 146 40 151 48', 0, 0.6, 0.4], ['M136 28C147 32 154.5 41 157.5 55', 1, 0.6, 0.4],
  ['M126 35C116 38 106 46 100 57', 0, 0.6, 0.55], ['M125 37.5C114 43 105 53 99 66', 1, 0.5, 0.5], ['M131 37C139 41 145 49 148 60', 0, 0.55, 0.45],
  ['M120 33C108 36.5 98 45 92 58', 1, 0.5, 0.45], ['M91 62C88.5 82 87.5 110 86.5 140', 0, 0.7, 0.35], ['M95 72C93.5 100 92 124 89 152', 1, 0.6, 0.5],
  ['M89 70C88 96 86 120 85.5 146', 0, 0.4, 0.3], ['M154 58C156 82 156 110 157 136', 0, 0.7, 0.35], ['M151 70C152.5 100 152.5 128 156 156', 1, 0.6, 0.5],
  ['M157 66C158.5 92 158.5 120 161 148', 0, 0.45, 0.3], ['M150.5 92C151.5 116 152 138 153 158', 0, 0.5, 0.3],
  ['M156.5 138C157.5 147 157 152 156.5 158', 1, 0.8, 0.6], ['M153 134C153 146 152 152 150.5 159', 1, 0.6, 0.5], ['M90 132C89.5 144 88.5 150 87.5 157', 1, 0.7, 0.5],
  // fine strands fanning out from the parting
  ['M118 27C112 28.5 105.5 32.5 100 38.5', 1, 0.45, 0.45], ['M117.5 29.5C110 32 103 37.5 97.5 45', 0, 0.4, 0.3], ['M116 26.5C108 27.5 100 31 94 37', 1, 0.4, 0.35],
  ['M122 27C128.5 28.5 135.5 32 141.5 37.5', 1, 0.45, 0.45], ['M122.5 29.5C130.5 31.5 138 36 144 43.5', 0, 0.4, 0.3], ['M124 26.5C132 27 140 30 146.5 36', 1, 0.4, 0.35],
  // depth in the side masses
  ['M93 78C92 100 91.5 122 91 144', 1, 0.45, 0.35], ['M87.5 76C86.5 98 86 120 85 142', 0, 0.35, 0.25], ['M152.5 76C153.5 98 153.5 120 154.5 142', 1, 0.45, 0.35], ['M158.5 80C159.5 102 159.5 124 160 146', 0, 0.35, 0.25],
  ['M99 42C94 50 90.5 60 89.5 72', 1, 0.5, 0.4], ['M145 40C150.5 48 154 58 155 70', 1, 0.5, 0.4],
];
const HAIR_RIBBONS = 'M146 46C154 58 155.5 80 155 100C154.5 120 156 140 160 155M92 50C89 62 89.5 84 89.5 104C89.5 122 87.5 138 86.5 152M104 33C114 28.5 132 28.5 144 34';

// Toby's head centre (global coordinates).
const TX = 69, TY = 108;
const TOBY_HEAD = tufts(TX, TY, 20, 18.5, 22, 0.14, 3);
const TOBY_BODY = tufts(TX + 5, TY + 38, 23.5, 21, 18, 0.1, 11);
// Long-haired ear (left side; mirrored for the right), hanging in soft waves.
const P = (pts: number[]) => pts.map((v, i) => f(i % 2 ? TY + v : TX + v)).join(' ');
const TOBY_EAR = `M${P([-14, -15])}C${P([-23, -13, -28, -3, -28.5, 8])}C${P([-29, 18, -31.5, 24, -30.5, 33])}L${P([-27.5, 29.5, -26.5, 37, -23, 31, -20, 36, -17.5, 30])}C${P([-14.5, 20, -12.5, 9, -12, 0])}Z`;
const EAR_STRANDS = `M${P([-16, -11])}C${P([-23, -4, -26, 8, -26, 19])}S${P([-27.5, 30, -26.5, 33])}M${P([-15, -6])}C${P([-19, 4, -21, 16, -21, 31])}M${P([-19, -12])}C${P([-25, -6, -27.5, 4, -28, 14])}`;
const TOBY_HEAD_STRANDS = strands(TX, TY + 2, 19.5, 17.5, 22, 0.62, 1.02, 7);
const TOBY_BODY_STRANDS = Array.from({ length: 9 }, (_, k) => {
  const x = TX - 12 + k * 4.2 + rnd(k) * 2, y = TY + 23 + Math.abs(k - 4) * 1.3 + rnd(k + 2) * 3;
  return `M${f(x)} ${f(y)}C${f(x + 3 - rnd(k + 3) * 6)} ${f(y + 6)} ${f(x - 3 + rnd(k + 5) * 6)} ${f(y + 11)} ${f(x + (k - 4) * 0.8)} ${f(y + 17)}`;
});

function Toby({ id, blink, animate }: { id: string; blink: boolean; animate: boolean }) {
  const B = (n: string) => `url(#${id}-${n})`;
  const eye = (ex: number) => (
    <g key={ex}>
      <ellipse cx={ex} cy={TY - 2.2} rx="3.7" ry="3.4" fill="#2E211B" opacity=".6" filter={B('b05')} />
      {blink ? (
        <path d={`M${ex - 3} ${TY - 2}Q${ex} ${TY - 0.4} ${ex + 3} ${TY - 2}`} stroke="#1A100C" strokeWidth="1" fill="none" strokeLinecap="round" />
      ) : (
        <>
          <ellipse cx={ex} cy={TY - 2.3} rx="2.85" ry="2.7" fill={B('teye')} />
          <circle cx={ex + 0.9} cy={TY - 3.3} r=".72" fill="#fff" opacity=".95" />
          <circle cx={ex - 0.8} cy={TY - 1.2} r=".35" fill="#fff" opacity=".35" />
        </>
      )}
    </g>
  );
  return (
    <motion.g
      style={{ originX: `${TX}px`, originY: `${TY + 18}px` }}
      initial={animate ? { rotate: 0 } : false}
      animate={animate ? { rotate: [0, 0, -4, -4, 0, 0, 3, 3, 0] } : undefined}
      transition={{ duration: 13, times: [0, 0.3, 0.36, 0.5, 0.56, 0.75, 0.8, 0.9, 0.96], repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* soft contact shadow so the white coat separates from light backgrounds */}
      <path d={TOBY_HEAD} transform="translate(1 1.5)" fill="#5E4E42" opacity=".3" filter={B('b2')} />
      <g filter={B('fur')}>
        <path d={TOBY_EAR} fill={B('ear')} />
        <path d={TOBY_EAR} transform={`translate(${2 * TX} 0) scale(-1 1)`} fill={B('ear')} />
      </g>
      <g stroke={C.furDeep} fill="none" strokeLinecap="round" strokeWidth=".5" opacity=".4" filter={B('b03')}>
        <path d={EAR_STRANDS} />
        <path d={EAR_STRANDS} transform={`translate(${2 * TX} 0) scale(-1 1)`} />
      </g>
      <ellipse cx={TX} cy={TY + 4} rx="21" ry="17" fill="#9C8C7C" opacity=".35" filter={B('b2')} />
      <g filter={B('fur')}>
        <path d={TOBY_HEAD} fill={B('furG')} />
      </g>
      <g stroke={C.furDeep} fill="none" strokeLinecap="round" strokeWidth=".4">
        {TOBY_HEAD_STRANDS.map((d, i) => <path key={i} d={d} opacity={0.12 + 0.22 * rnd(i)} filter={B('b03')} />)}
      </g>
      {/* fur modelling: shadow around the eyes and under the muzzle, light on the forehead */}
      <g filter={B('b15')}>
        <ellipse cx={TX - 7.5} cy={TY - 0.5} rx="4.6" ry="4" fill={C.furDeep} opacity=".55" />
        <ellipse cx={TX + 7.5} cy={TY - 0.5} rx="4.6" ry="4" fill={C.furDeep} opacity=".55" />
        <ellipse cx={TX - 6} cy={TY + 3} rx="1.8" ry="2.8" fill="#D8BE9E" opacity=".4" />
        <ellipse cx={TX + 6} cy={TY + 3} rx="1.8" ry="2.8" fill="#D8BE9E" opacity=".4" />
        <ellipse cx={TX} cy={TY + 15} rx="9" ry="3.5" fill={C.furDeep} opacity=".6" />
        <ellipse cx={TX} cy={TY + 1} rx="3" ry="2.2" fill={C.furDeep} opacity=".5" />
        <ellipse cx={TX - 1} cy={TY + 7} rx="6.5" ry="4.5" fill="#fff" opacity=".9" />
        <ellipse cx={TX} cy={TY - 11} rx="10" ry="5.5" fill="#fff" />
        <ellipse cx={TX - 4.6} cy={TY + 8.5} rx="5" ry="3.8" fill="#fff" />
        <ellipse cx={TX + 4.6} cy={TY + 8.5} rx="5" ry="3.8" fill="#fff" />
      </g>
      {eye(TX - 7.5)}
      {eye(TX + 7.5)}
      {/* nose, mouth and a hint of tongue */}
      <path d={`M${TX - 3.3} ${TY + 5}C${TX - 3.3} ${TY + 3.3} ${TX + 3.3} ${TY + 3.3} ${TX + 3.3} ${TY + 5}C${TX + 3.3} ${TY + 7.1} ${TX + 1} ${TY + 8.4} ${TX} ${TY + 8.5}C${TX - 1} ${TY + 8.4} ${TX - 3.3} ${TY + 7.1} ${TX - 3.3} ${TY + 5}Z`} fill={B('nose')} />
      <ellipse cx={TX - 0.5} cy={TY + 4.4} rx="1.4" ry=".6" fill="#fff" opacity=".45" />
      <path d={`M${TX} ${TY + 8.5}L${TX} ${TY + 10}M${TX - 3.2} ${TY + 10.4}Q${TX} ${TY + 12.2} ${TX + 3.2} ${TY + 10.4}`} stroke="#3A2A24" strokeWidth=".55" fill="none" opacity=".65" strokeLinecap="round" />
      <ellipse cx={TX + 0.3} cy={TY + 11.9} rx="1.3" ry=".95" fill="#E3878A" opacity=".85" />
      <path d={`M${TX - 2} ${TY + 8}q-4 3 -7 9M${TX + 2} ${TY + 8}q4 3 7 9M${TX - 4} ${TY + 7}q-4 2 -8 6M${TX + 4} ${TY + 7}q4 2 8 6`} stroke="#fff" strokeWidth=".5" fill="none" strokeLinecap="round" opacity=".7" filter={B('b03')} />
    </motion.g>
  );
}

export function DinaArt({
  expression = 'smile',
  speaking = false,
  waving = false,
  animate = true,
  size = 120,
  className,
  title,
  toby = true,
}: {
  expression?: DinaExpression;
  speaking?: boolean;
  waving?: boolean;
  animate?: boolean;
  size?: number;
  className?: string;
  title?: string;
  toby?: boolean;
}) {
  const id = `dva${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const blink = useBlink(animate, 2600, 3400);
  const tobyBlink = useBlink(animate && toby, 3300, 2700);
  const mouth = useMouth(speaking, animate);
  const beam = expression === 'beam' && !speaking;
  const label = title ?? (toby ? 'Dina, your Spanish tutor, holding her Maltese, Toby' : 'Dina, your Spanish tutor');
  const tilt = toby ? -6 : -2;
  const { w, h } = DINA_VIEWBOX;
  const B = (n: string) => `url(#${id}-${n})`;

  // Eye openness and mouth shape per expression.
  const up = beam ? 2.85 : 3.35, low = beam ? 0.95 : 1.75;
  const m = speaking
    ? { W: 13.4 - mouth * 1.6, lift: 2.6, D: 3.5 + mouth * 9, T: 3 + mouth * 1.6, lt: 3.2, lower: mouth > 0.45 }
    : beam
      ? { W: 15.4, lift: 4, D: 11, T: 6, lt: 3.1, lower: true }
      : { W: 14.2, lift: 3.3, D: 5.6, T: 3.4, lt: 3.4, lower: false };
  const grads: [string, string[], number[]][] = [
    ['neck', ['#AC7154', C.skinMid, C.skin], [0, 0.45, 1]], ['hairB', [C.hair, '#140B07'], [0, 1]],
    ['lipU', ['#BA675E', '#A65651'], [0, 1]], ['lipL', ['#D27E71', '#BA665D'], [0, 1]], ['top', ['#2C2724', C.top], [0, 1]],
    ['ear', ['#F1ECE4', '#FBF9F5', '#DDD3C6'], [0, 0.45, 1]],
  ];

  return (
    <svg viewBox={`${VX} 0 ${w} ${h}`} width={size} height={(size * h) / w} className={className} role="img" aria-label={label} style={{ overflow: 'visible' }}>
      <title>{label}</title>
      <defs>
        {([['b03', 0.3], ['b05', 0.5], ['b08', 0.8], ['b15', 1.5], ['b2', 2.2], ['b4', 4]] as const).map(([n, s]) => (
          <filter key={n} id={`${id}-${n}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={s} /></filter>
        ))}
        <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 .55 0 0 0 0 .33 0 0 0 0 .22 0 0 0 .9 -.35" />
        </filter>
        <filter id={`${id}-fur`} x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation=".35" />
        </filter>
        {grads.map(([n, cs, os]) => (
          <linearGradient key={n} id={`${id}-${n}`} x1="0" y1="0" x2="0" y2="1">
            {cs.map((c, i) => <stop key={i} offset={os[i]} stopColor={c} />)}
          </linearGradient>
        ))}
        <radialGradient id={`${id}-skin`} cx=".42" cy=".4" r=".72">
          <stop offset="0" stopColor={C.skinHi} />
          <stop offset=".5" stopColor={C.skin} />
          <stop offset=".85" stopColor={C.skinMid} />
          <stop offset="1" stopColor={C.skinSh} />
        </radialGradient>
        <linearGradient id={`${id}-hair`} x1=".2" y1="0" x2=".7" y2="1">
          <stop offset="0" stopColor={C.hairMid} />
          <stop offset=".45" stopColor={C.hair} />
          <stop offset="1" stopColor={C.hairDeep} />
        </linearGradient>
        <linearGradient id={`${id}-swA`} gradientUnits="userSpaceOnUse" x1="0" y1="28" x2="0" y2="70">
          <stop offset="0" stopColor={C.hair} />
          <stop offset=".6" stopColor={C.hair} />
          <stop offset="1" stopColor={C.hairMid} stopOpacity=".6" />
        </linearGradient>
        <linearGradient id={`${id}-swB`} gradientUnits="userSpaceOnUse" x1="0" y1="34" x2="0" y2="70">
          <stop offset="0" stopColor={C.hairMid} stopOpacity=".95" />
          <stop offset=".5" stopColor={C.hairMid} stopOpacity=".75" />
          <stop offset="1" stopColor={C.hairMid} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-scl`} cx=".5" cy=".55" r=".6">
          <stop offset="0" stopColor="#FAF6F1" />
          <stop offset=".7" stopColor="#EEE3DA" />
          <stop offset="1" stopColor="#D2B8AA" />
        </radialGradient>
        <radialGradient id={`${id}-iris`} cx=".5" cy=".58" r=".5">
          <stop offset=".25" stopColor="#A36B3D" />
          <stop offset=".6" stopColor="#6E4224" />
          <stop offset="1" stopColor="#3A2112" />
        </radialGradient>
        <radialGradient id={`${id}-mouth`} cx=".5" cy=".3" r=".7">
          <stop offset="0" stopColor="#7E3436" />
          <stop offset="1" stopColor="#4A1B20" />
        </radialGradient>
        <linearGradient id={`${id}-teeth`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#B4A190" />
          <stop offset=".2" stopColor="#E4DACD" />
          <stop offset=".5" stopColor="#FBF7F0" />
          <stop offset=".8" stopColor="#E4DACD" />
          <stop offset="1" stopColor="#B4A190" />
        </linearGradient>
        {(['brow', 'browR'] as const).map((n, i) => (
          <linearGradient key={n} id={`${id}-${n}`} x1={i} y1="0" x2={1 - i} y2="0">
            <stop offset="0" stopColor={C.hair} stopOpacity=".95" />
            <stop offset=".55" stopColor={C.hair} stopOpacity=".9" />
            <stop offset="1" stopColor={C.hairMid} stopOpacity=".5" />
          </linearGradient>
        ))}
        <pattern id={`${id}-knit`} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <circle cx="1.5" cy="1.5" r=".55" fill="#000" opacity=".5" />
        </pattern>
        <pattern id={`${id}-lace`} width="3.6" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(-20)">
          <rect width="3.6" height="3.2" fill={C.lace} />
          <ellipse cx="1.8" cy="1.6" rx="1.15" ry="1" fill="#3A322B" />
          <circle cx="0" cy="0" r=".55" fill="#3A322B" />
          <circle cx="3.6" cy="3.2" r=".55" fill="#3A322B" />
        </pattern>
        <radialGradient id={`${id}-furG`} cx=".45" cy=".38" r=".62">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset=".58" stopColor={C.fur} />
          <stop offset="1" stopColor={C.furSh} />
        </radialGradient>
        <radialGradient id={`${id}-teye`} cx=".4" cy=".35" r=".7">
          <stop offset="0" stopColor="#4A3226" />
          <stop offset=".6" stopColor="#1C120D" />
          <stop offset="1" stopColor="#0B0705" />
        </radialGradient>
        <radialGradient id={`${id}-nose`} cx=".4" cy=".3" r=".7">
          <stop offset="0" stopColor="#4B3D39" />
          <stop offset="1" stopColor="#0F0B0A" />
        </radialGradient>
        <linearGradient id={`${id}-hand`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={C.skinHi} />
          <stop offset=".6" stopColor={C.skin} />
          <stop offset="1" stopColor={C.skinMid} />
        </linearGradient>
        <clipPath id={`${id}-face`}><path d={FACE} /></clipPath>
        <clipPath id={`${id}-frame`}><rect x="-40" y="-40" width="300" height={h + 40} /></clipPath>
      </defs>

      <g clipPath={B('frame')}>
        {/* barely-there breathing */}
        <motion.g initial={animate ? { y: 0 } : false} animate={animate ? { y: [0, -0.45, 0] } : undefined} transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}>
          {/* hair behind the shoulders */}
          <g transform={`rotate(${tilt} ${HX} 150)`}>
            <path d={HAIR_BACK} fill={B('hairB')} filter={B('b03')} />
          </g>

          {/* black knit top with the cream crochet shoulder */}
          <path id={`${id}-body`} d="M14 200C16 180 28 164 50 156C68 150 90 148 104 143L140 143C156 147 172 152 184 160C194 168 198 184 199 200Z" fill={B('top')} />
          <use href={`#${id}-body`} fill={B('knit')} opacity=".35" />
          <path d="M150 146C164 149 177 154 186 161C193 167 197 177 199 189L189 192C187 179 182 171 175 165C167 159 157 155 146 152Z" fill={B('lace')} />
          <path d="M146 152C157 155 167 159 175 165C182 171 187 179 189 192" stroke={C.lace} strokeWidth="1.6" strokeDasharray="1.2 1.4" strokeLinecap="round" fill="none" />
          <path d="M150 146C164 149 177 154 186 161C193 167 197 177 199 189" stroke="#000" strokeWidth="3" fill="none" opacity=".25" filter={B('b15')} />
          <g filter={B('b2')} opacity=".6">
            <path d="M120 151C108 153 96 157 88 165" stroke="#4A4440" strokeWidth="3" fill="none" />
            <path d="M150 157C162 163 170 173 176 187" stroke="#000" strokeWidth="5" fill="none" opacity=".5" />
          </g>

          {/* slim neck with the jaw's shadow */}
          <path d="M105.5 112L106 134C105.5 140 103.5 143 101.5 144.5C110 150 134 150 142.5 144.5C140.5 143 138 140 137.5 134L138 112Z" fill={B('neck')} />
          <g filter={B('b2')}>
            <path d="M107 123C114 134.5 130 134.5 137 123L137 115L107 115Z" fill={C.skinDeep} opacity=".5" />
            <ellipse cx="131" cy="136" rx="3" ry="8" fill={C.skinSh} opacity=".35" />
          </g>
          <path d="M103 144.5C111 150 133 150 141 144.5" stroke="#4A433F" strokeWidth="1.4" fill="none" opacity=".8" filter={B('b03')} />

          {/* head, tilted gently toward Toby */}
          <g transform={`rotate(${tilt} ${HX} 150)`}>
            <motion.g
              style={{ originX: `${HX}px`, originY: '150px' }}
              initial={animate ? { rotate: 0 } : false}
              animate={animate ? (speaking ? { rotate: [0, 0.9, -0.6, 0.5, 0] } : { rotate: [0, 0, 1.2, 1.2, 0, -0.6, 0] }) : undefined}
              transition={{ duration: speaking ? 2.6 : 10, repeat: Infinity, ease: 'easeInOut' }}
            >
              <path d={FACE} fill={B('skin')} />
              {/* broad skin modelling, clipped to the face */}
              <g clipPath={B('face')}>
                <rect x="90" y="36" width="64" height="97" filter={B('grain')} opacity=".16" />
                <g filter={B('b4')}>
                  <ellipse cx="153" cy="92" rx="9" ry="36" fill={C.skinSh} opacity=".6" />
                  <ellipse cx="92" cy="92" rx="6" ry="30" fill={C.skinSh} opacity=".35" />
                  <ellipse cx="122" cy="40" rx="32" ry="8" fill="#7E4B36" opacity=".55" />
                  <ellipse cx="118" cy="57" rx="11" ry="6" fill={C.skinHi} opacity=".6" />
                  <ellipse cx="104" cy={beam ? 94 : 96} rx="8" ry={beam ? 5.5 : 4.5} fill={C.skinHi} opacity={beam ? 0.75 : 0.5} />
                  <ellipse cx="140" cy={beam ? 94 : 96} rx="7" ry={beam ? 5.5 : 4.5} fill={C.skinHi} opacity={beam ? 0.45 : 0.28} />
                  <ellipse cx="104" cy="100" rx="8.5" ry="5.5" fill={C.blush} opacity={beam ? 0.32 : 0.24} />
                  <ellipse cx="141" cy="100" rx="8.5" ry="5.5" fill={C.blush} opacity={beam ? 0.3 : 0.22} />
                  <ellipse cx="148" cy="108" rx="5" ry="10" fill={C.skinSh} opacity=".35" />
                  <ellipse cx="141" cy={beam ? 109 : 108} rx="7" ry="4" fill={C.skinSh} opacity={beam ? 0.3 : 0.2} />
                  <ellipse cx="103" cy={beam ? 109 : 108} rx="6.5" ry="4" fill={C.skinSh} opacity={beam ? 0.18 : 0.12} />
                  <ellipse cx="122" cy="129.5" rx="19" ry="5" fill={C.skinDeep} opacity=".35" />
                </g>
                <g filter={B('b2')}>
                  <ellipse cx="109" cy="77" rx="8.5" ry="4.4" fill="#B07760" opacity=".35" />
                  <ellipse cx="136" cy="77" rx="8.5" ry="4.4" fill="#A86E58" opacity=".42" />
                  <ellipse cx="116.5" cy="80" rx="2.4" ry="3.2" fill={C.skinSh} opacity=".35" />
                  <ellipse cx="128" cy="81" rx="2.6" ry="4" fill={C.skinSh} opacity=".45" />
                  <path d="M127.5 84C129 90 129.5 96 128.8 100.5L126 101C126.5 96 126 90 125 85Z" fill={C.skinSh} opacity=".55" />
                  <ellipse cx="122" cy="125" rx="5" ry="2.4" fill={C.skinHi} opacity=".45" />
                  {FRINGE.map((d, i) => <path key={i} d={d} transform="translate(1 2)" fill="#5A2E1F" opacity=".5" />)}
                  <Sweep id={id} shadow />
                  <path d={HAIR_L} transform="translate(1.5 1)" fill="#5A2E1F" opacity=".5" />
                  <path d={HAIR_R} transform="translate(-1.5 1)" fill="#5A2E1F" opacity=".55" />
                </g>
                {/* smile folds and the bridge of the nose */}
                <g filter={B('b08')} fill="none" strokeLinecap="round">
                  <path d={beam ? 'M114.5 100.5C109.5 103.5 105 108 104.5 114.5' : 'M114.5 100.5C110 104 107.5 108 107.5 112'} stroke={C.skinSh} strokeWidth="1.1" opacity={beam ? 0.5 : 0.28} />
                  <path d={beam ? 'M129.5 100.5C134.5 103.5 139 108 139.5 114.5' : 'M129.5 100.5C134 104 136.5 108 136.5 112'} stroke={C.skinDeep} strokeWidth="1.1" opacity={beam ? 0.5 : 0.28} />
                  <path d="M122.4 82C122.2 88 122.3 94 122.6 98" stroke={C.skinHi} strokeWidth="1.5" opacity=".55" />
                </g>
              </g>

              {/* nose: soft wings, nostrils and a gentle tip highlight */}
              <g filter={B('b05')}>
                <path d="M117 97.5C114.6 99 114.4 102.6 117.4 103.6" stroke="#B37760" strokeWidth=".9" fill="none" opacity=".6" />
                <path d="M127 97.5C129.4 99 129.6 102.6 126.6 103.6" stroke="#9F654F" strokeWidth="1" fill="none" opacity=".75" />
                <ellipse cx="119" cy="103.2" rx="1.7" ry=".85" transform="rotate(14 119 103.2)" fill="#7A4434" opacity=".6" />
                <ellipse cx="125" cy="103.2" rx="1.7" ry=".85" transform="rotate(-14 125 103.2)" fill="#7A4434" opacity=".65" />
                <ellipse cx="122" cy="105.6" rx="5" ry="1.2" fill="#A06450" opacity=".3" />
              </g>
              <ellipse cx="122.6" cy="100.2" rx="2.4" ry="1.8" fill="#FFE8D6" opacity=".55" filter={B('b08')} />

              {/* eyes, with the cheeks lifting under them when she beams */}
              <Eye x={108} y={80} m={1} up={up} low={low} closed={blink} id={id} />
              <Eye x={136} y={80} m={-1} up={up} low={low} closed={blink} id={id} />
              {beam && <path d="M99.6 81.4q-1.8 .3 -3 1.2M99.4 83.2q-1.6 .9 -2.6 2.4M144.4 81.4q1.8 .3 3 1.2M144.6 83.2q1.6 .9 2.6 2.4" stroke={C.skinSh} strokeWidth=".5" fill="none" opacity=".5" filter={B('b05')} />}
              <g filter={B('b03')} transform={beam ? 'translate(0 -0.8)' : undefined}>
                <path d="M115.8 71.4C112.4 68.6 107.6 67.2 104 67.4C101.6 67.6 99.6 68.8 98.2 70.6C100.4 69.6 102.6 69.2 104.6 69.3C107.8 69.5 111.6 70.8 115.4 73.1Z" fill={B('brow')} />
                <path d="M128.2 71.4C131.6 68.6 136.4 67.2 140 67.4C142.4 67.6 144.4 68.8 145.8 70.6C143.6 69.6 141.4 69.2 139.4 69.3C136.2 69.5 132.4 70.8 128.6 73.1Z" fill={B('browR')} />
              </g>

              <Mouth cx={HX} my={112} id={id} {...m} />

              {/* hair framing the face, fringe on top */}
              <g filter={B('b03')}>
                <path d={HAIR_CROWN} fill={B('hair')} />
                <path d={HAIR_L} fill={B('hair')} />
                <path d={HAIR_R} fill={B('hair')} />
                {FRINGE.map((d, i) => <path key={i} d={d} fill={B('hair')} />)}
              </g>
              <g filter={B('b05')}><Sweep id={id} /></g>
              <path d="M97 38C108 30 136 29 150 38M155 62C157.5 80 157.5 100 157 118M89 64C87.5 82 87.5 100 87.5 116" stroke={C.hairSheen} strokeWidth="4.5" fill="none" opacity=".3" filter={B('b2')} />
              {/* the parting, and fine baby hairs along the hairline */}
              <path d="M119.6 25.5C119.2 28.5 119.3 31.5 120 34" stroke={C.skinSh} strokeWidth="1.2" fill="none" opacity=".4" strokeLinecap="round" filter={B('b08')} />
              <g stroke={C.hairMid} strokeWidth=".5" fill="none" strokeLinecap="round" opacity=".55" filter={B('b03')}>
                <path d="M97.5 55.5q-2.6 3.5 -3.4 8.5M100.5 51.5q-3 3.6 -4.6 8.8M104 47.5q-3.2 3.4 -5 7.6M146.5 56q2.4 3.4 3.2 8M143.5 51.5q2.8 3.6 4.2 8.5M140 47.5q3 3.2 4.6 7.2" />
              </g>
              <g fill="none" strokeLinecap="round" filter={B('b03')}>
                {HAIR_LINES.map(([d, k, sw, o], i) => <path key={i} d={d} stroke={k ? C.hairDeep : C.hairHi} strokeWidth={sw} opacity={o} />)}
                <path d={HAIR_RIBBONS} stroke={C.hairMid} strokeWidth="3" opacity=".45" filter={B('b08')} />
              </g>
            </motion.g>
          </g>

          {toby && (
            <>
              {/* Toby sits on her forearm; her hand curls round his far side */}
              <g filter={B('fur')}>
                <path d={TOBY_BODY} fill={B('furG')} />
              </g>
              <g filter={B('b2')}>
                <ellipse cx={TX + 21} cy={TY + 40} rx="5.5" ry="14" fill={C.furDeep} opacity=".7" />
                <ellipse cx={TX - 12} cy={TY + 42} rx="4.5" ry="12" fill={C.furSh} />
                <ellipse cx={TX + 3} cy={TY + 30} rx="11" ry="8" fill="#fff" />
                <ellipse cx={TX + 4} cy={TY + 56} rx="16" ry="4" fill={C.furDeep} opacity=".5" />
              </g>
              <g stroke={C.furDeep} strokeWidth=".45" fill="none" strokeLinecap="round" filter={B('b03')}>
                {TOBY_BODY_STRANDS.map((d, i) => <path key={i} d={d} opacity={0.12 + 0.2 * rnd(i + 9)} />)}
              </g>
              <path d="M18 164C40 169 70 172 100 170L106 184C74 188 42 187 18 182Z" fill={B('top')} />
              <path d="M30 167C50 171 74 173 98 171" stroke="#3A3532" strokeWidth="1.2" fill="none" opacity=".7" filter={B('b05')} />
              <g filter={B('fur')}>
                <path d={`M${TX - 16} ${TY + 54}C${TX - 8} ${TY + 63} ${TX + 8} ${TY + 63} ${TX + 20} ${TY + 56}L${TX + 17} ${TY + 50}L${TX - 14} ${TY + 50}Z`} fill={C.fur} />
              </g>
              <g transform="translate(-1 -13)">
              <path d="M98 163C103 159.5 110 160 113 164C115 169 114.5 176 112 181L103 183C99 180 97 172 98 163Z" fill={B('hand')} />
              <path d="M104 164C108 166 110 171 109.5 177" stroke={C.skinSh} strokeWidth="1.2" fill="none" opacity=".35" filter={B('b08')} />
              <Digit d="M102.5 163.5Q98 160.3 93.5 159.4" w={4.2} id={id} />
              <Digit d="M99 164Q92 162.6 87.4 165.4" w={4.5} id={id} />
              <Digit d="M98.6 169Q91 168.6 85.6 171.8" w={4.7} id={id} />
              <Digit d="M98.8 174Q92 174 87 177.2" w={4.5} id={id} />
              <Digit d="M99.6 178.6Q94.5 179 91 182" w={3.9} id={id} />
              <g filter={B('fur')}>
                <path d="M88 160C84 166 83 174 85 184L80 184C78 174 80 166 84 160Z" fill={C.fur} />
              </g>
              </g>
              <Toby id={id} blink={tobyBlink} animate={animate} />
            </>
          )}

          {/* a gentle wave from her free hand */}
          {waving && (
            <motion.g
              style={{ originX: '178px', originY: '152px' }}
              initial={animate ? { opacity: 0, y: 8, rotate: 0 } : false}
              animate={animate ? { opacity: 1, y: 0, rotate: [0, 8, -3, 7, -2, 0] } : { opacity: 1, y: 0 }}
              transition={{ duration: 1.7, ease: 'easeInOut' }}
            >
              <path d="M167 200C169 184 171 168 171.5 152L185.5 150C186.5 166 190 184 193 200Z" fill={B('top')} />
              <path d="M171 154L186 152" stroke={C.lace} strokeWidth="2.4" strokeLinecap="round" />
              <g transform="translate(178 151) rotate(8) scale(1.2)">
                <path d={WAVE_HAND} fill={B('hand')} />
                <g stroke={C.skinSh} fill="none" strokeLinecap="round" filter={B('b05')}>
                  <path d="M-5.3 -26.5L-5.2 -36M.2 -26.5L.4 -37M5 -25.5L5.3 -33" strokeWidth=".9" opacity=".55" />
                  <path d="M-9.5 -33.5q2 .8 3.6 0M-4.6 -36.5q2.2 .8 4.4 0M.9 -34.5q2 .8 4 0M-10.8 -15C-7 -13 -4 -9 -3.5 -2M-8 -22C-2 -19 4 -19.5 9 -21.5" strokeWidth=".5" opacity=".45" />
                </g>
                <ellipse cx="0" cy="-14" rx="5" ry="6" fill={C.skinHi} opacity=".45" filter={B('b15')} />
              </g>
            </motion.g>
          )}
        </motion.g>
      </g>
    </svg>
  );
}

/** Greeting the learner hears/sees when tapping Dina (agrees with the learner's gender). */
export function dinaGreeting(gender: 'm' | 'f' | 'x' | undefined): { es: string; en: string } {
  return gender === 'm'
    ? { es: '¡Hola! ¡Bienvenido a Learning with Dina!', en: 'Hi! Welcome to Learning with Dina!' }
    : { es: '¡Hola! ¡Bienvenida a Learning with Dina!', en: 'Hi! Welcome to Learning with Dina!' };
}
