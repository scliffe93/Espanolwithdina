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

const C = { top: '#181513', topHi: '#2A2522', lace: '#E9DCC2', skin: '#ECB288', skinHi: '#F6CDAA', skinSh: '#C07E56', denim: '#3A5A85', denimSh: '#2B4567', denimHi: '#5377A6', shoe: '#FDFBF6', sole: '#D9CFBF', fur: '#FDFCFA', furSh: '#E8E1D6', furDeep: '#B9AA95', ink: '#2B2420', terra: '#C4573A' };
const W = 390, H = 844;
const DW = 88, UNIT = DW / 166, DH = Math.round(506 * UNIT); // Dina is drawn in the artwork's units: x 26..192, y 10..516
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

// ── Dina, whole ──
// She is one picture. The app's artwork draws her head, hair, neck and (when she holds him) Toby; the rest of her is
// drawn here *inside that same picture*, with its colours and soft shading, so there is no join at the shoulders.
// Units are the artwork's own: her head is centred on x = 120 and the picture runs from y = 10 down to her feet.
type Paint = (name: string) => string;
const FIG_H = 506;
const SHOULDER = { A: { x: 71, y: 168 }, B: { x: 169, y: 168 } }; // A is the arm on the left of the picture
const UPPER = 72, FORE = 66; // arm lengths: shoulder to elbow, elbow to wrist
const TORSO = 'M104 141.7C92 144.5 78 149 68 156C62 161 61 170 64 180C70 200 80 222 84 248C85 268 83 288 81 308L159 308C157 288 155 268 156 248C160 222 170 200 176 180C179 170 178 161 172 156C162 149 148 144.5 138 141.7Z';

/** A hand, drawn at the wrist pointing down. `point` extends the index finger; `open` is a relaxed open hand. */
function Hand({ kind, paint }: { kind: 'open' | 'point'; paint: Paint }) {
  const sk = { fill: paint('hand'), stroke: C.skinSh, strokeWidth: 0.5, strokeLinejoin: 'round' as const };
  return (
    <g>
      <path d="M-6.4 3C-10.6 4.6 -12.6 9.4 -11.4 13.6C-10.6 16 -7.8 15.6 -7.4 13.2L-6.2 8Z" {...sk} />
      {kind === 'open' ? (
        <>
          <path d="M-6.8 -1C-7.8 5 -7.6 11 -6.6 15L-6.6 23.4C-6.6 26.4 -3.9 26.6 -3.7 23.8L-3.5 25.6C-3.3 28.8 -0.5 28.8 -0.3 25.8L-0.1 26.4C0.1 29.4 3 29.2 3.1 26.2L3.2 24.6C3.5 27.4 6.3 27 6.3 24.2L6.5 15C7.6 11 7.8 5 6.8 -1Z" {...sk} />
          <path d="M-3.6 17.6L-3.6 23M-0.2 17.6L-0.2 25M3.1 17.6L3.1 24" stroke={C.skinSh} strokeWidth=".7" fill="none" strokeLinecap="round" opacity=".55" filter={paint('b03')} />
        </>
      ) : (
        <>
          <path d="M-6.8 -1C-7.8 5 -7.6 11 -6.6 15C-6.8 18.6 -4.4 20 -2.6 18.4C-1.6 20.6 1.2 20.4 1.6 18.2L1.8 15.6L6.5 15C7.6 11 7.8 5 6.8 -1Z" {...sk} />
          <path d="M1.9 13L2.1 29.4C2.2 32.8 6 32.8 6.1 29.4L6.5 13Z" {...sk} />
          <path d="M-2.6 14.6L-2.6 18M1.6 15L1.6 18" stroke={C.skinSh} strokeWidth=".7" fill="none" strokeLinecap="round" opacity=".6" filter={paint('b03')} />
        </>
      )}
      <ellipse cx="-1" cy="7" rx="4.5" ry="5" fill={C.skinHi} opacity=".35" filter={paint('b15')} />
    </g>
  );
}

interface ArmPose { s: number; e: number; hand: 'open' | 'point'; swing?: string; flick?: string }
/**
 * One arm with a shoulder and an elbow. It is drawn hanging straight down and turned at each joint; the left arm is
 * the same drawing mirrored, so the same angles mean the same thing on both sides (negative lifts it away from her body).
 */
