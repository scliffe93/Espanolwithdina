// Captures clean screenshots for the how-to guides from the demo (demo badges hidden). Needs a build served on :4173.
// Usage: node scripts/capture-guide-shots.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2];
const HIDE = `[data-testid="demo-pill"], [title*="fictional"] { display: none !important; }`;
async function clean(p) { await p.addStyleTag({ content: HIDE }); await p.evaluate(() => { document.querySelectorAll('button, a').forEach((el) => { if (/Switch person/.test(el.textContent || '')) (el).style.display = 'none'; }); }); }
async function shot(p, name, opts = {}) { await clean(p); await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/${name}.png`, ...opts }); console.log('•', name); }
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(BASE + '#/demo'); await p.waitForTimeout(1200);
  // Teacher
  await p.getByTestId('demo-dina').click(); await p.waitForTimeout(1800);
  await p.goto(BASE + '#/teach'); await p.waitForTimeout(1500); await shot(p, 't-today');
  await p.goto(BASE + '#/teach/calendar'); await p.waitForTimeout(1500); await shot(p, 't-calendar');
  await p.goto(BASE + '#/teach/students'); await p.waitForTimeout(1500); await shot(p, 't-students');
  await p.getByTestId('open-student-sam').click(); await p.waitForTimeout(1500); await shot(p, 't-profile');
  await p.getByTestId('lesson-debrief').click(); await p.waitForTimeout(600);
  await p.locator('#db-verbs').fill('querer, poder'); await p.locator('#db-well').fill('Great work on querer and poder today. Next week we focus on ser and estar.');
  await p.getByTestId('fix-ser-estar').click(); await p.getByTestId('fix-listening').click(); await p.locator('#db-goal-0').fill('Use ser and estar correctly when speaking');
  await shot(p, 't-debrief-form');
  await p.getByTestId('generate-plan').click(); await p.waitForTimeout(600); await shot(p, 't-debrief-plan');
  await p.getByTestId('send-plan').click(); await p.waitForTimeout(2500); await p.getByRole('button', { name: 'Done' }).click(); await p.waitForTimeout(400);
  await p.goto(BASE + '#/teach/student/demo-sam?tab=analytics'); await p.waitForTimeout(1800); await shot(p, 't-analytics', { fullPage: true });
  await p.goto(BASE + '#/teach/homework'); await p.waitForTimeout(1500); await shot(p, 't-homework');
  // Student (Sam)
  await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-sam').click(); await p.waitForTimeout(1800);
  await p.goto(BASE + '#/student'); await p.waitForTimeout(1800); await shot(p, 's-home', { fullPage: true });
  await p.goto(BASE + '#/student/homework'); await p.waitForTimeout(1500); await shot(p, 's-homework');
  await p.goto(BASE + '#/student/feedback'); await p.waitForTimeout(1500); await shot(p, 's-feedback');
  await p.goto(BASE + '#/verbs'); await p.waitForTimeout(1500); await shot(p, 's-verbs');
  await p.goto(BASE + '#/review'); await p.waitForTimeout(1500); await shot(p, 's-review');
  await p.goto(BASE + '#/games'); await p.waitForTimeout(1500); await shot(p, 's-arcade');
  await p.goto(BASE + '#/world'); await p.waitForTimeout(1800); await shot(p, 's-world');
  await p.goto(BASE + '#/journey'); await p.waitForTimeout(1800); await shot(p, 's-journey', { fullPage: true });
  await p.goto(BASE + '#/settings'); await p.waitForTimeout(1500); await shot(p, 's-settings');
  await p.goto(BASE + '#/account'); await p.waitForTimeout(1200); await shot(p, 's-account');
  // Phone views
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const mp = await m.newPage();
  await mp.goto(BASE + '#/demo'); await mp.waitForTimeout(1200); await mp.getByTestId('demo-sam').click(); await mp.waitForTimeout(1800);
  await mp.goto(BASE + '#/student'); await mp.waitForTimeout(1800); await clean(mp); await mp.screenshot({ path: `${OUT}/s-home-phone.png` }); console.log('• s-home-phone');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
