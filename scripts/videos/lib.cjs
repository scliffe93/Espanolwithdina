// Recording kit for the how-to videos: phone-sized recordings of the running app, guided by Dina and Toby.
//
// The picture is made one frame at a time. The page's clock is paused and stepped forward exactly one thirtieth of a
// second, a screenshot is taken, and so on. Nothing can drop a frame, so the result is a true, smooth 30 frames a
// second however long each screenshot takes, and the app's own animations stay in step with the characters.
// See guide/ for the characters and their choreography, and voice.py for the voice.
const path = require('path'); const fs = require('fs'); const { execSync, execFileSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const buildGuide = require('./guide/build.cjs');
const BASE = 'http://localhost:4173/';
const PY = process.env.PIPER_PYTHON || path.join(__dirname, 'voice-env/venv/bin/python');
const MODEL = process.env.PIPER_MODEL || path.join(__dirname, 'voice-env/model/es_MX-claude-high.onnx');
const ACCENT = process.env.DINA_ACCENT || 'spanish';
const FPS = 30, FRAME = 1000 / FPS;

/** "Tap *Homework*. [es]¡Dale![/es]" -> what the bubble shows and what the voice says. */
const bubbleOf = (t) => t.replace(/\[\/?es\]/g, '').replace(/\*([^*]+)\*/g, '<u>$1</u>');
const voiceOf = (t) => t.replace(/\*/g, '');
/** A stand-in for the page while the lines are being collected: every call works and does nothing. */
const nothing = () => new Proxy(function () {}, { get: (_, k) => (k === 'then' ? undefined : nothing()), apply: () => nothing() });

/** How loud a recording is, thirty times a second, from 0 to 1. This is what Dina's mouth follows. */
function loudness(wavFile) {
  const buf = fs.readFileSync(wavFile); const data = buf.indexOf('data') + 8; const rate = buf.readUInt32LE(24);
  const n = Math.floor((buf.length - data) / 2); const per = Math.round(rate / FPS); const out = [];
  for (let i = 0; i < n; i += per) { let sum = 0, c = 0; for (let j = i; j < Math.min(n, i + per); j++) { const v = buf.readInt16LE(data + j * 2) / 32768; sum += v * v; c++; } out.push(Math.sqrt(sum / Math.max(1, c))); }
  const top = [...out].sort((a, b) => a - b)[Math.floor(out.length * 0.92)] || 1;
  return out.map((v) => Math.min(1, Math.pow(v / top, 0.7))).map((v, i, a) => +(0.25 * (a[i - 1] ?? v) + 0.5 * v + 0.25 * (a[i + 1] ?? v)).toFixed(3));
}

async function make(name, opts, steps) {
  const { title, sub, kicker = 'Learning with Dina · for students' } = opts;
  const rawDir = path.join(__dirname, 'raw', name); fs.rmSync(rawDir, { recursive: true, force: true }); fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });

  // Pass 1: collect every spoken line, in order, and make the audio so each step can last as long as its line.
  const lines = [];
  const quiet = async () => {};
  const collect = { p: nothing(), wait: quiet, clear: quiet, go: quiet, tap: quiet, click: quiet, type: quiet, select: quiet, scroll: quiet, asSam: quiet, asDina: quiet, startHere: () => {},
    title: async () => { lines.push(opts.hello); }, step: async (t) => { lines.push(t); }, note: async (t) => { lines.push(t); }, end: async () => { lines.push(opts.bye.say); } };
  await steps(collect, { user: 'sam' });
  fs.writeFileSync(path.join(rawDir, 'lines.json'), JSON.stringify(Object.fromEntries(lines.map((t, i) => [`l${i}`, voiceOf(t)])), null, 1));
  execFileSync(PY, [path.join(__dirname, 'voice.py'), MODEL, path.join(rawDir, 'lines.json'), path.join(rawDir, 'voice'), '--level', ACCENT, '--speed', process.env.DINA_SPEED || '0.97', '--steady'], { stdio: ['ignore', 'ignore', 'inherit'] });
  const durations = JSON.parse(fs.readFileSync(path.join(rawDir, 'voice', 'durations.json'), 'utf8'));
  // A real recording beats the made-up voice: drop l0.m4a, l1.m4a … (or .mp3/.wav) into voice-recordings/<video>/ and
  // those lines use it instead. The script to read from is written to voice-recordings/<video>/script.txt.
  const recDir = path.join(__dirname, 'voice-recordings', name); fs.mkdirSync(recDir, { recursive: true });
  fs.writeFileSync(path.join(recDir, 'script.txt'), `${title}\nRecord each line as its own file, named as shown (m4a, mp3 or wav), and save them in this folder.\n\n` + lines.map((t, i) => `l${i}  ${voiceOf(t).replace(/\[\/?es\]/g, '').replace(/<[^>]+>/g, '')}`).join('\n') + '\n');
  let recorded = 0;
  lines.forEach((_, i) => { const src = ['m4a', 'mp3', 'wav'].map((e) => path.join(recDir, `l${i}.${e}`)).find((f) => fs.existsSync(f)); if (!src) return; const dst = path.join(rawDir, 'voice', `l${i}.wav`); execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-ac', '1', '-ar', '22050', '-c:a', 'pcm_s16le', dst]); durations[`l${i}`] = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dst]).toString().trim()); recorded++; });
  if (recorded) console.log(`${name}: using ${recorded} recorded line${recorded === 1 ? '' : 's'} in place of the made-up voice`);
  const loud = lines.map((_, i) => loudness(path.join(rawDir, 'voice', `l${i}.wav`)));

  // Pass 2: record, one frame at a time.
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Europe/London', locale: 'en-GB', ...(opts.context || {}) });
  await ctx.addInitScript({ content: buildGuide() }); if (opts.init) await ctx.addInitScript(opts.init);
  const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  const cdp = await ctx.newCDPSession(p);
  let recording = false, count = 0; const writes = []; const started = Date.now();
  /** Moves the page's clock on by one frame and takes its picture. */
  const frame = async () => {
    await new Promise((res) => { cdp.once('Emulation.virtualTimeBudgetExpired', res); cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pauseIfNetworkFetchesPending', budget: FRAME }); });
    const m = await cdp.send('Page.getLayoutMetrics'); const vv = m.cssVisualViewport; // the clip is in page coordinates, so follow the scroll position
    const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 90, clip: { x: vv.pageX, y: vv.pageY, width: 390, height: 844, scale: 2 }, captureBeyondViewport: false });
    writes.push(fs.promises.writeFile(path.join(rawDir, `f${String(count++).padStart(5, '0')}.jpg`), Buffer.from(r.data, 'base64')));
  };
  /** Lets time pass: on camera once recording has started, in real time before that. */
  const wait = async (ms) => { if (!recording) return p.waitForTimeout(ms); for (let i = Math.max(1, Math.round(ms / FRAME)); i > 0; i--) await frame(); };
  const g = (fn, ...args) => p.evaluate(([fn, args]) => window.__g[fn](...args), [fn, args]);
  /** Starts one of the guide's moves and lets time run until it has finished. */
  const run = async (fn, ...args) => {
    await p.evaluate(([fn, args]) => { window.__vgDone = false; window.__g[fn](...args).then(() => { window.__vgDone = true; }); }, [fn, args]);
    for (let i = 0; i < 900; i++) { await wait(FRAME); if (await p.evaluate(() => window.__vgDone)) return; }
    throw new Error(`the guide never finished "${fn}"`);
  };
  const locOf = (loc) => (typeof loc === 'string' ? p.getByTestId(loc) : loc).first();
  const boxOf = async (loc) => { const box = await locOf(loc).boundingBox(); if (!box) throw new Error('nothing there: ' + loc); return box; };
  /** Brings the target to the upper part of the screen, clear of the stage panel, and returns where it is. */
  const settle = async (loc) => {
    await locOf(loc).evaluate((e) => {
      // Things pinned to the screen (the tab bar, a sheet) do not move with the page, so leave the scroll alone.
      for (let a = e; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).position === 'fixed') return;
      e.scrollIntoView({ behavior: 'instant', block: 'center' }); const r = e.getBoundingClientRect(); window.scrollBy({ top: r.top + r.height / 2 - 230, behavior: 'instant' });
    });
    await wait(200); return boxOf(loc);
  };
  let n = 0, line = 0, notes = 0; const cues = [];
  const cue = (file) => cues.push({ file, at: (count / FPS) * 1000 });
  /** Plays the next line. Returns how loud it is over time, for her mouth. */
  const nextLine = () => { const id = `l${line}`; const env = loud[line]; line += 1; return { file: path.join(rawDir, 'voice', `${id}.wav`), ms: (durations[id] || 1.5) * 1000, env }; };
  /**
   * One thing Dina says. With something to look at: the two of them go to that side of the stage, Toby dashes to it and
   * barks, and Dina points and talks while he runs back. With nothing to look at she sometimes picks him up to talk.
   */
  const say = async (text, loc, pause) => {
    const box = loc ? await settle(loc) : null; const l = nextLine(); let homeStarted = false;
    if (box) {
      await run('putDown'); await run('prepare', box);
      await run('tobyTo', box); cue(path.join(rawDir, 'voice', 'bark.wav')); await g('bark', box); await wait(620);
      await p.evaluate(() => { window.__vgHome = false; window.__g.tobyHome().then(() => { window.__vgHome = true; }); }); homeStarted = true;
    } else { await run('prepare', null); if (notes++ % 2 === 0) await run('pickUp'); }
    await g('speakStart', bubbleOf(text), box, l.env); cue(l.file); await wait(l.ms + 120); await g('speakEnd');
    if (homeStarted) for (let i = 0; i < 300 && !(await p.evaluate(() => window.__vgHome)); i++) await wait(FRAME);
    await wait(pause);
  };
  const h = {
    p, wait,
    clear: async () => { await g('hush'); },
    go: async (hash, ms = 1400) => { await p.evaluate(() => window.__g && window.__g.hush()).catch(() => {}); await p.goto((opts.base || BASE) + hash); await wait(ms); },
    /** A numbered step. Give the thing it is about and Toby shows where it is. */
    step: async (text, loc, pause = 400) => { if (typeof loc === 'number') { pause = loc; loc = null; } n += 1; await say(`<b>${n}</b>${text}`, loc, pause); },
    /** Something Dina says that is not a step. */
    note: async (text, loc, pause = 400) => { if (typeof loc === 'number') { pause = loc; loc = null; } await say(text, loc, pause); },
    /** A tap you see: the ring appears on it, presses, and the app responds. */
    tap: async (loc, after = 1100) => {
      let box = await locOf(loc).boundingBox(); if (!box || box.y < 60 || box.y + box.height > 840) box = await settle(loc);
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await g('ring', x, y); await wait(600); await g('press'); await wait(170);
      await p.mouse.click(x, y); await wait(240); await p.evaluate(() => window.__g && window.__g.ringOff()).catch(() => {}); await wait(after);
    },
    /** A plain click with no ring (for tidying up between steps). */
    click: async (loc) => { const box = await locOf(loc).boundingBox(); if (box) await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); },
    /** Types into a field one character at a time, as a person would. */
    type: async (loc, text, perChar = 2) => { const box = await boxOf(loc); await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await wait(120); for (const ch of text) { await p.keyboard.type(ch); for (let i = 0; i < perChar; i++) await wait(FRAME); } },
    /** Picks an option in a drop-down. */
    select: async (loc, value) => { await locOf(loc).evaluate((e, v) => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(e, v); e.dispatchEvent(new Event('change', { bubbles: true })); }, value); },
    scroll: async (y, ms = 900) => { await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y); await wait(ms); },
    /** The opening: Dina walks on with Toby in her arms, waves and says hello; then the stage slides in and she puts him down. */
    title: async () => { await run('intro', kicker, title, sub); const l = nextLine(); await g('talk', l.env); cue(l.file); await wait(l.ms + 150); await g('talk', null); await wait(250); await run('curtainUp'); await wait(150); },
    end: async () => { await run('outro', opts.bye.title); const l = nextLine(); await g('talk', l.env); cue(l.file); await wait(l.ms + 150); await g('talk', null); await wait(1500); },
    asSam: async () => { await p.goto(BASE + '#/demo'); await wait(900); await p.getByTestId('demo-sam').click(); await wait(1500); },
    asDina: async () => { await p.goto(BASE + '#/demo'); await wait(900); await p.getByTestId('demo-dina').click(); await wait(1500); },
  };
  // Everything before this is setup, done in real time and not recorded. From here on the clock is ours.
  h.startHere = () => { recording = true; };
  let failed = null;
  try { const extra = opts.setup ? await opts.setup() : {}; await steps(h, extra); } catch (e) { failed = e; }
  await Promise.all(writes); await ctx.close(); await b.close();
  if (failed) { console.log(`${name}: FAILED at step ${n}: ${String(failed.message).split('\n')[0]}`); process.exitCode = 1; if (count < 5) return; }
  const out = path.join(__dirname, 'out', name + '.mp4');
  // Picture from the frames; sound from each spoken line (and each bark) placed at the moment it happened.
  const args = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(rawDir, 'f%05d.jpg')];
  for (const c of cues) args.push('-i', c.file);
  const mix = cues.map((c, i) => `[${i + 1}:a]adelay=${Math.max(0, Math.round(c.at))}:all=1[a${i}]`).join(';') + (cues.length ? `;${cues.map((_, i) => `[a${i}]`).join('')}amix=inputs=${cues.length}:normalize=0,volume=1.6,alimiter=limit=0.95[a]` : '');
  args.push('-filter_complex', `[0:v]scale=720:1558:flags=lanczos,format=yuv420p[v]${mix ? ';' + mix : ''}`, '-map', '[v]');
  if (cues.length) args.push('-map', '[a]', '-c:a', 'aac', '-b:a', '112k', '-ar', '44100');
  args.push('-r', String(FPS), '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-movflags', '+faststart', out);
  execFileSync('ffmpeg', args);
  const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim();
  console.log(`${name}: ${Number(dur).toFixed(0)}s at ${FPS} frames a second, ${(fs.statSync(out).size / 1e6).toFixed(1)} MB, ${cues.length} sounds, steps ${n}, page errors ${errors.length}${errors.length ? ' ' + errors[0] : ''}, took ${((Date.now() - started) / 1000).toFixed(0)}s`);
  for (const f of fs.readdirSync(rawDir)) if (/^f\d+\.jpg$/.test(f)) fs.rmSync(path.join(rawDir, f));
}
module.exports = { make, BASE };
