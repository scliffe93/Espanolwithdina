// Level access in the demo: Dina sets Sam's ceiling, Sam's verb gym locks tenses above it, assigned homework still opens.
// Needs a build served on :4173. Usage: node scripts/level-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2] || '.';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const errors = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(BASE + '#/demo'); await p.waitForTimeout(1000);
  await p.getByTestId('demo-dina').click(); await p.waitForTimeout(1500);
  await p.goto(BASE + '#/teach/student/demo-sam'); await p.waitForTimeout(1500);
  ok(/everything/.test(await p.getByTestId('level-ceiling').innerText()), 'Sam starts with no ceiling');
  await p.getByTestId('level-edit').click();
  await p.getByTestId('level-select').selectOption('A1');
  await p.getByTestId('level-save').click(); await p.waitForTimeout(1200);
  ok((await p.getByTestId('level-ceiling').innerText()) === 'A1', 'ceiling saved as A1');
  await p.screenshot({ path: OUT + '/level-teacher.png', fullPage: false });
  // The assignment form flags a tense above the ceiling but still allows it.
  await p.getByRole('button', { name: 'Assign homework' }).first().click(); await p.waitForTimeout(600);
  await p.locator('#hw-template').selectOption({ index: 0 });
  await p.locator('#hw-tense').selectOption('perfect'); await p.waitForTimeout(300);
  ok(await p.getByTestId('above-ceiling').isVisible(), 'assignment form flags a tense above the ceiling');
  await p.locator('#hw-title').fill('Perfect tense practice (set by Dina)');
  await p.waitForTimeout(900); // let the sheet finish animating
  await p.getByTestId('hw-assign-submit').click({ noWaitAfter: true }); await p.waitForTimeout(2000);
  const sheetText = (await p.locator('body').innerText());
  ok(!/Choose|Give the homework|Write the prompt|deadline/i.test(sheetText.slice(-600)) , 'no validation error after assigning');
  await p.screenshot({ path: OUT + '/level-assigned.png', fullPage: false });
  // Students list shows the ceiling.
  await p.goto(BASE + '#/teach/students'); await p.waitForTimeout(1500);
  ok(/access up to A1/.test(await p.locator('body').innerText()), 'student list shows "access up to A1"');
  // As Sam: tenses above A1 are locked; the app picks only A1 verbs; the teacher's homework still opens.
  await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-sam').click(); await p.waitForTimeout(1800);
  await p.goto(BASE + '#/verbs'); await p.waitForTimeout(1500);
  ok(await p.getByTestId('tense-perfect').isDisabled() && await p.getByTestId('tense-progressive').isDisabled(), 'progressive and perfect are locked for Sam');
  ok(!(await p.getByTestId('tense-present').isDisabled()), 'present stays open');
  ok(/set your level to A1/.test(await p.getByTestId('level-note').innerText()), 'Sam sees why');
  await p.screenshot({ path: OUT + '/level-student-verbs.png', fullPage: false });
  await p.goto(BASE + '#/settings'); await p.waitForTimeout(1200);
  const b1 = p.getByRole('radio', { name: 'B1' }).first();
  ok(await b1.isDisabled(), 'self-selecting B1 is disabled in the profile');
  await p.goto(BASE + '#/student/homework'); await p.waitForTimeout(1500);
  const card = p.locator('article', { hasText: 'Perfect tense practice (set by Dina)' }).first();
  ok(await card.isVisible(), 'Sam sees the perfect-tense homework Dina assigned');
  await card.locator('[data-testid^="hw-start-"]').click(); await p.waitForTimeout(1800);
  const body = await p.locator('body').innerText();
  const opened = /tense=perfect/.test(p.url()) && /hw=/.test(p.url()) && /\b1\/\d+\b/.test(body) && !/locked/i.test(body); // a session started (exercise counter), in the perfect tense, as homework
  ok(opened, 'homework in the perfect tense opens despite the ceiling');
  if (!opened) console.log('   url:', p.url(), '\n   body:', body.replace(/\s+/g, ' ').slice(0, 500));
  await p.screenshot({ path: OUT + '/level-homework-opens.png', fullPage: false });
  // Dina lifts the ceiling; Sam's gym unlocks.
  await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-dina').click(); await p.waitForTimeout(1500);
  await p.goto(BASE + '#/teach/student/demo-sam'); await p.waitForTimeout(1500);
  await p.getByTestId('level-edit').click(); await p.getByTestId('level-select').selectOption(''); await p.getByTestId('level-save').click(); await p.waitForTimeout(1200);
  ok(/everything/.test(await p.getByTestId('level-ceiling').innerText()), 'ceiling removed');
  await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-sam').click(); await p.waitForTimeout(1800);
  await p.goto(BASE + '#/verbs'); await p.waitForTimeout(1500);
  ok(!(await p.getByTestId('tense-perfect').isDisabled()), 'perfect unlocked again for Sam');
  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
