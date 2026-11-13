// The rig: poses Dina and Toby every frame. They are never keyframed by hand; each joint follows a target through a
// spring (so movement eases in, overshoots a touch and settles), walk cycles come from how far they have travelled,
// and loose things (hair, ears, tail) lag behind and catch up. Dina's mouth follows the loudness of the actual voice.
import { DINA, dinaSvg, mouthMarkup, tobySvg } from './characters';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
const rad = (d: number) => (d * Math.PI) / 180;
/** Repeatable "random": the same sequence every recording. */
let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

/** A value that chases a target like a weight on a spring. */
export class Spring {
  v = 0; t: number;
  constructor(public x: number, public k = 120, public c = 16) { this.t = x; }
  step(dt: number) { const n = Math.max(1, Math.ceil(dt / 0.008)); const h = dt / n; for (let i = 0; i < n; i++) { this.v += ((this.t - this.x) * this.k - this.v * this.c) * h; this.x += this.v * h; } return this.x; }
  snap(v: number) { this.x = this.t = v; this.v = 0; }
}

export const DINA_SCALE = 0.66; // screen pixels per unit
export const TOBY_SCALE = 0.62;

export class DinaRig {
  el: HTMLDivElement; private inner: HTMLDivElement; private p: Record<string, SVGElement> = {};
  x = -90; floor = 832; targetX = -90; vx = 0; phase = 0; dir: 1 | -1 = 1;
  shown = true; talking = false; waving = false; carrying = true; heldShown = true;
  point: { x: number; y: number } | null = null; pointArm: 'A' | 'B' = 'B';
  env: number[] | null = null; envAt = 0;
  private walk = 0; private scale = new Spring(1, 90, 14); private pop = new Spring(1, 160, 17);
  private arm = { A: { a: new Spring(5, 130, 15), b: new Spring(9, 150, 15) }, B: { a: new Spring(5, 130, 15), b: new Spring(9, 150, 15) } };
  private tilt = new Spring(0, 60, 11); private lookX = new Spring(0, 70, 13); private lookY = new Spring(0, 70, 13);
  private mouth = new Spring(0, 520, 34); private brow = new Spring(0, 160, 16); private lean = new Spring(0, 70, 12);
  private curtA = new Spring(0, 55, 6.5); private curtB = new Spring(0, 55, 6.5); private back = new Spring(0, 40, 6);
  private heldTilt = new Spring(0, 40, 7);
  private blinkAt = 1.2; private blink = 0; private gestureAt = 0; private gesture = 0; private wanderAt = 0; private wander = { tilt: 0, lx: 0, ly: 0 };
  private heldBlinkAt = 2.4; private mouthKey = "";

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div'); this.el.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:2147483645;pointer-events:none;will-change:transform';
    this.inner = document.createElement('div'); this.inner.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;transform-origin:0 0';
    this.inner.innerHTML = dinaSvg(); this.el.appendChild(this.inner); parent.appendChild(this.el);
    this.inner.querySelectorAll<SVGElement>('[id]').forEach((n) => { this.p[n.id] = n; });
  }
  setScale(v: number, now = false) { if (now) this.scale.snap(v); else this.scale.t = v; }
  setShown(v: boolean, now = false) { this.shown = v; if (now) this.pop.snap(v ? 1 : 0); else this.pop.t = v ? 1 : 0; }
  get moving() { return Math.abs(this.targetX - this.x) > 0.8 || Math.abs(this.vx) > 6; }
  place(x: number) { this.x = this.targetX = x; this.vx = 0; }
  /** Where a point on her body is on the screen. */
  at(ux: number, uy: number) { const s = DINA_SCALE * this.scale.x; return { x: this.x + ux * s, y: this.floor + uy * s }; }
  speak(env: number[] | null, now: number) { this.env = env; this.envAt = now; this.talking = !!env; }

  update(dt: number, t: number) {
    const P = this.p;
    // ── getting about ──
    const dx = this.targetX - this.x; const vmax = 168;
    const want = clamp(dx * 4.2, -vmax, vmax);
    this.vx += (want - this.vx) * Math.min(1, dt * 7.5);
    if (Math.abs(dx) < 0.7 && Math.abs(this.vx) < 9) { this.x = this.targetX; this.vx = 0; } else this.x += this.vx * dt;
    const speed = Math.abs(this.vx); if (speed > 4) this.dir = this.vx > 0 ? 1 : -1;
    this.walk += (clamp(speed / 80, 0, 1) - this.walk) * Math.min(1, dt * 11);
    const w = this.walk, d = this.dir;
    this.phase += (speed * dt / 66) * TAU; // one full stride every 66 px

    // ── legs: a real walk, with the knee bending as each leg comes through ──
    for (const side of ['A', 'B'] as const) {
      const ph = this.phase + (side === 'B' ? Math.PI : 0);
      const hip = 17 * Math.sin(ph) * w, knee = 42 * Math.pow(Math.max(0, Math.cos(ph)), 1.3) * w;
      const thigh = -d * (hip + knee * 0.42), shin = d * knee;
      const lift = Math.max(0, Math.cos(ph)) * w; // 1 while this foot is off the ground
      const foot = -(thigh + shin) * 0.8 + d * (-14 * lift + 10 * Math.max(0, Math.sin(ph)) * w);
      const j = DINA.hip[side];
      P[`d-th${side}`].setAttribute('transform', `translate(${j.x} ${j.y}) rotate(${thigh.toFixed(2)})`);
      P[`d-sh${side}`].setAttribute('transform', `translate(0 ${DINA.thigh}) rotate(${shin.toFixed(2)})`);
      const toe = w > 0.12 ? d : side === 'A' ? -1 : 1; // toes forward when walking, turned out a little when standing
      P[`d-ft${side}`].setAttribute('transform', `translate(0 ${DINA.shin}) rotate(${foot.toFixed(2)}) scale(${toe} 1)`);
    }
    const breathe = Math.sin(t * 1.9);
    const bob = -3.6 * (1 - Math.abs(Math.sin(this.phase))) * w + breathe * 0.7 * (1 - w);
    this.lean.t = 4.5 * d * w + (this.talking ? Math.sin(t * 1.1) * 0.8 : Math.sin(t * 0.55) * 0.9) * (1 - w);
    const lean = this.lean.step(dt);
    const shift = Math.sin(t * 0.55) * 1.3 * (1 - w); // weight moving from foot to foot
    P['d-body'].setAttribute('transform', `translate(${shift.toFixed(2)} ${bob.toFixed(2)}) rotate(${lean.toFixed(2)})`);
    P['d-torso'].setAttribute('transform', `translate(0 ${(-breathe * 0.5).toFixed(2)})`);

    // ── the voice: how loud is it right now? ──
    let loud = 0;
    if (this.talking && this.env) { const i = (t - this.envAt) * 30; const a = this.env[Math.floor(i)] ?? 0, b = this.env[Math.floor(i) + 1] ?? a; loud = a + (b - a) * (i - Math.floor(i)); }

    // ── arms ──
    if (this.talking && t > this.gestureAt) { this.gesture = (this.gesture + 1 + Math.floor(rnd() * 3)) % GESTURES.length; this.gestureAt = t + 0.5 + rnd() * 0.55; }
    for (const side of ['A', 'B'] as const) {
      const s = this.arm[side]; const sw = Math.sin(this.phase + (side === 'A' ? Math.PI : 0)); // arms swing against the legs
      let a = 5 + 1.5 * w + 6 * sw * w + breathe * 0.5, b = 9 + 5 * w + 12 * Math.max(0, sw) * w;
      if (side === 'A' && this.carrying) { a = 11; b = -99 + Math.sin(t * 1.7) * 1.5; }
      else if (side === 'B' && this.waving) { a = 92; b = 68 + 24 * Math.sin(t * 11.5); }
      else if (this.point && this.pointArm === side) {
        const sh = DINA.shoulder[side]; const o = this.at(sh.x, sh.y); const px = this.point.x - o.x, py = this.point.y - o.y;
        const total = (Math.atan2(side === 'B' ? px : -px, py) * 180) / Math.PI; a = total - 13 + Math.sin(t * 3.1) * 1.4; b = 13;
      } else if (this.talking && w < 0.3) {
        // one hand does the talking (livelier when her voice is louder); the other moves just a little
        const g = GESTURES[this.gesture]; const lead = side === 'B' || this.waving;
        if (lead) { a = g[0] + loud * 7; b = g[1] * (0.82 + loud * 0.3); } else { a = 7 + loud * 3; b = 20 + loud * 12; }
      }
      s.a.t = a; s.b.t = b;
      if (side === 'B' && this.waving) s.b.k = 420; else s.b.k = 150;
      const A = s.a.step(dt), B = s.b.step(dt); const sign = side === 'A' ? 1 : -1; const j = DINA.shoulder[side];
      const up = `translate(${j.x} ${(j.y - breathe * 0.5).toFixed(2)}) rotate(${(sign * A).toFixed(2)})`;
      P[`d-up${side}`].setAttribute('transform', up);
      P[`d-fo${side}`].setAttribute('transform', `${up} translate(0 ${DINA.upper}) rotate(${(sign * B).toFixed(2)})`);
      const pointing = !!this.point && this.pointArm === side && !(side === 'A' && this.carrying);
      (P[`d-hand${side}-open`] as SVGElement).style.display = pointing ? 'none' : '';
      (P[`d-hand${side}-point`] as SVGElement).style.display = pointing ? '' : 'none';
    }

    // ── head and face ──
    if (t > this.wanderAt) { this.wander = { tilt: (rnd() - 0.5) * 6, lx: (rnd() - 0.5) * 0.7, ly: (rnd() - 0.5) * 0.4 }; this.wanderAt = t + 1.8 + rnd() * 2.4; if (this.carrying && rnd() < 0.4) this.wander = { tilt: -5, lx: -0.8, ly: 0.7 }; }
    let lx = this.wander.lx, ly = this.wander.ly, tilt = this.wander.tilt;
    if (this.point) { const h = this.at(DINA.head.x, DINA.head.y); const px = this.point.x - h.x, py = this.point.y - h.y; const n = Math.hypot(px, py) || 1; lx = px / n; ly = py / n; tilt = lx * 5; }
    else if (w > 0.2) { lx = 0.85 * d; ly = 0.1; tilt = 2.2 * d; }
    else if (this.talking) { lx *= 0.4; ly = -0.05; tilt = Math.sin(t * 2.4) * 2.2 + (loud - 0.3) * 4; }
    this.tilt.t = tilt; this.lookX.t = lx; this.lookY.t = ly;
    const T = this.tilt.step(dt), LX = this.lookX.step(dt), LY = this.lookY.step(dt);
    const nod = this.talking ? loud * 1.6 : 0;
    P['d-head'].setAttribute('transform', `translate(${(LX * 1.4).toFixed(2)} ${(nod - breathe * 0.6).toFixed(2)}) rotate(${T.toFixed(2)} ${DINA.neck.x} ${DINA.neck.y})`);
    P['d-face'].setAttribute('transform', `translate(${(LX * 1.5).toFixed(2)} ${(LY * 1).toFixed(2)})`);
    for (const side of ['A', 'B'] as const) P[`d-pupil${side}`].setAttribute('transform', `translate(${(LX * 1.5).toFixed(2)} ${(LY * 0.9).toFixed(2)})`);
    // blinking
    if (t > this.blinkAt) { this.blink = 0.001; this.blinkAt = t + 2 + rnd() * 3.2; if (rnd() < 0.18) this.blinkAt = t + 0.34; }
    if (this.blink > 0) { this.blink += dt / 0.17; if (this.blink >= 1) this.blink = 0; }
    const lid = this.blink > 0 ? Math.sin(this.blink * Math.PI) : 0; const smileEyes = this.waving ? 0.28 : 0;
    const closed = Math.max(lid, smileEyes);
    for (const side of ['A', 'B'] as const) {
      P[`d-lid${side}`].setAttribute('transform', `translate(0 ${(-DINA.lid * (1 - closed)).toFixed(2)})`);
      (P[`d-shut${side}`] as SVGElement).style.display = closed > 0.86 ? '' : 'none';
      (P[`d-lash${side}`] as SVGElement).style.display = closed > 0.86 ? 'none' : '';
    }
    // mouth: open with the voice, smile otherwise
    this.mouth.t = this.talking ? clamp(loud * 1.25, 0, 1) : 0;
    const open = clamp(this.mouth.step(dt), 0, 1); const smile = this.waving ? 1 : this.talking ? 0.45 : 0.7;
    const mk = `${Math.round(open * 24)}/${Math.round(smile * 10)}`; // redraw only when the shape really changes
    if (mk !== this.mouthKey) { this.mouthKey = mk; P['d-mouth'].innerHTML = mouthMarkup(Math.round(open * 24) / 24, smile); }
    this.brow.t = this.talking ? clamp(loud * 1.6 - 0.25, 0, 1) : this.waving ? 0.7 : 0.15;
    const br = this.brow.step(dt);
    for (const side of ['A', 'B'] as const) P[`d-brow${side}`].setAttribute('transform', `translate(${(LX * 1.2).toFixed(2)} ${(-br * 1.7 + LY * 0.7).toFixed(2)})`);

    // ── hair: it swings a beat behind her ──
    const drag = -this.vx * 0.045 - T * 0.85 - lean * 0.8;
    this.curtA.t = drag + Math.sin(t * 1.25) * 0.5; this.curtB.t = drag + Math.sin(t * 1.25 + 1) * 0.5; this.back.t = drag * 0.55;
    P['d-curtA'].setAttribute('transform', `rotate(${(this.curtA.step(dt) * 0.6).toFixed(2)} 92 48)`);
    P['d-curtB'].setAttribute('transform', `rotate(${(this.curtB.step(dt) * 0.6).toFixed(2)} 150 60)`);
    P['d-hairBack'].setAttribute('transform', `rotate(${this.back.step(dt).toFixed(2)} 0 -330)`);

    // ── Toby in her arms ──
    const held = this.carrying && this.heldShown;
    (P['d-heldBack'] as SVGElement).style.display = held ? '' : 'none'; (P['d-heldFront'] as SVGElement).style.display = held ? '' : 'none';
    if (held) {
      this.heldTilt.t = Math.sin(t * 0.9) * 5 + (this.talking ? 4 : 0) - this.vx * 0.03;
      const ht = this.heldTilt.step(dt); const hx = DINA.held.x - 1, hy = DINA.held.y - 12;
      P['d-heldHead'].setAttribute('transform', `rotate(${ht.toFixed(2)} ${hx} ${hy})`);
      P['d-heldEarA'].setAttribute('transform', `rotate(${(-ht * 0.9 + w * Math.sin(this.phase * 2) * 6).toFixed(2)} ${hx - 14} ${hy - 22})`);
      P['d-heldEarB'].setAttribute('transform', `rotate(${(-ht * 0.9 - w * Math.sin(this.phase * 2) * 6).toFixed(2)} ${hx + 14} ${hy - 22})`);
      P['d-heldTongue'].setAttribute('transform', `translate(0 ${(Math.sin(t * 9) * 0.7).toFixed(2)})`);
      const shut = t > this.heldBlinkAt && t < this.heldBlinkAt + 0.14; if (t > this.heldBlinkAt + 0.14) this.heldBlinkAt = t + 1.8 + rnd() * 2.6;
      (P['d-heldEyes'] as SVGElement).style.display = shut ? 'none' : ''; (P['d-heldShut'] as SVGElement).style.display = shut ? '' : 'none';
    }

    // ── where she is ──
    const sc = DINA_SCALE * this.scale.step(dt) * clamp(this.pop.step(dt), 0, 1.3);
    this.el.style.transform = `translate(${this.x.toFixed(2)}px, ${this.floor}px)`;
    this.inner.style.transform = `scale(${sc.toFixed(4)})`; this.inner.style.opacity = this.pop.x < 0.05 ? '0' : '1';
    P['d-shadow'].setAttribute('rx', (46 - w * 4).toFixed(1));
  }
}
/** Ways her talking hand moves: how far the arm lifts away from her, and how much the elbow bends. */
const GESTURES: [number, number][] = [[12, 62], [20, 86], [9, 48], [27, 74], [15, 98], [8, 70]];

