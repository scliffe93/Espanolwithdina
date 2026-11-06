import { motion } from 'motion/react';
import { useEffect, useId, useState } from 'react';

// Dina — high-fidelity vector portrait of the tutor behind "Learning with Dina",
// cradling her Maltese, Toby. Hair, lashes and fringe are tapered ribbons generated
// from cubic curves at module load, so hundreds of fine strands cost little code;
// Toby's coat is a tufted outline with silky strands. Motion is quiet: blinks, a
// breath, a tiny head tilt; the mouth and hand move only while speaking / waving.
// animate=false renders a still image.

export type DinaExpression = 'smile' | 'beam';

/** SVG viewBox of DinaArt (width × height). */
export const DINA_VIEWBOX: { w: number; h: number } = { w: 166, h: 174 };
const VX = 26, VY = 10; // viewBox origin (the art is drawn in a 0–200 space)
/** Fraction of the height where the logo card's top edge sits (everything below is hidden). */
export const DINA_CARD_LINE = 0.85;

const C = {
  hairDeep: '#190D08', hair: '#2D1A12', hairMid: '#4B2F21', hairHi: '#7E5438', hairSheen: '#AE7D5C',
  skinHi: '#F6CDAA', skin: '#ECB288', skinMid: '#DA9B70', skinSh: '#C07E56', skinDeep: '#9D6044',
  blush: '#DF7E6A', lipHi: '#EFB0A2', top: '#181513', lace: '#E9DCC2',
  fur: '#FDFCFA', furSh: '#E8E1D6', furDeep: '#CDC1B1',
};

type P = [number, number];
type Cub = [P, P, P, P];
const f = (n: number) => Math.round(n * 100) / 100;
const rnd = (i: number) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const bz = (c: Cub, t: number): P => {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, d = 3 * u * t * t, e = t * t * t;
  return [a * c[0][0] + b * c[1][0] + d * c[2][0] + e * c[3][0], a * c[0][1] + b * c[1][1] + d * c[2][1] + e * c[3][1]];
};
const bzd = (c: Cub, t: number): P => {
  const u = 1 - t, a = 3 * u * u, b = 6 * u * t, d = 3 * t * t;
  return [a * (c[1][0] - c[0][0]) + b * (c[2][0] - c[1][0]) + d * (c[3][0] - c[2][0]), a * (c[1][1] - c[0][1]) + b * (c[2][1] - c[1][1]) + d * (c[3][1] - c[2][1])];
};
const nrm = (c: Cub, t: number): P => { const [dx, dy] = bzd(c, t), l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; };

