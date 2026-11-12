// The on-screen guides for the how-to videos: Dina as a whole person and Toby as his own little character.
// Bundled on its own (React + the app's DinaArt) and injected into the page being recorded. Dina's head and
// shoulders are the app's real artwork, so she blinks, talks and waves; the rest of her and all of Toby are drawn here.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DinaArt } from '../../../src/components/Dina';

const C = { top: '#181513', topHi: '#2A2522', lace: '#E9DCC2', skin: '#ECB288', skinSh: '#C07E56', denim: '#3A5A85', denimSh: '#2B4567', denimHi: '#5377A6', shoe: '#FDFBF6', sole: '#D9CFBF', fur: '#FDFCFA', furSh: '#E8E1D6', furDeep: '#B9AA95', ink: '#2B2420' };
const W = 390, H = 844, FLOOR = 760;
const DW = 88, UNIT = DW / 166, DH = Math.round((513 - 10) * UNIT); // Dina is drawn in the artwork's units: x 26..192, y 10..513

// ── state ──
interface S {
  on: boolean;
  dina: { x: number; walking: boolean; talking: boolean; waving: boolean; face: 1 | -1; ms: number };
  toby: { x: number; y: number; walking: boolean; hop: number; dir: 1 | -1; ms: number; happy: boolean };
  bubble: { html: string; on: boolean; x: number; y: number; w: number; tail: 'left' | 'right' };
  ring: { x: number; y: number; on: boolean; press: boolean };
  curtain: { on: boolean; kicker: string; title: string; sub: string };
}
const HOME: S = {
  on: false,
  dina: { x: -140, walking: false, talking: false, waving: false, face: 1, ms: 0 },
  toby: { x: W + 80, y: FLOOR, walking: false, hop: 0, dir: -1, ms: 0, happy: true },
  bubble: { html: '', on: false, x: DW + 16, y: 480, w: W - DW - 26, tail: 'left' },
  ring: { x: 0, y: 0, on: false, press: false },
  curtain: { on: false, kicker: '', title: '', sub: '' },
};
let state: S = (() => { try { const s = sessionStorage.getItem('vg-state'); if (s) { const p = JSON.parse(s) as S; p.dina.ms = 0; p.toby.ms = 0; p.dina.walking = false; p.toby.walking = false; return p; } } catch { /* fresh */ } return HOME; })();
const subs = new Set<() => void>();
function set(patch: (s: S) => void) { const next = JSON.parse(JSON.stringify(state)) as S; patch(next); state = next; try { sessionStorage.setItem('vg-state', JSON.stringify(state)); } catch { /* ignore */ } subs.forEach((f) => f()); }
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── drawing helpers ──
/** A fluffy outline: an ellipse with soft scallops. */
function fluff(cx: number, cy: number, rx: number, ry: number, n: number, amp = 0.12, seed = 1): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const wob = 1 + (i % 2 ? amp : -amp * 0.35) + Math.sin(i * 12.9898 + seed * 78.233) * 0.02;
    pts.push([cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob]);
  }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length; i++) { const p = pts[(i + 1) % pts.length], q = pts[(i + 2) % pts.length]; d += `Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${((p[0] + q[0]) / 2).toFixed(1)} ${((p[1] + q[1]) / 2).toFixed(1)}`; i++; }
  return d + 'Z';
}

