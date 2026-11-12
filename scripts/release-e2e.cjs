// Gradual release in the demo: Dina turns it on for Sam, releases blocks one at a time; Sam's verb gym and
// word packs only show what has been released; turning it off opens everything again.
// Needs a build served on :4173. Usage: node scripts/release-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2] || '.';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const errors = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e)));
  const as = async (who) => { await p.goto(BASE + '#/demo'); await p.waitForTimeout(900); await p.getByTestId('demo-' + who).click(); await p.waitForTimeout(1700); };
  const go = async (hash) => { await p.goto(BASE + hash); await p.waitForTimeout(1500); };
  await as('dina'); await go('#/teach/student/demo-sam');
  ok(/Off/.test(await p.getByTestId('release-summary').innerText()), 'gradual release starts off');
  await p.getByTestId('release-on').click(); await p.waitForTimeout(1200);
  ok(/12 verbs in 1 of \d+ blocks · 10 words in 1 of 15 packs/.test(await p.getByTestId('release-summary').innerText()), 'turning it on releases the starter blocks: ' + await p.getByTestId('release-summary').innerText());
  // Sam: 12 verbs, one pack.
  await as('sam'); await go('#/verbs');
  ok(/^12 verbs released/.test(await p.getByTestId('verb-count').innerText()), 'Sam sees 12 released verbs');
  ok(await p.getByTestId('release-note').isVisible(), 'Sam is told verbs arrive in blocks');
  await p.screenshot({ path: OUT + '/release-student-verbs.png' });
  await go('#/review');
  ok((await p.locator('[data-testid^="pack-learn-"]').count()) === 1, 'Sam sees exactly one word pack');
  // Dina releases the next of each, then picks a specific block.
  await as('dina'); await go('#/teach/student/demo-sam');
  await p.getByTestId('release-next-verbs').click(); await p.waitForTimeout(1200);
  await p.getByTestId('release-next-words').click(); await p.waitForTimeout(1200);
  ok(/24 verbs in 2 of \d+ blocks · 20 words in 2 of 15 packs/.test(await p.getByTestId('release-summary').innerText()), 'next verbs and next words released');
  await p.getByTestId('release-choose').click(); await p.waitForTimeout(400);
  await p.getByTestId('block-verbs-A2-1').click(); await p.waitForTimeout(1200);
  ok((await p.getByTestId('block-verbs-A2-1').getAttribute('aria-pressed')) === 'true', 'a chosen block (A2 verbs 1) is released');
  await p.getByLabel('Show what is in A1 verbs 1').click(); await p.waitForTimeout(300);
  ok(/ser|estar|tener/.test(await p.getByTestId('block-peek').innerText()), 'the teacher can see what is in a block');
  await p.getByTestId('release').scrollIntoViewIfNeeded(); await p.waitForTimeout(5500);
  await p.getByTestId('level-access').screenshot({ path: OUT + '/release-teacher.png' });
  // The level ceiling still saves without losing the blocks.
  await p.getByTestId('level-edit').click(); await p.getByTestId('level-select').selectOption('A2'); await p.getByTestId('level-save').click(); await p.waitForTimeout(1300);
  ok(/36 verbs in 3 of/.test(await p.getByTestId('release-summary').innerText()), 'saving the ceiling keeps the released blocks');
  await as('sam'); await go('#/verbs');
  ok(/^36 verbs released/.test(await p.getByTestId('verb-count').innerText()), 'Sam now sees 36 verbs');
  await p.getByRole('button', { name: /start|practise|train/i }).first().click().catch(() => {}); await p.waitForTimeout(1200);
  await go('#/review');
  ok((await p.locator('[data-testid^="pack-learn-"]').count()) === 2, 'Sam sees two word packs');
  await p.getByTestId('word-packs').scrollIntoViewIfNeeded(); await p.getByTestId('word-packs').screenshot({ path: OUT + '/release-student-packs.png' });
  // Lock a block again; then turn it all off.
  await as('dina'); await go('#/teach/student/demo-sam');
  await p.getByTestId('release-choose').click(); await p.waitForTimeout(300);
  await p.getByTestId('block-verbs-A2-1').click(); await p.waitForTimeout(1200);
  ok(/24 verbs in 2 of/.test(await p.getByTestId('release-summary').innerText()), 'a block can be locked again');
  await p.getByTestId('release-off').click(); await p.waitForTimeout(1200);
  ok(/Off/.test(await p.getByTestId('release-summary').innerText()), 'gradual release turned off');
  await as('sam'); await go('#/verbs');
  ok(/essential verbs/.test(await p.getByTestId('verb-count').innerText()), 'with it off, Sam sees every verb again');
  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
})();
