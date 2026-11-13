// Dina and Toby, drawn for animation. Dina has the head of the app's portrait (same shapes and colours) on a jointed body.
// Each is an SVG "puppet": named parts that the rig turns and moves every frame (see rig.ts). Nothing here moves by itself.
//
// Dina's units: her feet are at (0, 0) and she is about 370 tall (y is negative going up). Toby's: his feet are at
// (0, 0), he faces right, and he is about 110 long.

export const C = {
  // Dina's colours are the app artwork's own (src/components/Dina.tsx), so she is the same person in both.
  skin: '#ECB288', skinMid: '#DA9B70', skinSh: '#C07E56', skinDeep: '#9D6044', skinHi: '#F6CDAA', blush: '#DF7E6A',
  hair: '#2D1A12', hairSh: '#190D08', hairMid: '#4B2F21', hairHi: '#7E5438', hairSheen: '#AE7D5C',
  top: '#181513', topSh: '#0D0B0A', topHi: '#3A3431', lace: '#E9DCC2', laceDot: '#3A322B',
  denim: '#4169A6', denimSh: '#2E4D80', denimHi: '#6189C4',
  shoe: '#FDFBF6', sole: '#CFC5B5',
  eye: '#7A4A28', pupil: '#22130B', lip: '#B5635B', lipHi: '#EFB0A2', mouth: '#6E2A30', tongue: '#E98A8F',
  fur: '#FFFEFB', furSh: '#E9E1D4', furLine: '#BFB09A', nose: '#1C1210',
  terra: '#C4573A', ink: '#2B2420',
};

/** A fluffy outline: an ellipse with soft scallops. */
export function fluff(cx: number, cy: number, rx: number, ry: number, n: number, amp = 0.1, seed = 1): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const wob = 1 + (i % 2 ? amp : -amp * 0.35) + Math.sin(i * 12.9898 + seed * 78.233) * 0.015;
    pts.push([cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob]);
  }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length; i += 2) { const p = pts[(i + 1) % pts.length], q = pts[(i + 2) % pts.length]; d += `Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${((p[0] + q[0]) / 2).toFixed(1)} ${((p[1] + q[1]) / 2).toFixed(1)}`; }
  return d + 'Z';
}

// ── Dina ──
export const DINA = {
  height: 372,
  shoulder: { A: { x: -38, y: -229 }, B: { x: 38, y: -229 } }, // A is on the left of the picture
  hip: { A: { x: -16, y: -122 }, B: { x: 16, y: -122 } },
  upper: 46, fore: 44, thigh: 58, shin: 52,
  neck: { x: 0, y: -246 }, mouth: { x: 0, y: -269 }, head: { x: 0, y: -301 },
  /** How far an eyelid travels to shut. */
  lid: 8.6,
  /** Where Toby sits when she holds him (the middle of his body). */
  held: { x: -26, y: -202 },
};