/** A tapered strip along a cubic: width w0 at the start, w1 at the end, plus a mid bulge. `cap` rounds the end. */
function ribbon(c: Cub, w0: number, w1: number, bulge = 0, n = 8, cap = false): string {
  const L: string[] = [], R: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, [x, y] = bz(c, t), [nx, ny] = nrm(c, t);
    const w = ((1 - t) * w0 + t * w1 + 4 * t * (1 - t) * bulge) / 2;
    L.push(`${f(x + nx * w)} ${f(y + ny * w)}`); R.push(`${f(x - nx * w)} ${f(y - ny * w)}`);
  }
  const end = R[n]; R.reverse();
  return `M${L.join('L')}${cap ? `A${f(w1 / 2)} ${f(w1 / 2)} 0 0 1 ${end}` : `L${end}`}L${R.slice(1).join('L')}Z`;
}
/** k strands scattered around a guide curve, each tapering to nothing. */
function spray(c: Cub, k: number, seed: number, spread: number, w: number, tail: number): string[] {
  const n0 = nrm(c, 0), n1 = nrm(c, 1);
  const sh = (p: P, nn: P, d: number): P => [p[0] + nn[0] * d, p[1] + nn[1] * d];
  return Array.from({ length: k }, (_, i) => {
    const o = (rnd(seed + i) - 0.5) * spread, e = o + (rnd(seed + i + 31) - 0.5) * tail, s = 0.55 + rnd(seed + i + 77) * 0.9;
    return ribbon([sh(c[0], n0, o), sh(c[1], n0, o), sh(c[2], n1, e), sh(c[3], n1, e)], w * s * 0.5, 0, w * s, 7);
  });
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

/** Irregular, natural blinking. */
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

// ── Head geometry (untilted). A soft oval with a small, rounded chin and a high forehead.
const HX = 120;
const FACE = 'M120 34.5C136.5 34.5 146.5 49 147 68C147.5 84 146.5 96 143.2 106.5C140.4 117.6 132.8 128.4 120 129.3C107.2 128.4 99.6 117.6 96.8 106.5C93.5 96 92.5 84 93 68C93.5 49 103.5 34.5 120 34.5Z';
// Torso (global coordinates): the knit top and the crochet shoulder, also used to clip their soft shading.
const BODY = 'M14 200C16 180 28 164 50 156C68 149 90 146.7 104 141.7L138 141.7C156 145.7 172 151 184 159.5C194 167.5 198 184 199 200Z';
const LACE = 'M150 144.7C164 147.7 177 152.7 186 159.7C193 165.7 197 175.7 199 187.7L189 190.7C187 177.7 182 169.7 175 163.7C167 157.7 157 153.7 146 150.7Z';
// Hair gathered loosely behind the shoulders, its ends tapering in soft points.
const HAIR_BACK = 'M120 22.5C99 22.5 85 33 82.5 54C80.5 72 84 94 81.5 114C80 130 78 142 78 154C79.5 157.5 82 157.5 84 154L85.5 160.5C88 158 89.5 154 91 150C97 147 103 145.5 108 145L132 145C138 146 144 148 148.5 151.5L151 160C153 157 154 154 155 151L159.5 158C161.5 152 161 146 160 140C158.5 130 158 122 158 114C157.5 94 160.5 74 158.5 54C156 33 141 22.5 120 22.5Z';
const HAIR_CROWN = 'M95.5 72C87.5 58 91 33 108.5 26.5C114.5 24 127 24 133 26.5C150 33.5 154 56 147 63.5C144 59.5 140 55.5 136 53C131 50 125.5 46.8 122 45.8C119.2 45.1 116.8 45.4 115.2 46.6C109.5 50 104 56.5 100 62.5C98.3 65.3 96.8 68.6 95.5 72Z';
const HAIR_L = 'M102 40C91.5 47 86.5 62 86.5 80C86.5 100 85.5 120 85.2 140C85 148 84.6 155 85.5 161.5C88.5 156.5 91.5 151 93.5 146C95.5 141 97 137 97.4 133C96.8 118 96.2 102 96.4 88C96.6 74 97.5 60 103.5 49Z';
const HAIR_R = 'M146 58C155 64 159.5 82 159.5 100C159.5 118 160 134 161 146C161.5 152 163 157 165.5 161.5C162 160.5 158.5 159.5 156 161.5C154.5 158 152.5 159 150.5 162C150.5 154 149 146 148.5 138C147.5 126 148.5 110 148 96C147.5 84 147.5 70 146 58Z';
// Fringe from the parting: the loose section sweeps to the viewer's left and falls over that temple
// (as in the photo); the right side is combed back close to the hairline. [curve, start w, end w, bulge]
const SWEEP: [Cub, number, number, number][] = [
  [[[118, 40], [105, 43], [96.5, 57], [93.5, 80]], 8, 3.5, 2],
  [[[120.5, 43], [109, 47], [101, 59], [98, 76]], 3.6, 1.2, 1],
  [[[122, 47], [113, 51], [106, 60], [103.5, 70]], 1.6, 0.4, 0.4],
  [[[121, 41], [132, 42.5], [141, 49], [146, 60]], 2.6, 0.6, 0.6],
  [[[119, 46], [112, 52], [104, 64], [99, 84]], 1.3, 0.3, 0.3],
  [[[117.5, 44], [108, 50], [100, 62], [95, 88]], 1.1, 0.25, 0.3],
  [[[119.5, 44], [116, 50], [111.5, 57], [109, 63]], 1.2, 0.25, 0.3],
];
// Strand flow over the crown and down the side masses: [guide, count, seed, spread]
const FLOW: [Cub, number, number, number][] = [
  [[[117, 29], [104, 31], [92, 44], [89.5, 66]], 8, 1, 4.5], [[[118, 26], [100, 27.5], [87, 42], [85.5, 70]], 5, 2, 4.5],
  [[[122, 28], [138, 31], [150, 46], [152, 68]], 7, 3, 4.5], [[[121, 25], [141, 26.5], [155, 44], [155.5, 74]], 4, 4, 4.5],
  [[[89, 72], [88, 96], [86.5, 126], [86.5, 154]], 6, 5, 4], [[[93, 78], [93.5, 102], [93, 130], [91.5, 152]], 5, 6, 3],
  [[[150, 62], [160, 84], [161.5, 120], [160, 154]], 7, 7, 4.5], [[[147, 66], [154, 92], [154, 130], [153, 154]], 5, 8, 4],
];
const HAIR_STRANDS = FLOW.flatMap(([c, k, s, sp]) => spray(c, k, s * 97, sp, 1.1, 3).map((d, i) => [d, (i + s) % 3] as const));
const FLYAWAY = [
  ribbon([[146, 66], [149.5, 80], [150, 96], [148.5, 114]], 1.3, 0, 0.5, 7),
  ribbon([[104, 27], [96, 30], [90, 38], [88, 48]], 0.6, 0, 0.3, 6), ribbon([[136, 27], [146, 31], [152, 40], [153.5, 50]], 0.6, 0, 0.3, 6),
  ribbon([[99, 60], [94, 68], [91, 78], [90.5, 90]], 0.5, 0, 0.3, 6), ribbon([[148, 66], [157, 80], [161, 100], [162.5, 120]], 0.55, 0, 0.3, 6),
  ribbon([[152, 86], [161, 104], [163.5, 128], [163, 150]], 0.5, 0, 0.3, 6), ribbon([[88, 90], [86, 106], [85.8, 120], [86.2, 134]], 0.5, 0, 0.3, 6),
];
/** Eyebrow: a soft filled shape (thicker, straight, natural) with a few faint hairs for texture. */
function brow(m: 1 | -1, seed: number) {
  const X = (v: number) => HX + m * (v - HX);
  const c: Cub = [[X(113.8), 72.5], [X(109), 69.2], [X(103), 68.6], [X(98.2), 71.4]];
  const hairs = Array.from({ length: 16 }, (_, i) => {
    const t = (i % 8) / 7, row = i < 8 ? -0.4 : 0.4, [x0, y0] = bz(c, t), [dx, dy] = bzd(c, t), [nx, ny] = nrm(c, t);
    const x = x0 + nx * row, y = y0 + ny * row;
    const ang = Math.atan2(dy, dx) + m * (1 - t) * 0.5 + (rnd(seed + i) - 0.5) * 0.25, len = 1.3 - t * 0.5 + rnd(seed + i + 9) * 0.4;
    const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
    return ribbon([[x, y], [x + (ex - x) * 0.35, y + (ey - y) * 0.35 - 0.1 * m], [x + (ex - x) * 0.7, y + (ey - y) * 0.7], [ex, ey]], 0.32, 0.05, 0, 3);
  });
  return { base: ribbon(c, 1.6, 0.8, 1.5, 10), hairs };
}
const BROWS = [brow(1, 3), brow(-1, 51)];

function Eye({ x, y, m, up, low, closed, beam, id }: { x: number; y: number; m: 1 | -1; up: number; low: number; closed: boolean; beam: boolean; id: string }) {
  const X = (v: number) => x + m * v, Y = (v: number) => y + v;
  const topC: Cub = [[X(-6.5), Y(0.6)], [X(-4.3), Y(-up - 0.5)], [X(1.4), Y(-up - 1.1)], [X(6.5), Y(-0.2)]];
  const top = `M${f(topC[0][0])} ${f(topC[0][1])}C${f(topC[1][0])} ${f(topC[1][1])} ${f(topC[2][0])} ${f(topC[2][1])} ${f(topC[3][0])} ${f(topC[3][1])}`;
  const crease = <path d={`M${f(X(-5.6))} ${f(Y(-up - 1.2))}C${f(X(-2.4))} ${f(Y(-up - 3.5))} ${f(X(3))} ${f(Y(-up - 3.4))} ${f(X(6.6))} ${f(Y(-up - 0.9))}`} stroke={C.skinSh} strokeWidth=".7" fill="none" opacity=".3" filter={`url(#${id}-b03)`} />;
  if (closed) {
    const cl: Cub = [[X(-6.5), Y(0.6)], [X(-3.8), Y(low + 1.6)], [X(2.6), Y(low + 1.6)], [X(6.5), Y(-0.1)]];
    return (
      <g>
        {crease}
        <path d={ribbon(cl, 0.8, 0.4, 0.5, 8)} fill="#241510" opacity=".92" />
        <path d={ribbon(cl, 0.5, 0.2, 0.2, 8)} fill="#241510" transform="translate(0 0.8)" opacity=".3" filter={`url(#${id}-b03)`} />
      </g>
    );
  }
  const lowL = `C${f(X(3.6))} ${f(Y(low + 0.7))} ${f(X(-3.4))} ${f(Y(low + 0.5))} ${f(X(-6.5))} ${f(Y(0.6))}`;
  const shape = `${top}${lowL}Z`;
  const ix = X(0.5), iy = y - 0.15, r = 3.35;
  // The clip id carries the lid state so several static instances on one page never share a clip shape.
  const cid = `${id}-e${m > 0 ? 'l' : 'r'}${beam ? 'b' : ''}`;
  return (
    <g>
      {crease}
      <clipPath id={cid}><path d={shape} /></clipPath>
      <g clipPath={`url(#${cid})`}>
        <path d={shape} fill={`url(#${id}-scl)`} />
        <circle cx={ix} cy={iy} r={r} fill={`url(#${id}-iris)`} />
        <circle cx={ix} cy={iy} r={r - 0.25} fill="none" stroke="#1E1008" strokeWidth=".5" opacity=".75" />
        <g stroke="#2B170C" strokeWidth=".35" opacity=".32" fill="none">
          {[20, 70, 115, 160, 205, 250, 300, 340].map((a) => <path key={a} d={`M${f(ix + Math.cos(a * 0.01745) * 1.5)} ${f(iy + Math.sin(a * 0.01745) * 1.5)}L${f(ix + Math.cos(a * 0.01745) * r)} ${f(iy + Math.sin(a * 0.01745) * r)}`} />)}
        </g>
        <circle cx={ix} cy={iy} r="1.3" fill="#0C0604" />
        <path d={top} stroke="#3B2016" strokeWidth={beam ? 1.5 : 2} fill="none" opacity=".36" filter={`url(#${id}-b08)`} />
        <path d={`M${f(X(6.5))} ${f(Y(-0.2))}${lowL}`} stroke="#fff" strokeWidth="1" fill="none" opacity={beam ? 0.18 : 0.35} filter={`url(#${id}-b05)`} />
        <circle cx={ix - 1.1} cy={iy - 1.25} r=".9" fill="#fff" opacity=".96" />
        <circle cx={ix + 1.25} cy={iy + 1.35} r=".42" fill="#fff" opacity=".4" />
      </g>
      {/* lower lid: a faint lash shadow and the pale wet edge */}
      <path d={`M${f(X(5.5))} ${f(Y(0.3))}${lowL}`} stroke="#6B4536" strokeWidth=".4" fill="none" opacity=".22" filter={`url(#${id}-b03)`} />
      <path d={`M${f(X(4.5))} ${f(Y(0.8))}${lowL}`} stroke={C.skinHi} strokeWidth=".6" fill="none" opacity=".55" transform="translate(0 1)" filter={`url(#${id}-b03)`} />
      {/* lash line, thickest toward the outer corner */}
      <path d={ribbon(topC, 1.15, 0.3, 0.3, 10)} fill="#211209" transform="translate(0 -0.25)" />
      <g fill="#241510" opacity=".8">
        {[0.07, 0.19, 0.33].map((t, i) => {
          const [px, py] = bz(topC, t), [nx, ny] = nrm(topC, t), l = 1.05 - i * 0.28;
          return <path key={t} d={ribbon([[px, py], [px + nx * l * 0.5 - m * 0.3, py + ny * l * 0.5 - 0.3], [px + nx * l - m * 0.6, py + ny * l - 0.6], [px + nx * l - m * 0.9, py + ny * l - 0.8]], 0.4, 0.05, 0, 3)} />;
        })}
      </g>
      {beam && (
        <g fill="none" strokeLinecap="round">
          {/* the cheek lifts into a soft pillow under the eye, with a faint lower-lid crease and one short laugh line */}
          <ellipse cx={f(X(0.5))} cy={f(Y(low + 2.1))} rx="4.6" ry="1" fill={C.skinHi} opacity=".4" filter={`url(#${id}-b08)`} />
          <path d={`M${f(X(-5))} ${f(Y(low + 2.5))}C${f(X(-2))} ${f(Y(low + 3.6))} ${f(X(3.2))} ${f(Y(low + 3.5))} ${f(X(6.6))} ${f(Y(low + 2))}`} stroke={C.skinSh} strokeWidth=".7" opacity=".28" filter={`url(#${id}-b05)`} />
          <path d={`M${f(X(-7.4))} ${f(Y(0.8))}q-1.3 -.3 -2.2 .2`} transform={m < 0 ? `translate(${f(2 * X(-7.45))} 0) scale(-1 1)` : undefined} stroke={C.skinSh} strokeWidth=".4" opacity=".22" filter={`url(#${id}-b03)`} />
        </g>
      )}
    </g>
  );
}

/** Mouth: half-width W, corner lift, opening depth D, upper-teeth depth T, lower-lip thickness lt; k names the shape for its clip id. */
function Mouth({ cx, my, W, lift, D, T, lt, lower, id, k }: { cx: number; my: number; W: number; lift: number; D: number; T: number; lt: number; lower: boolean; id: string; k: string }) {
  const cc = my - lift, L = f(cx - W), R = f(cx + W);
  const openTop = `C${f(cx + W * 0.52)} ${f(my + 0.9)} ${f(cx - W * 0.52)} ${f(my + 0.9)} ${L} ${f(cc)}`; // right → left
  const openBot = `C${f(cx - W * 0.64)} ${f(my + D)} ${f(cx + W * 0.64)} ${f(my + D)} ${R} ${f(cc)}`; // left → right
  const opening = `M${L} ${f(cc)}${openBot}${openTop}Z`;
  const upperLip = `M${f(cx - W - 0.4)} ${f(cc - 0.2)}C${f(cx - W * 0.58)} ${f(my - 1.9)} ${f(cx - 5)} ${f(my - 3)} ${f(cx - 2.2)} ${f(my - 3.1)}Q${f(cx - 0.9)} ${f(my - 3)} ${cx} ${f(my - 2.4)}Q${f(cx + 0.9)} ${f(my - 3)} ${f(cx + 2.2)} ${f(my - 3.1)}C${f(cx + 5)} ${f(my - 3)} ${f(cx + W * 0.58)} ${f(my - 1.9)} ${f(cx + W + 0.4)} ${f(cc - 0.2)}L${R} ${f(cc)}${openTop}Z`;
  const lowerLip = `M${L} ${f(cc)}${openBot}C${f(cx + W * 0.52)} ${f(my + D + lt * 1.35)} ${f(cx - W * 0.52)} ${f(my + D + lt * 1.35)} ${L} ${f(cc)}Z`;
  // Upper teeth: a softly curved row, each edge gently rounded, narrowing toward the corners.
  const xs = [-1, -0.83, -0.65, -0.46, -0.24, 0, 0.24, 0.46, 0.65, 0.83, 1].map((t) => t * W * 0.95);
  const yb = (x: number) => my + T - (T + lift * 0.85) * (x / W) ** 2;
  let teeth = `M${f(cx - W)} ${f(cc - 3)}L${f(cx + W)} ${f(cc - 3)}L${f(cx + xs[10])} ${f(yb(xs[10]))}`;
  for (let i = 10; i > 0; i--) teeth += `Q${f(cx + (xs[i] + xs[i - 1]) / 2)} ${f(yb((xs[i] + xs[i - 1]) / 2) + 0.55)} ${f(cx + xs[i - 1])} ${f(yb(xs[i - 1]))}`;
  const B = (n: string) => `url(#${id}-${n})`;
  return (
    <g>
      <clipPath id={`${id}-mo${k}`}><path d={opening} /></clipPath>
      <path d={opening} fill={B('mouth')} />
      <g clipPath={B(`mo${k}`)}>
        {D > 5 && <ellipse cx={cx} cy={my + D * 0.86} rx={W * 0.5} ry="2.4" fill="#A9555A" />}
        {lower && <path d={`M${f(cx - W * 0.68)} ${f(my + D * 0.86)}Q${cx} ${f(my + D * 0.7)} ${f(cx + W * 0.68)} ${f(my + D * 0.86)}L${f(cx + W * 0.68)} ${f(my + D + 2)}L${f(cx - W * 0.68)} ${f(my + D + 2)}Z`} fill="#EFE6DA" opacity=".92" />}
        <path d={teeth + 'Z'} fill={B('teeth')} />
        {/* gum line and the soft shade under the lip */}
        <path d={`M${R} ${f(cc)}${openTop}`} stroke="#C97A78" strokeWidth="1.1" fill="none" opacity=".5" filter={B('b05')} transform="translate(0 0.6)" />
        {xs.slice(1, 10).map((x, i) => (
          <path key={i} d={`M${f(cx + x)} ${f(cc - 1.5)}L${f(cx + x * 0.97)} ${f(yb(x) + 0.2)}`} stroke="#A89483" strokeWidth={i === 4 ? 0.4 : 0.3} opacity=".5" />
        ))}
        <path d={`M${R} ${f(cc)}${openTop}`} stroke="#6E3530" strokeWidth="1.6" fill="none" opacity=".36" filter={B('b05')} />
        <g fill="#3A1414" opacity=".2" filter={B('b08')}>
          <circle cx={cx - W} cy={cc + 0.6} r="1.8" />
          <circle cx={cx + W} cy={cc + 0.6} r="1.8" />
        </g>
      </g>
      <g filter={B('b03')}>
        <path d={upperLip} fill={B('lipU')} />
        <path d={lowerLip} fill={B('lipL')} />
      </g>
      <ellipse cx={cx + 0.6} cy={my + D * 0.78 + lt * 0.55} rx={W * 0.28} ry=".85" fill={C.lipHi} opacity=".5" filter={B('b08')} />
      <path d={`M${f(cx - 3.6)} ${f(my - 3.9)}Q${cx} ${f(my - 2.9)} ${f(cx + 3.6)} ${f(my - 3.9)}`} stroke={C.skinHi} strokeWidth=".8" fill="none" opacity=".6" filter={B('b05')} />
      <g fill="#8A4A3C" opacity=".24" filter={B('b08')}>
        <circle cx={cx - W - 0.7} cy={cc + 0.3} r="1.2" />
        <circle cx={cx + W + 0.7} cy={cc + 0.3} r="1.2" />
      </g>
    </g>
  );
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
// Open palm for the wave, fingers joined to the palm, thumb angled out.
const WAVE_HAND = 'M-8.5 0C-9 -4 -9.5 -6 -10.5 -8C-13 -11 -16 -15 -18.4 -19.4C-19.8 -22.2 -17.4 -23.6 -15.8 -21.8C-14.4 -19.8 -12.6 -17.6 -11.2 -16.6C-11.2 -20 -11.4 -23 -11.2 -25C-11.2 -31 -11 -37 -10.5 -42C-10.1 -45.6 -6 -45.8 -5.7 -42.4C-5.5 -37 -5.4 -31 -5.3 -26.5C-5.3 -32 -5.2 -39 -5 -44.8C-4.7 -48.4 .1 -48.4 .3 -44.8C.4 -39 .3 -32 .2 -26.5C.3 -31 .5 -37 .8 -42C1.1 -45.4 5.2 -45.2 5.3 -41.8C5.3 -36 5.1 -30 5 -25.5C5.3 -29 5.7 -32 6.2 -34.6C6.8 -37.6 10.2 -36.8 9.9 -33.8C9.7 -30 9.7 -26.5 9.8 -23C10 -15 9.5 -7 8.5 0Z';

// ── Toby (global coordinates), cradled at Dina's chin. Drawn at TS× scale about his head centre.
const TX = 68, TY = 110, TS = 1.1;
const TOBY_T = `translate(${TX} ${TY}) scale(${TS}) translate(${-TX} ${-TY})`;
const TOBY_HEAD = tufts(TX, TY, 20, 18.5, 22, 0.14, 3);
const TOBY_BODY = tufts(TX + 5, TY + 38, 23.5, 21, 18, 0.1, 11);
// Long-haired ear (left side; mirrored for the right), hanging in soft waves.
const tp = (pts: number[]) => pts.map((v, i) => f(i % 2 ? TY + v : TX + v)).join(' ');
const TOBY_EAR = `M${tp([-14, -15])}C${tp([-23, -13, -28, -3, -28.5, 8])}C${tp([-29, 18, -31.5, 24, -30.5, 33])}L${tp([-28.6, 36.8, -26.2, 31.5, -23, 37, -20, 31.8, -17.5, 30])}C${tp([-14.5, 20, -12.5, 9, -12, 0])}Z`;
const EAR_STRANDS = `M${tp([-16, -11])}C${tp([-23, -4, -26, 8, -26, 19])}S${tp([-27.5, 30, -26.5, 33])}M${tp([-15, -6])}C${tp([-19, 4, -21, 16, -21, 31])}M${tp([-19, -12])}C${tp([-25, -6, -27.5, 4, -28, 14])}`;
const TOBY_HEAD_STRANDS = strands(TX, TY + 2, 19.5, 17.5, 22, 0.62, 1.02, 7);
const TOBY_PAWS = [tufts(TX - 7, TY + 57.5, 7, 4.8, 12, 0.18, 21), tufts(TX + 9, TY + 57.5, 7, 4.8, 12, 0.18, 29)];
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
          <circle cx={ex - 0.9} cy={TY - 3.3} r=".75" fill="#fff" opacity=".95" />
          <circle cx={ex + 0.9} cy={TY - 1.2} r=".35" fill="#fff" opacity=".35" />
        </>
      )}
    </g>
  );
  return (
    <motion.g
      style={{ originX: `${TX - VX}px`, originY: `${TY + 18 - VY}px` }}
      initial={animate ? { rotate: 0 } : false}
      animate={animate ? { rotate: [0, 0, -4, -4, 0, 0, 3, 3, 0] } : undefined}
      transition={{ duration: 13, times: [0, 0.3, 0.36, 0.5, 0.56, 0.75, 0.8, 0.9, 0.96], repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* soft contact shadow so the white coat separates from light backgrounds */}
      <path d={TOBY_HEAD} transform="translate(1 1.5)" fill="#5E4E42" opacity=".3" filter={B('b2')} />
      {/* solid underlay under the displaced, soft-edged ears and head (see the body) */}
      <g fill={C.fur} filter={B('b05')}>
        <path d={TOBY_EAR} />
        <path d={TOBY_EAR} transform={`translate(${2 * TX} 0) scale(-1 1)`} />
        <path d={TOBY_HEAD} />
      </g>
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
  const id = `dvc${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const blink = useBlink(animate, 2600, 3400);
  const tobyBlink = useBlink(animate && toby, 3300, 2700);
  const mouth = useMouth(speaking, animate);
  const beam = expression === 'beam' && !speaking;
  const label = title ?? (toby ? 'Dina, your Spanish tutor, holding her Maltese, Toby' : 'Dina, your Spanish tutor');
  const tilt = toby ? -5 : -1.5;
  const { w, h } = DINA_VIEWBOX;
  const B = (n: string) => `url(#${id}-${n})`;

  // Eye openness and mouth shape per expression (beam squeezes the eyes into a crinkle).
  const up = beam ? 2.6 : 3.2, low = beam ? 0.15 : 2.3;
  const m = speaking
    ? { W: 13.4 - mouth * 1.6, lift: 2.6, D: 3.5 + mouth * 9, T: 3 + mouth * 1.6, lt: 3.2, lower: mouth > 0.45, k: 's' }
    : beam
      ? { W: 15.4, lift: 4.2, D: 8.6, T: 5.8, lt: 3, lower: true, k: 'b' }
      : { W: 14.2, lift: 3.4, D: 5.6, T: 3.4, lt: 3.3, lower: false, k: 'n' };
  const grads: [string, string[], number[]][] = [
    ['neck', ['#A86E52', C.skinMid, C.skin], [0, 0.45, 1]], ['hairB', [C.hair, '#120905'], [0, 1]],
    ['lipU', ['#B5635B', '#9E514C'], [0, 1]], ['lipL', ['#D98C80', '#C07266'], [0, 1]], ['top', ['#2A2522', C.top], [0, 1]],
    ['ear', ['#F3EEE6', '#FBF9F5', '#DCD2C4'], [0, 0.45, 1]],
  ];

  return (
    <svg viewBox={`${VX} ${VY} ${w} ${h}`} width={size} height={(size * h) / w} className={className} role="img" aria-label={label} style={{ overflow: 'visible' }}>
      <title>{label}</title>
      <defs>
        {([['b03', 0.3], ['b05', 0.5], ['b08', 0.8], ['b15', 1.5], ['b2', 2.2], ['b4', 4]] as const).map(([n, s]) => (
          <filter key={n} id={`${id}-${n}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={s} /></filter>
        ))}
        <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".95" numOctaves="2" seed="7" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 .55 0 0 0 0 .33 0 0 0 0 .22 0 0 0 .9 -.35" />
        </filter>
        <filter id={`${id}-fur`} x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation=".3" />
        </filter>
        {grads.map(([n, cs, os]) => (
          <linearGradient key={n} id={`${id}-${n}`} x1="0" y1="0" x2="0" y2="1">
            {cs.map((c, i) => <stop key={i} offset={os[i]} stopColor={c} />)}
          </linearGradient>
        ))}
        <radialGradient id={`${id}-skin`} cx=".42" cy=".38" r=".74">
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
        <linearGradient id={`${id}-sweep`} gradientUnits="userSpaceOnUse" x1="0" y1="40" x2="0" y2="88">
          <stop offset="0" stopColor={C.hair} />
          <stop offset=".55" stopColor={C.hairMid} />
          <stop offset="1" stopColor={C.hairMid} stopOpacity=".5" />
        </linearGradient>
        <radialGradient id={`${id}-scl`} cx=".5" cy=".55" r=".6">
          <stop offset="0" stopColor="#FDFBF8" />
          <stop offset=".7" stopColor="#F5EDE6" />
          <stop offset="1" stopColor="#DECBBF" />
        </radialGradient>
        <radialGradient id={`${id}-iris`} cx=".5" cy=".6" r=".5">
          <stop offset=".2" stopColor="#B07A48" />
          <stop offset=".6" stopColor="#6F4225" />
          <stop offset="1" stopColor="#3A2012" />
        </radialGradient>
        <radialGradient id={`${id}-mouth`} cx=".5" cy=".3" r=".7">
          <stop offset="0" stopColor="#8A3E42" />
          <stop offset="1" stopColor="#4E1D23" />
        </radialGradient>
        <linearGradient id={`${id}-teeth`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#B09D8C" />
          <stop offset=".2" stopColor="#E5DBCE" />
          <stop offset=".5" stopColor="#FBF7F0" />
          <stop offset=".8" stopColor="#E5DBCE" />
          <stop offset="1" stopColor="#B09D8C" />
        </linearGradient>
        {(['brow', 'browR'] as const).map((n, i) => (
          <linearGradient key={n} id={`${id}-${n}`} x1={i} y1="0" x2={1 - i} y2="0">
            <stop offset="0" stopColor={C.hair} stopOpacity=".92" />
            <stop offset=".6" stopColor={C.hair} stopOpacity=".85" />
            <stop offset="1" stopColor={C.hairMid} stopOpacity=".55" />
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
          <stop offset=".55" stopColor={C.skin} />
          <stop offset="1" stopColor={C.skinMid} />
        </linearGradient>
        <clipPath id={`${id}-face`}><path d={FACE} /></clipPath>
        <clipPath id={`${id}-hairc`}><path d={HAIR_BACK} /><path d={HAIR_L} /><path d={HAIR_R} /><path d={HAIR_CROWN} /></clipPath>
        <clipPath id={`${id}-torso`}><path d={BODY} /><path d={LACE} /></clipPath>
        <clipPath id={`${id}-frame`}><rect x="-40" y="-40" width="300" height={VY + h + 40} /></clipPath>
      </defs>

      <g clipPath={B('frame')}>
        {/* barely-there breathing */}
        <motion.g initial={animate ? { y: 0 } : false} animate={animate ? { y: [0, -0.5, 0] } : undefined} transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}>
          {/* hair behind the shoulders */}
          <g transform={`rotate(${tilt} ${HX} 150)`}>
            <path d={HAIR_BACK} fill={B('hairB')} filter={B('b03')} />
          </g>

          {/* black knit top with the cream crochet shoulder */}
          <path id={`${id}-body`} d={BODY} fill={B('top')} />
          <use href={`#${id}-body`} fill={B('knit')} opacity=".35" />
          <path d={LACE} fill={B('lace')} />
          <path d="M146 150.7C157 153.7 167 157.7 175 163.7C182 169.7 187 177.7 189 190.7" stroke={C.lace} strokeWidth="1.6" strokeDasharray="1.2 1.4" strokeLinecap="round" fill="none" />
          {/* soft shading, kept inside the silhouette so nothing haloes onto the page */}
          <g clipPath={B('torso')}>
            <path d="M150 144.7C164 147.7 177 152.7 186 159.7C193 165.7 197 175.7 199 187.7" stroke="#000" strokeWidth="3" fill="none" opacity=".25" filter={B('b15')} />
            <g filter={B('b2')} opacity=".6">
              <path d="M120 149.7C108 151.7 96 155.7 88 163.7" stroke="#4A4440" strokeWidth="3" fill="none" />
              <path d="M150 155.7C162 161.7 170 171.7 176 185.7" stroke="#000" strokeWidth="5" fill="none" opacity=".5" />
            </g>
          </g>

          {/* slim neck with the jaw's shadow */}
          <path d="M106.5 112L107 132.8C106.5 138.3 104 141.3 101.5 143.2C111 148.7 129 148.7 138.5 143.2C136 141.3 133.5 138.3 133 132.8L133.5 112Z" fill={B('neck')} />
          <g filter={B('b2')}>
            <path d="M107 123C114 134.5 127 134.5 133 123L133 115L107 115Z" fill={C.skinDeep} opacity=".55" />
            <ellipse cx="128" cy="134" rx="3" ry="8" fill={C.skinSh} opacity=".35" />
          </g>
          <path d="M103 143.2C111 148.7 129 148.7 137 143.2" stroke="#4A433F" strokeWidth="1.4" fill="none" opacity=".8" filter={B('b03')} />

          {/* head, tilted gently toward Toby */}
          <g transform={`rotate(${tilt} ${HX} 150)`}>
            <motion.g
              style={{ originX: `${HX - VX}px`, originY: `${150 - VY}px` }}
              initial={animate ? { rotate: 0 } : false}
              animate={animate ? (speaking ? { rotate: [0, 0.8, -0.5, 0.5, 0] } : { rotate: [0, 0, 1.2, 1.2, 0, -0.6, 0] }) : undefined}
              transition={{ duration: speaking ? 2.6 : 10, repeat: Infinity, ease: 'easeInOut' }}
            >
              <path d={FACE} fill={B('skin')} />
              {/* skin modelling, clipped to the face; light comes from the upper left */}
              <g clipPath={B('face')}>
                <rect x="90" y="34" width="60" height="98" filter={B('grain')} opacity=".14" />
                <g filter={B('b4')}>
                  <ellipse cx="149.5" cy="92" rx="9" ry="38" fill={C.skinSh} opacity=".52" />
                  <ellipse cx="91" cy="94" rx="5.5" ry="30" fill={C.skinSh} opacity=".32" />
                  <ellipse cx="120" cy="40" rx="32" ry="8" fill="#7E4B36" opacity=".5" />
                  <ellipse cx="116" cy="57" rx="11" ry="7" fill={C.skinHi} opacity=".55" />
                  <ellipse cx="96" cy="72" rx="5" ry="9" fill={C.skinSh} opacity=".3" />
                  <ellipse cx="145" cy="70" rx="5" ry="9" fill={C.skinSh} opacity=".4" />
                  <ellipse cx="105" cy={beam ? 93.5 : 95} rx="8" ry={beam ? 5.5 : 5} fill={C.skinHi} opacity={beam ? 0.75 : 0.6} />
                  <ellipse cx="139" cy={beam ? 93.5 : 95} rx="7" ry={beam ? 5.5 : 5} fill={C.skinHi} opacity={beam ? 0.45 : 0.35} />
                  <ellipse cx="104" cy="101" rx="8.5" ry="5.5" fill={C.blush} opacity={beam ? 0.3 : 0.25} />
                  <ellipse cx="140" cy="101" rx="8.5" ry="5.5" fill={C.blush} opacity={beam ? 0.28 : 0.23} />
                  <ellipse cx="100" cy="109" rx="7" ry="4.5" fill={C.skinSh} opacity={beam ? 0.14 : 0.1} />
                  <ellipse cx="143" cy="109" rx="7" ry="4.5" fill={C.skinSh} opacity={beam ? 0.22 : 0.16} />
                  <ellipse cx="120" cy="128.3" rx="18" ry="4.6" fill={C.skinDeep} opacity=".34" />
                  <ellipse cx="119" cy="122" rx="5" ry="2.6" fill={C.skinHi} opacity=".5" />
                </g>
                <g filter={B('b2')}>
                  <ellipse cx="107.5" cy="77" rx="9" ry="4.5" fill="#B07760" opacity=".14" />
                  <ellipse cx="132.5" cy="77" rx="9" ry="4.5" fill="#A86E58" opacity=".18" />
                  <ellipse cx="115.5" cy="80.5" rx="2.4" ry="3.2" fill={C.skinSh} opacity=".18" />
                  <ellipse cx="125" cy="81.5" rx="2.6" ry="4" fill={C.skinSh} opacity=".24" />
                  <path d="M124.5 84C126.2 90 127.2 96 126.8 100.5L123 101C123.6 96 123.4 90 122.6 85Z" fill={C.skinSh} opacity=".4" filter={B('b15')} />
                  <ellipse cx="120" cy="108" rx="5" ry="1.4" fill={C.skinSh} opacity=".3" />
                  <ellipse cx="120" cy="120" rx="5.5" ry="1.8" fill={C.skinSh} opacity=".26" />
                  {/* shadows the hair casts on the forehead and cheeks */}
                  <g fill="#5A2E1F" opacity=".4" transform="translate(1.2 2.4)">
                    {SWEEP.slice(0, 4).map(([c, w0, w1, b], i) => <path key={i} d={ribbon(c, w0, w1, b, 10)} />)}
                    <path d={HAIR_L} transform="translate(0.6 -1)" />
                    <path d={HAIR_R} transform="translate(-3.2 -1)" />
                  </g>
                </g>
                {/* smile folds and the bridge of the nose */}
                <g filter={B('b08')} fill="none" strokeLinecap="round">
                  <path d={beam ? 'M113.5 100.5C108.5 103.5 104.5 108 104 114.5' : 'M114 101C109.5 104 107.3 108 107 112.5'} stroke={C.skinSh} strokeWidth="1" opacity={beam ? 0.3 : 0.2} />
                  <path d={beam ? 'M126.5 100.5C131.5 103.5 135.5 108 136 114.5' : 'M126 101C130.5 104 132.7 108 133 112.5'} stroke={C.skinDeep} strokeWidth="1" opacity={beam ? 0.3 : 0.2} />
                  <path d="M120.2 82C120 88 120.1 94 120.4 98" stroke={C.skinHi} strokeWidth="1.5" opacity=".55" />
                </g>
              </g>

              {/* nose: soft wings, nostrils and a gentle tip highlight */}
              <g filter={B('b08')}>
                <path d="M115.8 96.5C113 98.2 112.6 102.4 115.6 104" stroke="#B37760" strokeWidth="1.3" fill="none" opacity=".5" />
                <path d="M124.2 96.5C127.2 98.2 127.6 102.6 124.4 104.2" stroke="#9A604A" strokeWidth="1.5" fill="none" opacity=".7" />
                <ellipse cx="120" cy="105.8" rx="5.5" ry="1.5" fill="#9A604A" opacity=".38" />
                <path d="M114.5 103.5C117 105.5 123 105.5 125.5 103.5" stroke="#8E563F" strokeWidth=".9" fill="none" opacity=".4" />
              </g>
              <g filter={B('b05')}>
                <ellipse cx="117.1" cy="103.1" rx="1.5" ry=".75" transform="rotate(16 117.1 103.1)" fill="#6E3C2C" opacity=".62" />
                <ellipse cx="122.9" cy="103.1" rx="1.5" ry=".75" transform="rotate(-16 122.9 103.1)" fill="#6E3C2C" opacity=".68" />
              </g>
              <ellipse cx="120.2" cy="100.2" rx="2.4" ry="1.8" fill="#FFE8D6" opacity=".55" filter={B('b08')} />
              <ellipse cx="119.4" cy="90" rx="1.3" ry="6" fill={C.skinHi} opacity=".35" filter={B('b15')} />

              {/* eyes and brows */}
              <Eye x={107.5} y={80} m={1} up={up} low={low} closed={blink} beam={beam} id={id} />
              <Eye x={132.5} y={80} m={-1} up={up} low={low} closed={blink} beam={beam} id={id} />
              <g transform={beam ? 'translate(0 -0.7)' : undefined}>
                {BROWS.map((b, i) => (
                  <g key={i}>
                    <path d={b.base} fill={B(i ? 'browR' : 'brow')} filter={B('b05')} />
                    <g fill={C.hair} opacity=".35">{b.hairs.map((d, j) => <path key={j} d={d} />)}</g>
                  </g>
                ))}
              </g>

              <Mouth cx={HX} my={112} id={id} {...m} />

              {/* hair: the right side is tucked behind the ear; the left falls forward; the fringe sweeps across */}
              <g filter={B('b03')}>
                <path d={HAIR_R} fill={B('hair')} />
                <path d={HAIR_L} fill={B('hair')} />
                <path d={HAIR_CROWN} fill={B('hair')} />
              </g>
              {/* the two thick sections stay crisp; the fine wisps are feathered so they never read as scratches */}
              <g filter={B('b03')}>
                {SWEEP.map(([c, w0, w1, b], i) => (w0 > 2 ? <path key={i} d={ribbon(c, w0, w1, b, 10)} fill={i === 0 || i === 3 ? B('hair') : B('sweep')} /> : null))}
              </g>
              <g filter={B('b05')} opacity=".72">
                {SWEEP.map(([c, w0, w1, b], i) => (w0 > 2 ? null : <path key={i} d={ribbon(c, w0, w1, b, 10)} fill={B('sweep')} />))}
              </g>
              <g clipPath={B('hairc')}>
                <path d="M98 42C108 32 134 31 146 41M153 64C159 82 160.5 104 159.5 124M89.5 66C88 84 88 104 88.5 122" stroke={C.hairSheen} strokeWidth="4.5" fill="none" opacity=".3" filter={B('b2')} />
                <path d={ribbon([[149, 62], [156, 78], [158, 100], [157, 126]], 5, 2, 2, 8)} fill={C.hairMid} opacity=".45" filter={B('b15')} />
                <path d="M146 96C150 112 150 130 149 148" stroke={C.hairDeep} strokeWidth="5" fill="none" opacity=".45" filter={B('b2')} />
              </g>
              <path d="M118.4 25.5C118 29 118.2 33 119 36" stroke={C.skinSh} strokeWidth="1.1" fill="none" opacity=".4" strokeLinecap="round" filter={B('b08')} />
              <g filter={B('b03')}>
                {HAIR_STRANDS.map(([d, k], i) => <path key={i} d={d} fill={k === 0 ? C.hairHi : k === 1 ? C.hairDeep : C.hairSheen} opacity={k === 1 ? 0.55 : 0.42} />)}
                {FLYAWAY.map((d, i) => <path key={i} d={d} fill={C.hairMid} opacity=".6" />)}
              </g>
              {/* baby hairs where the loose section leaves the hairline */}
              <g stroke={C.hairMid} strokeWidth=".45" fill="none" strokeLinecap="round" opacity=".4" filter={B('b05')}>
                <path d="M102 50q-3.2 2.4 -5.2 6.4M98.5 52.5q-2.6 2.4 -4 6M106 48.5q-3 2 -5 5" />
              </g>
            </motion.g>
          </g>

          {toby && (
            <>
              {/* Toby sits on her forearm; her hand curls round his far side */}
              <g transform={TOBY_T}>
                {/* solid underlay: the displaced, soft-edged coat never lets a dark page show through */}
                <path d={TOBY_BODY} fill={C.fur} filter={B('b05')} />
                <g filter={B('fur')}><path d={TOBY_BODY} fill={B('furG')} /></g>
                <g filter={B('b2')}>
                  <ellipse cx={TX + 21} cy={TY + 40} rx="5.5" ry="14" fill={C.furDeep} opacity=".7" />
                  <ellipse cx={TX - 12} cy={TY + 42} rx="4.5" ry="12" fill={C.furSh} />
                  {/* the chest: two soft lobes either side of a shallow valley */}
                  <ellipse cx={TX - 4} cy={TY + 34} rx="8" ry="10" fill="#fff" opacity=".9" />
                  <ellipse cx={TX + 12} cy={TY + 35} rx="7.5" ry="10" fill="#fff" opacity=".75" />
                  <ellipse cx={TX + 4} cy={TY + 40} rx="2.2" ry="12" fill={C.furDeep} opacity=".4" />
                  <ellipse cx={TX + 4} cy={TY + 56} rx="16" ry="4" fill={C.furDeep} opacity=".5" />
                </g>
                <g stroke={C.furDeep} strokeWidth=".45" fill="none" strokeLinecap="round" filter={B('b03')}>
                  {TOBY_BODY_STRANDS.map((d, i) => <path key={i} d={d} opacity={0.1 + 0.16 * rnd(i + 9)} />)}
                </g>
              </g>
              {/* her forearm under him */}
              <path d="M18 170C40 175 70 178 100 176L106 190C74 194 42 193 18 188Z" fill={B('top')} />
              <path d="M30 173C50 177 74 179 98 177" stroke="#3A3532" strokeWidth="1.2" fill="none" opacity=".7" filter={B('b05')} />
              <g transform={TOBY_T}>
                <g filter={B('fur')}>
                  <path d={`M${TX - 16} ${TY + 54}C${TX - 8} ${TY + 63} ${TX + 8} ${TY + 63} ${TX + 20} ${TY + 56}L${TX + 17} ${TY + 50}L${TX - 14} ${TY + 50}Z`} fill={C.fur} />
                </g>
                {/* front paws resting on her forearm */}
                <ellipse cx={TX + 1} cy={TY + 55} rx="17" ry="3" fill={C.furDeep} opacity=".35" filter={B('b15')} />
                <g fill={C.fur} filter={B('b05')}>{TOBY_PAWS.map((d, i) => <path key={i} d={d} />)}</g>
                <g filter={B('fur')} fill={B('furG')}>{TOBY_PAWS.map((d, i) => <path key={i} d={d} />)}</g>
                <path d={`M${TX - 10} ${TY + 56.5}q.4 2.4 .2 4.2M${TX - 7} ${TY + 56}q.3 2.6 .1 4.6M${TX - 4} ${TY + 56.5}q.3 2.4 0 4.2M${TX + 6} ${TY + 56.5}q.4 2.4 .2 4.2M${TX + 9} ${TY + 56}q.3 2.6 .1 4.6M${TX + 12} ${TY + 56.5}q.3 2.4 0 4.2`} stroke={C.furDeep} strokeWidth=".5" fill="none" strokeLinecap="round" opacity=".5" filter={B('b03')} />
              </g>
              {/* compact hand: palm at his far side, fingers softly curled into the fur */}
              <g transform="translate(1 -7)">
                <path d="M98 163C103 159.5 110 160 113 164C115 169 114.5 176 112 181L103 183C99 180 97 172 98 163Z" fill={B('hand')} />
                <path d="M104 164C108 166 110 171 109.5 177" stroke={C.skinSh} strokeWidth="1.2" fill="none" opacity=".35" filter={B('b08')} />
                <Digit d="M105 164.6Q100.5 160.8 96 160.2" w={4.6} id={id} />
                <Digit d="M99 164Q92 162.6 87.8 165.2" w={4.4} id={id} />
                <Digit d="M98.6 169Q91 168.6 85.6 171.8" w={4.8} id={id} />
                <Digit d="M98.8 174Q92 174 87.4 177.2" w={4.4} id={id} />
                <Digit d="M99.6 178.6Q94.5 179 91.4 181.8" w={3.7} id={id} />
                <g filter={B('fur')}>
                  <path d="M88 160C84 166 83 174 85 184L80 184C78 174 80 166 84 160Z" fill={C.fur} />
                </g>
              </g>
              <g transform={TOBY_T}><Toby id={id} blink={tobyBlink} animate={animate} /></g>
            </>
          )}

          {/* a gentle wave from her free hand */}
          {waving && (
            <motion.g
              style={{ originX: `${176 - VX}px`, originY: `${152 - VY}px` }}
              initial={animate ? { opacity: 0, y: 8, rotate: 0 } : false}
              animate={animate ? { opacity: 1, y: 0, rotate: [0, 9, -4, 8, -3, 0] } : { opacity: 1, y: 0 }}
              transition={{ duration: 1.8, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1.4 }}
            >
              <path d="M165 200C167 184 169 168 170 152L182.5 150C184 166 188 184 191 200Z" fill={B('top')} />
              <path d="M170 154L183 152" stroke={C.lace} strokeWidth="2.4" strokeLinecap="round" />
              <g transform="translate(176 151) rotate(8) scale(1.15)">
                <path d={WAVE_HAND} fill={C.skinSh} transform="translate(0.5 0.7)" opacity=".5" filter={B('b08')} />
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
