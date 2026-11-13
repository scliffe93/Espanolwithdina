// The on-screen guides for the how-to videos, injected into the page being recorded.
//
//  • They have their own stage: a panel that slides in, so they stand on it and not on the app's words.
//  • They stay together. Toby runs a step ahead of Dina, sits at her feet, and sometimes rides in her arms.
//  • Toby points things out: he dashes to the thing to look at, barks "¡Guau!", and runs back to her.
//  • Dina walks, talks (her mouth follows the voice), gestures, points and waves.
// The drawings are in characters.ts and the way they move is in rig.ts; this file is the stage and the choreography.
import { C, DINA } from './characters';
import { DINA_SCALE, DinaRig, TOBY_SCALE, TobyRig } from './rig';

const W = 390, H = 844;
const PANEL = { bottom: { top: 610, floor: 832, height: H - 610 }, top: { top: 0, floor: 252, height: 262 } } as const;
type Mode = keyof typeof PANEL;
type Box = { x: number; y: number; width: number; height: number };
const EASE = 'cubic-bezier(.45,.05,.35,1)', POP = 'cubic-bezier(.3,1.5,.5,1)';
const HALF = 40; // half of Dina's width on screen, for keeping things clear of her
const DINA_L = 12 + HALF, DINA_R = W - 12 - HALF;
const TW = 110 * TOBY_SCALE, TH = 80 * TOBY_SCALE;

const CSS = `
.vg-bubble{position:relative;background:#fff;color:#2B2420;font:600 15.5px/1.34 Inter,system-ui,sans-serif;padding:11px 14px;border-radius:18px;box-shadow:0 8px 22px rgba(43,36,32,.2);border:2px solid #2B2420}
.vg-bubble:after{content:"";position:absolute;top:15px;width:14px;height:14px;background:#fff;transform:rotate(45deg)}
.vg-bubble[data-tail=left]:after{left:-9px;border-left:2px solid #2B2420;border-bottom:2px solid #2B2420}
.vg-bubble[data-tail=right]:after{right:-9px;border-right:2px solid #2B2420;border-top:2px solid #2B2420}
.vg-bubble b{display:inline-grid;place-items:center;min-width:22px;height:22px;margin-right:7px;border-radius:999px;background:#C4573A;color:#fff;font-size:13px;font-weight:700;vertical-align:1px}
.vg-bubble u{text-decoration:none;color:#C4573A;font-weight:700}
#vg-ring{position:fixed;z-index:2147483647;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;background:rgba(196,87,58,.22);border:3px solid rgba(196,87,58,.95);pointer-events:none;opacity:0;transform:scale(.5);transition:opacity .2s,transform .35s}
#vg-ring.on{opacity:1;transform:scale(1)}#vg-ring.press{transform:scale(.7);background:rgba(196,87,58,.5)}
@keyframes vg-glow{0%,100%{box-shadow:0 0 0 4px rgba(196,87,58,.18)}50%{box-shadow:0 0 0 10px rgba(196,87,58,.07)}}
@keyframes vg-ripple{0%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(1.55)}}
@keyframes vg-guau{0%{opacity:0;transform:translateY(8px) scale(.3)}16%{opacity:1;transform:translateY(-3px) scale(1.14)}28%{transform:translateY(0) scale(1)}76%{opacity:1;transform:translateY(-4px) scale(1)}100%{opacity:0;transform:translateY(-16px) scale(.9)}}
[title^="Dina, Sam and Anneka"],[data-vg-hide]{display:none!important}
`;

// ── the clock: everything waits on animation time, so a recording that steps time frame by frame stays in step ──
let now = 0; const waiters: { at: number; go: () => void }[] = [];
const sleep = (ms: number) => new Promise<void>((go) => waiters.push({ at: now + ms / 1000, go }));

let dina: DinaRig, toby: TobyRig;
let mode: Mode = 'bottom';
const el: Record<string, HTMLElement> = {};
const make = (id: string, css: string, html = '') => { const d = document.createElement('div'); d.id = id; d.style.cssText = css; d.innerHTML = html; document.getElementById('vg-root')!.appendChild(d); el[id] = d; return d; };