// ── Her head is the app's portrait, shape for shape ──
// The app draws it in its own space (head centred on x = 120, chin at y = 129.3). ART moves that onto the puppet's neck,
// and everything inside her head, including the points the rig turns her hair about, is in the app's units.
export const ART = 'translate(-120 -381.3)';
type Pt = [number, number]; type Cub = [Pt, Pt, Pt, Pt];
const f = (n: number) => Math.round(n * 100) / 100;
const rnd = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const bz = (c: Cub, t: number): Pt => { const u = 1 - t, a = u * u * u, b = 3 * u * u * t, d = 3 * u * t * t, e = t * t * t; return [a * c[0][0] + b * c[1][0] + d * c[2][0] + e * c[3][0], a * c[0][1] + b * c[1][1] + d * c[2][1] + e * c[3][1]]; };
const bzd = (c: Cub, t: number): Pt => { const u = 1 - t, a = 3 * u * u, b = 6 * u * t, d = 3 * t * t; return [a * (c[1][0] - c[0][0]) + b * (c[2][0] - c[1][0]) + d * (c[3][0] - c[2][0]), a * (c[1][1] - c[0][1]) + b * (c[2][1] - c[1][1]) + d * (c[3][1] - c[2][1])]; };
const nrm = (c: Cub, t: number): Pt => { const [dx, dy] = bzd(c, t), l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; };
/** A tapered strip along a curve: width w0 at the start, w1 at the end, plus a bulge in the middle. */
function ribbon(c: Cub, w0: number, w1: number, bulge = 0, n = 8): string {
  const L: string[] = [], R: string[] = [];
  for (let i = 0; i <= n; i++) { const t = i / n, [x, y] = bz(c, t), [nx, ny] = nrm(c, t); const w = ((1 - t) * w0 + t * w1 + 4 * t * (1 - t) * bulge) / 2; L.push(`${f(x + nx * w)} ${f(y + ny * w)}`); R.push(`${f(x - nx * w)} ${f(y - ny * w)}`); }
  const end = R[n]; R.reverse();
  return `M${L.join('L')}L${end}L${R.slice(1).join('L')}Z`;
}
function spray(c: Cub, k: number, seed: number, spread: number, w: number, tail: number): string[] {
  const n0 = nrm(c, 0), n1 = nrm(c, 1); const sh = (q: Pt, nn: Pt, d: number): Pt => [q[0] + nn[0] * d, q[1] + nn[1] * d];
  return Array.from({ length: k }, (_, i) => { const o = (rnd(seed + i) - 0.5) * spread, e = o + (rnd(seed + i + 31) - 0.5) * tail, w1 = 0.55 + rnd(seed + i + 77) * 0.9; return ribbon([sh(c[0], n0, o), sh(c[1], n0, o), sh(c[2], n1, e), sh(c[3], n1, e)], w * w1 * 0.5, 0, w * w1, 7); });
}
const FACE = 'M120 34.5C136.5 34.5 146.5 49 147 68C147.5 84 146.5 96 143.2 106.5C140.4 117.6 132.8 128.4 120 129.3C107.2 128.4 99.6 117.6 96.8 106.5C93.5 96 92.5 84 93 68C93.5 49 103.5 34.5 120 34.5Z';
const HAIR_BACK = 'M120 22.5C99 22.5 85 33 82.5 54C80.5 72 84 94 81.5 114C80 130 78 142 78 154C79.5 157.5 82 157.5 84 154L85.5 160.5C88 158 89.5 154 91 150C97 147 103 145.5 108 145L132 145C138 146 144 148 148.5 151.5L151 160C153 157 154 154 155 151L159.5 158C161.5 152 161 146 160 140C158.5 130 158 122 158 114C157.5 94 160.5 74 158.5 54C156 33 141 22.5 120 22.5Z';
const HAIR_CROWN = 'M95.5 72C87.5 58 91 33 108.5 26.5C114.5 24 127 24 133 26.5C150 33.5 154 56 147 63.5C144 59.5 140 55.5 136 53C131 50 125.5 46.8 122 45.8C119.2 45.1 116.8 45.4 115.2 46.6C109.5 50 104 56.5 100 62.5C98.3 65.3 96.8 68.6 95.5 72Z';
const HAIR_L = 'M102 40C91.5 47 86.5 62 86.5 80C86.5 100 85.5 120 85.2 140C85 148 84.6 155 85.5 161.5C88.5 156.5 91.5 151 93.5 146C95.5 141 97 137 97.4 133C96.8 118 96.2 102 96.4 88C96.6 74 97.5 60 103.5 49Z';
const HAIR_R = 'M146 58C155 64 159.5 82 159.5 100C159.5 118 160 134 161 146C161.5 152 163 157 165.5 161.5C162 160.5 158.5 159.5 156 161.5C154.5 158 152.5 159 150.5 162C150.5 154 149 146 148.5 138C147.5 126 148.5 110 148 96C147.5 84 147.5 70 146 58Z';
const SWEEP: [Cub, number, number, number][] = [
  [[[118, 40], [105, 43], [96.5, 57], [93.5, 80]], 8, 3.5, 2], [[[120.5, 43], [109, 47], [101, 59], [98, 76]], 3.6, 1.2, 1],
  [[[122, 47], [113, 51], [106, 60], [103.5, 70]], 1.6, 0.4, 0.4], [[[121, 41], [132, 42.5], [141, 49], [146, 60]], 2.6, 0.6, 0.6],
  [[[119, 46], [112, 52], [104, 64], [99, 84]], 1.3, 0.3, 0.3], [[[117.5, 44], [108, 50], [100, 62], [95, 88]], 1.1, 0.25, 0.3],
  [[[119.5, 44], [116, 50], [111.5, 57], [109, 63]], 1.2, 0.25, 0.3],
];
const FLOW: [Cub, number, number, number][] = [
  [[[117, 29], [104, 31], [92, 44], [89.5, 66]], 8, 1, 4.5], [[[118, 26], [100, 27.5], [87, 42], [85.5, 70]], 5, 2, 4.5],
  [[[122, 28], [138, 31], [150, 46], [152, 68]], 7, 3, 4.5], [[[121, 25], [141, 26.5], [155, 44], [155.5, 74]], 4, 4, 4.5],
  [[[89, 72], [88, 96], [86.5, 126], [86.5, 154]], 6, 5, 4], [[[93, 78], [93.5, 102], [93, 130], [91.5, 152]], 5, 6, 3],
  [[[150, 62], [160, 84], [161.5, 120], [160, 154]], 7, 7, 4.5], [[[147, 66], [154, 92], [154, 130], [153, 154]], 5, 8, 4],
];
function strandsOf(from: number, to: number): string {
  return FLOW.slice(from, to).map(([c, k, sd, sp]) => spray(c, k, sd * 97, sp, 1.1, 3).map((d, i) => { const kind = (i + sd) % 3; return `<path d="${d}" fill="${kind === 0 ? C.hairHi : kind === 1 ? C.hairSh : C.hairSheen}" opacity="${kind === 1 ? 0.55 : 0.42}"/>`; }).join('')).join('');
}

const HAND_OPEN = `<path d="M-6.4 3C-10.6 4.6-12.6 9.4-11.4 13.6C-10.6 16-7.8 15.6-7.4 13.2L-6.2 8Z"/><path d="M-6.8-1C-7.8 5-7.6 11-6.6 15L-6.6 22.4C-6.6 25.4-3.9 25.6-3.7 22.8L-3.5 24.6C-3.3 27.8-.5 27.8-.3 24.8L-.1 25.4C.1 28.4 3 28.2 3.1 25.2L3.2 23.6C3.5 26.4 6.3 26 6.3 23.2L6.5 15C7.6 11 7.8 5 6.8-1Z"/><path d="M-3.6 17L-3.6 22M-.2 17L-.2 24M3.1 17L3.1 23" fill="none" stroke-width=".8" opacity=".6"/>`;
const HAND_POINT = `<path d="M-6.4 3C-10.6 4.6-12.6 9.4-11.4 13.6C-10.6 16-7.8 15.6-7.4 13.2L-6.2 8Z"/><path d="M-6.8-1C-7.8 5-7.6 11-6.6 15C-6.8 18.6-4.4 20-2.6 18.4C-1.6 20.6 1.2 20.4 1.6 18.2L1.8 15.6L6.5 15C7.6 11 7.8 5 6.8-1Z"/><path d="M1.9 13L2.1 29C2.2 32.4 6 32.4 6.1 29L6.5 13Z"/>`;

