// The verb area's front page and the verb families game. Needs a build on :4173. Usage: node scripts/families-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2] || '.';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const errors = [];
  for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const p = await (await b.newContext({ viewport })).newPage(); p.on('pageerror', (e) => errors.push(String(e)));
    await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-sam').click(); await p.waitForTimeout(1600);
    await p.goto(BASE + '#/verbs'); await p.waitForTimeout(1500);
    ok(await p.getByTestId('verbs-hero').isVisible() && await p.getByTestId('verbs-tense').isVisible() && await p.getByTestId('verbs-ways').isVisible(), `${name}: the front page has the start, the tense and the ways to practise`);
    ok((await p.locator('[data-testid^="verb-group-"]').count()) >= 5, `${name}: the verbs are grouped by how they change`);
    const wide = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(wide <= 1, `${name}: nothing runs off the side (${wide}px)`);
    await p.screenshot({ path: `${OUT}/verbs-front-${name}.png`, fullPage: true });
    await p.getByTestId('open-families').click(); await p.getByTestId('families').waitFor({ timeout: 8000 });
    ok((await p.locator('[data-testid^="family-"][data-testid$="ie"], [data-testid="family-go"]').count()) >= 2, `${name}: the families page shows each family`);
    await p.screenshot({ path: `${OUT}/families-${name}.png`, fullPage: true });
    if (name === 'desktop') {
      await p.getByTestId('families-play').click(); await p.getByTestId('families-game').waitFor({ timeout: 8000 });
      const kinds = new Set(); let right = 0;
      for (let k = 0; k < 10; k++) {
        const kind = await p.locator('[data-kind]').getAttribute('data-kind'); kinds.add(kind);
        if (kind === 'same') { const inp = p.getByTestId('family-typed'); await inp.fill(k === 1 ? 'zzz' : await inp.getAttribute('data-answer')); await p.getByRole('button', { name: 'Check' }).click(); }
        else await p.locator('[data-testid="family-option"][data-right]').click();
        await p.getByTestId('family-feedback').waitFor();
        if (/Eso es/.test(await p.getByTestId('family-feedback').innerText())) right++;
        if (k === 2) await p.screenshot({ path: `${OUT}/families-game.png` });
        await p.getByTestId('family-next').click(); await p.waitForTimeout(250);
      }
      ok(kinds.size === 3, `the game mixes three kinds of question (${[...kinds].join(', ')})`);
      ok(right === 9 && /9 of 10/.test(await p.getByTestId('families-done').innerText()), `right answers are accepted and the wrong one is not (${right} of 10)`);
      await p.getByText('Back to the families').click(); await p.getByTestId('family-play-go').click(); await p.getByTestId('families-game').waitFor();
      ok((await p.locator('[data-kind]').getAttribute('data-kind')) === 'same', 'one family can be practised alone');
    }
    await p.context().close();
  }
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  await b.close();
})();