// What has to survive a page reload in the middle of a video.
interface Saved { on: boolean; mode: Mode; stage: boolean; dinaX: number; carrying: boolean; tobyX: number; tobyY: number; tobyShown: boolean; tobyDir: 1 | -1; curtain: string[] | null }
const save = () => { try { sessionStorage.setItem('vg3', JSON.stringify({ on: el['vg-root'].style.display !== 'none', mode, stage: stageOn, dinaX: dina.targetX, carrying: dina.carrying, tobyX: toby.x, tobyY: toby.y, tobyShown: toby.shown, tobyDir: toby.dir, curtain: curtainText } satisfies Saved)); } catch { /* private mode */ } };
let stageOn = false; let curtainText: string[] | null = null;

function setMode(m: Mode) { mode = m; dina.floor = PANEL[m].floor; const p = PANEL[m]; const s = el['vg-panel'].style; s.top = `${p.top}px`; s.height = `${p.height}px`; s.borderRadius = m === 'bottom' ? '30px 30px 0 0' : '0 0 30px 30px'; s.boxShadow = m === 'bottom' ? '0 -10px 34px rgba(43,36,32,.22)' : '0 10px 34px rgba(43,36,32,.22)'; setStage(stageOn, true); }
function setStage(on: boolean, instant = false) { stageOn = on; const p = PANEL[mode]; const s = el['vg-panel'].style; s.transition = instant ? 'none' : `transform .5s ${EASE}`; s.transform = `translateY(${on ? 0 : mode === 'bottom' ? p.height + 30 : -p.height - 30}px)`; }
function setCurtain(text: string[] | null) {
  curtainText = text; const c = el['vg-curtain']; c.style.opacity = text ? '1' : '0';
  if (text) { (c.querySelector('.k') as HTMLElement).textContent = text[0]; (c.querySelector('.t') as HTMLElement).textContent = text[1]; (c.querySelector('.s') as HTMLElement).textContent = text[2]; }
}
function bubble(html: string | null, x = 0, y = 0, w = 200, tail: 'left' | 'right' = 'left') {
  const b = el['vg-bubble']; const s = b.style;
  if (html === null) { s.transition = 'transform .18s ease-in, opacity .16s'; s.opacity = '0'; s.transform = `translateY(${b.dataset.y ?? 0}px) scale(.2)`; return; }
  b.innerHTML = `<div class="vg-bubble" data-tail="${tail}">${html}</div>`; b.dataset.y = String(y);
  s.transition = 'none'; s.left = `${x}px`; s.width = `${w}px`; s.transformOrigin = tail === 'left' ? '-10px 22px' : 'calc(100% + 10px) 22px'; s.transform = `translateY(${y}px) scale(.2)`; s.opacity = '0';
  void b.offsetWidth; // it grows out of her mouth
  s.transition = `transform .38s ${POP}, opacity .16s`; s.transform = `translateY(${y}px) scale(1)`; s.opacity = '1';
}
function focus(box: Box | null, ripple = false) {
  const f = el['vg-focus'], r = el['vg-ripple']; const pad = 7;
  if (!box) { f.style.opacity = '0'; f.style.animation = ''; return; }
  for (const d of [f, r]) { d.style.left = `${box.x - pad}px`; d.style.top = `${box.y - pad}px`; d.style.width = `${box.width + pad * 2}px`; d.style.height = `${box.height + pad * 2}px`; d.style.borderRadius = `${Math.min(22, (box.height + pad * 2) / 2)}px`; }
  f.style.opacity = '1'; f.style.transform = 'scale(1)'; f.style.animation = 'vg-glow 1.5s ease-in-out infinite';
  if (ripple) { r.style.animation = 'none'; void r.offsetWidth; r.style.animation = 'vg-ripple .7s ease-out 2'; }
}