function arm(side: 'A' | 'B'): { upper: string; fore: string } {
  const mirror = side === 'A' ? ' scale(-1 1)' : '';
  // Each part is drawn hanging straight down from its joint; the rig sets data-joint transforms on the outer <g>.
  const upper = `<g id="d-up${side}"><g transform="${mirror.trim() || 'scale(1 1)'}"><path d="M-8.5-3C-9.5-11 9.5-11 8.5-3C9 14 8.2 32 7.6 ${DINA.upper + 3}L-7.6 ${DINA.upper + 3}C-8.2 32-9 14-8.5-3Z" fill="${C.top}"/><path d="M-4.5 2C-5.2 16-4.8 30-4.2 ${DINA.upper - 3}" fill="none" stroke="${C.topHi}" stroke-width="2.6" stroke-linecap="round" opacity=".7"/></g></g>`;
  const fore = `<g id="d-fo${side}"><g transform="${mirror.trim() || 'scale(1 1)'}"><path d="M-7.6-3C-8.6-8.5 8.6-8.5 7.6-3C7.8 12 6.8 30 6 ${DINA.fore}L-6 ${DINA.fore}C-6.8 30-7.8 12-7.6-3Z" fill="${C.top}"/><path d="M-3.6 2C-4.2 14-3.8 28-3.2 ${DINA.fore - 6}" fill="none" stroke="${C.topHi}" stroke-width="2.2" stroke-linecap="round" opacity=".7"/><path d="M-6.1 ${DINA.fore - 2.6}L6.1 ${DINA.fore - 2.6}" stroke="${C.lace}" stroke-width="3" stroke-linecap="round"/><g transform="translate(0 ${DINA.fore})" fill="${C.skin}" stroke="${C.skinSh}" stroke-width=".8" stroke-linejoin="round"><g id="d-hand${side}-open">${HAND_OPEN}</g><g id="d-hand${side}-point" style="display:none">${HAND_POINT}</g></g></g></g>`;
  return { upper, fore };
}
function leg(side: 'A' | 'B'): string {
  const inner = side === 'A' ? 1 : -1; // which side of the leg faces the other one (for the shadow)
  return `<g id="d-th${side}"><path d="M-13-4C-14 18-12.6 40-11.4 ${DINA.thigh + 3}L11.4 ${DINA.thigh + 3}C12.6 40 14 18 13-4C10-10-10-10-13-4Z" fill="${C.denim}"/><path d="M${inner * 9} 2C${inner * 10} 20 ${inner * 9} 40 ${inner * 8.4} ${DINA.thigh}" fill="none" stroke="${C.denimSh}" stroke-width="4" stroke-linecap="round" opacity=".7"/><path d="M${-inner * 6} 4C${-inner * 7} 22 ${-inner * 6.4} 40 ${-inner * 5.6} ${DINA.thigh - 4}" fill="none" stroke="${C.denimHi}" stroke-width="2.4" stroke-linecap="round" opacity=".6"/>
    <g id="d-sh${side}" transform="translate(0 ${DINA.thigh})"><path d="M-11.4-4C-11.6 16-10.4 34-9.4 ${DINA.shin}L9.4 ${DINA.shin}C10.4 34 11.6 16 11.4-4C8-9-8-9-11.4-4Z" fill="${C.denim}"/><path d="M${inner * 7.6} 0C${inner * 8} 16 ${inner * 7.2} 34 ${inner * 6.6} ${DINA.shin - 3}" fill="none" stroke="${C.denimSh}" stroke-width="3.6" stroke-linecap="round" opacity=".7"/><path d="M-9.6 ${DINA.shin - 6}L9.6 ${DINA.shin - 6}L9.4 ${DINA.shin}L-9.4 ${DINA.shin}Z" fill="${C.denimSh}"/>
      <g id="d-ft${side}" transform="translate(0 ${DINA.shin})"><path d="M-9-3C-11.5 3-11.5 9-8 12L19 12C25 12 26.5 6 22 2C16-3 10-5 6-6L-8-6Z" fill="${C.shoe}" stroke="${C.sole}" stroke-width="1.2" stroke-linejoin="round"/><path d="M-9.6 9.2L23 9.2" stroke="${C.sole}" stroke-width="2.4" stroke-linecap="round"/><path d="M5-3.6L11 1.6M9-4.4L14.4.6" stroke="${C.sole}" stroke-width="1.1" stroke-linecap="round"/></g>
    </g></g>`;
}
function eye(side: 'A' | 'B'): string {
  const x = side === 'A' ? 107.5 : 132.5, y = 80, m = side === 'A' ? 1 : -1, up = 3.2, low = 2.3;
  const X = (v: number) => x + m * v, Y = (v: number) => y + v;
  const topC: Cub = [[X(-6.5), Y(0.6)], [X(-4.3), Y(-up - 0.5)], [X(1.4), Y(-up - 1.1)], [X(6.5), Y(-0.2)]];
  const top = `M${f(topC[0][0])} ${f(topC[0][1])}C${f(topC[1][0])} ${f(topC[1][1])} ${f(topC[2][0])} ${f(topC[2][1])} ${f(topC[3][0])} ${f(topC[3][1])}`;
  const lowL = `C${f(X(3.6))} ${f(Y(low + 0.7))} ${f(X(-3.4))} ${f(Y(low + 0.5))} ${f(X(-6.5))} ${f(Y(0.6))}`;
  const shape = `${top}${lowL}Z`; const ix = X(0.5), iy = y - 0.15, r = 3.35;
  const cl: Cub = [[X(-6.5), Y(0.6)], [X(-3.8), Y(low + 1.6)], [X(2.6), Y(low + 1.6)], [X(6.5), Y(-0.1)]];
  const rays = [20, 70, 115, 160, 205, 250, 300, 340].map((a) => `M${f(Math.cos(a * 0.01745) * 1.5)} ${f(Math.sin(a * 0.01745) * 1.5)}L${f(Math.cos(a * 0.01745) * r)} ${f(Math.sin(a * 0.01745) * r)}`).join('');
  const lashes = [0.07, 0.19, 0.33].map((t, i) => { const [px, py] = bz(topC, t), [nx, ny] = nrm(topC, t), l = 1.05 - i * 0.28; return `<path d="${ribbon([[px, py], [px + nx * l * 0.5 - m * 0.3, py + ny * l * 0.5 - 0.3], [px + nx * l - m * 0.6, py + ny * l - 0.6], [px + nx * l - m * 0.9, py + ny * l - 0.8]], 0.4, 0.05, 0, 3)}"/>`; }).join('');
  const bc: Cub = [[120 + m * (113.8 - 120), 72.5], [120 + m * (109 - 120), 69.2], [120 + m * (103 - 120), 68.6], [120 + m * (98.2 - 120), 71.4]];
  return `<path d="M${f(X(-5.6))} ${f(Y(-up - 1.2))}C${f(X(-2.4))} ${f(Y(-up - 3.5))} ${f(X(3))} ${f(Y(-up - 3.4))} ${f(X(6.6))} ${f(Y(-up - 0.9))}" stroke="${C.skinSh}" stroke-width=".7" fill="none" opacity=".3" filter="url(#d-b03)"/>
    <clipPath id="d-eyec${side}"><path d="${shape}"/></clipPath>
    <g clip-path="url(#d-eyec${side})">
      <path d="${shape}" fill="url(#d-scl)"/>
      <g id="d-pupil${side}"><g transform="translate(${f(ix)} ${f(iy)})"><circle r="${r}" fill="url(#d-iris)"/><circle r="${r - 0.25}" fill="none" stroke="#1E1008" stroke-width=".5" opacity=".75"/><path d="${rays}" stroke="#2B170C" stroke-width=".35" opacity=".32" fill="none"/><circle r="1.3" fill="#0C0604"/><circle cx="-1.1" cy="-1.25" r=".9" fill="#fff" opacity=".96"/><circle cx="1.25" cy="1.35" r=".42" fill="#fff" opacity=".4"/></g></g>
      <path d="${top}" stroke="#3B2016" stroke-width="2" fill="none" opacity=".36" filter="url(#d-b08)"/>
      <rect id="d-lid${side}" x="${f(x - 9)}" y="${f(y - up - 2.6)}" width="18" height="${DINA.lid}" fill="${C.skinMid}" transform="translate(0 ${-DINA.lid})"/>
    </g>
    <g id="d-lash${side}">
      <path d="M${f(X(4.5))} ${f(Y(0.8))}${lowL}" stroke="${C.skinHi}" stroke-width=".6" fill="none" opacity=".55" transform="translate(0 1)" filter="url(#d-b03)"/>
      <path d="${ribbon(topC, 1.15, 0.3, 0.3, 10)}" fill="#211209" transform="translate(0 -0.25)"/><g fill="#241510" opacity=".8">${lashes}</g>
    </g>
    <g id="d-shut${side}" style="display:none"><path d="${ribbon(cl, 0.8, 0.4, 0.5, 8)}" fill="#241510" opacity=".92"/></g>
    <g id="d-brow${side}"><path d="${ribbon(bc, 1.6, 0.8, 1.5, 10)}" fill="url(#d-brow${side})" filter="url(#d-b05)"/></g>`;
}

