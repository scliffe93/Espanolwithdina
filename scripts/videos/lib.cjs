// Recording kit for the how-to videos: phone-sized recordings of the running app, guided by Dina and Toby.
// Dina is a whole person who walks about, talks (her mouth moves while the voice plays) and waves; Toby trots to
// whatever is being explained and hops when it is tapped. See guide/guide.tsx for the characters and voice.py for the voice.
const path = require('path'); const fs = require('fs'); const { execSync, execFileSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const buildGuide = require('./guide/build.cjs');
const BASE = 'http://localhost:4173/';
const PY = process.env.PIPER_PYTHON || path.join(__dirname, 'voice-env/venv/bin/python');
const MODEL = process.env.PIPER_MODEL || path.join(__dirname, 'voice-env/model/en_US-ljspeech-high.onnx');
const ACCENT = process.env.DINA_ACCENT || 'clear';

/** "Tap *Homework*. [es]¡Dale![/es]" -> what the bubble shows and what the voice says. */
const bubbleOf = (t) => t.replace(/\[\/?es\]/g, '').replace(/\*([^*]+)\*/g, '<u>$1</u>');
const voiceOf = (t) => t.replace(/\*/g, '');

/** A stand-in for the page while the lines are being collected: every call works and does nothing. */
const nothing = () => new Proxy(function () {}, { get: (_, k) => (k === 'then' ? undefined : nothing()), apply: () => nothing() });

async function make(name, opts, steps) {
  const { title, sub, kicker = 'Learning with Dina · for students' } = opts;
  const rawDir = path.join(__dirname, 'raw', name); fs.rmSync(rawDir, { recursive: true, force: true }); fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });

  // Pass 1: collect every spoken line, in order, and make the audio so each step can last as long as its line.
  const lines = [];
  const quiet = async () => {};
  const collect = { p: nothing(), wait: quiet, clear: quiet, go: quiet, tap: quiet, scroll: quiet, asSam: quiet, asDina: quiet, startHere: () => {},
    title: async () => { lines.push(opts.hello); }, step: async (t) => { lines.push(t); }, note: async (t) => { lines.push(t); }, end: async () => { lines.push(opts.bye.say); } };
  await steps(collect, { user: 'sam' });
  fs.writeFileSync(path.join(rawDir, 'lines.json'), JSON.stringify(Object.fromEntries(lines.map((t, i) => [`l${i}`, voiceOf(t)])), null, 1));
  execFileSync(PY, [path.join(__dirname, 'voice.py'), MODEL, path.join(rawDir, 'lines.json'), path.join(rawDir, 'voice'), '--level', ACCENT, '--speed', process.env.DINA_SPEED || '1.08'], { stdio: ['ignore', 'ignore', 'inherit'] });
  const durations = JSON.parse(fs.readFileSync(path.join(rawDir, 'voice', 'durations.json'), 'utf8'));
  // A real recording beats the made-up voice: drop l0.m4a, l1.m4a … (or .mp3/.wav) into voice-recordings/<video>/ and
  // those lines use it instead. The script to read from is written to voice-recordings/<video>/script.txt.
  const recDir = path.join(__dirname, 'voice-recordings', name); fs.mkdirSync(recDir, { recursive: true });
  fs.writeFileSync(path.join(recDir, 'script.txt'), `${title}\nRecord each line as its own file, named as shown (m4a, mp3 or wav), and save them in this folder.\n\n` + lines.map((t, i) => `l${i}  ${voiceOf(t).replace(/\[\/?es\]/g, '').replace(/<[^>]+>/g, '')}`).join('\n') + '\n');
  let recorded = 0;
  lines.forEach((_, i) => { const src = ['m4a', 'mp3', 'wav'].map((e) => path.join(recDir, `l${i}.${e}`)).find((f) => fs.existsSync(f)); if (!src) return; const dst = path.join(rawDir, 'voice', `l${i}.wav`); execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-ac', '1', '-ar', '22050', dst]); durations[`l${i}`] = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dst]).toString().trim()); recorded++; });
  if (recorded) console.log(`${name}: using ${recorded} recorded line${recorded === 1 ? '' : 's'} in place of the made-up voice`);

  // Pass 2: record.
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Europe/London', locale: 'en-GB', ...(opts.context || {}) });
  await ctx.addInitScript({ content: buildGuide() }); if (opts.init) await ctx.addInitScript(opts.init);
  const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  // Frames: screenshots at one and a half times phone size, taken as fast as the browser allows (about 20 a second), stitched afterwards.
  const cdp = await ctx.newCDPSession(p); const frames = []; const writes = []; let recording = false, alive = true;
  const loop = (async () => { while (alive) { if (!recording) { await new Promise((r) => setTimeout(r, 30)); continue; } try { const m = await cdp.send('Page.getLayoutMetrics'); const vv = m.cssVisualViewport; /* the clip is in page coordinates, so follow the scroll position */ const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 90, optimizeForSpeed: true, clip: { x: vv.pageX, y: vv.pageY, width: 390, height: 844, scale: 1.5 }, captureBeyondViewport: false }); const f = path.join(rawDir, `f${String(frames.length).padStart(5, '0')}.jpg`); frames.push({ f, t: Date.now() }); writes.push(fs.promises.writeFile(f, Buffer.from(r.data, 'base64'))); } catch (e) { await new Promise((r) => setTimeout(r, 50)); } } })();
  let n = 0, line = 0; const cues = [];
  const wait = (ms) => p.waitForTimeout(ms);
  const g = (fn, ...args) => p.evaluate(([fn, args]) => window.__g[fn](...args), [fn, args]);
  const locOf = (loc) => (typeof loc === 'string' ? p.getByTestId(loc) : loc).first();
  /** Brings the target to the upper part of the screen, clear of Dina and Toby, and returns where it is. */
  const settle = async (loc) => {
    const el = locOf(loc);
    await el.evaluate((e) => {
      // Things pinned to the screen (the tab bar, a sheet) do not move with the page, so leave the scroll alone.
      for (let a = e; a && a !== document.body; a = a.parentElement) { const pos = getComputedStyle(a).position; if (pos === 'fixed') return; }
      e.scrollIntoView({ behavior: 'instant', block: 'center' }); const r = e.getBoundingClientRect(); window.scrollBy({ top: r.top + r.height / 2 - 250, behavior: 'instant' });
    });
    await wait(250); const box = await el.boundingBox(); if (!box) throw new Error('nothing there: ' + loc); return box;
  };
  /** Plays the next line: Dina's mouth moves for as long as the audio lasts. */
  const speak = async () => {
    const id = `l${line++}`; const dur = durations[id] || 1.5;
    cues.push({ file: path.join(rawDir, 'voice', `${id}.wav`), at: frames.length ? Date.now() - frames[0].t : 0 });
    await g('talk', true); await wait(dur * 1000); await g('talk', false);
  };
  const say = async (text, loc, pause) => {
    const box = loc ? await settle(loc) : null;
    const moving = g('say', bubbleOf(text), box); await wait(380);
    await Promise.all([speak(), moving]); await wait(pause);
  };
  const h = {
    p, wait,
    clear: async () => { await g('hush'); },
    go: async (hash, ms = 1400) => { await p.evaluate(() => window.__g && window.__g.hush()).catch(() => {}); await p.goto((opts.base || BASE) + hash); await wait(ms); },
    /** A numbered step. Give the thing it is about and Toby trots over to it. */
    step: async (text, loc, pause = 450) => { if (typeof loc === 'number') { pause = loc; loc = null; } n += 1; await say(`<b>${n}</b>${text}`, loc, pause); },
    /** Something Dina says that is not a step. */
    note: async (text, loc, pause = 450) => { if (typeof loc === 'number') { pause = loc; loc = null; } await say(text, loc, pause); },
    tap: async (loc, after = 1100) => {
      const el = locOf(loc); let box = await el.boundingBox();
      if (!box || box.y < 60 || box.y + box.height > 840) box = await settle(loc);
      await g('ring', box.x + box.width / 2, box.y + box.height / 2); await wait(650);
      await g('press'); await wait(170);
      await el.click({ noWaitAfter: true }); await wait(240);
      await p.evaluate(() => window.__g && window.__g.ringOff()).catch(() => {});
      await wait(after);
    },
    scroll: async (y, ms = 900) => { await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y); await wait(ms); },
    /** The opening: Dina walks on and waves, Toby runs in, and she says hello. */
    title: async () => { await g('intro', kicker, title, sub); await wait(250); await speak(); await wait(350); await g('curtainUp'); await wait(200); },
    end: async () => { await g('outro', opts.bye.title); await wait(200); await speak(); await wait(1500); },
    asSam: async () => { await p.goto(BASE + '#/demo'); await wait(900); await p.getByTestId('demo-sam').click(); await wait(1500); },
    asDina: async () => { await p.goto(BASE + '#/demo'); await wait(900); await p.getByTestId('demo-dina').click(); await wait(1500); },
  };
  h.startHere = () => { recording = true; }; // everything before this is setup and is not recorded
  let failed = null;
  try { const extra = opts.setup ? await opts.setup() : {}; await steps(h, extra); } catch (e) { failed = e; }
  recording = false; alive = false; await loop; await Promise.all(writes); await ctx.close(); await b.close();
  if (failed) { console.log(`${name}: FAILED at step ${n}: ${String(failed.message).split('\n')[0]}`); process.exitCode = 1; if (frames.length < 5) return; }
  const list = frames.map((fr, i) => `file '${fr.f}'\nduration ${(((frames[i + 1]?.t ?? fr.t + 60) - fr.t) / 1000).toFixed(3)}`).join('\n') + `\nfile '${frames[frames.length - 1].f}'\n`;
  fs.writeFileSync(path.join(rawDir, 'list.txt'), list);
  const out = path.join(__dirname, 'out', name + '.mp4');
  // Picture from the frames; sound from each spoken line placed at the moment it was said.
  const args = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(rawDir, 'list.txt')];
  for (const c of cues) args.push('-i', c.file);
  const mix = cues.map((c, i) => `[${i + 1}:a]adelay=${Math.max(0, Math.round(c.at))}:all=1[a${i}]`).join(';') + (cues.length ? `;${cues.map((_, i) => `[a${i}]`).join('')}amix=inputs=${cues.length}:normalize=0,volume=1.6,alimiter=limit=0.95[a]` : '');
  args.push('-filter_complex', `[0:v]fps=30,scale=720:1558:flags=lanczos,format=yuv420p[v]${mix ? ';' + mix : ''}`, '-map', '[v]');
  if (cues.length) args.push('-map', '[a]', '-c:a', 'aac', '-b:a', '112k', '-ar', '44100');
  args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-movflags', '+faststart', out);
  execFileSync('ffmpeg', args);
  const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim();
  console.log(`${name}: ${Number(dur).toFixed(0)}s, ${(fs.statSync(out).size / 1e6).toFixed(1)} MB, ${frames.length} frames (${(frames.length / Number(dur)).toFixed(0)}/s), ${cues.length} spoken lines, steps ${n}, page errors ${errors.length}${errors.length ? ' ' + errors[0] : ''}`);
  for (const fr of frames) fs.rmSync(fr.f, { force: true });
}
module.exports = { make, BASE };
