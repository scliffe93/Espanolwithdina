// Homework from the teacher's own material, in the demo: Dina pastes a text, the app builds exercises, Sam does them,
// Dina sees every answer; the debrief can add a document too. Needs a build served on :4173. Usage: node scripts/material-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2] || '.';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
const asActor = async (p, who) => { await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId(`demo-${who}`).click(); await p.waitForTimeout(1600); };
const TEXT = `El lunes fui al mercado con mi vecina Carmen. Compramos fruta, pan y un poco de queso.
Por la tarde trabajé en casa y después cené con mis amigos en un bar de Lavapiés.
El martes no pude salir porque llovía mucho. Leí un libro y escuché música toda la tarde.
Ahora vivo en un piso pequeño cerca del metro. Me gusta mucho el barrio.
¿Quieres venir a Madrid el año que viene? Creo que te gustará.`;
(async () => {
  const b = await chromium.launch(); const errors = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 950 } }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e)));
  await asActor(p, 'dina');
  await p.goto(BASE + '#/teach/student/demo-sam'); await p.waitForTimeout(1500);
  await p.getByRole('button', { name: 'Assign homework' }).first().click(); await p.waitForTimeout(900);
  await p.locator('#hw-template').selectOption({ label: 'From a document or text (your own material)' }); await p.waitForTimeout(400);
  ok(await p.getByTestId('material-builder').isVisible(), 'the assignment form shows the material builder');
  await p.getByTestId('material-text').fill(TEXT);
  await p.getByTestId('material-title').fill('Mi semana en Madrid');
  await p.getByTestId('material-analyse').click(); await p.waitForTimeout(1200);
  const summary = await p.getByTestId('material-summary').innerText();
  ok(/words/.test(summary) && /Preterite/.test(summary), 'the text is analysed: words and tenses found: ' + summary.replace(/\s+/g, ' ').slice(0, 140));
  const n1 = await p.getByTestId('material-item').count();
  ok(n1 >= 6, `${n1} exercises previewed`);
  await p.getByTestId('material-questions').fill('¿Qué compró el lunes?');
  await p.waitForTimeout(300);
  const n2 = await p.getByTestId('material-item').count();
  ok(n2 === n1 + 1, 'the teacher’s question is appended');
  await p.getByTestId('material-regenerate').click(); await p.waitForTimeout(300);
  ok((await p.getByTestId('material-item').count()) >= 6, 'regenerate keeps a full set');
  await p.screenshot({ path: OUT + '/material-builder.png', fullPage: true });
  await p.getByTestId('hw-assign-submit').click({ noWaitAfter: true }); await p.waitForTimeout(1800);
  ok(!(await p.getByTestId('material-builder').count()), 'assigned and the sheet closed');
  // Sam does the exercises.
  await asActor(p, 'sam');
  await p.goto(BASE + '#/student/homework'); await p.waitForTimeout(1500);
  const card = p.locator('article', { hasText: 'From “Mi semana en Madrid”' }).first();
  ok(await card.isVisible(), 'Sam sees the homework from the material');
  await card.locator('[data-testid^="hw-start-"]').click(); await p.waitForTimeout(1200);
  if (!(await p.getByTestId('material-runner').count()) && (await p.locator('[data-testid^="hw-start-"]').count())) { await p.locator('[data-testid^="hw-start-"]').first().click(); await p.waitForTimeout(800); }
  ok(await p.getByTestId('material-runner').isVisible(), 'the runner starts');
  let answered = 0;
  for (let i = 0; i < 40; i++) {
    if (await p.getByTestId('hw-submitted').count()) break;
    const feedback = p.getByTestId('material-feedback');
    if (await feedback.count()) { await p.getByTestId('material-next').click(); await p.waitForTimeout(600); continue; }
    const opt = p.getByTestId('material-option');
    if (await opt.count()) { await opt.first().click(); answered++; await p.waitForTimeout(400); continue; }
    const typed = p.getByTestId('material-typed');
    if (await typed.count()) { await typed.fill('El lunes fui al mercado con mi vecina Carmen'); await p.getByTestId('material-check').click(); answered++; await p.waitForTimeout(400); continue; }
    // build: tap every tile then check
    const tiles = p.locator('[data-testid="material-runner"] button.chip:not(.invisible)');
    if (await tiles.count()) { while (await tiles.count()) await tiles.first().click(); await p.getByTestId('material-check').click(); answered++; await p.waitForTimeout(400); continue; }
    await p.waitForTimeout(300);
  }
  ok(await p.getByTestId('hw-submitted').isVisible(), `all exercises answered (${answered}) and submitted`);
  await p.screenshot({ path: OUT + '/material-submitted.png' });
  // Dina sees every answer.
  await asActor(p, 'dina');
  await p.goto(BASE + '#/teach/student/demo-sam?tab=homework'); await p.waitForTimeout(1500);
  await p.locator('article', { hasText: 'From “Mi semana en Madrid”' }).first().getByRole('button', { name: /Review|Details/ }).click(); await p.waitForTimeout(900);
  const answers = await p.locator('[data-testid^="rv-answer-"]').count();
  ok(answers === answered, `review sheet lists ${answers} answers (expected ${answered})`);
  ok(/Q: ¿Qué compró el lunes\?/.test(await p.getByTestId('rv-answers').innerText()), 'the teacher’s question is there for marking');
  await p.screenshot({ path: OUT + '/material-review.png', fullPage: true });
  // The debrief can add a document too.
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await p.goto(BASE + '#/teach/student/demo-sam'); await p.waitForTimeout(1200);
  await p.getByTestId('lesson-debrief').click(); await p.waitForTimeout(600);
  await p.locator('#db-verbs').fill('comprar');
  await p.getByTestId('generate-plan').click(); await p.waitForTimeout(600);
  const before = await p.locator('[data-testid="plan-items"] li').count();
  await p.getByTestId('plan-add-material').click(); await p.waitForTimeout(300);
  await p.getByTestId('material-text').fill(TEXT); await p.getByTestId('material-analyse').click(); await p.waitForTimeout(1000);
  await p.getByTestId('plan-material-add').click(); await p.waitForTimeout(400);
  ok((await p.locator('[data-testid="plan-items"] li').count()) === before + 1, 'a document task joins the week plan');
  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
