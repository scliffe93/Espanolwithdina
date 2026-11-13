// The on-screen guides for the how-to videos: Dina as a whole person and Toby, her Maltese.
// Bundled on its own (React + the app's DinaArt) and injected into the page being recorded.
//
// How they behave:
//  • They have their own stage: a frosted panel that slides in, so they stand on it and not on the app's words.
//  • They stay together. Toby runs a step ahead of Dina, sits at her feet, and sometimes rides in her arms.
//  • Toby points things out: he dashes to the thing to look at, barks "¡Guau!", and runs back to her.
//  • Dina moves like a person: she sways, nods as she talks, gestures, points at the target and leans into her walk.
// Dina's head is the app's real artwork (so she blinks, talks and waves); her body and all of Toby are drawn here.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DinaArt } from '../../../src/components/Dina';

const C = { top: '#181513', topHi: '#2A2522', lace: '#E9DCC2', skin: '#ECB288', skinSh: '#C07E56', denim: '#3A5A85', denimSh: '#2B4567', denimHi: '#5377A6', shoe: '#FDFBF6', sole: '#D9CFBF', fur: '#FDFCFA', furSh: '#E8E1D6', furDeep: '#B9AA95', ink: '#2B2420', terra: '#C4573A' };
const W = 390, H = 844;
const DW = 84, UNIT = DW / 166, DH = Math.round((513 - 10) * UNIT); // Dina is drawn in the artwork's units: x 26..192, y 10..513
const TW = 74, TH = 55; // Toby's width, and his height above his feet
const PANEL = { bottom: { top: 610, floor: 832, height: H - 610 }, top: { top: 0, floor: 252, height: 262 } } as const;
type Mode = keyof typeof PANEL;
const EASE = 'cubic-bezier(.45,.05,.35,1)';
const POP = 'cubic-bezier(.3,1.5,.5,1)';

// ── state ──
type Box = { x: number; y: number; width: number; height: number };
interface S {
  on: boolean; mode: Mode; stage: boolean; scale: number;
  dina: { x: number; shown: boolean; walking: boolean; talking: boolean; waving: boolean; carrying: boolean; point: number | null; pointArm: 'A' | 'B'; face: 1 | -1; ms: number };
  toby: { x: number; y: number; shown: boolean; walking: boolean; hop: number; arc: number; dir: 1 | -1; ms: number; bark: number; sitting: boolean };
  bubble: { html: string; on: boolean; x: number; y: number; w: number; tail: 'left' | 'right' };
  ring: { x: number; y: number; on: boolean; press: boolean };
  focus: { on: boolean; box: Box; pulse: number };
  curtain: { on: boolean; kicker: string; title: string; sub: string };
}
const HOME: S = {
  on: false, mode: 'bottom', stage: false, scale: 1,
  dina: { x: -160, shown: true, walking: false, talking: false, waving: false, carrying: true, point: null, pointArm: 'B', face: 1, ms: 0 },
  toby: { x: -100, y: PANEL.bottom.floor, shown: false, walking: false, hop: 0, arc: 0, dir: 1, ms: 0, bark: 0, sitting: false },
  bubble: { html: '', on: false, x: DW + 22, y: 626, w: W - DW - 32, tail: 'left' },
  ring: { x: 0, y: 0, on: false, press: false },
  focus: { on: false, box: { x: 0, y: 0, width: 0, height: 0 }, pulse: 0 },
  curtain: { on: false, kicker: '', title: '', sub: '' },
};
const fresh = (): S => JSON.parse(JSON.stringify(HOME));
let state: S = (() => { try { const s = sessionStorage.getItem('vg-state'); if (s) { const p = JSON.parse(s) as S; p.dina.ms = 0; p.toby.ms = 0; p.dina.walking = false; p.toby.walking = false; p.ring.on = false; return p; } } catch { /* fresh */ } return fresh(); })();
const subs = new Set<() => void>();
function set(patch: (s: S) => void) { const next = JSON.parse(JSON.stringify(state)) as S; patch(next); state = next; try { sessionStorage.setItem('vg-state', JSON.stringify(state)); } catch { /* ignore */ } subs.forEach((f) => f()); }
function useStore<T>(pick: (s: S) => T): T { const [, force] = useState(0); useEffect(() => { const f = () => force((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []); return pick(state); }
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const floorOf = (m: Mode) => PANEL[m].floor;

// ── drawing ──
/** A fluffy outline: an ellipse with soft scallops. */
function fluff(cx: number, cy: number, rx: number, ry: number, n: number, amp = 0.12, seed = 1): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const wob = 1 + (i % 2 ? amp : -amp * 0.35) + Math.sin(i * 12.9898 + seed * 78.233) * 0.02;
    pts.push([cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob]);
  }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length; i += 2) { const p = pts[(i + 1) % pts.length], q = pts[(i + 2) % pts.length]; d += `Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${((p[0] + q[0]) / 2).toFixed(1)} ${((p[1] + q[1]) / 2).toFixed(1)}`; }
  return d + 'Z';
}