/** Dina from the shoulders down, in the same units as the app's artwork (her head is centred on x = 120) so the two join up. */
function DinaBody({ walking, waving }: { walking: boolean; waving: boolean }) {
  const limb = (cls: string, origin = '50% 3%'): React.CSSProperties => ({ transformBox: 'fill-box', transformOrigin: origin, animation: walking ? `${cls} .62s ease-in-out infinite` : undefined });
  return (
    <svg viewBox="26 130 166 390" style={{ position: 'absolute', left: 0, top: (130 - 10) * UNIT, width: DW, height: 390 * UNIT, overflow: 'visible' }} aria-hidden>
      {/* legs: high-waisted jeans and white trainers */}
      <g style={limb('vg-legA')}>
        <path d="M89 300C86 370 84 440 83 496L117 496C118 440 120 370 120 312Z" fill={C.denim} />
        <path d="M93 310C91 372 89 438 88 492" stroke={C.denimHi} strokeWidth="2" fill="none" opacity=".5" strokeLinecap="round" />
        <path d="M83 490L117 490L117 496L83 496Z" fill={C.denimSh} />
        <path d="M78 506C78 499 86 496 100 496C112 496 120 500 120 506C120 510 117 512 112 512L84 512C80 512 78 510 78 506Z" fill={C.shoe} stroke={C.sole} strokeWidth="1.4" />
        <path d="M79 508.5L119 508.5" stroke={C.sole} strokeWidth="2.2" strokeLinecap="round" />
      </g>
      <g style={limb('vg-legB')}>
        <path d="M151 300C154 370 156 440 157 496L123 496C122 440 120 370 120 312Z" fill={C.denim} />
        <path d="M120 314C121 372 122 438 123 492" stroke={C.denimSh} strokeWidth="2.2" fill="none" opacity=".75" strokeLinecap="round" />
        <path d="M123 490L157 490L157 496L123 496Z" fill={C.denimSh} />
        <path d="M120 506C120 500 128 496 140 496C154 496 162 499 162 506C162 510 160 512 156 512L128 512C123 512 120 510 120 506Z" fill={C.shoe} stroke={C.sole} strokeWidth="1.4" />
        <path d="M121 508.5L161 508.5" stroke={C.sole} strokeWidth="2.2" strokeLinecap="round" />
      </g>
      {/* torso: the black knit top, shoulders rounded off under her hair */}
      <path d="M100 141C88 143 76 147 70 156C66 164 68 176 72 190C78 226 86 262 88 306L152 306C154 262 162 226 168 190C172 176 174 164 170 156C164 147 152 143 140 141Z" fill={C.top} />
      <path d="M92 286C104 291 136 291 148 286" stroke={C.topHi} strokeWidth="2.4" fill="none" opacity=".7" />
      {/* the cream crochet shoulder from the artwork */}
      <path d="M150 143C160 145 168 150 171 158L164 164C161 156 155 151 147 148Z" fill={C.lace} opacity=".95" />
      <path d="M152 146L166 157M156 145L169 155" stroke="#B9A988" strokeWidth=".8" opacity=".7" />
      <path d="M87 298L153 298L154 312L86 312Z" fill={C.denimSh} />
      <circle cx="120" cy="305" r="2.2" fill="#C9A45A" />
      {/* arms: long sleeves with a cream cuff, hands relaxed */}
      <g style={limb('vg-armA', '70% 3%')}>
        <path d="M74 152C62 158 60 200 62 240C63 270 65 296 67 318L82 318C85 280 88 230 88 176Z" fill={C.top} />
        <path d="M67.5 316.5L81.5 316.5" stroke={C.lace} strokeWidth="3.4" strokeLinecap="round" />
        <path d="M68 320C66 328 67 338 71 343C75 347 80 345 81.5 338C83 331 82 325 81.5 320Z" fill={C.skin} stroke={C.skinSh} strokeWidth=".7" />
      </g>
      {!waving && (
        <g style={limb('vg-armB', '30% 3%')}>
          <path d="M166 152C178 158 180 200 178 240C177 270 175 296 173 318L158 318C155 280 152 230 152 176Z" fill={C.top} />
          <path d="M158.5 316.5L172.5 316.5" stroke={C.lace} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M172 320C174 328 173 338 169 343C165 347 160 345 158.5 338C157 331 158 325 158.5 320Z" fill={C.skin} stroke={C.skinSh} strokeWidth=".7" />
        </g>
      )}
    </svg>
  );
}