/** Toby as she holds him: facing us, tucked on her forearm. Drawn in Dina's units, in two layers either side of her arm. */
function heldToby(): { back: string; front: string } {
  const { x, y } = DINA.held;
  const fur = `fill="${C.fur}" stroke="${C.furLine}" stroke-width="1.2" stroke-linejoin="round"`;
  const back = `<g id="d-heldBack" style="display:none"><path d="${fluff(x + 1, y + 4, 19, 20, 9, 0.09, 4)}" ${fur}/><path d="M${x - 8} ${y + 2}C${x - 4} ${y + 12} ${x + 6} ${y + 12} ${x + 10} ${y + 2}" fill="none" stroke="${C.furSh}" stroke-width="3.5" stroke-linecap="round"/></g>`;
  const hx = x - 1, hy = y - 27;
  const front = `<g id="d-heldFront" style="display:none">
    <ellipse cx="${x - 8}" cy="${y + 12}" rx="6.4" ry="4.8" ${fur}/><ellipse cx="${x + 7}" cy="${y + 12}" rx="6.4" ry="4.8" ${fur}/>
    <g id="d-heldHead">
      <g id="d-heldEarA"><path d="M${hx - 15} ${hy - 9}C${hx - 25} ${hy - 4} ${hx - 26} ${hy + 14} ${hx - 20} ${hy + 22}C${hx - 15} ${hy + 25} ${hx - 11} ${hy + 18} ${hx - 11} ${hy + 6}Z" ${fur}/></g>
      <g id="d-heldEarB"><path d="M${hx + 15} ${hy - 9}C${hx + 25} ${hy - 4} ${hx + 26} ${hy + 14} ${hx + 20} ${hy + 22}C${hx + 15} ${hy + 25} ${hx + 11} ${hy + 18} ${hx + 11} ${hy + 6}Z" ${fur}/></g>
      <path d="${fluff(hx, hy, 21, 20, 10, 0.09, 7)}" ${fur}/>
      <ellipse cx="${hx}" cy="${hy + 8}" rx="10" ry="7.5" fill="${C.fur}" stroke="${C.furSh}" stroke-width="1"/>
      <g id="d-heldEyes"><circle cx="${hx - 7.4}" cy="${hy - 2}" r="3.8" fill="${C.nose}"/><circle cx="${hx + 7.4}" cy="${hy - 2}" r="3.8" fill="${C.nose}"/><circle cx="${hx - 8.5}" cy="${hy - 3.3}" r="1.2" fill="#fff"/><circle cx="${hx + 6.3}" cy="${hy - 3.3}" r="1.2" fill="#fff"/></g>
      <g id="d-heldShut" style="display:none" fill="none" stroke="${C.nose}" stroke-width="1.8" stroke-linecap="round"><path d="M${hx - 11} ${hy - 2}q3.6 3 7.2 0"/><path d="M${hx + 3.8} ${hy - 2}q3.6 3 7.2 0"/></g>
      <ellipse cx="${hx}" cy="${hy + 5.4}" rx="3.9" ry="3.1" fill="${C.nose}"/>
      <path d="M${hx} ${hy + 8.4}L${hx} ${hy + 10.6}M${hx - 4.6} ${hy + 10}C${hx - 3} ${hy + 12.4} ${hx - .6} ${hy + 12.2} ${hx} ${hy + 10.6}C${hx + .6} ${hy + 12.2} ${hx + 3} ${hy + 12.4} ${hx + 4.6} ${hy + 10}" fill="none" stroke="${C.nose}" stroke-width="1.2" stroke-linecap="round"/>
      <path id="d-heldTongue" d="M${hx - 2.6} ${hy + 11.6}C${hx - 3} ${hy + 16.4} ${hx + 3} ${hy + 16.4} ${hx + 2.6} ${hy + 11.6}Z" fill="${C.tongue}" stroke="#C4636B" stroke-width=".7"/>
    </g>
  </g>`;
  return { back, front };
}

