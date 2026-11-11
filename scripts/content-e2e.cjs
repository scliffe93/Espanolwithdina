// Content by level in the demo: grammar drills in the verb gym, word packs on the Memory page, and the teacher assigning both.
// Needs a build served on :4173. Usage: node scripts/content-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2] || '.';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
const asActor = async (p, who) => { await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId(`demo-${who}`).click(); await p.waitForTimeout(1600); };
(async () => {
  const b = await chromium.launch(); const errors = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 950 } }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e)));
  // Sam: grammar drills in the gym.
  await asActor(p, 'sam');
  await p.goto(BASE + '#/verbs'); await p.waitForTimeout(1500);
  const drills = await p.locator('[data-testid^="drill-"]').evaluateAll((els) => els.map((e) => e.textContent.trim()));
  ok(drills.length === 5, `five grammar drills offered: ${drills.join(' | ')}`);
  await p.getByTestId('drill-por-para').click();
  await p.getByText(/por vs para/i).first().waitFor({ timeout: 10000 }); await p.waitForTimeout(600);
  const opts = p.getByRole('button', { name: /^(por|para)$/i });
  ok((await opts.count()) === 2 && /1\/\d+/.test(await p.locator('body').innerText()), 'a por/para drill starts with the two options');
  await opts.first().click();
  await p.getByRole('button', { name: /Continue/ }).waitFor({ timeout: 10000 });
  const fb = await p.locator('body').innerText();
  ok(/→ (por|para)|por\.|para\./i.test(fb), 'the drill explains why');
  await p.screenshot({ path: OUT + '/content-drill.png' });
  await p.goto(BASE + '#/arcade'); await p.waitForTimeout(500); await p.goto(BASE + '#/verbs'); await p.waitForTimeout(1200);
  await p.getByTestId('drill-conditional').click(); await p.waitForTimeout(1200);
  ok(/If-sentences/i.test(await p.locator('body').innerText()), 'the if-sentences drill starts');
  // Sam: word packs on the Memory page.
  await p.goto(BASE + '#/review'); await p.waitForTimeout(1500);
  const packs = await p.locator('[data-testid^="pack-"]:not([data-testid^="pack-learn"]):not([data-testid^="pack-add"])').count();
  ok(packs === 15, `${packs} word packs listed`);
  await p.getByTestId('pack-add-a2-salud').click(); await p.waitForTimeout(600);
  ok(/All in your deck|10 of 10/.test(await p.getByTestId('pack-a2-salud').innerText()), 'a pack is added to the deck');
  await p.getByTestId('pack-learn-b1-opinion').click(); await p.waitForTimeout(1200);
  const sess = await p.locator('body').innerText();
  ok(/new word|say it in spanish|1\/10/i.test(sess), 'learning a pack starts a session on its ten words');
  await p.screenshot({ path: OUT + '/content-pack-session.png' });
  // Dina: assign a pack and a drill; the level ceiling hides packs for Sam.
  await asActor(p, 'dina');
  await p.goto(BASE + '#/teach/student/demo-sam'); await p.waitForTimeout(1500);
  await p.getByRole('button', { name: 'Assign homework' }).first().click(); await p.waitForTimeout(900);
  await p.locator('#hw-template').selectOption({ label: 'Vocabulary: a word pack by level' }); await p.waitForTimeout(300);
  await p.locator('#hw-pack').selectOption('b2-economia'); await p.waitForTimeout(300);
  ok(/Word pack: Work and money \(B2\)/.test(await p.locator('body').innerText()), 'the assignment preview names the pack');
  await p.getByTestId('hw-assign-submit').click({ noWaitAfter: true }); await p.waitForTimeout(1800);
  await p.getByRole('button', { name: 'Assign homework' }).first().click(); await p.waitForTimeout(900);
  await p.locator('#hw-template').selectOption({ label: 'Grammar: Preterite vs imperfect (from B1)' }); await p.waitForTimeout(300);
  await p.getByTestId('hw-assign-submit').click({ noWaitAfter: true }); await p.waitForTimeout(1800);
  await p.getByTestId('level-edit').click(); await p.getByTestId('level-select').selectOption('A2'); await p.getByTestId('level-save').click(); await p.waitForTimeout(1200);
  // Sam: the homework opens despite the ceiling; packs above A2 are hidden; the B1 drill is locked in the gym.
  await asActor(p, 'sam');
  await p.goto(BASE + '#/student/homework'); await p.waitForTimeout(1500);
  const packCard = p.locator('article', { hasText: 'Word pack: Work and money' }).first();
  ok(await packCard.isVisible(), 'Sam sees the pack homework');
  await packCard.locator('[data-testid^="hw-start-"]').click(); await p.waitForTimeout(1500);
  ok(/pack=b2-economia/.test(p.url()) && /new word|say it in spanish/i.test(await p.locator('body').innerText()), 'the pack homework opens straight into its words');
  await p.goto(BASE + '#/review'); await p.waitForTimeout(1200);
  ok((await p.locator('[data-testid="pack-c2-refranes"]').count()) === 0 && (await p.locator('[data-testid="pack-a1-casa"]').count()) === 1, 'packs above the ceiling are hidden, lower ones shown');
  await p.goto(BASE + '#/verbs'); await p.waitForTimeout(1200);
  ok(await p.getByTestId('drill-pret-imp').isDisabled() && !(await p.getByTestId('drill-por-para').isDisabled()), 'B1 drill locked by the A2 ceiling, A2 drill open');
  await p.goto(BASE + '#/student/homework'); await p.waitForTimeout(1200);
  const drillCard = p.locator('article', { hasText: 'Preterite vs imperfect drill' }).first();
  ok(await drillCard.isVisible(), 'Sam sees the drill homework');
  await drillCard.locator('[data-testid^="hw-start-"]').click(); await p.waitForTimeout(1500);
  ok(/mode=pret-imp/.test(p.url()) && /1\/\d+/.test(await p.locator('body').innerText()), 'the assigned B1 drill opens despite the A2 ceiling');
  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
