// The verb grid drill on a phone-sized screen: several verbs side by side with their meaning and whether they are
// regular, blanks filled in and checked all at once, then "try the ones I missed".
// Needs a build served on :4173. Usage: node scripts/grid-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2] || '.';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const errors = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-sam').click(); await p.waitForTimeout(1600);
  await p.goto(BASE + '#/verbs'); await p.waitForTimeout(1200);
  await p.getByTestId('open-grid').click(); await p.waitForTimeout(700);
  const kinds = await p.locator('[data-testid^="grid-kind-"]').allInnerTexts();
  ok(kinds.length === 3, `three verbs side by side on a phone: ${kinds.join(' | ')}`);
  const visible = await p.locator('thead th').evaluateAll((els) => els.every((e) => e.getBoundingClientRect().right <= window.innerWidth + 1));
  ok(visible, 'all of them fit on the screen without sliding');
  ok(kinds.some((k) => /Regular/.test(k)) && kinds.some((k) => !/Regular/.test(k)), 'regular and irregular verbs are mixed and labelled');
  ok(/follows the pattern/.test(await p.getByTestId('grid-legend').innerText()), 'the hint at the top explains the labels');
  const heads = await p.locator('thead th').allInnerTexts();
  ok(heads.filter((h) => /to /.test(h)).length === 3, 'each verb shows its meaning');
  const fits = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  ok(fits, 'the page does not scroll sideways');
  let cells = p.locator('[data-testid^="grid-cell-"]');
  const n = await cells.count();
  ok(n >= 6 && n < 18, `the weak spots are blank and the rest is filled in (${n} blanks)`);
  await p.screenshot({ path: OUT + '/grid-1.png' });
  await p.getByTestId('grid-count-4').click(); await p.waitForTimeout(300);
  ok(await p.locator('[data-testid^="grid-kind-"]').count() === 4, 'four or five verbs can be chosen');
  await p.getByTestId('grid-count-3').click(); await p.waitForTimeout(300);
  await p.getByTestId('grid-all').click(); await p.waitForTimeout(300);
  cells = p.locator('[data-testid^="grid-cell-"]');
  const all = await cells.count();
  ok(all >= 15, `"Everything" blanks the whole table (${all})`);
  // Fill every cell: the right answer for all but two, which get a wrong one.
  const answers = await p.evaluate(() => null);
  const ids = await cells.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
  // Learn the answers by checking once with nothing useful typed.
  await cells.first().fill('x'); await p.getByTestId('grid-check').click(); await p.waitForTimeout(500);
  const shown = await p.locator('td button[data-mark]').evaluateAll((els) => els.map((e) => e.querySelector('b').textContent));
  ok(shown.length === all && /0 of|1 of/.test(await p.getByTestId('grid-result').innerText()), 'checking shows the right form under every miss');
  await p.screenshot({ path: OUT + '/grid-2.png' });
  await p.getByTestId('grid-retry').click(); await p.waitForTimeout(400);
  cells = p.locator('[data-testid^="grid-cell-"]');
  const again = await cells.count();
  for (let i = 0; i < again; i++) await cells.nth(i).fill(i < 2 ? 'zzz' : shown[shown.length - again + i] ?? shown[i]);
  // (cells come back in the same order as the first check)
  await p.getByTestId('grid-check').click(); await p.waitForTimeout(600);
  const res = await p.getByTestId('grid-result').innerText();
  const m = res.match(/(\d+) of (\d+) right/);
  ok(!!m && Number(m[1]) === Number(m[2]) - 2, `filled in and checked all at once: ${m ? m[0] : res.slice(0, 40)}`);
  await p.screenshot({ path: OUT + '/grid-3.png' });
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  await b.close();
  execSync(`cd ${OUT} && ffmpeg -y -loglevel error -i grid-1.png -i grid-2.png -i grid-3.png -filter_complex hstack=3 grid.png`);
})();