/** The whole of Dina. Parts are stacked so that her hair falls over her shoulders and Toby sits in front of her arm. */
export function dinaSvg(): string {
  const A = arm('A'), B = arm('B'); const held = heldToby();
  return `<svg id="d-svg" viewBox="-110 -390 220 410" width="220" height="410" style="position:absolute;left:-110px;top:-390px;overflow:visible" aria-hidden="true">
  <defs>
    <pattern id="d-lace" width="3.6" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(-20)"><rect width="3.6" height="3.2" fill="${C.lace}"/><ellipse cx="1.8" cy="1.6" rx="1.1" ry=".95" fill="${C.laceDot}"/></pattern>
    <filter id="d-b03" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.3"/></filter><filter id="d-b05" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.5"/></filter><filter id="d-b08" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.8"/></filter><filter id="d-b15" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.5"/></filter><filter id="d-b2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter><filter id="d-b4" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
    <radialGradient id="d-skin" cx=".42" cy=".38" r=".74"><stop offset="0" stop-color="${C.skinHi}"/><stop offset=".5" stop-color="${C.skin}"/><stop offset=".85" stop-color="${C.skinMid}"/><stop offset="1" stop-color="${C.skinSh}"/></radialGradient>
    <linearGradient id="d-neck" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A86E52"/><stop offset=".45" stop-color="${C.skinMid}"/><stop offset="1" stop-color="${C.skin}"/></linearGradient>
    <linearGradient id="d-hair" x1=".2" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="${C.hairMid}"/><stop offset=".45" stop-color="${C.hair}"/><stop offset="1" stop-color="${C.hairSh}"/></linearGradient>
    <linearGradient id="d-hairB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.hair}"/><stop offset="1" stop-color="#120905"/></linearGradient>
    <linearGradient id="d-sweep" gradientUnits="userSpaceOnUse" x1="0" y1="40" x2="0" y2="88"><stop offset="0" stop-color="${C.hair}"/><stop offset=".55" stop-color="${C.hairMid}"/><stop offset="1" stop-color="${C.hairMid}" stop-opacity=".5"/></linearGradient>
    <radialGradient id="d-scl" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#FDFBF8"/><stop offset=".7" stop-color="#F5EDE6"/><stop offset="1" stop-color="#DECBBF"/></radialGradient>
    <radialGradient id="d-iris" cx=".5" cy=".6" r=".5"><stop offset=".2" stop-color="#B07A48"/><stop offset=".6" stop-color="#6F4225"/><stop offset="1" stop-color="#3A2012"/></radialGradient>
    <radialGradient id="d-mouthG" cx=".5" cy=".3" r=".7"><stop offset="0" stop-color="#8A3E42"/><stop offset="1" stop-color="#4E1D23"/></radialGradient>
    <linearGradient id="d-teethG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#B09D8C"/><stop offset=".2" stop-color="#E5DBCE"/><stop offset=".5" stop-color="#FBF7F0"/><stop offset=".8" stop-color="#E5DBCE"/><stop offset="1" stop-color="#B09D8C"/></linearGradient>
    <linearGradient id="d-lipU" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B5635B"/><stop offset="1" stop-color="#9E514C"/></linearGradient>
    <linearGradient id="d-lipL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D98C80"/><stop offset="1" stop-color="#C07266"/></linearGradient>
    <linearGradient id="d-browA" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.hair}" stop-opacity=".92"/><stop offset=".6" stop-color="${C.hair}" stop-opacity=".85"/><stop offset="1" stop-color="${C.hairMid}" stop-opacity=".55"/></linearGradient>
    <linearGradient id="d-browB" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="${C.hair}" stop-opacity=".92"/><stop offset=".6" stop-color="${C.hair}" stop-opacity=".85"/><stop offset="1" stop-color="${C.hairMid}" stop-opacity=".55"/></linearGradient>
    <linearGradient id="d-topG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A2522"/><stop offset="1" stop-color="${C.top}"/></linearGradient>
    <clipPath id="d-facec"><path d="${FACE}"/></clipPath>
    <clipPath id="d-hairc"><path d="${HAIR_L}"/><path d="${HAIR_R}"/><path d="${HAIR_CROWN}"/></clipPath>
  </defs>
  <ellipse id="d-shadow" cx="0" cy="12" rx="46" ry="7" fill="${C.ink}" opacity=".16"/>
  <g id="d-body">
    <g id="d-hairBack"><g transform="${ART}"><path d="${HAIR_BACK}" fill="url(#d-hairB)" filter="url(#d-b03)"/></g></g>
    ${leg('A')}${leg('B')}
    <path d="M-34-128L34-128C35.4-118 34.6-108 33-99L3-97L0-104L-3-97L-33-99C-34.6-108-35.4-118-34-128Z" fill="${C.denim}"/>
    <path d="M0-104L0-124" stroke="${C.denimSh}" stroke-width="1.6" opacity=".8"/><path d="M-26-112C-22-106-14-104-8-105M26-112C22-106 14-104 8-105" fill="none" stroke="${C.denimSh}" stroke-width="1.5" stroke-linecap="round" opacity=".8"/>
    <g id="d-torso">
      <g transform="${ART}"><path d="M106.5 112L107 132.8C106.5 138.3 104 141.3 101.5 143.2C111 148.7 129 148.7 138.5 143.2C136 141.3 133.5 138.3 133 132.8L133.5 112Z" fill="url(#d-neck)"/><g filter="url(#d-b2)"><path d="M107 123C114 134.5 127 134.5 133 123L133 115L107 115Z" fill="${C.skinDeep}" opacity=".55"/><ellipse cx="128" cy="134" rx="3" ry="8" fill="${C.skinSh}" opacity=".35"/></g></g>
      <path d="M-12-244C-24-243-36-240-41-232C-45-224-40-210-35-200C-30-186-27-174-27-162C-28-150-32-140-34.6-128L-35-119L35-119L34.6-128C32-140 28-150 27-162C27-174 30-186 35-200C40-210 45-224 41-232C36-240 24-243 12-244C8-238-8-238-12-244Z" fill="${C.top}"/>
      <path d="M30-222C28-200 23-180 24-160C25-146 29-134 31-121" fill="none" stroke="${C.topSh}" stroke-width="8" stroke-linecap="round" opacity=".7"/>
      <path d="M-30-218C-27-200-22-182-22-164C-23-150-27-138-29-124" fill="none" stroke="${C.topHi}" stroke-width="3" stroke-linecap="round" opacity=".6"/>
      <path d="M-16-196C-8-190 8-190 16-196" fill="none" stroke="${C.topSh}" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>
      <path d="M-34.6-126L34.6-126" stroke="${C.topHi}" stroke-width="1" opacity=".9"/><path d="M-30-125.4L-30-119.4M-24-125.4L-24-119.4M-18-125.4L-18-119.4M-12-125.4L-12-119.4M-6-125.4L-6-119.4M0-125.4L0-119.4M6-125.4L6-119.4M12-125.4L12-119.4M18-125.4L18-119.4M24-125.4L24-119.4M30-125.4L30-119.4" stroke="${C.topHi}" stroke-width=".9" opacity=".8"/>
      <path d="M13.4-243.8C24-242.8 35-240 41-232C43.4-228 43.4-223.4 42-219L35-221.6C36-226 35-229 32-232C28-235 21-237 12.4-238Z" fill="${C.lace}"/>
      <path d="M15-240.8C24-239.6 32-237 37-231.6C39-228.4 39.2-225 38.4-221.6" fill="none" stroke="${C.laceDot}" stroke-width="1.5" stroke-dasharray=".2 3.2" stroke-linecap="round"/>
      <path d="M-12-244C-8-237.6 8-237.6 12-244" fill="none" stroke="${C.topHi}" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>
    </g>
    ${A.upper}${B.upper}
    <g id="d-head"><g transform="${ART}">
      <path d="${FACE}" fill="url(#d-skin)"/>
      <g clip-path="url(#d-facec)">
        <g filter="url(#d-b4)">
          <ellipse cx="149.5" cy="92" rx="9" ry="38" fill="${C.skinSh}" opacity=".52"/><ellipse cx="91" cy="94" rx="5.5" ry="30" fill="${C.skinSh}" opacity=".32"/>
          <ellipse cx="120" cy="40" rx="32" ry="8" fill="#7E4B36" opacity=".5"/><ellipse cx="116" cy="57" rx="11" ry="7" fill="${C.skinHi}" opacity=".55"/>
          <ellipse cx="96" cy="72" rx="5" ry="9" fill="${C.skinSh}" opacity=".3"/><ellipse cx="145" cy="70" rx="5" ry="9" fill="${C.skinSh}" opacity=".4"/>
          <ellipse cx="105" cy="95" rx="8" ry="5" fill="${C.skinHi}" opacity=".6"/><ellipse cx="139" cy="95" rx="7" ry="5" fill="${C.skinHi}" opacity=".35"/>
          <ellipse cx="104" cy="101" rx="8.5" ry="5.5" fill="${C.blush}" opacity=".25"/><ellipse cx="140" cy="101" rx="8.5" ry="5.5" fill="${C.blush}" opacity=".23"/>
          <ellipse cx="100" cy="109" rx="7" ry="4.5" fill="${C.skinSh}" opacity=".1"/><ellipse cx="143" cy="109" rx="7" ry="4.5" fill="${C.skinSh}" opacity=".16"/>
          <ellipse cx="120" cy="128.3" rx="18" ry="4.6" fill="${C.skinDeep}" opacity=".34"/><ellipse cx="119" cy="122" rx="5" ry="2.6" fill="${C.skinHi}" opacity=".5"/>
        </g>
        <g fill="#5A2E1F" opacity=".4" transform="translate(1.2 2.4)" filter="url(#d-b2)">${SWEEP.slice(0, 4).map(([c, w0, w1, b]) => `<path d="${ribbon(c, w0, w1, b, 10)}"/>`).join('')}<path d="${HAIR_L}" transform="translate(0.6 -1)"/><path d="${HAIR_R}" transform="translate(-3.2 -1)"/></g>
      </g>
      <g id="d-face">
        <g filter="url(#d-b2)"><ellipse cx="107.5" cy="77" rx="9" ry="4.5" fill="#B07760" opacity=".14"/><ellipse cx="132.5" cy="77" rx="9" ry="4.5" fill="#A86E58" opacity=".18"/><ellipse cx="115.5" cy="80.5" rx="2.4" ry="3.2" fill="${C.skinSh}" opacity=".18"/><ellipse cx="125" cy="81.5" rx="2.6" ry="4" fill="${C.skinSh}" opacity=".24"/></g>
        <path d="M124.5 84C126.2 90 127.2 96 126.8 100.5L123 101C123.6 96 123.4 90 122.6 85Z" fill="${C.skinSh}" opacity=".32" filter="url(#d-b15)"/>
        <g filter="url(#d-b08)" fill="none" stroke-linecap="round"><path d="M114 101C109.5 104 107.3 108 107 112.5" stroke="${C.skinSh}" stroke-width="1" opacity=".2"/><path d="M126 101C130.5 104 132.7 108 133 112.5" stroke="${C.skinDeep}" stroke-width="1" opacity=".2"/><path d="M120.2 82C120 88 120.1 94 120.4 98" stroke="${C.skinHi}" stroke-width="1.5" opacity=".55"/></g>
        <g filter="url(#d-b08)"><path d="M115.8 96.5C113 98.2 112.6 102.4 115.6 104" stroke="#B37760" stroke-width="1.3" fill="none" opacity=".5"/><path d="M124.2 96.5C127.2 98.2 127.6 102.6 124.4 104.2" stroke="#9A604A" stroke-width="1.5" fill="none" opacity=".7"/><ellipse cx="120" cy="105.8" rx="5.5" ry="1.5" fill="#9A604A" opacity=".38"/><path d="M114.5 103.5C117 105.5 123 105.5 125.5 103.5" stroke="#8E563F" stroke-width=".9" fill="none" opacity=".4"/></g>
        <g filter="url(#d-b05)"><ellipse cx="117.1" cy="103.1" rx="1.5" ry=".75" transform="rotate(16 117.1 103.1)" fill="#6E3C2C" opacity=".62"/><ellipse cx="122.9" cy="103.1" rx="1.5" ry=".75" transform="rotate(-16 122.9 103.1)" fill="#6E3C2C" opacity=".68"/></g>
        <ellipse cx="120.2" cy="100.2" rx="2.4" ry="1.8" fill="#FFE8D6" opacity=".55" filter="url(#d-b08)"/>
        ${eye('A')}${eye('B')}
        <g id="d-mouth"></g>
      </g>
      <g id="d-curtB"><path d="${HAIR_R}" fill="url(#d-hair)"/><path d="M153 64C159 82 160.5 104 159.5 124" stroke="${C.hairSheen}" stroke-width="3" fill="none" opacity=".22" filter="url(#d-b2)"/><g filter="url(#d-b03)">${strandsOf(6, 8)}</g></g>
      <g id="d-curtA"><path d="${HAIR_L}" fill="url(#d-hair)"/><path d="M89.5 66C88 84 88 104 88.5 122" stroke="${C.hairSheen}" stroke-width="3" fill="none" opacity=".22" filter="url(#d-b2)"/><g filter="url(#d-b03)">${strandsOf(4, 6)}</g></g>
      <path d="${HAIR_CROWN}" fill="url(#d-hair)"/>
      ${SWEEP.map(([c, w0, w1, b], i) => `<path d="${ribbon(c, w0, w1, b, 10)}" fill="${i === 0 || i === 3 ? 'url(#d-hair)' : 'url(#d-sweep)'}"${w0 > 2 ? '' : ' opacity=".72"'}/>`).join('')}
      <path d="M98 42C108 32 134 31 146 41" stroke="${C.hairSheen}" stroke-width="4.5" fill="none" opacity=".3" filter="url(#d-b2)" clip-path="url(#d-hairc)"/>
      <path d="M118.4 25.5C118 29 118.2 33 119 36" stroke="${C.skinSh}" stroke-width="1.1" fill="none" opacity=".4" stroke-linecap="round" filter="url(#d-b08)"/>
      <g filter="url(#d-b03)">${strandsOf(0, 4)}</g>
    </g></g>
    ${held.back}
    ${A.fore}${B.fore}
    ${held.front}
  </g>
</svg>`;
}

