// Small recording kit: phone-sized screen videos of the app with a caption pill and a tap marker.
const path = require('path'); const fs = require('fs'); const { execSync, execFileSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/';
const ART = (() => { const art = require('./dina-art.cjs'); const out = {}; for (const [k, v] of Object.entries(art)) out[k] = 'data:image/svg+xml;base64,' + Buffer.from(v.includes('xmlns=') ? v : v.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')).toString('base64'); return out; })();
// Runs inside the page: Dina and Toby as an on-screen guide. They walk to whatever is being explained and say the
// step in a speech bubble; a ring marks the exact spot to tap.
const INIT = (ART) => {
  const NAV = 84; // bottom tab bar
  const mount = () => {
    if (document.getElementById('vg-guide')) return;
    const st = document.createElement('style');
    st.textContent = `
      #vg-guide{position:fixed;left:8px;right:8px;top:0;z-index:2147483646;pointer-events:none;display:flex;align-items:flex-end;gap:2px;opacity:0;transform:translateY(600px);transition:transform .6s cubic-bezier(.3,1.25,.5,1),opacity .3s}
      #vg-guide.right{flex-direction:row-reverse}
      #vg-guide img{width:92px;height:auto;flex:none;filter:drop-shadow(0 6px 10px rgba(0,0,0,.22));animation:vg-bob 1.6s ease-in-out infinite}
      @keyframes vg-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
      #vg-bubble{position:relative;flex:1;min-width:0;margin-bottom:26px;background:#fff;color:#2B2420;font:600 15.5px/1.32 Inter,system-ui,sans-serif;padding:11px 14px;border-radius:18px;box-shadow:0 10px 28px rgba(43,36,32,.26);border:2px solid #2B2420}
      #vg-bubble:after{content:"";position:absolute;bottom:14px;left:-9px;width:14px;height:14px;background:#fff;border-left:2px solid #2B2420;border-bottom:2px solid #2B2420;transform:rotate(45deg)}
      #vg-guide.right #vg-bubble:after{left:auto;right:-9px;border:0;border-right:2px solid #2B2420;border-top:2px solid #2B2420}
      #vg-bubble b{display:inline-grid;place-items:center;min-width:22px;height:22px;margin-right:7px;border-radius:999px;background:#C4573A;color:#fff;font-size:13px;font-weight:700;vertical-align:1px}
      #vg-bubble u{text-decoration:none;color:#C4573A;font-weight:700}
      #vg-dot{position:fixed;z-index:2147483647;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;background:rgba(196,87,58,.22);border:3px solid rgba(196,87,58,.95);pointer-events:none;opacity:0;transform:scale(.5);transition:opacity .2s,transform .35s}
      #vg-dot.on{opacity:1;transform:scale(1)}
      #vg-dot.press{transform:scale(.72);background:rgba(196,87,58,.45)}
      #vg-title{position:fixed;inset:0;z-index:2147483647;background:#FBF6EE;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:28px;transition:opacity .4s;pointer-events:none}
      #vg-title img{width:210px;height:auto;margin-bottom:6px}
      #vg-title .k{font:600 13px Inter,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#6B7F3A}
      #vg-title .t{font:600 34px/1.15 Fraunces,Georgia,serif;color:#2B2420;margin-top:12px}
      #vg-title .s{font:400 17px/1.4 Inter,system-ui,sans-serif;color:#6B5F55;margin-top:12px}
      #vg-title .n{margin-top:22px;font:700 14px Inter,system-ui,sans-serif;color:#fff;background:#C4573A;border-radius:999px;padding:8px 16px}
      [title^="Dina, Sam and Anneka"],[data-vg-hide]{display:none!important}
    `;
    document.head.appendChild(st);
    const g = document.createElement('div'); g.id = 'vg-guide'; g.innerHTML = `<img alt="" src="${ART.talk}"><div id="vg-bubble"></div>`; document.body.appendChild(g);
    const dot = document.createElement('div'); dot.id = 'vg-dot'; document.body.appendChild(dot);
    const saved = sessionStorage.getItem('vg-say'); if (saved) { const o = JSON.parse(saved); window.__vgSay(o.html, null, o.y, o.right, true); }
    const hide = () => !window.__vgNoHide && document.querySelectorAll('a,button,span').forEach((el) => { const t = (el.textContent || '').replace(/\s+/g, ' ').trim(); if (/^(Demo · \w+ · Switch|Log in · save everywhere|Log in|Demo data|Cambiar|Switch person ?Cambiar)$/.test(t)) (el.closest('a,button') || el).setAttribute('data-vg-hide', ''); });
    hide(); new MutationObserver(hide).observe(document.body, { childList: true, subtree: true });
  };
  /** Dina says `html`. With a target box she walks next to it (below it when it is high on the screen, above when low). */
  window.__vgSay = (html, box, keepY, keepRight, instant) => {
    const g = document.getElementById('vg-guide'); if (!g) return;
    g.querySelector('#vg-bubble').innerHTML = html;
    const h = g.offsetHeight, H = innerHeight;
    let y, right;
    if (box) {
      const cy = box.y + box.height / 2;
      y = cy < H * 0.46 ? box.y + box.height + 10 : box.y - h - 10;
      right = box.x + box.width / 2 > innerWidth / 2;
    } else if (keepY != null) { y = keepY; right = !!keepRight; } else { y = H - NAV - h - 6; right = false; }
    y = Math.max(8, Math.min(y, H - NAV - h - 6));
    g.classList.toggle('right', right);
    if (instant) { g.style.transition = 'none'; requestAnimationFrame(() => { g.style.transition = ''; }); }
    g.style.transform = `translateY(${y}px)`; g.style.opacity = '1';
    sessionStorage.setItem('vg-say', JSON.stringify({ html, y, right }));
  };
  window.__vgHush = () => { sessionStorage.removeItem('vg-say'); const g = document.getElementById('vg-guide'); if (g) g.style.opacity = '0'; };
  window.__vgFace = (k) => { const i = document.querySelector('#vg-guide img'); if (i && ART[k]) i.src = ART[k]; };
  window.__vgArt = ART;
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  window.__vgMount = mount;
};
async function make(name, opts, steps) {
  const { title, sub, kicker = 'Learning with Dina · for students' } = opts;
  const rawDir = path.join(__dirname, 'raw', name); fs.rmSync(rawDir, { recursive: true, force: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Europe/London', locale: 'en-GB', ...(opts.context || {}) });
  await ctx.addInitScript(INIT, ART); if (opts.init) await ctx.addInitScript(opts.init);
  const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  // Frames: full-resolution screenshots taken as fast as the browser allows (about 18 a second), stitched afterwards.
  fs.mkdirSync(rawDir, { recursive: true });
  const cdp = await ctx.newCDPSession(p); const frames = []; let recording = false, alive = true;
  const loop = (async () => { while (alive) { if (!recording) { await new Promise((r) => setTimeout(r, 30)); continue; } try { const m = await cdp.send('Page.getLayoutMetrics'); const vv = m.cssVisualViewport; /* the clip is in page coordinates, so follow the scroll position */ const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 90, optimizeForSpeed: true, clip: { x: vv.pageX, y: vv.pageY, width: 390, height: 844, scale: 2 }, captureBeyondViewport: false }); const f = path.join(rawDir, `f${String(frames.length).padStart(5, '0')}.jpg`); fs.writeFileSync(f, Buffer.from(r.data, 'base64')); frames.push({ f, t: Date.now() }); } catch (e) { await new Promise((r) => setTimeout(r, 50)); } } })();
  let n = 0;
  const wait = (ms) => p.waitForTimeout(ms);
  const locOf = (loc) => (typeof loc === 'string' ? p.getByTestId(loc) : loc).first();
  /** Brings the target to a comfortable place on screen and returns where it is. */
  const settle = async (loc) => { const el = locOf(loc); await el.evaluate((e) => e.scrollIntoView({ behavior: 'instant', block: 'center' })); await wait(250); const box = await el.boundingBox(); if (!box) throw new Error('nothing there: ' + loc); return box; };
  const say = async (html, loc, ms) => { const box = loc ? await settle(loc) : null; await p.evaluate(([x, b]) => window.__vgSay(x, b), [html, box]); await wait(ms); };
  const h = {
    p, wait,
    clear: async () => { await p.evaluate(() => window.__vgHush()); },
    go: async (hash, ms = 1400) => { await p.evaluate(() => window.__vgHush && window.__vgHush()).catch(() => {}); await p.goto((opts.base || BASE) + hash); await wait(ms); await p.evaluate(() => window.__vgMount && window.__vgMount()); },
    /** A numbered step. Give the thing it is about and Dina walks over to it. */
    step: async (text, loc, ms = 1900) => { if (typeof loc === 'number') { ms = loc; loc = null; } n += 1; await say(`<b>${n}</b>${text}`, loc, ms); },
    /** Something Dina says that is not a step. */
    note: async (text, loc, ms = 2200) => { if (typeof loc === 'number') { ms = loc; loc = null; } await say(text, loc, ms); },
    tap: async (loc, after = 1200) => {
      const el = locOf(loc); let box = await el.boundingBox();
      if (!box || box.y < 60 || box.y + box.height > 760) box = await settle(loc);
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await p.evaluate(([x, y]) => { const d = document.getElementById('vg-dot'); d.style.left = x + 'px'; d.style.top = y + 'px'; d.classList.add('on'); }, [x, y]);
      await wait(700); await p.evaluate(() => document.getElementById('vg-dot').classList.add('press')); await wait(160);
      await el.click({ noWaitAfter: true }); await wait(220);
      await p.evaluate(() => document.getElementById('vg-dot')?.classList.remove('on', 'press'));
      await wait(after);
    },
    scroll: async (y, ms = 900) => { await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y); await wait(ms); },
    title: async () => {
      await p.evaluate(([k, t, s]) => { const d = document.createElement('div'); d.id = 'vg-title'; d.innerHTML = `<img alt="" src="${window.__vgArt.wave}"><div class="k">${k}</div><div class="t">${t}</div><div class="s">${s}</div>`; document.body.appendChild(d); }, [kicker, title, sub]);
      await wait(2800); await p.evaluate(() => { const d = document.getElementById('vg-title'); d.style.opacity = '0'; setTimeout(() => d.remove(), 450); }); await wait(650);
    },
    end: async (text = 'That’s it. ¡Hasta pronto!') => {
      await p.evaluate((t) => { window.__vgHush(); const d = document.createElement('div'); d.id = 'vg-title'; d.style.opacity = '0'; d.innerHTML = `<img alt="" src="${window.__vgArt.beam}"><div class="t">${t}</div><div class="n">Dina y Toby · Learning with Dina</div>`; document.body.appendChild(d); requestAnimationFrame(() => { d.style.opacity = '1'; }); }, text);
      await wait(2600);
    },
    asSam: async () => { await p.goto(BASE + '#/demo'); await wait(900); await p.getByTestId('demo-sam').click(); await wait(1500); },
    asDina: async () => { await p.goto(BASE + '#/demo'); await wait(900); await p.getByTestId('demo-dina').click(); await wait(1500); },
  };
  h.startHere = () => { recording = true; }; // everything before this is setup and is not recorded
  let failed = null;
  try { await steps(h); } catch (e) { failed = e; }
  recording = false; alive = false; await loop; await ctx.close(); await b.close();
  if (failed) { console.log(`${name}: FAILED at step ${n}: ${String(failed.message).split('\n')[0]}`); process.exitCode = 1; if (frames.length < 5) return; }
  const list = frames.map((fr, i) => `file '${fr.f}'\nduration ${(((frames[i + 1]?.t ?? fr.t + 60) - fr.t) / 1000).toFixed(3)}`).join('\n') + `\nfile '${frames[frames.length - 1].f}'\n`;
  fs.writeFileSync(path.join(rawDir, 'list.txt'), list);
  const out = path.join(__dirname, 'out', name + '.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(rawDir, 'list.txt'), '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-movflags', '+faststart', '-an', out]);
  const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim();
  console.log(`${name}: ${Number(dur).toFixed(0)}s, ${(fs.statSync(out).size / 1e6).toFixed(1)} MB, ${frames.length} frames, steps ${n}, page errors ${errors.length}${errors.length ? ' ' + errors[0] : ''}`);
  for (const fr of frames) fs.rmSync(fr.f, { force: true });
}
module.exports = { make, BASE };