/** Dina from the shoulders down, in the same units as the app's artwork (her head is centred on x = 120) so the two join up. */
function DinaBody({ walking, waving, talking, carrying, point, pointArm }: { walking: boolean; waving: boolean; talking: boolean; carrying: boolean; point: number | null; pointArm: 'A' | 'B' }) {
  const swing = (cls: string, origin: string): React.CSSProperties => ({ transformBox: 'fill-box', transformOrigin: origin, animation: walking ? `${cls} .62s ease-in-out infinite` : undefined });
  // An arm either swings with the walk, points at something, talks with a small gesture, or hangs relaxed.
  const arm = (which: 'A' | 'B', origin: string): React.CSSProperties => {
    if (point !== null && pointArm === which) return { transformBox: 'fill-box', transformOrigin: origin, transform: `rotate(${point}deg)`, transition: `transform .45s ${POP}` };
    if (walking) return swing(which === 'A' ? 'vg-armA' : 'vg-armB', origin);
    if (talking) return { transformBox: 'fill-box', transformOrigin: origin, animation: `${which === 'A' ? 'vg-gestA' : 'vg-gestB'} 1.9s ease-in-out infinite`, transition: `transform .45s ${POP}` };
    return { transformBox: 'fill-box', transformOrigin: origin, transform: 'rotate(0deg)', transition: `transform .45s ${EASE}` };
  };
  return (
    <svg viewBox="26 130 166 390" style={{ position: 'absolute', left: 0, top: (130 - 10) * UNIT, width: DW, height: 390 * UNIT, overflow: 'visible' }} aria-hidden>
      {/* legs: high-waisted jeans and white trainers */}
      <g style={swing('vg-legA', '50% 3%')}>
        <path d="M89 300C86 370 84 440 83 496L117 496C118 440 120 370 120 312Z" fill={C.denim} />
        <path d="M93 310C91 372 89 438 88 492" stroke={C.denimHi} strokeWidth="2" fill="none" opacity=".5" strokeLinecap="round" />
        <path d="M83 490L117 490L117 496L83 496Z" fill={C.denimSh} />
        <path d="M78 506C78 499 86 496 100 496C112 496 120 500 120 506C120 510 117 512 112 512L84 512C80 512 78 510 78 506Z" fill={C.shoe} stroke={C.sole} strokeWidth="1.4" />
        <path d="M79 508.5L119 508.5" stroke={C.sole} strokeWidth="2.2" strokeLinecap="round" />
      </g>
      <g style={swing('vg-legB', '50% 3%')}>
        <path d="M151 300C154 370 156 440 157 496L123 496C122 440 120 370 120 312Z" fill={C.denim} />
        <path d="M120 314C121 372 122 438 123 492" stroke={C.denimSh} strokeWidth="2.2" fill="none" opacity=".75" strokeLinecap="round" />
        <path d="M123 490L157 490L157 496L123 496Z" fill={C.denimSh} />
        <path d="M120 506C120 500 128 496 140 496C154 496 162 499 162 506C162 510 160 512 156 512L128 512C123 512 120 510 120 506Z" fill={C.shoe} stroke={C.sole} strokeWidth="1.4" />
        <path d="M121 508.5L161 508.5" stroke={C.sole} strokeWidth="2.2" strokeLinecap="round" />
      </g>
      {/* torso: the black knit top, shoulders rounded off under her hair */}
      <path d="M100 141C88 143 76 147 70 156C66 164 68 176 72 190C78 226 86 262 88 306L152 306C154 262 162 226 168 190C172 176 174 164 170 156C164 147 152 143 140 141Z" fill={C.top} />
      <path d="M92 286C104 291 136 291 148 286" stroke={C.topHi} strokeWidth="2.4" fill="none" opacity=".7" />
      <path d="M150 143C160 145 168 150 171 158L164 164C161 156 155 151 147 148Z" fill={C.lace} opacity=".95" />
      <path d="M87 298L153 298L154 312L86 312Z" fill={C.denimSh} />
      <circle cx="120" cy="305" r="2.2" fill="#C9A45A" />
      {/* arms: long sleeves with a cream cuff */}
      {!carrying && (
        <g style={arm('A', '70% 3%')}>
          <path d="M74 152C62 158 60 200 62 240C63 270 65 296 67 318L82 318C85 280 88 230 88 176Z" fill={C.top} />
          <path d="M67.5 316.5L81.5 316.5" stroke={C.lace} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M68 320C66 328 67 338 71 343C75 347 80 345 81.5 338C83 331 82 325 81.5 320Z" fill={C.skin} stroke={C.skinSh} strokeWidth=".7" />
        </g>
      )}
      {!waving && (
        <g style={arm('B', '30% 3%')}>
          <path d="M166 152C178 158 180 200 178 240C177 270 175 296 173 318L158 318C155 280 152 230 152 176Z" fill={C.top} />
          <path d="M158.5 316.5L172.5 316.5" stroke={C.lace} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M172 320C174 328 173 338 169 343C165 347 160 345 158.5 338C157 331 158 325 158.5 320Z" fill={C.skin} stroke={C.skinSh} strokeWidth=".7" />
        </g>
      )}
    </svg>
  );
}

/**
 * Her arm around Toby when she carries him. The artwork already shows her hand holding him, so this is only the
 * sleeve: down from the shoulder, bent at the elbow and up to that hand. One arm, one hand.
 */