/** Dina's mouth for a given openness (0 at rest … 1 wide) and smile (0 … 1): the app's own mouth, in the app's units. */
export function mouthMarkup(open: number, smile: number): string {
  const o = Math.max(0, Math.min(1, open)), cx = 120, my = 112;
  const W = 13.2 - 2 * o + 1.4 * smile, lift = 2.4 + 1.6 * smile * (1 - o * 0.5), D = 2.6 + 9.4 * o + 3 * smile * (1 - o), T = 2.6 + 1.8 * o + 0.9 * smile, lt = 3.2, lower = o > 0.5;
  const cc = my - lift, L = f(cx - W), R = f(cx + W);
  const openTop = `C${f(cx + W * 0.52)} ${f(my + 0.9)} ${f(cx - W * 0.52)} ${f(my + 0.9)} ${L} ${f(cc)}`;
  const openBot = `C${f(cx - W * 0.64)} ${f(my + D)} ${f(cx + W * 0.64)} ${f(my + D)} ${R} ${f(cc)}`;
  const opening = `M${L} ${f(cc)}${openBot}${openTop}Z`;
  const upperLip = `M${f(cx - W - 0.4)} ${f(cc - 0.2)}C${f(cx - W * 0.58)} ${f(my - 1.9)} ${f(cx - 5)} ${f(my - 3)} ${f(cx - 2.2)} ${f(my - 3.1)}Q${f(cx - 0.9)} ${f(my - 3)} ${cx} ${f(my - 2.4)}Q${f(cx + 0.9)} ${f(my - 3)} ${f(cx + 2.2)} ${f(my - 3.1)}C${f(cx + 5)} ${f(my - 3)} ${f(cx + W * 0.58)} ${f(my - 1.9)} ${f(cx + W + 0.4)} ${f(cc - 0.2)}L${R} ${f(cc)}${openTop}Z`;
  const lowerLip = `M${L} ${f(cc)}${openBot}C${f(cx + W * 0.52)} ${f(my + D + lt * 1.35)} ${f(cx - W * 0.52)} ${f(my + D + lt * 1.35)} ${L} ${f(cc)}Z`;
  const xs = [-1, -0.83, -0.65, -0.46, -0.24, 0, 0.24, 0.46, 0.65, 0.83, 1].map((t) => t * W * 0.95);
  const yb = (x: number) => my + T - (T + lift * 0.85) * (x / W) ** 2;
  let teeth = `M${f(cx - W)} ${f(cc - 3)}L${f(cx + W)} ${f(cc - 3)}L${f(cx + xs[10])} ${f(yb(xs[10]))}`;
  for (let i = 10; i > 0; i--) teeth += `Q${f(cx + (xs[i] + xs[i - 1]) / 2)} ${f(yb((xs[i] + xs[i - 1]) / 2) + 0.55)} ${f(cx + xs[i - 1])} ${f(yb(xs[i - 1]))}`;
  const gaps = xs.slice(1, 10).map((x, i) => `<path d="M${f(cx + x)} ${f(cc - 1.5)}L${f(cx + x * 0.97)} ${f(yb(x) + 0.2)}" stroke="#A89483" stroke-width="${i === 4 ? 0.4 : 0.3}" opacity=".5"/>`).join('');
  return `<clipPath id="d-moc"><path d="${opening}"/></clipPath><path d="${opening}" fill="url(#d-mouthG)"/>
    <g clip-path="url(#d-moc)">${D > 5 ? `<ellipse cx="${cx}" cy="${f(my + D * 0.86)}" rx="${f(W * 0.5)}" ry="2.4" fill="#A9555A"/>` : ''}${lower ? `<path d="M${f(cx - W * 0.68)} ${f(my + D * 0.86)}Q${cx} ${f(my + D * 0.7)} ${f(cx + W * 0.68)} ${f(my + D * 0.86)}L${f(cx + W * 0.68)} ${f(my + D + 2)}L${f(cx - W * 0.68)} ${f(my + D + 2)}Z" fill="#EFE6DA" opacity=".92"/>` : ''}<path d="${teeth}Z" fill="url(#d-teethG)"/>${gaps}<path d="M${R} ${f(cc)}${openTop}" stroke="#6E3530" stroke-width="1.6" fill="none" opacity=".36" filter="url(#d-b05)"/></g>
    <path d="${upperLip}" fill="url(#d-lipU)"/><path d="${lowerLip}" fill="url(#d-lipL)"/>
    <ellipse cx="${cx + 0.6}" cy="${f(my + D * 0.78 + lt * 0.55)}" rx="${f(W * 0.28)}" ry=".85" fill="${C.lipHi}" opacity=".5" filter="url(#d-b08)"/>`;
}

