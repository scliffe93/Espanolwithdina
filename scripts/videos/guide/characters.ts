// Dina and Toby, drawn for animation. One style for both: flat colour with a little soft shading, big readable faces.
// Each is an SVG "puppet": named parts that the rig turns and moves every frame (see rig.ts). Nothing here moves by itself.
//
// Dina's units: her feet are at (0, 0) and she is about 370 tall (y is negative going up). Toby's: his feet are at
// (0, 0), he faces right, and he is about 110 long.

export const C = {
  skin: '#EFB78D', skinSh: '#D9986C', skinHi: '#F8D2B0', blush: '#E88B78',
  hair: '#3A2317', hairSh: '#26150D', hairHi: '#7A4F33',
  top: '#1F1C1A', topSh: '#121010', topHi: '#3A3532', lace: '#EADFC8', laceDot: '#3A322B',
  denim: '#4169A6', denimSh: '#2E4D80', denimHi: '#6189C4',
  shoe: '#FDFBF6', sole: '#CFC5B5',
  eye: '#7A4A28', pupil: '#22130B', lip: '#B4574F', mouth: '#6E2A30', tongue: '#E98A8F',
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
  neck: { x: 0, y: -248 }, mouth: { x: 0, y: -272 }, head: { x: 0, y: -300 },
  /** Where Toby sits when she holds him (the middle of his body). */
  held: { x: -26, y: -202 },
};

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
  const x = side === 'A' ? -16 : 16; const out = side === 'A' ? -1 : 1;
  return `<g transform="translate(${x} -300)">
    <g clip-path="url(#d-eyeclip)"><ellipse rx="8.8" ry="7.6" fill="#fff"/>
    <g id="d-pupil${side}"><circle r="5.4" fill="${C.eye}"/><circle r="2.7" fill="${C.pupil}"/><circle cx="-1.9" cy="-2.1" r="1.7" fill="#fff"/><circle cx="1.8" cy="1.9" r=".8" fill="#fff" opacity=".7"/></g>
    <path d="M-10-7.6L10-7.6L10 8L-10 8Z" fill="${C.skin}" id="d-lid${side}" transform="translate(0 -15.2)"/></g>
    <path d="M${-9 * out} -1C${-5 * out}-8.4 ${5 * out}-8.6 ${9.4 * out}-2.4L${11.6 * out}-5" fill="none" stroke="${C.hairSh}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" id="d-lash${side}"/>
    <path d="M-8.6 0C-4 4.6 4 4.6 8.6 0" fill="none" stroke="${C.hairSh}" stroke-width="2.2" stroke-linecap="round" id="d-shut${side}" style="display:none"/>
  </g>
  <path id="d-brow${side}" d="M${-9 * out} 1C${-4 * out}-3.4 ${4 * out}-3.6 ${9 * out}-.6" transform="translate(${x} -316)" fill="none" stroke="${C.hair}" stroke-width="2.8" stroke-linecap="round"/>`;
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
  <defs><clipPath id="d-eyeclip"><ellipse rx="8.8" ry="7.6"/></clipPath><pattern id="d-lace" width="3.6" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(-20)"><rect width="3.6" height="3.2" fill="${C.lace}"/><ellipse cx="1.8" cy="1.6" rx="1.1" ry=".95" fill="${C.laceDot}"/></pattern></defs>
  <ellipse id="d-shadow" cx="0" cy="12" rx="46" ry="7" fill="${C.ink}" opacity=".16"/>
  <g id="d-body">
    <g id="d-hairBack"><path d="M-46-318C-53-288-55-248-52-214C-50-203-44-199-38-206L-34-199C-28-206-24-204-20-211L20-211C24-204 28-206 34-199L38-206C44-199 50-203 52-214C55-248 53-288 46-318C40-352-40-352-46-318Z" fill="${C.hairSh}"/></g>
    ${leg('A')}${leg('B')}
    <path d="M-34-128L34-128C35.4-118 34.6-108 33-99L3-97L0-104L-3-97L-33-99C-34.6-108-35.4-118-34-128Z" fill="${C.denim}"/>
    <path d="M0-104L0-124" stroke="${C.denimSh}" stroke-width="1.6" opacity=".8"/><path d="M-26-112C-22-106-14-104-8-105M26-112C22-106 14-104 8-105" fill="none" stroke="${C.denimSh}" stroke-width="1.5" stroke-linecap="round" opacity=".8"/>
    <g id="d-torso">
      <path d="M-12-244C-24-243-36-240-41-232C-45-224-40-210-35-200C-30-186-27-174-27-162C-28-150-32-140-34.6-128L-35-119L35-119L34.6-128C32-140 28-150 27-162C27-174 30-186 35-200C40-210 45-224 41-232C36-240 24-243 12-244C8-238-8-238-12-244Z" fill="${C.top}"/>
      <path d="M30-222C28-200 23-180 24-160C25-146 29-134 31-121" fill="none" stroke="${C.topSh}" stroke-width="8" stroke-linecap="round" opacity=".7"/>
      <path d="M-30-218C-27-200-22-182-22-164C-23-150-27-138-29-124" fill="none" stroke="${C.topHi}" stroke-width="3" stroke-linecap="round" opacity=".6"/>
      <path d="M-16-196C-8-190 8-190 16-196" fill="none" stroke="${C.topSh}" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>
      <path d="M-34.6-126L34.6-126" stroke="${C.topHi}" stroke-width="1" opacity=".9"/><path d="M-30-125.4L-30-119.4M-24-125.4L-24-119.4M-18-125.4L-18-119.4M-12-125.4L-12-119.4M-6-125.4L-6-119.4M0-125.4L0-119.4M6-125.4L6-119.4M12-125.4L12-119.4M18-125.4L18-119.4M24-125.4L24-119.4M30-125.4L30-119.4" stroke="${C.topHi}" stroke-width=".9" opacity=".8"/>
      <path d="M13.4-243.8C24-242.8 35-240 41-232C43.4-228 43.4-223.4 42-219L35-221.6C36-226 35-229 32-232C28-235 21-237 12.4-238Z" fill="${C.lace}"/>
      <path d="M15-240.8C24-239.6 32-237 37-231.6C39-228.4 39.2-225 38.4-221.6" fill="none" stroke="${C.laceDot}" stroke-width="1.5" stroke-dasharray=".2 3.2" stroke-linecap="round"/>
      <path d="M-9.4-262L-9.4-240C-5-235 5-235 9.4-240L9.4-262Z" fill="${C.skinSh}"/>
      <path d="M-12-244C-8-237 8-237 12-244" fill="none" stroke="${C.topHi}" stroke-width="2.6" stroke-linecap="round"/>
    </g>
    ${A.upper}${B.upper}
    <g id="d-head">
      <path d="M-38-306C-38-334-22-347 0-347C22-347 38-334 38-306C38-282 30-262 12-254.4C4-251.4-4-251.4-12-254.4C-30-262-38-282-38-306Z" fill="${C.skin}"/>
      <path d="M-38-306C-38-322-33-334-24-340C-28-326-30-312-34-300C-32-286-26-270-12-258C-28-264-38-282-38-306Z" fill="${C.skinSh}" opacity=".45"/>
      <ellipse cx="-25" cy="-281" rx="7" ry="4.4" fill="${C.blush}" opacity=".5" id="d-cheekA"/><ellipse cx="25" cy="-281" rx="7" ry="4.4" fill="${C.blush}" opacity=".5" id="d-cheekB"/>
      <g id="d-face">
        ${eye('A')}${eye('B')}
        <path d="M-2-291C-3.6-285.4-.4-282.6 3.4-284.6" fill="none" stroke="${C.skinSh}" stroke-width="2" stroke-linecap="round"/>
        <g id="d-mouth"><path id="d-mouthIn" d="" fill="${C.mouth}"/><path id="d-teeth" d="" fill="#fff"/><path id="d-tongue" d="" fill="${C.tongue}"/><path id="d-lips" d="" fill="none" stroke="${C.lip}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g>
      </g>
      <path d="M-45-296C-50-340-28-365 0-365C28-365 50-340 45-296L39.4-302C36-322 24-336 6-342.4C-4-326-20-310-39.6-298Z" fill="${C.hair}"/>
      <path d="M-30-341C-16-353 10-355 28-345" fill="none" stroke="${C.hairHi}" stroke-width="4" stroke-linecap="round" opacity=".7"/><path d="M5-343C-3-330-16-318-33-308" fill="none" stroke="${C.hairSh}" stroke-width="2" stroke-linecap="round" opacity=".6"/>
      <g id="d-curtA"><path d="M-45.4-300C-51-270-51-236-48-204C-45-197-38-197-34-204C-33-230-34-262-39.6-298Z" fill="${C.hair}"/><path d="M-44-286C-46-262-46-236-44-212" fill="none" stroke="${C.hairHi}" stroke-width="2.6" stroke-linecap="round" opacity=".6"/></g>
      <g id="d-curtB"><path d="M45.4-300C51-270 51-236 48-204C45-197 38-197 34-204C33-230 34-262 39.6-298Z" fill="${C.hair}"/><path d="M41-290C43.4-266 43.6-240 42-214" fill="none" stroke="${C.hairSh}" stroke-width="2.4" stroke-linecap="round" opacity=".6"/></g>
    </g>
    ${held.back}
    ${A.fore}${B.fore}
    ${held.front}
  </g>
