// Analytics tab, journey analytics, class CSV and the three football games. Needs a build served on :4173. Usage: node scripts/analytics-games-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2];
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const errors = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await p.goto(BASE + '#/demo'); await p.waitForTimeout(1200);
  await p.getByTestId('demo-dina').click(); await p.waitForTimeout(1500);
  await p.goto(BASE + '#/teach/students'); await p.waitForTimeout(1500);
  ok(await p.getByTestId('class-csv').isVisible(), 'class CSV button on Students');
  await p.getByTestId('open-student-sam').click(); await p.waitForTimeout(1200);
  await p.getByRole('radio', { name: 'Analytics' }).click().catch(async () => p.getByText('Analytics', { exact: true }).first().click()); await p.waitForTimeout(1500);
  const txt = await p.locator('body').innerText();
  ok(/STUDY DAYS \(28\)/i.test(txt) && /Mistakes by type/i.test(txt) && /Tenses/.test(txt), 'Analytics tab renders consistency, mistakes and tenses');
  await p.screenshot({ path: OUT + '/analytics-tab.png', fullPage: true });
  ok(await p.getByTestId('download-report').isVisible(), 'PDF report button present');
  // Sam's journey page
  await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-sam').click(); await p.waitForTimeout(1500);
  await p.goto(BASE + '#/journey'); await p.waitForTimeout(1500);
  const j = await p.locator('body').innerText();
  ok(/Consistency/i.test(j) && /Trends/i.test(j), 'Journey page shows analytics section');
  await p.screenshot({ path: OUT + '/journey-analytics.png', fullPage: true });
  // Games
  await p.goto(BASE + '#/games'); await p.waitForTimeout(1200);
  const g = await p.locator('body').innerText();
  ok(/Penalty Shoot-out/.test(g) && /Derby Quiz/.test(g) && /Line-up/.test(g), 'three football games listed in the arcade');
  await p.screenshot({ path: OUT + '/arcade.png', fullPage: true });
  for (const id of ['penalty', 'derbi', 'lineup']) {
    await p.goto(BASE + '#/game/' + id); await p.waitForTimeout(1200);
    const start = p.locator('button.rounded-full.bg-white.px-7').first();
    if (await start.isVisible().catch(() => false)) { await start.click(); } await p.waitForTimeout(4500);
    const sel = id === 'penalty' ? '[data-testid^="shot-"]' : id === 'derbi' ? '[data-testid^="derbi-"]' : '[data-testid^="lineup-word-"]';
    const n = await p.locator(sel).count();
    ok(n >= 3, `${id}: ${n} answer buttons visible`);
    await p.screenshot({ path: OUT + `/game-${id}.png` });
    if (n) { await p.locator(sel).first().click(); await p.waitForTimeout(900); }
  }
  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