function Arm({ side, pose, paint }: { side: 'A' | 'B'; pose: ArmPose; paint: Paint }) {
  const o = SHOULDER[side];
  const joint = (deg: number): React.CSSProperties => ({ transform: `rotate(${deg}deg)`, transformOrigin: '0px 0px', transition: `transform .5s ${EASE}` });
  const loop = (name?: string): React.CSSProperties => ({ transformOrigin: '0px 0px', animation: name });
  const upper = `M-11 -2C-12 -11.5 12 -11.5 11.5 -2C12 22 10.8 50 9.6 ${UPPER + 4}L-9.6 ${UPPER + 4}C-10.8 50 -11.6 22 -11 -2Z`;
  const fore = `M-9.8 -5C-11 -11 11 -11 9.8 -5C10 18 8.4 44 7.2 ${FORE}L-7.2 ${FORE}C-8.4 44 -10 18 -9.8 -5Z`;
  return (
    <g transform={`translate(${o.x} ${o.y}) scale(${side === 'A' ? -1 : 1} 1)`}>
      <g style={joint(pose.s)}>
        <g style={loop(pose.swing)}>
          <path d={upper} fill={paint('top')} />
          <path d={upper} fill={paint('knit')} opacity=".35" />
          <path d={`M-5 4C-6 26 -5.4 50 -4.6 ${UPPER - 2}`} stroke="#4A4440" strokeWidth="3" fill="none" opacity=".5" strokeLinecap="round" filter={paint('b2')} />
          <g transform={`translate(0 ${UPPER})`}>
            <g style={joint(pose.e)}>
              <g style={loop(pose.flick)}>
                <path d={fore} fill={paint('top')} />
                <path d={fore} fill={paint('knit')} opacity=".35" />
                <path d={`M-4 2C-4.6 22 -4 44 -3.4 ${FORE - 6}`} stroke="#4A4440" strokeWidth="2.6" fill="none" opacity=".5" strokeLinecap="round" filter={paint('b2')} />
                <path d={`M-7.2 ${FORE - 3}L7.2 ${FORE - 3}`} stroke={C.lace} strokeWidth="2.6" strokeLinecap="round" />
                <g transform={`translate(0 ${FORE}) scale(1.14)`}><Hand kind={pose.hand} paint={paint} /></g>
              </g>
            </g>
          </g>
        </g>
      </g>
    </g>
  );
}