export class TobyRig {
  el: HTMLDivElement; private inner: HTMLDivElement; private p: Record<string, SVGElement> = {};
  x = -120; y = 832; dir: 1 | -1 = 1; shown = false; lookUp = 0;
  private path: { x0: number; y0: number; x1: number; y1: number; t: number; dur: number; arc: number; done?: () => void } | null = null;
  private phase = 0; private run = 0; private vx = 0; private vy = 0; private still = 0;
  private sit = new Spring(0, 70, 12); private ear = new Spring(0, 60, 6); private squash = new Spring(1, 300, 13); private pop = new Spring(0, 170, 17); private head = new Spring(0, 110, 13);
  private barkAt = -9; private hop: { t: number; dur: number; h: number } | null = null; private blinkAt = 1.9; private tiltAt = 0; private tilt = 0; private air = 0;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div'); this.el.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:2147483646;pointer-events:none;will-change:transform';
    this.inner = document.createElement('div'); this.inner.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;transform-origin:0 0';
    this.inner.innerHTML = tobySvg(); this.el.appendChild(this.inner); parent.appendChild(this.el);
    this.inner.querySelectorAll<SVGElement>('[id]').forEach((n) => { this.p[n.id] = n; });
  }
  get moving() { return !!this.path; }
  place(x: number, y: number) { this.x = x; this.y = y; this.path = null; this.vx = this.vy = 0; }
  setShown(v: boolean, now = false) { this.shown = v; if (now) this.pop.snap(v ? 1 : 0); else this.pop.t = v ? 1 : 0; }
  /** Runs (or leaps, with `arc`) to a spot. Resolves when he lands. */
  moveTo(x: number, y: number, opts: { speed?: number; arc?: number } = {}): Promise<void> {
    const dist = Math.hypot(x - this.x, y - this.y); if (dist < 3) return Promise.resolve();
    if (Math.abs(x - this.x) > 6) this.dir = x > this.x ? 1 : -1;
    return new Promise((done) => { this.path = { x0: this.x, y0: this.y, x1: x, y1: y, t: 0, dur: Math.max(0.24, dist / (opts.speed ?? 330)), arc: opts.arc ?? 0, done }; });
  }
  bark(t: number) { this.barkAt = t; }
  jump(h = 22) { this.hop = { t: 0, dur: 0.46, h }; }

  update(dt: number, t: number) {
    const P = this.p; let lift = 0; const px = this.x, py = this.y;
    if (this.path) {
      const q = this.path; q.t += dt; const u = clamp(q.t / q.dur, 0, 1); const e = u * u * u * (u * (u * 6 - 15) + 10); // ease in and out
      this.x = q.x0 + (q.x1 - q.x0) * e; this.y = q.y0 + (q.y1 - q.y0) * e; lift = q.arc * 4 * u * (1 - u);
      if (u >= 1) { this.path = null; this.squash.v = -2.4; q.done?.(); }
    }
    this.vx = (this.x - px) / Math.max(dt, 1e-4); this.vy = (this.y - py) / Math.max(dt, 1e-4);
    const speed = Math.hypot(this.vx, this.vy);
    this.run += (clamp(speed / 150, 0, 1) - this.run) * Math.min(1, dt * 14); const r = this.run;
    this.phase += (speed * dt / 40) * TAU;
    this.still = speed < 3 ? this.still + dt : 0;
    if (this.hop) { this.hop.t += dt; const u = this.hop.t / this.hop.dur; if (u >= 1) { this.hop = null; this.squash.v = -2.6; } else { lift += this.hop.h * 4 * u * (1 - u); if (u < 0.12) this.squash.v = 3; } }
    this.air += ((lift > 6 ? 1 : 0) - this.air) * Math.min(1, dt * 16); const air = this.air;

    // sitting down when he has been still for a moment
    this.sit.t = this.still > 0.55 && !this.hop ? 1 : 0; const sit = clamp(this.sit.step(dt), 0, 1.1);
    // legs: trot on the ground, tucked in the air
    const a = 34 * Math.sin(this.phase) * r * (1 - air);
    const leg = (id: string, x: number, ang: number, hind: boolean) => P[id].setAttribute('transform', `translate(${x} -24) rotate(${(ang + air * (hind ? 38 : -38)).toFixed(2)}) scale(1 ${(hind ? 1 - 0.5 * sit : 1).toFixed(3)})`);
    leg('t-legFN', 20, a, false); leg('t-legHF', -28, a, true); leg('t-legFF', 30, -a, false); leg('t-legHN', -18, -a, true);
    // body: bobs and stretches as he runs, squashes when he lands
    const sq = this.squash.step(dt); this.squash.t = 1;
    const bark = this.barkPulse(t);
    const bob = -3.2 * Math.abs(Math.sin(this.phase)) * r - bark * 3.5;
    const pitch = 3.6 * Math.sin(this.phase * 2) * r - sit * 12 - air * clamp(this.vy * 0.03, -14, 14) - bark * 4;
    const sx = 1 + 0.06 * Math.sin(this.phase * 2) * r + (1 - sq) * 0.5, sy = sq - 0.05 * Math.sin(this.phase * 2) * r;
    P['t-all'].setAttribute('transform', `translate(0 ${(bob + sit * 5).toFixed(2)}) rotate(${pitch.toFixed(2)} 18 -6) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`);
    // head: looks up when sitting, jerks up to bark, tilts now and then
    if (t > this.tiltAt) { this.tilt = rnd() < 0.5 ? (rnd() - 0.5) * 22 : 0; this.tiltAt = t + 1.4 + rnd() * 2.6; }
    this.head.t = -bark * 20 + sit * (-10 * this.lookUp + this.tilt * 0.6) + 4 * Math.sin(this.phase * 2 + 0.8) * r - air * 8;
    P['t-head'].setAttribute('transform', `translate(30 -44) rotate(${this.head.step(dt).toFixed(2)} -4 10)`);
    // ear flaps back as he runs and bounces when he lands; tail wags faster when he is excited
    this.ear.t = clamp(r * 26 + air * 30 + (1 - sq) * 60 - bark * 16, -30, 55);
    P['t-ear'].setAttribute('transform', `translate(-9 -24) rotate(${this.ear.step(dt).toFixed(2)})`);
    const excited = r > 0.2 || bark > 0 || t - this.barkAt < 1.2 || this.hop; const wag = Math.sin(t * (excited ? 17 : 7.5)) * (excited ? 22 : 13);
    P['t-tail'].setAttribute('transform', `translate(-36 -38) rotate(${(wag - r * 14 + sit * 10).toFixed(2)})`);
    // face
    const shut = t > this.blinkAt && t < this.blinkAt + 0.13; if (t > this.blinkAt + 0.13) this.blinkAt = t + 1.6 + rnd() * 2.8;
    (P['t-eyes'] as SVGElement).style.display = shut ? 'none' : ''; (P['t-shut'] as SVGElement).style.display = shut ? '' : 'none';
    (P['t-mouthOpen'] as SVGElement).style.display = bark > 0.3 ? '' : 'none'; (P['t-mouthShut'] as SVGElement).style.display = bark > 0.3 ? 'none' : '';
    P['t-tongue'].setAttribute('transform', `translate(0 ${(Math.sin(t * 10) * 0.8).toFixed(2)})`);
    // where he is
    const pop = clamp(this.pop.step(dt), 0, 1.25);
    this.el.style.transform = `translate(${this.x.toFixed(2)}px, ${(this.y - lift).toFixed(2)}px)`;
    this.inner.style.transform = `scale(${(TOBY_SCALE * pop * this.dir).toFixed(4)}, ${(TOBY_SCALE * pop).toFixed(4)})`; this.inner.style.opacity = pop < 0.05 ? '0' : '1';
    P['t-shadow'].setAttribute('transform', `translate(0 ${(lift / TOBY_SCALE).toFixed(1)}) scale(${(1 - Math.min(0.5, lift / 90)).toFixed(3)})`);
  }
  /** 1 during each of the two yips of his bark, 0 otherwise. */
  private barkPulse(t: number) { const b = t - this.barkAt; const p = (a: number, z: number) => (b > a && b < z ? Math.sin(((b - a) / (z - a)) * Math.PI) : 0); return Math.max(p(0.02, 0.15), p(0.225, 0.375)); }
}
void rad;