// ── helpers for the choreography ──
const hits = (a: Box, b: Box, pad = 6) => a.x < b.x + b.width + pad && b.x < a.x + a.width + pad && a.y < b.y + b.height + pad && b.y < a.y + a.height + pad;
const onLeft = () => dina.targetX < W / 2;
const tobyHomeX = (dx: number) => (dx < W / 2 ? dx + HALF + TW / 2 - 4 : dx - HALF - TW / 2 + 4);
const armsSpot = () => dina.at(DINA.held.x, DINA.held.y + 20);
const until = async (ok: () => boolean) => { while (!ok()) await sleep(34); };
function bubbleHeight(html: string, w: number): number { const d = document.createElement('div'); d.style.cssText = `position:fixed;left:-9999px;top:0;width:${w}px`; d.innerHTML = `<div class="vg-bubble">${html}</div>`; document.body.appendChild(d); const h = d.offsetHeight; d.remove(); return h; }
/** True when there is writing or a control on the page under this box. */
function overText(b: Box): boolean {
  const seen = new Set<Element>();
  for (const fx of [0.15, 0.5, 0.85]) for (const fy of [0.2, 0.55, 0.9]) {
    const e = document.elementFromPoint(b.x + b.width * fx, b.y + b.height * fy); if (!e || seen.has(e)) continue; seen.add(e);
    if (e instanceof HTMLImageElement || e.closest('svg, button, a, input, select')) return true;
    for (const n of Array.from(e.childNodes)) {
      if (n.nodeType !== 3 || !n.textContent || !n.textContent.trim()) continue;
      const r = document.createRange(); r.selectNodeContents(n);
      for (const q of Array.from(r.getClientRects())) if (hits(b, { x: q.x, y: q.y, width: q.width, height: q.height }, 0)) return true;
    }
  }
  return false;
}
/** A place for Toby right by the target, preferring one with nothing to read under him and outside the stage panel. */
function spotBy(box: Box): { x: number; y: number } {
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2; const p = PANEL[mode]; const panel: Box = { x: 0, y: p.top, width: W, height: p.height };
  const spot = (x: number, y: number) => ({ x, y, box: { x: x - TW / 2, y: y - TH, width: TW, height: TH } as Box });
  const mid = Math.min(Math.max(cx, TW / 2 + 4), W - TW / 2 - 4);
  const all = [spot(box.x + box.width + TW / 2 + 4, cy + TH / 2), spot(box.x - TW / 2 - 4, cy + TH / 2), spot(mid, box.y + box.height + TH + 6), spot(mid, box.y - 6)];
  const fits = (s: ReturnType<typeof spot>) => s.box.x >= 2 && s.box.x + TW <= W - 2 && s.box.y >= 50 && s.y <= H - 4 && !hits(s.box, panel, -6);
  const c = all.filter(fits);
  return c.find((s) => !overText(s.box)) ?? c[0] ?? all[2];
}

