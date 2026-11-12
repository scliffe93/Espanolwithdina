// Small recording kit: phone-sized screen videos of the app with a caption pill and a tap marker.
const path = require('path'); const fs = require('fs'); const { execSync, execFileSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/';
const INIT = () => {
  const mount = () => {
    if (document.getElementById('vg-cap')) return;
    const st = document.createElement('style');
    st.textContent = `
      #vg-cap{position:fixed;left:12px;right:12px;bottom:92px;z-index:2147483646;pointer-events:none;display:flex;justify-content:center;transition:opacity .25s}
      #vg-cap span{background:rgba(32,26,22,.94);color:#fff;font:600 16px/1.3 Inter,system-ui,sans-serif;padding:11px 16px;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,.28);max-width:100%;text-align:center}
      #vg-cap b{color:#F2C66E;font-weight:700;margin-right:6px}
      #vg-dot{position:fixed;z-index:2147483647;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;background:rgba(196,87,58,.28);border:3px solid rgba(196,87,58,.9);pointer-events:none;opacity:0;transform:scale(.6);transition:opacity .2s,transform .35s}
      #vg-dot.on{opacity:1;transform:scale(1)}
      #vg-title{position:fixed;inset:0;z-index:2147483647;background:#FBF6EE;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:32px;transition:opacity .4s;pointer-events:none}
      #vg-title .k{font:600 13px Inter,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#6B7F3A}
      #vg-title .t{font:600 34px/1.15 Fraunces,Georgia,serif;color:#2B2420;margin-top:14px}
      #vg-title .s{font:400 17px/1.4 Inter,system-ui,sans-serif;color:#6B5F55;margin-top:14px}
      #vg-title .n{margin-top:26px;font:700 14px Inter,system-ui,sans-serif;color:#fff;background:#C4573A;border-radius:999px;padding:8px 16px}
      [title^="Dina, Sam and Anneka"],[data-vg-hide]{display:none!important}
    `;
    document.head.appendChild(st);
    const cap = document.createElement('div'); cap.id = 'vg-cap'; cap.style.opacity = '0'; cap.innerHTML = '<span></span>'; document.body.appendChild(cap);
    const dot = document.createElement('div'); dot.id = 'vg-dot'; document.body.appendChild(dot);
    const saved = sessionStorage.getItem('vg-cap'); if (saved) { cap.firstChild.innerHTML = saved; cap.style.opacity = '1'; }
    // Hide demo-only chrome so the video looks like a student's own account.
    const hide = () => !window.__vgNoHide && document.querySelectorAll('a,button,span').forEach((el) => { const t = (el.textContent || '').replace(/\s+/g, ' ').trim(); if (/^(Demo · \w+ · Switch|Log in · save everywhere|Log in|Demo data|Cambiar|Switch person ?Cambiar)$/.test(t)) (el.closest('a,button') || el).setAttribute('data-vg-hide', ''); });
    hide(); new MutationObserver(hide).observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  window.__vgMount = mount;
};
async function make(name, opts, steps) {
  const { title, sub, kicker = 'Learning with Dina · for students' } = opts;
  const rawDir = path.join(__dirname, 'raw', name); fs.rmSync(rawDir, { recursive: true, force: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Europe/London', locale: 'en-GB', ...(opts.context || {}) });
  await ctx.addInitScript(INIT); if (opts.init) await ctx.addInitScript(opts.init);
  const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  // Frames: full-resolution screenshots taken as fast as the browser allows (about 18 a second), stitched afterwards.
  fs.mkdirSync(rawDir, { recursive: true });
  const cdp = await ctx.newCDPSession(p); const frames = []; let recording = false, alive = true;
  const loop = (async () => { while (alive) { if (!recording) { await new Promise((r) => setTimeout(r, 30)); continue; } try { const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 90, optimizeForSpeed: true, clip: { x: 0, y: 0, width: 390, height: 844, scale: 2 }, captureBeyondViewport: false }); const f = path.join(rawDir, `f${String(frames.length).padStart(5, '0')}.jpg`); fs.writeFileSync(f, Buffer.from(r.data, 'base64')); frames.push({ f, t: Date.now() }); } catch (e) { await new Promise((r) => setTimeout(r, 50)); } } })();
  let n = 0;
  const wait = (ms) => p.waitForTimeout(ms);
  const h = {
    p, wait,
    clear: async () => { await p.evaluate(() => { sessionStorage.removeItem('vg-cap'); const c = document.getElementById('vg-cap'); if (c) c.style.opacity = '0'; }); },
    go: async (hash, ms = 1400) => { await p.goto((opts.base || BASE) + hash); await wait(ms); await p.evaluate(() => window.__vgMount && window.__vgMount()); },
    /** Numbered step caption. */
    step: async (text, ms = 1500) => { n += 1; const html = `<b>${n}</b>${text}`; await p.evaluate((x) => { sessionStorage.setItem('vg-cap', x); const c = document.getElementById('vg-cap'); if (c) { c.firstChild.innerHTML = x; c.style.opacity = '1'; } }, html); await wait(ms); },
    note: async (text, ms = 1800) => { await p.evaluate((x) => { sessionStorage.setItem('vg-cap', x); const c = document.getElementById('vg-cap'); if (c) { c.firstChild.innerHTML = x; c.style.opacity = '1'; } }, text); await wait(ms); },
    tap: async (loc, after = 1200) => {
      const l = typeof loc === 'string' ? p.getByTestId(loc) : loc; const el = l.first();
      await el.scrollIntoViewIfNeeded(); await wait(350);
      const box = await el.boundingBox(); if (!box) throw new Error('nothing to tap: ' + loc);
      const x = box.x + box.width / 2, y = Math.min(box.y + box.height / 2, 780);
      await p.evaluate(([x, y]) => { const d = document.getElementById('vg-dot'); d.style.left = x + 'px'; d.style.top = y + 'px'; d.classList.add('on'); }, [x, y]);
      await wait(650); await el.click({ noWaitAfter: true }); await wait(250);
      await p.evaluate(() => document.getElementById('vg-dot')?.classList.remove('on'));
      await wait(after);
    },
    scroll: async (y, ms = 900) => { await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y); await wait(ms); },
    show: async (loc, ms = 900) => { const l = typeof loc === 'string' ? p.getByTestId(loc) : loc; await l.first().evaluate((el) => el.scrollIntoView({ behavior: 'instant', block: 'center' })); await wait(ms); },
    title: async () => {
      await p.evaluate(([k, t, s]) => { const d = document.createElement('div'); d.id = 'vg-title'; d.innerHTML = `<div class="k">${k}</div><div class="t">${t}</div><div class="s">${s}</div>`; document.body.appendChild(d); }, [kicker, title, sub]);
      await wait(2600); await p.evaluate(() => { const d = document.getElementById('vg-title'); d.style.opacity = '0'; setTimeout(() => d.remove(), 450); }); await wait(600);
    },
    end: async (text = 'That’s it. ¡Hasta pronto!') => {
      await p.evaluate((t) => { sessionStorage.removeItem('vg-cap'); document.getElementById('vg-cap').style.opacity = '0'; const d = document.createElement('div'); d.id = 'vg-title'; d.style.opacity = '0'; d.innerHTML = `<div class="t">${t}</div><div class="n">Learning with Dina</div>`; document.body.appendChild(d); requestAnimationFrame(() => { d.style.opacity = '1'; }); }, text);
      await wait(2200);
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
