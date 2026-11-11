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
  // ── New screens: level access, marking, material, packs ──
  const TEXT = 'El lunes fui al mercado con mi vecina Carmen. Compramos fruta, pan y un poco de queso. Por la tarde trabajé en casa y después cené con mis amigos en un bar de Lavapiés. El martes no pude salir porque llovía mucho. Leí un libro y escuché música toda la tarde. Ahora vivo en un piso pequeño cerca del metro. Me gusta mucho el barrio.';
  await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-dina').click(); await p.waitForTimeout(1800);
  await p.goto(BASE + '#/teach/student/demo-sam'); await p.waitForTimeout(1500);
  await p.getByRole('button', { name: 'Assign homework' }).first().click(); await p.waitForTimeout(900);
  await p.locator('#hw-template').selectOption({ label: 'From a document or text (your own material)' }); await p.waitForTimeout(400);
  await p.getByTestId('material-text').fill(TEXT); await p.getByTestId('material-title').fill('Mi semana en Madrid');
  await p.getByTestId('material-analyse').click(); await p.waitForTimeout(1200);
  await p.getByTestId('material-questions').fill('¿Qué compró el lunes?'); await p.waitForTimeout(300);
  await shot(p, 't-material');
  await p.getByTestId('hw-assign-submit').click({ noWaitAfter: true }); await p.waitForTimeout(1800);
  await p.getByRole('button', { name: 'Assign homework' }).first().click(); await p.waitForTimeout(900);
  await p.locator('#hw-template').selectOption({ label: 'Written homework' }); await p.waitForTimeout(300);
  await p.locator('#hw-prompt').fill('Preséntate: de dónde eres y qué haces.'); await p.locator('#hw-minwords').fill('5'); await p.locator('#hw-title').fill('Written: present yourself');
  await p.getByTestId('hw-assign-submit').click({ noWaitAfter: true }); await p.waitForTimeout(1800);
  // Sam does the written homework and starts the material exercises
  await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-sam').click(); await p.waitForTimeout(1800);
  await p.goto(BASE + '#/student/homework'); await p.waitForTimeout(1500);
  await p.locator('article', { hasText: 'Written: present yourself' }).first().locator('[data-testid^="hw-start-"]').click(); await p.waitForTimeout(1200);
  await p.getByTestId('hw-text').fill('Hola, yo estoy de Londres y trabajo en un banco. Me gusta mucho Madrid.'); await p.getByTestId('hw-submit').click(); await p.waitForTimeout(1500);
  await p.goto(BASE + '#/student/homework'); await p.waitForTimeout(1500);
  await p.locator('article', { hasText: 'From “Mi semana en Madrid”' }).first().locator('[data-testid^="hw-start-"]').click(); await p.waitForTimeout(1500);
  await shot(p, 's-material');
  await p.goto(BASE + '#/review'); await p.waitForTimeout(1500); await shot(p, 's-packs', { fullPage: true });
  // Dina marks the written homework
  await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-dina').click(); await p.waitForTimeout(1800);
  await p.goto(BASE + '#/teach/student/demo-sam?tab=homework'); await p.waitForTimeout(1500);
  await p.locator('article', { hasText: 'Written: present yourself' }).first().getByRole('button', { name: /Review|Details/ }).click(); await p.waitForTimeout(900);
  await p.getByTestId('rv-quote').fill('estoy de Londres'); await p.getByTestId('rv-correction').fill('soy de Londres'); await p.getByTestId('rv-category').selectOption('ser-estar'); await p.getByTestId('rv-add-correction').click(); await p.waitForTimeout(300);
  await p.getByTestId('rv-mark').fill('70'); await p.getByTestId('rv-grade').fill('B'); await p.locator('#rv-feedback').fill('Buen trabajo. Recuerda: origen → ser.');
  await shot(p, 't-marking');
  await p.getByTestId('rv-save').click(); await p.waitForTimeout(1500);
  await p.goto(BASE + '#/teach/student/demo-sam'); await p.waitForTimeout(1500);
  await p.getByTestId('level-edit').click(); await p.getByTestId('level-select').selectOption('B1'); await p.getByTestId('level-save').click(); await p.waitForTimeout(1200);
  await shot(p, 't-level');
  // Sam sees the marking
  await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-sam').click(); await p.waitForTimeout(1800);
  await p.goto(BASE + '#/student/feedback'); await p.waitForTimeout(1500);
  await p.locator('li', { hasText: 'Written: present yourself' }).first().getByRole('button', { name: 'See the marking' }).click(); await p.waitForTimeout(1500);
  await shot(p, 's-marked', { fullPage: true });
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