const api = {
  /** Title card: Dina walks on with Toby in her arms, and waves. */
  async intro(kicker: string, title: string, sub: string) {
    el['vg-root'].style.display = ''; bubble(null); focus(null); setStage(false, true); setMode('bottom');
    dina.carrying = true; dina.heldShown = true; dina.point = null; dina.waving = false; dina.speak(null, now);
    dina.place(-70); dina.setScale(1.5, true); dina.setShown(true, true); toby.setShown(false, true);
    setCurtain([kicker, title, sub]); save();
    await sleep(380);
    dina.targetX = W / 2; await until(() => !dina.moving);
    dina.waving = true; await sleep(250);
  },
  /** The card lifts: she walks to her side of the stage and puts Toby down. */
  async curtainUp() {
    dina.waving = false; setCurtain(null); dina.setScale(1); setStage(true); save();
    await sleep(420);
    dina.targetX = DINA_L; await until(() => !dina.moving);
    await api.putDown();
  },
  async outro(title: string) {
    bubble(null); focus(null); dina.point = null;
    await api.pickUp();
    if (mode !== 'bottom') { dina.setShown(false); await sleep(300); setStage(false, true); setMode('bottom'); dina.place(DINA_L); dina.setShown(true); }
    setStage(false); setCurtain(['Dina y Toby · Learning with Dina', title, '']); save();
    dina.targetX = W / 2; await until(() => !dina.moving);
    dina.setScale(1.5); dina.waving = true; await sleep(450);
  },
  /** Toby hops down from her arms and sits at her feet. */
  async putDown() {
    if (!dina.carrying) return;
    const a = armsSpot(); toby.place(a.x, a.y); toby.dir = onLeft() ? 1 : -1; toby.setShown(true, true); dina.heldShown = false; dina.carrying = false;
    await toby.moveTo(tobyHomeX(dina.targetX), PANEL[mode].floor, { speed: 300, arc: 26 });
    toby.dir = onLeft() ? 1 : -1; toby.lookUp = 1; save(); await sleep(260);
  },
  /** Toby jumps up into her arms. */
  async pickUp() {
    if (dina.carrying) return;
    dina.point = null; const a = armsSpot();
    await toby.moveTo(a.x, a.y, { speed: 300, arc: 34 });
    toby.setShown(false, true); dina.carrying = true; dina.heldShown = true; save(); await sleep(240);
  },
  /** Gets the stage ready: the panel sits at the bottom unless the thing to look at is down there, and they go together to the side nearer it. */
  async prepare(box: Box | null) {
    const next: Mode = box && box.y + box.height > PANEL.bottom.top - 14 ? 'top' : 'bottom';
    bubble(null); focus(null); dina.point = null;
    if (next !== mode) {
      dina.setShown(false); toby.setShown(false); setStage(false); await sleep(420);
      setMode(next); toby.place(tobyHomeX(dina.targetX), PANEL[next].floor); setStage(true); await sleep(380);
      dina.setShown(true); if (!dina.carrying) toby.setShown(true); await sleep(340);
    } else if (!stageOn) { setStage(true); await sleep(320); }
    if (box) {
      const x = box.x + box.width / 2 < W / 2 ? DINA_L : DINA_R;
      if (Math.abs(x - dina.targetX) > 4) {
        // Toby scampers ahead; Dina follows a beat behind.
        const lead = dina.carrying ? Promise.resolve() : toby.moveTo(tobyHomeX(x), PANEL[mode].floor, { speed: 250 });
        await sleep(dina.carrying ? 0 : 170); dina.targetX = x;
        await lead; await until(() => !dina.moving); toby.dir = onLeft() ? 1 : -1;
      }
    }
    save();
  },
  /** Toby dashes to the thing to look at. */
  async tobyTo(box: Box) { toby.lookUp = 0; const sp = spotBy(box); await toby.moveTo(sp.x, sp.y, { speed: 430, arc: 30 }); toby.dir = box.x + box.width / 2 >= toby.x ? 1 : -1; },
  /** He barks at it ("¡Guau!") and it lights up. */
  bark(box: Box | null) {
    toby.bark(now); focus(box, true);
    const g = el['vg-guau']; g.style.left = `${toby.x + (toby.dir > 0 ? 14 : -74)}px`; g.style.top = `${toby.y - TH - 30}px`; g.style.animation = 'none'; void g.offsetWidth; g.style.animation = 'vg-guau .85s ease-out 1';
  },
  /** He runs back to her and sits, looking up at her. */
  async tobyHome() { if (dina.carrying) return; await toby.moveTo(tobyHomeX(dina.targetX), PANEL[mode].floor, { speed: 400, arc: 26 }); toby.dir = onLeft() ? 1 : -1; toby.lookUp = 1; save(); },
  /** Dina starts a line: the bubble pops out of her mouth, her mouth follows the voice, and she points at the target. */
  speakStart(html: string, box: Box | null, env: number[]) {
    const left = onLeft(); const p = PANEL[mode];
    const bx = left ? dina.targetX + HALF + 14 : 10, w = left ? W - bx - 10 : dina.targetX - HALF - 14 - 10, bh = bubbleHeight(html, w);
    const mouth = dina.at(DINA.mouth.x, DINA.mouth.y);
    const by = Math.max(p.top + 12, Math.min(mouth.y - 22, PANEL[mode].floor - TH - bh - 8));
    bubble(html, bx, by, w, left ? 'left' : 'right');
    if (box) { const tx = box.x + box.width / 2; dina.pointArm = tx < dina.targetX ? 'A' : 'B'; if (dina.carrying) dina.pointArm = 'B'; dina.point = { x: tx, y: box.y + box.height / 2 }; focus(box); } else dina.point = null;
    dina.speak(env, now);
  },
  speakEnd() { dina.speak(null, now); },
  /** For the hello and goodbye, which have no bubble. */
  talk(env: number[] | null) { dina.speak(env, now); },
  hush() { bubble(null); focus(null); dina.speak(null, now); dina.point = null; },
  ring(x: number, y: number) { const r = el['vg-ring']; r.style.left = `${x}px`; r.style.top = `${y}px`; r.className = 'on'; },
  press() { el['vg-ring'].className = 'on press'; focus(null); dina.point = null; if (toby.shown) toby.jump(22); },
  ringOff() { el['vg-ring'].className = ''; },
  /** For stills and tests. */
  rigs: () => ({ dina, toby }), wait: sleep,
  set(fn: string) { new Function('dina', 'toby', 'api', fn)(dina, toby, api); },
};