interface Pose { walking: boolean; waving: boolean; talking: boolean; carrying: boolean; point: number | null; pointArm: 'A' | 'B' }
/** Everything below her neck: jeans and trainers, the knit top with its crochet shoulder, and her arms. */
function Body({ paint, pose }: { paint: Paint; pose: Pose }) {
  const { walking, waving, talking, carrying, point, pointArm } = pose;
  const leg = (cls: string): React.CSSProperties => ({ transformBox: 'fill-box', transformOrigin: '50% 3%', animation: walking ? `${cls} .62s ease-in-out infinite` : undefined });
  const poseOf = (side: 'A' | 'B'): ArmPose => {
    if (side === 'B' && waving) return { s: -72, e: -84, hand: 'open', flick: 'vg-wave .5s ease-in-out infinite' };
    if (point !== null && pointArm === side) return { s: point, e: -6, hand: 'point' };
    if (walking) return { s: 0, e: -14, hand: 'open', swing: `${side === 'A' ? 'vg-swingA' : 'vg-swingB'} .62s ease-in-out infinite` };
    // Talking: one hand does the talking, the other stays easy at her side.
    if (talking) return side === 'B' ? { s: -10, e: -46, hand: 'open', flick: 'vg-talkB 1.7s ease-in-out infinite' } : { s: 1, e: -16, hand: 'open', flick: 'vg-talkA 2.3s ease-in-out infinite' };
    return { s: 3, e: -7, hand: 'open' };
  };
  const legA = 'M83 304C82 370 82 440 82 498L118 498C118.5 440 120 372 120 316Z', legB = 'M157 304C158 370 158 440 158 498L122 498C121.5 440 120 372 120 316Z';
  return (
    <>
      <defs>
        <linearGradient id="vgf-denim" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#2F4B70" /><stop offset=".3" stopColor="#56799F" /><stop offset=".62" stopColor="#40618C" /><stop offset="1" stopColor="#2A4263" /></linearGradient>
        <clipPath id="vgf-torso"><path d={TORSO} /></clipPath>
        <clipPath id="vgf-legA"><path d={legA} /></clipPath>
        <clipPath id="vgf-legB"><path d={legB} /></clipPath>
      </defs>
      {/* jeans and white trainers */}
      <g style={leg('vg-legA')}>
        <path d={legA} fill="url(#vgf-denim)" />
        <g clipPath="url(#vgf-legA)" filter={paint('b2')}><path d="M88 396C96 400 108 400 116 396" stroke="#1F3350" strokeWidth="3" fill="none" opacity=".45" /><path d="M116 320L117 494" stroke="#1F3350" strokeWidth="5" opacity=".4" /></g>
        <path d="M82 491L118 491L118 498L82 498Z" fill="#2A4263" />
        <path d="M76 508C76 501 84 498 99 498C112 498 120 502 120 508C120 512 117 514 112 514L82 514C78 514 76 512 76 508Z" fill={C.shoe} stroke={C.sole} strokeWidth="1.2" />
        <path d="M77 510.6L119 510.6" stroke={C.sole} strokeWidth="2.2" strokeLinecap="round" />
      </g>
      <g style={leg('vg-legB')}>
        <path d={legB} fill="url(#vgf-denim)" />
        <g clipPath="url(#vgf-legB)" filter={paint('b2')}><path d="M124 396C132 400 144 400 152 396" stroke="#1F3350" strokeWidth="3" fill="none" opacity=".45" /><path d="M123 320L122 494" stroke="#1F3350" strokeWidth="5" opacity=".4" /></g>
        <path d="M122 491L158 491L158 498L122 498Z" fill="#2A4263" />
        <path d="M120 508C120 502 128 498 141 498C156 498 164 501 164 508C164 512 162 514 158 514L128 514C123 514 120 512 120 508Z" fill={C.shoe} stroke={C.sole} strokeWidth="1.2" />
        <path d="M121 510.6L163 510.6" stroke={C.sole} strokeWidth="2.2" strokeLinecap="round" />
      </g>
      <path d="M83 300L157 300L157.4 320L120 322L82.6 320Z" fill="url(#vgf-denim)" />
      {/* the black knit top, running straight from her neck out over her shoulders */}
      <path d={TORSO} fill={paint('top')} />
      <path d={TORSO} fill={paint('knit')} opacity=".35" />
      <g clipPath="url(#vgf-torso)">
        <g filter={paint('b2')}>
          <path d="M120 149.7C106 152 92 156 80 164" stroke="#4A4440" strokeWidth="3" fill="none" opacity=".6" />
          <path d="M170 172C164 206 158 244 158 302" stroke="#000" strokeWidth="9" fill="none" opacity=".4" />
          <path d="M74 178C82 208 87 244 86 300" stroke="#4A4440" strokeWidth="4" fill="none" opacity=".45" />
          <path d="M94 218C108 226 132 226 146 218" stroke="#000" strokeWidth="3" fill="none" opacity=".28" />
          <ellipse cx="90" cy="161" rx="9" ry="7" fill="#000" opacity=".3" /><ellipse cx="161" cy="163" rx="9" ry="7" fill="#000" opacity=".3" />
        </g>
        <path d="M81 300.5L159 300.5" stroke="#3A3532" strokeWidth=".9" opacity=".8" />
        <path d="M86 301L85.6 308M92 301L91.8 308M98 301L98 308M104 301L104 308M110 301L110 308M116 301L116 308M122 301L122 308M128 301L128 308M134 301L134 308M140 301L140 308M146 301L146.2 308M152 301L152.4 308" stroke="#3A3532" strokeWidth=".8" opacity=".7" />
      </g>
      {carrying ? (
        // The arm that holds Toby: this is the part above the elbow. He sits in front of it; the forearm comes after him.
        <>
          <path d="M62 157C54 165 49 181 49 193C50 203 58 208 66 204L80 187C82 176 84 166 86 158Z" fill={paint('top')} />
          <path d="M57 170C53 180 52 190 54 198" stroke="#4A4440" strokeWidth="3" fill="none" opacity=".5" strokeLinecap="round" filter={paint('b2')} />
        </>
      ) : <Arm side="A" pose={poseOf('A')} paint={paint} />}
      <Arm side="B" pose={poseOf('B')} paint={paint} />
      {/* the cream crochet panel over her shoulder, as in the artwork */}
      <path d="M146 144.6C157 147.6 166 151.6 172 156C178 161 179 169 177 178L169.4 178.4C171 170 170 164.4 166 161C160 156.6 152 153.2 142.6 150.6Z" fill={paint('lace')} />
      <path d="M143.4 150.8C153 153.4 160.6 156.8 166.4 161.2C170.2 164.6 171 170 169.6 178" stroke={C.lace} strokeWidth="1.4" strokeDasharray="1.2 1.4" strokeLinecap="round" fill="none" />
    </>
  );
}
/** Her forearm under Toby when she holds him: from the elbow across to the hand that curls round him. */
function HoldingForearm({ paint }: { paint: Paint }) {
  const d = 'M52 187C62 183 82 180 101 176L107.5 190C89 195 71 199 61 205C52 207 46 197 52 187Z';
  return (
    <>
      <path d={d} fill={paint('top')} />
      <path d={d} fill={paint('knit')} opacity=".35" />
      <path d="M58 190C72 186 86 183 99 180" stroke="#4A4440" strokeWidth="2.4" fill="none" opacity=".6" strokeLinecap="round" filter={paint('b15')} />
    </>
  );
}