// ── Toby (on the ground) ──
export function tobySvg(): string {
  const fur = `fill="${C.fur}" stroke="${C.furLine}" stroke-width="1.5" stroke-linejoin="round"`;
  const far = `fill="${C.furSh}" stroke="${C.furLine}" stroke-width="1.5" stroke-linejoin="round"`;
  const legAt = (id: string, x: number, style: string) => `<g id="${id}" transform="translate(${x} -24)"><path d="${fluff(0, 12, 7.4, 14, 6, 0.09, x)}" ${style}/><ellipse cx="2" cy="24" rx="8.4" ry="4.8" ${style}/></g>`;
  return `<svg id="t-svg" viewBox="-70 -100 140 110" width="140" height="110" style="position:absolute;left:-70px;top:-100px;overflow:visible" aria-hidden="true">
  <ellipse id="t-shadow" cx="0" cy="3" rx="42" ry="5" fill="${C.ink}" opacity=".16"/>
  <g id="t-all">
    <g id="t-tail" transform="translate(-36 -38)"><path d="${fluff(-8, -16, 12, 18, 7, 0.14, 5)}" ${fur} transform="rotate(-28 -8 -16)"/></g>
    ${legAt('t-legHF', -28, far)}${legAt('t-legFF', 30, far)}
    <g id="t-bodyG"><path d="${fluff(-2, -36, 40, 23, 12, 0.08, 2)}" ${fur}/><path d="M-30-27C-16-18 14-17 30-26" fill="none" stroke="${C.furSh}" stroke-width="5" stroke-linecap="round" opacity=".9"/></g>
    ${legAt('t-legHN', -18, fur)}${legAt('t-legFN', 20, fur)}
    <g id="t-head" transform="translate(30 -44)">
      <path d="${fluff(8, -12, 25, 24, 11, 0.09, 9)}" ${fur}/>
      <g id="t-ear" transform="translate(-9 -24)"><path d="M0 0C-9 8-11 26-7 40C-5 46 2 47 5 41C8 30 8 14 6 2Z" ${fur}/><path d="M-2 12C-3 22-2.4 30-.6 36" fill="none" stroke="${C.furSh}" stroke-width="1.8" stroke-linecap="round"/></g>
      <ellipse cx="21" cy="-4" rx="12.4" ry="9.4" fill="${C.fur}" stroke="${C.furSh}" stroke-width="1.1"/>
      <g id="t-eyes"><circle cx="9" cy="-17" r="4.5" fill="${C.nose}"/><circle cx="23.4" cy="-17" r="4.1" fill="${C.nose}"/><circle cx="7.6" cy="-18.6" r="1.45" fill="#fff"/><circle cx="22.2" cy="-18.5" r="1.3" fill="#fff"/></g>
      <g id="t-shut" style="display:none" fill="none" stroke="${C.nose}" stroke-width="2" stroke-linecap="round"><path d="M4.6-17q4.4 3.4 8.8 0"/><path d="M19.4-17q4 3.2 8 0"/></g>
      <ellipse cx="30.4" cy="-7.4" rx="4.6" ry="3.7" fill="${C.nose}"/><circle cx="29.2" cy="-8.6" r="1.1" fill="#fff" opacity=".7"/>
      <g id="t-mouthShut"><path d="M30.4-3.6C30 .4 26 2.4 22 1" fill="none" stroke="${C.nose}" stroke-width="1.4" stroke-linecap="round"/><path id="t-tongue" d="M24.4 1.4C24 6.6 27 10 30 8C32 6.6 31.6 3 30.6.9Z" fill="${C.tongue}" stroke="#C4636B" stroke-width=".8"/></g>
      <g id="t-mouthOpen" style="display:none"><path d="M19 0C21 11 31 12 34-1Z" fill="${C.mouth}" stroke="${C.nose}" stroke-width="1.3" stroke-linejoin="round"/><path d="M23 6C25 10 30 10 31.6 5.4Z" fill="${C.tongue}"/></g>
    </g>
  </g>
</svg>`;
}