// The app's artwork is a head-and-shoulders crop whose shoulders run off both edges. Keep her head, hair and neck
// (and the raised hand when she waves) and let the drawn body supply shoulders of a natural width.
const u = (x: number, y: number) => `${((x - 26) * UNIT).toFixed(1)}px ${((y - 10) * UNIT).toFixed(1)}px`;
const BUST_CLIP = `polygon(${[u(26, 10), u(192, 10), u(192, 143), u(168, 143), u(167, 170), u(77, 170), u(76, 143), u(26, 143)].join(',')})`;
const BUST_CLIP_WAVE = `polygon(${[u(26, 10), u(200, 10), u(200, 186), u(160, 186), u(160, 170), u(77, 170), u(76, 143), u(26, 143)].join(',')})`;

function Dina() {
  const d = useStore((s) => s.dina);
  return (
    <div style={{ position: 'fixed', left: 0, top: FLOOR - DH, width: DW, height: DH, transform: `translateX(${d.x}px)`, transition: `transform ${d.ms}ms linear`, zIndex: 2147483645, pointerEvents: 'none', willChange: 'transform' }}>
      <div style={{ position: 'absolute', left: '8%', right: '8%', bottom: -5, height: 12, borderRadius: '50%', background: 'rgba(43,36,32,.22)', filter: 'blur(3px)' }} />
      <div style={{ position: 'absolute', inset: 0, transformOrigin: `${(120 - 26) * UNIT}px 50%`, transform: `scaleX(${d.face})` }}>
        <div style={{ position: 'absolute', inset: 0, animation: d.walking ? 'vg-bob .31s ease-in-out infinite' : 'vg-breathe 3.2s ease-in-out infinite' }}>
          <DinaBody walking={d.walking} waving={d.waving} />
          <div style={{ position: 'absolute', left: 0, top: 0, width: DW, clipPath: d.waving ? BUST_CLIP_WAVE : BUST_CLIP }}>
            <DinaArt size={DW} toby={false} animate speaking={d.talking} waving={d.waving} expression={d.waving || !d.talking ? 'beam' : 'smile'} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Toby the Maltese, side on, facing right. He trots, wags, blinks and hops. */
function Toby() {
  const t = useStore((s) => s.toby);
  const [blink, setBlink] = useState(false);
  useEffect(() => { let live = true; const loop = async () => { while (live) { await sleep(1800 + Math.random() * 2200); setBlink(true); await sleep(140); setBlink(false); } }; void loop(); return () => { live = false; }; }, []);
  const TW = 78;
  const leg = (x: number, far: boolean, cls: string) => (
    <g style={{ transformBox: 'fill-box', transformOrigin: '50% 0%', animation: t.walking ? `${cls} .26s ease-in-out infinite` : undefined }}>
      <path d={fluff(x, 78, 7.5, 13, 6, 0.1, x)} fill={far ? C.furSh : C.fur} stroke={C.furDeep} strokeWidth="1" />
      <ellipse cx={x + 1.5} cy="90" rx="8" ry="4.6" fill={far ? C.furSh : C.fur} stroke={C.furDeep} strokeWidth="1" />
    </g>
  );
  return (
    <div style={{ position: 'fixed', left: 0, top: 0, width: TW, transform: `translate(${t.x - TW / 2}px, ${t.y - TW * 0.74}px)`, transition: `transform ${t.ms}ms linear`, zIndex: 2147483646, pointerEvents: 'none', willChange: 'transform' }}>
      <div key={t.hop} style={{ animation: t.hop ? 'vg-hop .5s ease-out 1' : t.walking ? 'vg-trot .26s ease-in-out infinite' : undefined }}>
        <svg viewBox="0 0 130 100" width={TW} style={{ display: 'block', overflow: 'visible', transform: `scaleX(${t.dir})` }} aria-hidden>
          <ellipse cx="66" cy="95" rx="40" ry="4.5" fill="#2B2420" opacity=".16" />
          {/* tail: a plume that wags when he is standing */}
          <g style={{ transformBox: 'fill-box', transformOrigin: '80% 90%', animation: `vg-wag ${t.walking ? '.3s' : '.42s'} ease-in-out infinite` }}>
            <path d={fluff(22, 36, 13, 19, 7, 0.16, 5)} fill={C.fur} stroke={C.furDeep} strokeWidth="1.1" transform="rotate(-24 22 36)" />
          </g>
          {leg(42, true, 'vg-pawB')}{leg(86, true, 'vg-pawA')}
          <path d={fluff(62, 58, 37, 23, 11, 0.09, 2)} fill={C.fur} stroke={C.furDeep} strokeWidth="1.2" />
          <path d="M34 66C46 74 78 76 92 68" stroke={C.furSh} strokeWidth="5" fill="none" strokeLinecap="round" opacity=".8" />
          {leg(52, false, 'vg-pawA')}{leg(76, false, 'vg-pawB')}
          {/* head, with a long silky ear */}
          <g style={{ transformBox: 'fill-box', transformOrigin: '30% 80%', animation: t.walking ? undefined : 'vg-tilt 3.4s ease-in-out infinite' }}>
            <path d={fluff(98, 37, 23, 22, 10, 0.1, 9)} fill={C.fur} stroke={C.furDeep} strokeWidth="1.2" />
            <path d="M82 22C74 30 72 46 76 60C78 66 84 67 87 61C90 50 90 36 88 24Z" fill={C.fur} stroke={C.furDeep} strokeWidth="1.1" />
            <path d="M80 34C79 44 80 52 82 58" stroke={C.furSh} strokeWidth="1.6" fill="none" strokeLinecap="round" />
            <ellipse cx="108" cy="46" rx="11" ry="8.5" fill={C.fur} stroke={C.furSh} strokeWidth="1" />
            {blink ? (
              <><path d="M96 33Q100 36 104 33" stroke="#1A100C" strokeWidth="1.8" fill="none" strokeLinecap="round" /><path d="M110 33Q113.5 36 117 33" stroke="#1A100C" strokeWidth="1.8" fill="none" strokeLinecap="round" /></>
            ) : (
              <><circle cx="100" cy="33" r="4" fill="#1A100C" /><circle cx="113.5" cy="33" r="3.7" fill="#1A100C" /><circle cx="98.8" cy="31.6" r="1.25" fill="#fff" /><circle cx="112.4" cy="31.7" r="1.15" fill="#fff" /></>
            )}
            <ellipse cx="116.5" cy="43" rx="4.2" ry="3.4" fill="#1A100C" />
            <circle cx="115.4" cy="42" r="1" fill="#fff" opacity=".7" />
            <path d="M116.5 46.4C116 50 112 52 108 50.5" stroke="#1A100C" strokeWidth="1.3" fill="none" strokeLinecap="round" />
            {t.happy && <path d="M110.5 51C110 56 113 59.5 116 57.5C118 56 117.6 52.5 116.6 50.4Z" fill="#E98A8F" stroke="#C4636B" strokeWidth=".7" style={{ transformBox: 'fill-box', transformOrigin: '50% 0%', animation: 'vg-pant .36s ease-in-out infinite' }} />}
          </g>
        </svg>
      </div>
    </div>
  );
}

function Bubble() {
  const b = useStore((s) => s.bubble);
  return (
    <div style={{ position: 'fixed', left: b.x, top: 0, width: b.w, transform: `translateY(${b.y}px) scale(${b.on ? 1 : 0.85})`, opacity: b.on ? 1 : 0, transformOrigin: b.tail === 'left' ? '0 100%' : '100% 100%', transition: 'transform .35s cubic-bezier(.3,1.4,.5,1), opacity .2s', zIndex: 2147483644, pointerEvents: 'none' }}>
      <div className="vg-bubble" data-tail={b.tail} dangerouslySetInnerHTML={{ __html: b.html }} />
    </div>
  );
}
function Ring() {
  const r = useStore((s) => s.ring);
  return <div className={`vg-ring${r.on ? ' on' : ''}${r.press ? ' press' : ''}`} style={{ left: r.x, top: r.y }} />;
}
function Curtain() {
  const c = useStore((s) => s.curtain);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg,#FBF6EE 0%,#F7E9D7 100%)', opacity: c.on ? 1 : 0, transition: 'opacity .5s', zIndex: 2147483640, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '120px 28px 0' }}>
      <div style={{ font: '600 13px Inter,system-ui,sans-serif', letterSpacing: '.14em', textTransform: 'uppercase', color: '#6B7F3A' }}>{c.kicker}</div>
      <div style={{ font: '600 38px/1.12 Fraunces,Georgia,serif', color: C.ink, marginTop: 14 }}>{c.title}</div>
      <div style={{ font: '400 17px/1.4 Inter,system-ui,sans-serif', color: '#6B5F55', marginTop: 12 }}>{c.sub}</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: FLOOR, bottom: 0, background: '#EBD9C2' }} />
    </div>
  );
}
function useStore<T>(pick: (s: S) => T): T { const [, force] = useState(0); useEffect(() => { const f = () => force((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []); return pick(state); }
function Stage() { const on = useStore((s) => s.on); return on ? <><Curtain /><Bubble /><Dina /><Toby /><Ring /></> : null; }

const CSS = `
@keyframes vg-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes vg-breathe{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.2px)}}
@keyframes vg-legA{0%,100%{transform:rotate(9deg)}50%{transform:rotate(-9deg)}}
@keyframes vg-legB{0%,100%{transform:rotate(-9deg)}50%{transform:rotate(9deg)}}
@keyframes vg-armA{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(7deg)}}
@keyframes vg-armB{0%,100%{transform:rotate(7deg)}50%{transform:rotate(-7deg)}}
@keyframes vg-pawA{0%,100%{transform:rotate(24deg)}50%{transform:rotate(-24deg)}}
@keyframes vg-pawB{0%,100%{transform:rotate(-24deg)}50%{transform:rotate(24deg)}}
@keyframes vg-trot{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}}
@keyframes vg-wag{0%,100%{transform:rotate(-13deg)}50%{transform:rotate(15deg)}}
@keyframes vg-tilt{0%,70%,100%{transform:rotate(0)}80%,92%{transform:rotate(-9deg)}}
@keyframes vg-pant{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.78)}}
@keyframes vg-hop{0%{transform:translateY(0)}35%{transform:translateY(-22px) rotate(-6deg)}70%{transform:translateY(0)}85%{transform:translateY(-6px)}100%{transform:translateY(0)}}
.vg-bubble{position:relative;background:#fff;color:#2B2420;font:600 15.5px/1.32 Inter,system-ui,sans-serif;padding:11px 14px;border-radius:18px;box-shadow:0 10px 28px rgba(43,36,32,.26);border:2px solid #2B2420}
.vg-bubble:after{content:"";position:absolute;bottom:16px;width:14px;height:14px;background:#fff;transform:rotate(45deg)}
.vg-bubble[data-tail=left]:after{left:-9px;border-left:2px solid #2B2420;border-bottom:2px solid #2B2420}
.vg-bubble[data-tail=right]:after{right:-9px;border-right:2px solid #2B2420;border-top:2px solid #2B2420}
.vg-bubble b{display:inline-grid;place-items:center;min-width:22px;height:22px;margin-right:7px;border-radius:999px;background:#C4573A;color:#fff;font-size:13px;font-weight:700;vertical-align:1px}
.vg-bubble u{text-decoration:none;color:#C4573A;font-weight:700}
.vg-ring{position:fixed;z-index:2147483647;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;background:rgba(196,87,58,.22);border:3px solid rgba(196,87,58,.95);pointer-events:none;opacity:0;transform:scale(.5);transition:opacity .2s,transform .35s}
.vg-ring.on{opacity:1;transform:scale(1)}.vg-ring.press{transform:scale(.72);background:rgba(196,87,58,.45)}
[title^="Dina, Sam and Anneka"],[data-vg-hide]{display:none!important}
`;

// ── what the recorder calls ──
type Box = { x: number; y: number; width: number; height: number };
const DINA_L = 6, DINA_R = W - DW - 6;
const hits = (a: Box, b: Box, pad = 6) => a.x < b.x + b.width + pad && b.x < a.x + a.width + pad && a.y < b.y + b.height + pad && b.y < a.y + a.height + pad;
async function dinaWalkTo(x: number) {
  const dx = x - state.dina.x; if (Math.abs(dx) < 4) return;
  const ms = Math.max(350, Math.abs(dx) / 0.19);
  set((s) => { s.dina.face = dx > 0 ? 1 : -1; s.dina.walking = true; s.dina.ms = ms; s.dina.x = x; });
  await sleep(ms);
  set((s) => { s.dina.walking = false; s.dina.ms = 0; s.dina.face = x < W / 2 ? 1 : -1; });
}
async function tobyGoTo(x: number, y: number) {
  x = Math.max(34, Math.min(W - 34, x)); y = Math.max(70, Math.min(FLOOR, y));
  const dx = x - state.toby.x, dy = y - state.toby.y, dist = Math.hypot(dx, dy); if (dist < 5) return;
  const ms = Math.max(260, dist / 0.42);
  set((s) => { if (Math.abs(dx) > 6) s.toby.dir = dx > 0 ? 1 : -1; s.toby.walking = true; s.toby.ms = ms; s.toby.x = x; s.toby.y = y; });
  await sleep(ms);
  set((s) => { s.toby.walking = false; s.toby.ms = 0; });
}
/** True when there is writing on the page under this box (so Toby would be standing on something you need to read). */
function overText(b: Box): boolean {
  const seen = new Set<Element>();
  for (const fx of [0.15, 0.5, 0.85]) for (const fy of [0.2, 0.55, 0.9]) {
    const el = document.elementFromPoint(b.x + b.width * fx, b.y + b.height * fy); if (!el || seen.has(el)) continue; seen.add(el);
    if (el instanceof HTMLImageElement || el.closest('svg, button, a, input, select')) return true;
    for (const n of Array.from(el.childNodes)) {
      if (n.nodeType !== 3 || !n.textContent || !n.textContent.trim()) continue;
      const r = document.createRange(); r.selectNodeContents(n);
      for (const q of Array.from(r.getClientRects())) if (hits(b, { x: q.x, y: q.y, width: q.width, height: q.height }, 0)) return true;
    }
  }
  return false;
}
function bubbleHeight(html: string, w: number): number { const d = document.createElement('div'); d.style.cssText = `position:fixed;left:-9999px;top:0;width:${w}px`; d.innerHTML = `<div class="vg-bubble">${html}</div>`; document.body.appendChild(d); const h = d.offsetHeight; d.remove(); return h; }

const api = {
  mount() {
    if (document.getElementById('vg-root')) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const el = document.createElement('div'); el.id = 'vg-root'; document.body.appendChild(el);
    createRoot(el).render(<Stage />);
    const hide = () => !(window as unknown as { __vgNoHide?: boolean }).__vgNoHide && document.querySelectorAll('a,button,span').forEach((e) => { const t = (e.textContent || '').replace(/\s+/g, ' ').trim(); if (/^(Demo · \w+ · Switch|Log in · save everywhere|Log in|Demo data|Cambiar|Switch person ?Cambiar)$/.test(t)) (e.closest('a,button') || e).setAttribute('data-vg-hide', ''); });
    hide(); new MutationObserver(hide).observe(document.body, { childList: true, subtree: true });
  },
  show() { set((s) => { s.on = true; }); },
  /** Title card: the two of them come on from either side and Dina waves. */
  async intro(kicker: string, title: string, sub: string) {
    set((s) => { Object.assign(s, JSON.parse(JSON.stringify(HOME))); s.on = true; s.curtain = { on: true, kicker, title, sub }; });
    await sleep(350);
    await Promise.all([dinaWalkTo(W / 2 - DW / 2 - 34), (async () => { await sleep(500); await tobyGoTo(W / 2 + 66, FLOOR); })()]);
    set((s) => { s.dina.waving = true; s.toby.hop += 1; });
  },
  async curtainUp() {
    set((s) => { s.curtain.on = false; s.dina.waving = false; s.bubble.on = false; });
    await Promise.all([dinaWalkTo(DINA_L), tobyGoTo(DW + 60, FLOOR)]);
  },
  async outro(title: string) {
    set((s) => { s.bubble.on = false; s.ring.on = false; s.curtain = { on: true, kicker: 'Dina y Toby · Learning with Dina', title, sub: '' }; });
    await Promise.all([dinaWalkTo(W / 2 - DW / 2 - 34), tobyGoTo(W / 2 + 66, FLOOR)]);
    set((s) => { s.dina.waving = true; s.toby.hop += 1; });
  },
  /** Dina says something. With a target, she steps aside if she is in the way and Toby trots over to it. */
  async say(html: string, box: Box | null) {
    const dinaBox = (x: number): Box => ({ x, y: FLOOR - DH, width: DW, height: DH });
    let dx = state.dina.x < W / 2 ? DINA_L : DINA_R;
    if (box && hits(dinaBox(dx), box, 10)) dx = dx === DINA_L ? DINA_R : DINA_L;
    const left = dx === DINA_L;
    const w = W - DW - 26, bx = left ? DW + 18 : 8, bh = bubbleHeight(html, w);
    const head = FLOOR - DH + 8;
    let by = head;
    if (box) { const tries = [head, box.y - bh - 14, box.y + box.height + 54, 70]; by = tries.find((y) => y >= 60 && y + bh <= FLOOR - 4 && !hits({ x: bx, y, width: w, height: bh }, box, 8)) ?? head; }
    set((s) => { s.bubble.on = false; });
    const moves: Promise<void>[] = [dinaWalkTo(dx)];
    if (box) {
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      const inNav = box.y >= FLOOR - 6;
      // Toby goes to the thing and looks at it. He prefers a spot with no writing under him: beside it, then under, then over.
      const TW = 78, TH = 58;
      const spot = (x: number, y: number) => ({ x, y, box: { x: x - TW / 2, y: y - TH, width: TW, height: TH } as Box });
      const spots = inNav ? [spot(cx, FLOOR)] : [spot(box.x + box.width + 46, cy + 26), spot(box.x - 46, cy + 26), spot(box.width > 150 ? box.x + 40 : cx, box.y + box.height + 64), spot(cx, box.y - 6)];
      const free = (sp: ReturnType<typeof spot>) => sp.box.x >= 2 && sp.box.x + TW <= W - 2 && sp.box.y >= 56 && sp.y <= FLOOR && !hits(sp.box, dinaBox(dx), 0) && !hits(sp.box, { x: bx, y: by, width: w, height: bh }, 0) && !overText(sp.box);
      const chosen = spots.find(free) ?? spots.find((sp) => sp.box.x >= 2 && sp.box.x + TW <= W - 2 && sp.y <= FLOOR && sp.box.y >= 56 && !hits(sp.box, dinaBox(dx), 0)) ?? spots[spots.length > 2 ? 2 : 0];
      moves.push(tobyGoTo(chosen.x, chosen.y).then(() => set((s) => { if (!inNav) s.toby.dir = cx >= s.toby.x ? 1 : -1; })));
    }
    // Nothing to point at: Toby comes back to sit by Dina's feet, out of the way.
    if (!box) moves.push(tobyGoTo(left ? DW + 44 : W - DW - 44, FLOOR).then(() => set((s) => { s.toby.dir = left ? 1 : -1; })));
    await sleep(180);
    set((s) => { s.bubble = { html, on: true, x: bx, y: by, w, tail: left ? 'left' : 'right' }; });
    await Promise.all(moves);
  },
  talk(on: boolean) { set((s) => { s.dina.talking = on; }); },
  hush() { set((s) => { s.bubble.on = false; s.dina.talking = false; }); },
  ring(x: number, y: number) { set((s) => { s.ring = { x, y, on: true, press: false }; }); },
  press() { set((s) => { s.ring.press = true; s.toby.hop += 1; }); },
  ringOff() { set((s) => { s.ring.on = false; s.ring.press = false; }); },
  /** For stills: put everything in a given pose at once. */
  pose(p: Partial<S>) { set((s) => { Object.assign(s, p); }); },
};
(window as unknown as { __g: typeof api }).__g = api;
if (document.body) api.mount(); else document.addEventListener('DOMContentLoaded', () => api.mount());