function Dina() {
  const d = useStore((s) => s.dina); const mode = useStore((s) => s.mode); const scale = useStore((s) => s.scale);
  const lean = d.walking ? 2.2 * d.face : 0;
  const pose: Pose = { walking: d.walking, waving: d.waving, talking: d.talking, carrying: d.carrying, point: d.point, pointArm: d.pointArm };
  return (
    <div style={{ position: 'fixed', left: 0, top: floorOf(mode) - DH, width: DW, height: DH, transform: `translateX(${d.x}px)`, transition: `transform ${d.ms}ms ${EASE}`, zIndex: 2147483645, pointerEvents: 'none', willChange: 'transform' }}>
      <div style={{ position: 'absolute', inset: 0, transformOrigin: '50% 100%', transform: `scale(${d.shown ? scale : 0})`, opacity: d.shown ? 1 : 0, transition: `transform .45s ${POP}, opacity .25s` }}>
        <div style={{ position: 'absolute', left: '6%', right: '6%', bottom: -4, height: 11, borderRadius: '50%', background: 'rgba(43,36,32,.2)', filter: 'blur(3px)' }} />
        <div style={{ position: 'absolute', inset: 0, transformOrigin: '50% 100%', transform: `rotate(${lean}deg)`, transition: 'transform .3s ease-out' }}>
          <div style={{ position: 'absolute', inset: 0, transformOrigin: '50% 100%', animation: d.walking ? 'vg-bob .31s ease-in-out infinite' : 'vg-sway 4.6s ease-in-out infinite' }}>
            <DinaArt size={DW} toby={d.carrying} animate speaking={d.talking} expression={d.waving || !d.talking ? 'beam' : 'smile'}
              figure={{ height: FIG_H, body: (paint) => <Body paint={paint} pose={pose} />, arm: (paint) => <HoldingForearm paint={paint} /> }} />
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
@keyframes vg-swingA{0%,100%{transform:rotate(16deg)}50%{transform:rotate(-16deg)}}
@keyframes vg-swingB{0%,100%{transform:rotate(-16deg)}50%{transform:rotate(16deg)}}
@keyframes vg-talkA{0%,100%{transform:rotate(0)}40%{transform:rotate(-7deg)}70%{transform:rotate(-2deg)}}
@keyframes vg-talkB{0%,100%{transform:rotate(4deg)}30%{transform:rotate(-22deg)}55%{transform:rotate(-6deg)}80%{transform:rotate(-18deg)}}
@keyframes vg-wave{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(16deg)}}
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
      const sx = state.dina.x + (SHOULDER[pointArm].x - 26) * UNIT, sy = floorOf(state.mode) - DH + (SHOULDER[pointArm].y - 10) * UNIT;
      // The left arm is drawn mirrored, so its angle is measured the other way round.
      point = (Math.atan2(ty - sy, pointArm === 'A' ? sx - tx : tx - sx) * 180) / Math.PI - 90;
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
