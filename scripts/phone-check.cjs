// Walks the main student and teacher screens under phone and tablet emulation (screen size, touch, the device's
// browser identity) and reports anything that would look or feel wrong: a page that scrolls sideways, a button too
// small to tap, text cut off, a script error. It cannot stand in for a real device: speech, the microphone,
// notifications and installing to the Home Screen have to be tried by hand (see docs/PHONE-CHECKLIST.md).
// Needs a build served on :4173. Usage: node scripts/phone-check.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const pw = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const { chromium, devices } = pw;
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2] || '.';
const DEVICES = ['iPhone SE', 'iPhone 14', 'iPhone 14 Pro Max', 'Pixel 7', 'Galaxy S9+', 'iPad Mini'];
let failed = 0;
const problems = [];

async function audit(p, device, label) {
  await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const vw = window.innerWidth; const out = { sideways: document.documentElement.scrollWidth > vw + 1 || vw > screen.width + 1, small: [], cut: [] };
    const vis = (el) => { const b = el.getBoundingClientRect(); const st = getComputedStyle(el); return b.width > 0 && b.height > 0 && st.visibility !== 'hidden' && st.display !== 'none' && b.bottom > 0 && b.top < window.innerHeight; };
    for (const el of document.querySelectorAll('button, a[href], input:not([type=checkbox]):not([type=radio]), select, textarea')) {
      if (!vis(el)) continue; const b = el.getBoundingClientRect();
      // Things to tap should be at least 32px in one direction and not thinner than 24px in the other.
      if (Math.min(b.width, b.height) < 24 || Math.max(b.width, b.height) < 32) out.small.push(`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().slice(0, 30)}" ${Math.round(b.width)}x${Math.round(b.height)}`);
      if (b.right > vw + 2 && !el.closest('.overflow-x-auto, [class*="overflow-x-auto"]')) out.cut.push(`${el.tagName.toLowerCase()} "${(el.textContent || '').trim().slice(0, 30)}" runs off the right edge`);
    }
    const nav = [...document.querySelectorAll('nav')].pop();
    if (nav && vis(nav)) { const rows = new Set([...nav.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().top))); if (rows.size > 1) out.cut.push('the bottom menu wraps onto two rows'); }
    return out;
  });
  const bad = [];
  if (r.sideways) bad.push('the page is wider than the screen');
  if (r.small.length) bad.push(`too small to tap: ${[...new Set(r.small)].slice(0, 3).join('; ')}`);
  if (r.cut.length) bad.push([...new Set(r.cut)].slice(0, 3).join('; '));
  if (bad.length) { failed++; problems.push(`${device} · ${label}: ${bad.join(' | ')}`); }
  return bad.length === 0;
}

(async () => {
  const b = await chromium.launch();
  for (const name of DEVICES) {
    const d = devices[name]; if (!d) { console.log('- no profile for', name); continue; }
    const { defaultBrowserType, ...profile } = d; // these profiles are run in Chromium: the layout and touch are what is checked
    const ctx = await b.newContext({ ...profile }); const p = await ctx.newPage(); const errors = [];
    p.on('pageerror', (e) => errors.push(String(e)));
    const as = async (who) => { await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-' + who).click(); await p.waitForTimeout(1500); };
    let good = 0, total = 0; const check = async (label) => { total++; if (await audit(p, name, label)) good++; };
    await as('sam');
    for (const [route, label] of [['student', 'home'], ['student/homework', 'homework'], ['student/feedback', 'feedback'], ['verbs', 'verb gym'], ['review', 'memory'], ['games', 'arcade'], ['journey', 'my journey'], ['dele', 'exam practice'], ['dele/a2-reading-1', 'exam reading'], ['dele/a2-writing-1', 'exam writing'], ['recap', 'my week'], ['settings', 'settings'], ['account', 'account']]) {
      await p.goto(BASE + '#/' + route); await p.waitForTimeout(1100); await check(label);
    }
    const step = async (label, fn) => { try { await fn(); await check(label); } catch (e) { total++; failed++; problems.push(`${name} · ${label}: could not be used (${String(e).split('\n')[0].slice(0, 90)})`); } };
    await step('the More menu', async () => { await p.goto(BASE + '#/student'); await p.waitForTimeout(900); await p.getByTestId('tab-more').tap({ timeout: 5000 }); await p.waitForTimeout(500); });
    await p.keyboard.press('Escape');
    await step('grid drill', async () => { await p.goto(BASE + '#/verbs'); await p.waitForTimeout(900); await p.getByTestId('open-grid').tap({ timeout: 5000 }); await p.waitForTimeout(800); });
    await step('a verb question', async () => { await p.goto(BASE + '#/world'); await p.waitForTimeout(300); await p.goto(BASE + '#/verbs?start=1&tense=present'); await p.waitForTimeout(1200); });
    await step('the Pairs game', async () => { await p.goto(BASE + '#/world'); await p.waitForTimeout(300); await p.goto(BASE + '#/game/pairs'); await p.waitForTimeout(800); await p.getByRole('button', { name: /Vamos/ }).tap({ timeout: 5000 }); await p.waitForTimeout(3200); });
    await step('the Quick Keys game', async () => { await p.goto(BASE + '#/world'); await p.waitForTimeout(300); await p.goto(BASE + '#/game/type'); await p.waitForTimeout(800); await p.getByRole('button', { name: /Vamos/ }).tap({ timeout: 5000 }); await p.waitForTimeout(3200); });
    await as('dina');
    for (const [route, label] of [['teach', 'teacher: today'], ['teach/calendar', 'teacher: calendar'], ['teach/students', 'teacher: students'], ['teach/student/demo-sam', 'teacher: a student'], ['teach/homework', 'teacher: homework'], ['teach/invoices', 'teacher: invoices']]) {
      await p.goto(BASE + '#/' + route); await p.waitForTimeout(1300); await check(label);
    }
    if (errors.length) { failed++; problems.push(`${name}: script error: ${errors[0]}`); }
    console.log(`${good === total && !errors.length ? '✓' : '✗'} ${name} (${profile.viewport.width}x${profile.viewport.height}): ${good} of ${total} screens clean${errors.length ? `, ${errors.length} script error(s)` : ''}`);
    if (name === 'iPhone SE') { await as('sam'); await p.goto(BASE + '#/student'); await p.waitForTimeout(1200); await p.screenshot({ path: OUT + '/phone-se-home.png' }); }
    await ctx.close();
  }
  await b.close();
  if (problems.length) { console.log('\nTo fix:'); for (const x of problems) console.log(' -', x); }
  process.exitCode = failed ? 1 : 0;
})();