function HoldingArm() {
  return (
    <svg viewBox="26 130 166 390" style={{ position: 'absolute', left: 0, top: (130 - 10) * UNIT, width: DW, height: 390 * UNIT, overflow: 'visible' }} aria-hidden>
      <path d="M74 153C63 160 59 180 62 196C64 206 73 210 82 205C91 199 97 186 101 172L92 167C88 177 84 184 80 187C79 176 82 164 86 156Z" fill={C.top} />
      <path d="M69 198C76 202 86 192 94 174" stroke={C.topHi} strokeWidth="2" fill="none" strokeLinecap="round" opacity=".85" />
      <path d="M91.5 167.5L100.5 172" stroke={C.lace} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// The app's artwork is a head-and-shoulders crop whose shoulders run off both edges. Keep her head, hair and neck
// (plus Toby when she holds him, and her raised hand when she waves); the drawn body supplies shoulders of a natural width.
const u = (x: number, y: number) => `${((x - 26) * UNIT).toFixed(1)}px ${((y - 10) * UNIT).toFixed(1)}px`;
function bustClip(carrying: boolean, waving: boolean): string {
  const right = waving ? [u(200, 10), u(200, 186), u(160, 186), u(160, 170)] : [u(192, 10), u(192, 143), u(168, 143), u(167, 170)];
  // When she holds him, keep Toby and her hand from the artwork but not the wide shoulder behind them.
  const left = carrying ? [u(116, 170), u(116, 178), u(72, 178), u(50, 170), u(46, 143), u(26, 143)] : [u(77, 170), u(76, 143), u(26, 143)];
  return `polygon(${[u(26, 10), ...right, ...left].join(',')})`;
}

function Dina() {
  const d = useStore((s) => s.dina); const mode = useStore((s) => s.mode); const scale = useStore((s) => s.scale);
  const lean = d.walking ? 2.2 * d.face : 0;
  return (
    <div style={{ position: 'fixed', left: 0, top: floorOf(mode) - DH, width: DW, height: DH, transform: `translateX(${d.x}px)`, transition: `transform ${d.ms}ms ${EASE}`, zIndex: 2147483645, pointerEvents: 'none', willChange: 'transform' }}>
      <div style={{ position: 'absolute', inset: 0, transformOrigin: '50% 100%', transform: `scale(${d.shown ? scale : 0})`, opacity: d.shown ? 1 : 0, transition: `transform .45s ${POP}, opacity .25s` }}>
        <div style={{ position: 'absolute', left: '6%', right: '6%', bottom: -4, height: 11, borderRadius: '50%', background: 'rgba(43,36,32,.2)', filter: 'blur(3px)' }} />
        <div style={{ position: 'absolute', inset: 0, transformOrigin: '50% 100%', transform: `rotate(${lean}deg)`, transition: 'transform .3s ease-out' }}>
          <div style={{ position: 'absolute', inset: 0, transformOrigin: '50% 100%', animation: d.walking ? 'vg-bob .31s ease-in-out infinite' : 'vg-sway 4.6s ease-in-out infinite' }}>
            <DinaBody walking={d.walking} waving={d.waving} talking={d.talking} carrying={d.carrying} point={d.point} pointArm={d.pointArm} />
            {d.carrying && <HoldingArm />}
            <div style={{ position: 'absolute', left: 0, top: 0, width: DW, transformOrigin: `${(120 - 26) * UNIT}px ${(132 - 10) * UNIT}px`, animation: d.talking ? 'vg-nod 1.3s ease-in-out infinite' : 'vg-head 5.2s ease-in-out infinite' }}>
              <div style={{ clipPath: bustClip(d.carrying, d.waving) }}>
                <DinaArt size={DW} toby={d.carrying} animate speaking={d.talking} waving={d.waving} expression={d.waving || !d.talking ? 'beam' : 'smile'} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Toby the Maltese, side on, facing right. He trots, sits, wags, blinks, hops and barks. */
function Toby() {
  const t = useStore((s) => s.toby);
  const [blink, setBlink] = useState(false);
  useEffect(() => { let live = true; const loop = async () => { while (live) { await sleep(1700 + Math.random() * 2300); setBlink(true); await sleep(140); setBlink(false); } }; void loop(); return () => { live = false; }; }, []);
  const barking = t.bark > 0 && Date.now() - t.bark < 800;
  const [, tick] = useState(0);
  useEffect(() => { if (!t.bark) return; const id = setTimeout(() => tick((n) => n + 1), 820); return () => clearTimeout(id); }, [t.bark]);
  const leg = (x: number, far: boolean, cls: string) => (
    <g style={{ transformBox: 'fill-box', transformOrigin: '50% 0%', animation: t.walking ? `${cls} .24s ease-in-out infinite` : undefined }}>
      <path d={fluff(x, 78, 7.5, 13, 6, 0.1, x)} fill={far ? C.furSh : C.fur} stroke={C.furDeep} strokeWidth="1" />
      <ellipse cx={x + 1.5} cy="90" rx="8" ry="4.6" fill={far ? C.furSh : C.fur} stroke={C.furDeep} strokeWidth="1" />
    </g>
  );
  return (
    <div style={{ position: 'fixed', left: 0, top: 0, width: TW, transform: `translate(${t.x - TW / 2}px, ${t.y - TW * 0.74}px)`, transition: `transform ${t.ms}ms ${EASE}`, zIndex: 2147483646, pointerEvents: 'none', willChange: 'transform' }}>
      <div style={{ transformOrigin: '50% 100%', transform: `scale(${t.shown ? 1 : 0})`, opacity: t.shown ? 1 : 0, transition: `transform .3s ${POP}, opacity .2s` }}>
        <div key={`a${t.arc}`} style={{ animation: t.arc ? `vg-arc ${Math.max(300, t.ms)}ms ease-in-out 1` : undefined }}>
          <div key={`h${t.hop}`} style={{ transformOrigin: '50% 100%', animation: t.hop ? 'vg-hop .55s ease-out 1' : barking ? 'vg-yap .2s ease-in-out 4' : t.walking ? 'vg-trot .24s ease-in-out infinite' : undefined }}>
            <svg viewBox="0 0 130 100" width={TW} style={{ display: 'block', overflow: 'visible', transform: `scaleX(${t.dir})` }} aria-hidden>
              <ellipse cx="66" cy="95" rx="40" ry="4.5" fill="#2B2420" opacity=".16" />
              <g style={{ transformBox: 'fill-box', transformOrigin: '80% 90%', animation: `vg-wag ${t.walking || barking ? '.26s' : '.44s'} ease-in-out infinite` }}>
                <path d={fluff(22, 36, 13, 19, 7, 0.16, 5)} fill={C.fur} stroke={C.furDeep} strokeWidth="1.1" transform="rotate(-24 22 36)" />
              </g>
              {leg(42, true, 'vg-pawB')}{leg(86, true, 'vg-pawA')}
              <path d={fluff(62, 58, 37, 23, 11, 0.09, 2)} fill={C.fur} stroke={C.furDeep} strokeWidth="1.2" />
              <path d="M34 66C46 74 78 76 92 68" stroke={C.furSh} strokeWidth="5" fill="none" strokeLinecap="round" opacity=".8" />
              {leg(52, false, 'vg-pawA')}{leg(76, false, 'vg-pawB')}
              <g style={{ transformBox: 'fill-box', transformOrigin: '30% 80%', animation: barking ? 'vg-barkhead .2s ease-in-out 4' : t.walking ? 'vg-headbob .24s ease-in-out infinite' : 'vg-tilt 3.6s ease-in-out infinite' }}>
                <path d={fluff(98, 37, 23, 22, 10, 0.1, 9)} fill={C.fur} stroke={C.furDeep} strokeWidth="1.2" />
                <g style={{ transformBox: 'fill-box', transformOrigin: '60% 0%', animation: t.walking ? 'vg-ear .24s ease-in-out infinite' : undefined }}>
                  <path d="M82 22C74 30 72 46 76 60C78 66 84 67 87 61C90 50 90 36 88 24Z" fill={C.fur} stroke={C.furDeep} strokeWidth="1.1" />
                  <path d="M80 34C79 44 80 52 82 58" stroke={C.furSh} strokeWidth="1.6" fill="none" strokeLinecap="round" />
                </g>
                <ellipse cx="108" cy="46" rx="11" ry="8.5" fill={C.fur} stroke={C.furSh} strokeWidth="1" />
                {blink ? (
                  <><path d="M96 33Q100 36 104 33" stroke="#1A100C" strokeWidth="1.8" fill="none" strokeLinecap="round" /><path d="M110 33Q113.5 36 117 33" stroke="#1A100C" strokeWidth="1.8" fill="none" strokeLinecap="round" /></>
                ) : (
                  <><circle cx="100" cy="33" r="4" fill="#1A100C" /><circle cx="113.5" cy="33" r="3.7" fill="#1A100C" /><circle cx="98.8" cy="31.6" r="1.25" fill="#fff" /><circle cx="112.4" cy="31.7" r="1.15" fill="#fff" /></>
                )}
                <ellipse cx="116.5" cy="43" rx="4.2" ry="3.4" fill="#1A100C" />
                <circle cx="115.4" cy="42" r="1" fill="#fff" opacity=".7" />
                {barking
                  ? <path d="M107 48C108 56 116 58 119 50Z" fill="#7A2E33" stroke="#1A100C" strokeWidth="1.1" strokeLinejoin="round" />
                  : <><path d="M116.5 46.4C116 50 112 52 108 50.5" stroke="#1A100C" strokeWidth="1.3" fill="none" strokeLinecap="round" /><path d="M110.5 51C110 56 113 59.5 116 57.5C118 56 117.6 52.5 116.6 50.4Z" fill="#E98A8F" stroke="#C4636B" strokeWidth=".7" style={{ transformBox: 'fill-box', transformOrigin: '50% 0%', animation: 'vg-pant .36s ease-in-out infinite' }} /></>}
              </g>
            </svg>
          </div>
        </div>
        {/* his bark, in Spanish */}
        <div key={`b${t.bark}`} style={{ position: 'absolute', left: t.dir > 0 ? TW - 14 : undefined, right: t.dir > 0 ? undefined : TW - 14, top: -26, whiteSpace: 'nowrap', font: '800 15px/1 Inter,system-ui,sans-serif', color: '#fff', background: C.terra, padding: '6px 10px', borderRadius: 12, boxShadow: '0 4px 10px rgba(43,36,32,.3)', opacity: 0, animation: barking ? 'vg-guau .8s ease-out 1' : undefined }}>¡Guau!</div>
      </div>
    </div>
  );
}

function Bubble() {
  const b = useStore((s) => s.bubble);
  // It grows out of her mouth: the origin is the tail.
  return (
    <div style={{ position: 'fixed', left: b.x, top: 0, width: b.w, transform: `translateY(${b.y}px) scale(${b.on ? 1 : 0.2})`, opacity: b.on ? 1 : 0, transformOrigin: b.tail === 'left' ? '-10px 22px' : 'calc(100% + 10px) 22px', transition: b.on ? `transform .38s ${POP}, opacity .16s` : 'transform .18s ease-in, opacity .16s', zIndex: 2147483644, pointerEvents: 'none' }}>
      <div className="vg-bubble" data-tail={b.tail} dangerouslySetInnerHTML={{ __html: b.html }} />
    </div>
  );
}
function Ring() { const r = useStore((s) => s.ring); return <div className={`vg-ring${r.on ? ' on' : ''}${r.press ? ' press' : ''}`} style={{ left: r.x, top: r.y }} />; }
/** A soft outline around the thing to look at, with a ripple when Toby barks at it. */
function Focus() {
  const f = useStore((s) => s.focus); const pad = 7;
  const st: React.CSSProperties = { position: 'fixed', left: f.box.x - pad, top: f.box.y - pad, width: f.box.width + pad * 2, height: f.box.height + pad * 2, borderRadius: Math.min(22, (f.box.height + pad * 2) / 2), pointerEvents: 'none', zIndex: 2147483641 };
  return (
    <>
      <div style={{ ...st, border: `3px solid ${C.terra}`, boxShadow: '0 0 0 4px rgba(196,87,58,.18)', opacity: f.on ? 1 : 0, transform: `scale(${f.on ? 1 : 1.25})`, transition: `opacity .25s, transform .35s ${POP}`, animation: f.on ? 'vg-glow 1.5s ease-in-out infinite' : undefined }} />
      <div key={f.pulse} style={{ ...st, border: `3px solid ${C.terra}`, opacity: 0, animation: f.pulse ? 'vg-ripple .7s ease-out 2' : undefined }} />
    </>
  );
}
function Panel() {
  const mode = useStore((s) => s.mode); const on = useStore((s) => s.stage); const p = PANEL[mode];
  const hidden = mode === 'bottom' ? p.height + 30 : -p.height - 30;
  return <div style={{ position: 'fixed', left: 0, right: 0, top: p.top, height: p.height, transform: `translateY(${on ? 0 : hidden}px)`, transition: `transform .5s ${EASE}`, background: 'linear-gradient(180deg,rgba(255,250,242,.97) 0%,rgba(249,238,222,.985) 100%)', borderRadius: mode === 'bottom' ? '30px 30px 0 0' : '0 0 30px 30px', boxShadow: mode === 'bottom' ? '0 -10px 34px rgba(43,36,32,.22)' : '0 10px 34px rgba(43,36,32,.22)', borderTop: mode === 'bottom' ? '1px solid rgba(255,255,255,.9)' : undefined, zIndex: 2147483642, pointerEvents: 'none' }} />;
}
function Curtain() {
  const c = useStore((s) => s.curtain);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(120% 80% at 50% 78%,#FFF6E6 0%,#F7E6D0 55%,#EFD9BE 100%)', opacity: c.on ? 1 : 0, transition: 'opacity .55s', zIndex: 2147483643, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '104px 26px 0' }}>
      <div style={{ font: '600 13px Inter,system-ui,sans-serif', letterSpacing: '.14em', textTransform: 'uppercase', color: '#6B7F3A', transform: `translateY(${c.on ? 0 : 14}px)`, transition: 'transform .6s ease-out' }}>{c.kicker}</div>
      <div style={{ font: '600 40px/1.1 Fraunces,Georgia,serif', color: C.ink, marginTop: 14, transform: `translateY(${c.on ? 0 : 18}px)`, transition: 'transform .7s ease-out' }}>{c.title}</div>
      <div style={{ font: '400 17px/1.4 Inter,system-ui,sans-serif', color: '#6B5F55', marginTop: 12 }}>{c.sub}</div>
      <div style={{ position: 'absolute', left: -40, right: -40, top: PANEL.bottom.floor - 26, bottom: -40, background: '#E8D3B6', borderRadius: '50% 50% 0 0 / 46px 46px 0 0' }} />
    </div>
  );
}
function Stage() { const on = useStore((s) => s.on); return on ? <><Focus /><Panel /><Curtain /><Bubble /><Dina /><Toby /><Ring /></> : null; }

const CSS = `
@keyframes vg-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes vg-sway{0%,100%{transform:rotate(-.7deg)}50%{transform:rotate(.8deg)}}
@keyframes vg-head{0%,60%,100%{transform:rotate(0)}70%,88%{transform:rotate(2.2deg)}}
@keyframes vg-nod{0%,100%{transform:rotate(-1.4deg) translateY(0)}30%{transform:rotate(1.6deg) translateY(.6px)}60%{transform:rotate(-.4deg) translateY(-.4px)}80%{transform:rotate(1deg)}}
@keyframes vg-legA{0%,100%{transform:rotate(10deg)}50%{transform:rotate(-10deg)}}
@keyframes vg-legB{0%,100%{transform:rotate(-10deg)}50%{transform:rotate(10deg)}}
@keyframes vg-armA{0%,100%{transform:rotate(-9deg)}50%{transform:rotate(9deg)}}
@keyframes vg-armB{0%,100%{transform:rotate(9deg)}50%{transform:rotate(-9deg)}}
@keyframes vg-gestA{0%,100%{transform:rotate(4deg)}35%{transform:rotate(22deg)}55%{transform:rotate(14deg)}75%{transform:rotate(24deg)}}
@keyframes vg-gestB{0%,100%{transform:rotate(-3deg)}40%{transform:rotate(-20deg)}60%{transform:rotate(-11deg)}82%{transform:rotate(-18deg)}}
@keyframes vg-pawA{0%,100%{transform:rotate(26deg)}50%{transform:rotate(-26deg)}}
@keyframes vg-pawB{0%,100%{transform:rotate(-26deg)}50%{transform:rotate(26deg)}}
@keyframes vg-trot{0%,100%{transform:translateY(0) scaleY(1)}50%{transform:translateY(-3px) scaleY(1.03)}}
@keyframes vg-headbob{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
@keyframes vg-ear{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(9deg)}}
@keyframes vg-wag{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(16deg)}}
@keyframes vg-tilt{0%,64%,100%{transform:rotate(0)}74%,90%{transform:rotate(-10deg)}}
@keyframes vg-pant{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.78)}}
@keyframes vg-hop{0%{transform:translateY(0) scale(1.08,.9)}30%{transform:translateY(-24px) scale(.95,1.08) rotate(-7deg)}62%{transform:translateY(0) scale(1.1,.88)}80%{transform:translateY(-7px) scale(1,1)}100%{transform:translateY(0) scale(1,1)}}
@keyframes vg-arc{0%{transform:translateY(0)}50%{transform:translateY(-34px)}100%{transform:translateY(0)}}
@keyframes vg-yap{0%,100%{transform:translateY(0) scale(1,1)}50%{transform:translateY(-5px) scale(1.04,.97)}}
@keyframes vg-barkhead{0%,100%{transform:rotate(0)}50%{transform:rotate(-13deg)}}
@keyframes vg-guau{0%{opacity:0;transform:translateY(8px) scale(.4)}18%{opacity:1;transform:translateY(-2px) scale(1.12)}30%{transform:translateY(0) scale(1)}78%{opacity:1;transform:translateY(-4px) scale(1)}100%{opacity:0;transform:translateY(-14px) scale(.9)}}
@keyframes vg-glow{0%,100%{box-shadow:0 0 0 4px rgba(196,87,58,.18)}50%{box-shadow:0 0 0 9px rgba(196,87,58,.08)}}
@keyframes vg-ripple{0%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(1.5)}}
.vg-bubble{position:relative;background:#fff;color:#2B2420;font:600 15.5px/1.34 Inter,system-ui,sans-serif;padding:11px 14px;border-radius:18px;box-shadow:0 8px 22px rgba(43,36,32,.2);border:2px solid #2B2420}
.vg-bubble:after{content:"";position:absolute;top:15px;width:14px;height:14px;background:#fff;transform:rotate(45deg)}
.vg-bubble[data-tail=left]:after{left:-9px;border-left:2px solid #2B2420;border-bottom:2px solid #2B2420}
.vg-bubble[data-tail=right]:after{right:-9px;border-right:2px solid #2B2420;border-top:2px solid #2B2420}
.vg-bubble b{display:inline-grid;place-items:center;min-width:22px;height:22px;margin-right:7px;border-radius:999px;background:#C4573A;color:#fff;font-size:13px;font-weight:700;vertical-align:1px}
.vg-bubble u{text-decoration:none;color:#C4573A;font-weight:700}
.vg-ring{position:fixed;z-index:2147483647;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;background:rgba(196,87,58,.22);border:3px solid rgba(196,87,58,.95);pointer-events:none;opacity:0;transform:scale(.5);transition:opacity .2s,transform .35s}
.vg-ring.on{opacity:1;transform:scale(1)}.vg-ring.press{transform:scale(.72);background:rgba(196,87,58,.45)}
[title^="Dina, Sam and Anneka"],[data-vg-hide]{display:none!important}
`;

// ── choreography ──
const DINA_L = 10, DINA_R = W - DW - 10;
const hits = (a: Box, b: Box, pad = 6) => a.x < b.x + b.width + pad && b.x < a.x + a.width + pad && a.y < b.y + b.height + pad && b.y < a.y + a.height + pad;
const onLeft = () => state.dina.x < W / 2 - DW / 2;
/** Where Toby sits when he is with her: at her feet, on the side facing the middle of the screen. */
const tobyHomeX = (dinaX: number) => (dinaX < W / 2 - DW / 2 ? dinaX + DW + TW / 2 - 6 : dinaX - TW / 2 + 6);
/** Where Toby is when she holds him (his feet), so he can jump to and from her arms. */
const armsSpot = () => ({ x: state.dina.x + (72 - 26) * UNIT, y: floorOf(state.mode) - DH + (176 - 10) * UNIT });

async function dinaWalkTo(x: number) {
  const dx = x - state.dina.x; if (Math.abs(dx) < 4) return;
  const ms = Math.max(420, Math.abs(dx) / 0.17);
  set((s) => { s.dina.face = dx > 0 ? 1 : -1; s.dina.walking = true; s.dina.ms = ms; s.dina.x = x; s.dina.point = null; });
  await sleep(ms);
  set((s) => { s.dina.walking = false; s.dina.ms = 0; s.dina.face = 1; });
}
async function tobyRunTo(x: number, y: number, opts: { jump?: boolean; speed?: number } = {}) {
  x = Math.max(TW / 2 + 2, Math.min(W - TW / 2 - 2, x));
  const dx = x - state.toby.x, dy = y - state.toby.y, dist = Math.hypot(dx, dy); if (dist < 5) return;
  const ms = Math.max(240, dist / (opts.speed ?? 0.5));
  set((s) => { if (Math.abs(dx) > 6) s.toby.dir = dx > 0 ? 1 : -1; s.toby.walking = true; s.toby.sitting = false; s.toby.ms = ms; s.toby.x = x; s.toby.y = y; if (opts.jump ?? Math.abs(dy) > 30) s.toby.arc += 1; });
  await sleep(ms);
  set((s) => { s.toby.walking = false; s.toby.ms = 0; });
}
/** The two of them move to a side of the stage together: Toby scampers ahead, Dina follows. */
async function goTogether(x: number) {
  if (Math.abs(x - state.dina.x) < 4) return;
  const moves: Promise<void>[] = [];
  if (!state.dina.carrying && state.toby.shown) moves.push(tobyRunTo(tobyHomeX(x), floorOf(state.mode), { jump: false, speed: 0.36 }).then(() => set((s) => { s.toby.dir = x < W / 2 - DW / 2 ? 1 : -1; })));
  moves.push((async () => { await sleep(state.dina.carrying ? 0 : 160); await dinaWalkTo(x); })());
  await Promise.all(moves);
}
function bubbleHeight(html: string, w: number): number { const d = document.createElement('div'); d.style.cssText = `position:fixed;left:-9999px;top:0;width:${w}px`; d.innerHTML = `<div class="vg-bubble">${html}</div>`; document.body.appendChild(d); const h = d.offsetHeight; d.remove(); return h; }
/** True when there is writing or a control on the page under this box. */
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
/** A place for Toby right by the target, preferring one with nothing to read under him and outside the stage panel. */
function spotBy(box: Box): { x: number; y: number } {
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const p = PANEL[state.mode]; const panel: Box = { x: 0, y: p.top, width: W, height: p.height };
  const spot = (x: number, y: number) => ({ x, y, box: { x: x - TW / 2, y: y - TH, width: TW, height: TH } as Box });
  const all = [spot(box.x + box.width + TW / 2 + 6, cy + TH / 2), spot(box.x - TW / 2 - 6, cy + TH / 2), spot(Math.min(Math.max(cx, TW / 2 + 4), W - TW / 2 - 4), box.y + box.height + TH + 8), spot(Math.min(Math.max(cx, TW / 2 + 4), W - TW / 2 - 4), box.y - 8)];
  const fits = (s: ReturnType<typeof spot>) => s.box.x >= 2 && s.box.x + TW <= W - 2 && s.box.y >= 50 && s.y <= H - 4 && !hits(s.box, panel, -6);
  const c = all.filter(fits);
  return c.find((s) => !overText(s.box)) ?? c[0] ?? all[2];
}

const api = {
  mount() {
    if (document.getElementById('vg-root')) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const el = document.createElement('div'); el.id = 'vg-root'; document.body.appendChild(el);
    createRoot(el).render(<Stage />);
    const hide = () => !(window as unknown as { __vgNoHide?: boolean }).__vgNoHide && document.querySelectorAll('a,button,span').forEach((e) => { const t = (e.textContent || '').replace(/\s+/g, ' ').trim(); if (/^(Demo · \w+ · Switch|Log in · save everywhere|Log in|Demo data|Cambiar|Switch person ?Cambiar)$/.test(t)) (e.closest('a,button') || e).setAttribute('data-vg-hide', ''); });
    hide(); new MutationObserver(hide).observe(document.body, { childList: true, subtree: true });
  },
  /** Title card: Dina walks on with Toby in her arms, and waves. */
  async intro(kicker: string, title: string, sub: string) {
    set((s) => { Object.assign(s, fresh()); s.on = true; s.scale = 1.5; s.curtain = { on: true, kicker, title, sub }; });
    await sleep(450);
    await dinaWalkTo(W / 2 - DW / 2);
    set((s) => { s.dina.waving = true; });
  },
  /** The card lifts: she walks to her side of the stage and puts Toby down. */
  async curtainUp() {
    set((s) => { s.curtain.on = false; s.dina.waving = false; s.scale = 1; s.stage = true; });
    await sleep(350);
    await dinaWalkTo(DINA_L);
    await api.putDown();
  },
  async outro(title: string) {
    set((s) => { s.bubble.on = false; s.ring.on = false; s.focus.on = false; s.dina.point = null; });
    await api.pickUp();
    if (state.mode !== 'bottom') { set((s) => { s.dina.shown = false; }); await sleep(260); set((s) => { s.mode = 'bottom'; s.dina.x = DINA_L; }); await sleep(80); set((s) => { s.dina.shown = true; }); }
    set((s) => { s.stage = false; s.curtain = { on: true, kicker: 'Dina y Toby · Learning with Dina', title, sub: '' }; });
    await dinaWalkTo(W / 2 - DW / 2);
    set((s) => { s.scale = 1.5; s.dina.waving = true; });
  },
  /** Toby hops down from her arms and sits at her feet. */
  async putDown() {
    if (!state.dina.carrying) return;
    const a = armsSpot();
    set((s) => { s.toby.x = a.x; s.toby.y = a.y; s.toby.ms = 0; s.toby.shown = true; s.toby.dir = onLeft() ? 1 : -1; s.dina.carrying = false; });
    await sleep(60);
    await tobyRunTo(tobyHomeX(state.dina.x), floorOf(state.mode), { jump: true, speed: 0.42 });
    set((s) => { s.toby.hop += 1; });
    await sleep(300);
  },
  /** Toby jumps up into her arms. */
  async pickUp() {
    if (state.dina.carrying) return;
    const a = armsSpot();
    set((s) => { s.dina.point = null; });
    await tobyRunTo(a.x, a.y, { jump: true, speed: 0.42 });
    set((s) => { s.toby.shown = false; s.dina.carrying = true; });
    await sleep(220);
  },
  /**
   * Gets the stage ready for a target (or for no target): the panel sits at the bottom unless the thing to look at is
   * down there, and the two of them go together to the side nearer it.
   */
  async prepare(box: Box | null) {
    const mode: Mode = box && box.y + box.height > PANEL.bottom.top - 14 ? 'top' : 'bottom';
    set((s) => { s.bubble.on = false; s.dina.point = null; s.focus.on = false; });
    if (mode !== state.mode) {
      // The stage swaps ends: they pop out, the panel changes over, and they pop back in.
      set((s) => { s.dina.shown = false; s.toby.shown = false; s.stage = false; });
      await sleep(380);
      set((s) => { s.mode = mode; s.toby.y = floorOf(mode); s.toby.x = tobyHomeX(s.dina.x); s.toby.ms = 0; });
      await sleep(60);
      set((s) => { s.stage = true; });
      await sleep(360);
      set((s) => { s.dina.shown = true; s.toby.shown = !s.dina.carrying; });
      await sleep(320);
    } else if (!state.stage) { set((s) => { s.stage = true; }); await sleep(300); }
    if (box) await goTogether(box.x + box.width / 2 < W / 2 ? DINA_L : DINA_R);
  },
  /** Toby dashes to the thing to look at. Resolves when he gets there. */
  async tobyTo(box: Box) { const sp = spotBy(box); await tobyRunTo(sp.x, sp.y, { jump: true, speed: 0.62 }); set((s) => { s.toby.dir = box.x + box.width / 2 >= s.toby.x ? 1 : -1; }); },
  /** He barks at it ("¡Guau!") and it lights up. */
  bark(box: Box | null) { set((s) => { s.toby.bark = Date.now(); if (box) { s.focus = { on: true, box, pulse: s.focus.pulse + 1 }; } }); },
  /** He runs back to her. */
  async tobyHome() { if (state.dina.carrying) return; await tobyRunTo(tobyHomeX(state.dina.x), floorOf(state.mode), { jump: true, speed: 0.55 }); set((s) => { s.toby.dir = onLeft() ? 1 : -1; s.toby.sitting = true; }); },
  /** Dina starts a line: the bubble pops out of her mouth, and she points at the target if there is one. */
  speakStart(html: string, box: Box | null) {
    const left = onLeft(); const p = PANEL[state.mode];
    const w = W - DW - 30, bx = left ? state.dina.x + DW + 12 : 10, bh = bubbleHeight(html, w);
    const mouthY = floorOf(state.mode) - DH + (112 - 10) * UNIT;
    const by = Math.max(p.top + 12, Math.min(mouthY - 22, floorOf(state.mode) - TH - bh - 10));
    let point: number | null = null; let pointArm: 'A' | 'B' = 'B';
    if (box) {
      // Raise the arm nearer the target and aim it there (the arm is drawn hanging straight down).
      const tx = box.x + box.width / 2, ty = box.y + box.height / 2;
      pointArm = tx < state.dina.x + DW / 2 ? 'A' : 'B';
      const sx = state.dina.x + ((pointArm === 'A' ? 76 : 164) - 26) * UNIT, sy = floorOf(state.mode) - DH + (156 - 10) * UNIT;
      point = (Math.atan2(ty - sy, tx - sx) * 180) / Math.PI - 90;
    }
    set((s) => { s.bubble = { html, on: true, x: bx, y: by, w, tail: left ? 'left' : 'right' }; s.dina.talking = true; s.dina.point = point; s.dina.pointArm = pointArm; if (box) s.focus = { ...s.focus, on: true, box }; });
  },
  speakEnd() { set((s) => { s.dina.talking = false; }); },
  hush() { set((s) => { s.bubble.on = false; s.dina.talking = false; s.dina.point = null; s.focus.on = false; }); },
  ring(x: number, y: number) { set((s) => { s.ring = { x, y, on: true, press: false }; }); },
  press() { set((s) => { s.ring.press = true; s.focus.on = false; s.dina.point = null; if (s.toby.shown) s.toby.hop += 1; }); },
  ringOff() { set((s) => { s.ring.on = false; s.ring.press = false; }); },
  /** For stills: put everything in a given pose at once. */
  pose(p: Partial<S>) { set((s) => { Object.assign(s, p); }); },
  carrying: () => state.dina.carrying,
};
(window as unknown as { __g: typeof api }).__g = api;
if (document.body) api.mount(); else document.addEventListener('DOMContentLoaded', () => api.mount());