</svg>`;
}

/** Dina's mouth for a given openness (0 closed … 1 wide) and smile (0 … 1). */
export function mouthPaths(open: number, smile: number): { lips: string; inside: string; teeth: string; tongue: string } {
  const { x, y } = DINA.mouth; const o = Math.max(0, Math.min(1, open));
  const w = 12.5 - 3.4 * o + 1.5 * smile, lift = 1.2 + 2.6 * smile * (1 - o * 0.5), drop = 2.4 + 13 * o;
  const L = x - w, R = x + w, cy = y - lift; // the corners sit a little higher than the middle: a smile
  const upper = `M${L} ${cy}Q${x} ${y + 1.6 - o * 1.4} ${R} ${cy}`;
  if (o < 0.07) return { lips: `M${L} ${cy}Q${x} ${y + 3.4 + 2.6 * smile} ${R} ${cy}`, inside: '', teeth: '', tongue: '' };
  const lower = `Q${x} ${y + drop * 1.9} ${L} ${cy}`;
  const th = Math.min(3.6, 1.4 + 6 * o);
  return {
    lips: `${upper}${lower}Z`, inside: `${upper}${lower}Z`,
    teeth: `M${L + 2.6} ${cy + 0.9}Q${x} ${y + 2.2 - o * 1.2} ${R - 2.6} ${cy + 0.9}L${R - 3.6} ${cy + 0.9 + th}Q${x} ${y + 2.4 + th - o} ${L + 3.6} ${cy + 0.9 + th}Z`,
    tongue: o > 0.42 ? `M${x - w * 0.5} ${y + drop * 0.72}Q${x} ${y + drop * 0.5} ${x + w * 0.5} ${y + drop * 0.72}Q${x} ${y + drop * 1.1} ${x - w * 0.5} ${y + drop * 0.72}Z` : '',
  };
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