function mount() {
  if (document.getElementById('vg-root')) return;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const root = document.createElement('div'); root.id = 'vg-root'; root.style.display = 'none'; document.body.appendChild(root); el['vg-root'] = root;
  make('vg-focus', `position:fixed;border:3px solid ${C.terra};box-shadow:0 0 0 4px rgba(196,87,58,.18);pointer-events:none;z-index:2147483641;opacity:0;transform:scale(1.25);transition:opacity .25s, transform .35s ${POP}`);
  make('vg-ripple', `position:fixed;border:3px solid ${C.terra};pointer-events:none;z-index:2147483641;opacity:0`);
  make('vg-panel', 'position:fixed;left:0;right:0;background:linear-gradient(180deg,rgba(255,250,242,.97) 0%,rgba(249,238,222,.985) 100%);border-top:1px solid rgba(255,255,255,.9);z-index:2147483642;pointer-events:none');
  make('vg-curtain', `position:fixed;inset:0;background:radial-gradient(120% 80% at 50% 78%,#FFF6E6 0%,#F7E6D0 55%,#EFD9BE 100%);opacity:0;transition:opacity .55s;z-index:2147483643;pointer-events:none;display:flex;flex-direction:column;align-items:center;text-align:center;padding:104px 26px 0;box-sizing:border-box`,
    `<div class="k" style="font:600 13px Inter,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#6B7F3A"></div><div class="t" style="font:600 40px/1.1 Fraunces,Georgia,serif;color:${C.ink};margin-top:14px"></div><div class="s" style="font:400 17px/1.4 Inter,system-ui,sans-serif;color:#6B5F55;margin-top:12px"></div><div style="position:absolute;left:-40px;right:-40px;top:${PANEL.bottom.floor - 26}px;bottom:-40px;background:#E8D3B6;border-radius:50% 50% 0 0 / 46px 46px 0 0"></div>`);
  make('vg-bubble', 'position:fixed;left:0;top:0;opacity:0;z-index:2147483644;pointer-events:none');
  dina = new DinaRig(root); toby = new TobyRig(root);
  make('vg-guau', `position:fixed;white-space:nowrap;font:800 15px/1 Inter,system-ui,sans-serif;color:#fff;background:${C.terra};padding:6px 10px;border-radius:12px;box-shadow:0 4px 10px rgba(43,36,32,.3);opacity:0;z-index:2147483647;pointer-events:none`, '¡Guau!');
  make('vg-ring', '');
  setMode('bottom');
  // Pick up where the last page left off.
  try { const s = JSON.parse(sessionStorage.getItem('vg3') || 'null') as Saved | null; if (s && s.on) { root.style.display = ''; setMode(s.mode); setStage(s.stage, true); dina.place(s.dinaX); dina.carrying = s.carrying; dina.heldShown = s.carrying; dina.setShown(true, true); toby.place(s.tobyX, s.tobyY); toby.dir = s.tobyDir; toby.setShown(s.tobyShown, true); toby.lookUp = 1; setCurtain(s.curtain); } } catch { /* fresh start */ }
  const hide = () => !(window as unknown as { __vgNoHide?: boolean }).__vgNoHide && document.querySelectorAll('a,button,span').forEach((e) => { const t = (e.textContent || '').replace(/\s+/g, ' ').trim(); if (/^(Demo · \w+ · Switch|Log in · save everywhere|Log in|Demo data|Cambiar|Switch person ?Cambiar)$/.test(t)) (e.closest('a,button') || e).setAttribute('data-vg-hide', ''); });
  hide(); new MutationObserver(hide).observe(document.body, { childList: true, subtree: true });
  let last = performance.now();
  const tick = (ts: number) => {
    const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000)); last = ts; now += dt;
    dina.update(dt, now); toby.update(dt, now);
    for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].at <= now) waiters.splice(i, 1)[0].go();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
(window as unknown as { __g: typeof api }).__g = api;
if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
void DINA_SCALE;
