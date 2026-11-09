// Front page without demo, guides, and the lesson debrief → weekly plan flow in the demo (Dina → Sam). Needs a build served on :4173. Usage: node scripts/debrief-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2];
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const errors = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(BASE); await p.waitForTimeout(1200);
  const home = await p.locator('body').innerText();
  ok(!/Try the demonstration/i.test(home) && (await p.getByTestId('demo-dina').count()) === 0, 'front page has no demo cards');
  await p.goto(BASE + '#/guide?for=teacher'); await p.waitForTimeout(800);
  ok(/Guide for Dina/.test(await p.locator('body').innerText()), 'teacher guide renders');
  await p.goto(BASE + '#/guide?for=student'); await p.waitForTimeout(800);
  ok(/Guide for students/.test(await p.locator('body').innerText()), 'student guide renders');
  await p.screenshot({ path: OUT + '/guide-student.png', fullPage: true });
  await p.goto(BASE + '#/demo'); await p.waitForTimeout(1000);
  ok((await p.getByTestId('demo-dina').count()) === 1, 'demo still reachable at #/demo');
  await p.getByTestId('demo-dina').click(); await p.waitForTimeout(1500);
  await p.goto(BASE + '#/teach/students'); await p.waitForTimeout(1200);
  await p.getByTestId('open-student-sam').click(); await p.waitForTimeout(1200);
  await p.getByTestId('lesson-debrief').click(); await p.waitForTimeout(600);
  await p.locator('#db-verbs').fill('querer, poder');
  await p.locator('#db-well').fill('Great work on querer and poder today. Next week: ser vs estar.');
  await p.getByTestId('fix-ser-estar').click(); await p.getByTestId('fix-listening').click();
  await p.locator('#db-goal-0').fill('Use ser and estar correctly when speaking');
  await p.getByTestId('generate-plan').click(); await p.waitForTimeout(600);
  const n = await p.locator('[data-testid="plan-items"] li').count();
  ok(n >= 4, `generated plan has ${n} tasks`);
  await p.screenshot({ path: OUT + '/debrief-plan.png', fullPage: true });
  await p.getByTestId('send-plan').click(); await p.waitForTimeout(2500);
  ok(/Plan sent/.test(await p.locator('body').innerText()), 'plan sent');
  await p.getByRole('button', { name: 'Done' }).click(); await p.waitForTimeout(500);
  // As Sam
  await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-sam').click(); await p.waitForTimeout(1800);
  await p.goto(BASE + '#/student'); await p.waitForTimeout(1500);
  const wp = p.getByTestId('week-plan');
  ok(await wp.isVisible(), 'Sam sees "This week with Dina"');
  const wpText = await wp.innerText();
  ok(/Great work on querer/.test(wpText) && /Use ser and estar/.test(wpText) && new RegExp(`0/${n} done`).test(wpText), 'card shows the note, goal and task count');
  await p.screenshot({ path: OUT + '/student-week-plan.png', fullPage: true });
  // Dina's next debrief shows last plan summary
  await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-dina').click(); await p.waitForTimeout(1500);
  await p.goto(BASE + '#/teach/student/demo-sam'); await p.waitForTimeout(1200);
  await p.getByTestId('lesson-debrief').click(); await p.waitForTimeout(600);
  ok(await p.getByTestId('last-plan').isVisible(), 'next debrief starts with last plan evidence');
  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
