// "What to concentrate on" and the detail behind the trends, on a phone-sized screen in the demo.
// Needs a build served on :4173. Usage: node scripts/focus-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2] || '.';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const errors = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-sam').click(); await p.waitForTimeout(1600);

  // Student home: what to concentrate on before the next lesson.
  await p.goto(BASE + '#/student'); await p.waitForTimeout(1500);
  const prep = await p.getByTestId('lesson-prep').innerText().catch(() => '');
  ok(/Going into your next lesson/.test(prep), `the home page says what to mention in the lesson: "${prep.slice(0, 90)}…"`);
  const first = p.getByTestId('focus-areas').locator('button[aria-expanded]').first();
  await first.scrollIntoViewIfNeeded(); await first.click(); await p.waitForTimeout(400);
  const detail = await p.getByTestId('focus-detail').first().innerText();
  ok(/Why this happens/.test(detail) && /How to improve/.test(detail) && /Take this to your lesson/.test(detail), 'an area opens to why it happens, how to improve and what to take to the lesson');
  ok(/You wrote/.test(detail), 'it quotes the student’s own answers');
  await p.getByTestId('focus-areas').screenshot({ path: OUT + '/focus-home.png' });

  // My journey: trends, slips and tenses open into detail.
  await p.goto(BASE + '#/journey'); await p.waitForTimeout(1500);
  for (const kind of ['minutes', 'accuracy', 'words']) {
    const t = p.getByTestId(`trend-${kind}`); await t.scrollIntoViewIfNeeded(); await t.click(); await p.waitForTimeout(500);
    const text = await p.getByTestId('trend-detail').innerText();
    ok(/This week/.test(text) && text.split('\n').length >= 10, `the ${kind} trend opens week by week with an explanation`);
    if (kind === 'accuracy') await p.screenshot({ path: OUT + '/focus-trend.png' });
    await p.keyboard.press('Escape'); await p.waitForTimeout(350);
  }
  const slip = p.locator('[data-testid^="slip-"]').first(); await slip.scrollIntoViewIfNeeded(); await slip.click(); await p.waitForTimeout(500);
  ok(/How to improve/.test(await p.getByRole('dialog').innerText()), 'a common slip opens to its explanation');
  await p.screenshot({ path: OUT + '/focus-slip.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(350);
  const tense = p.locator('[data-testid^="tense-row-"]').first(); await tense.scrollIntoViewIfNeeded(); await tense.click(); await p.waitForTimeout(500);
  const tt = await p.getByTestId('tense-detail').innerText();
  ok(/verbs tried/i.test(tt) && /Practise/.test(tt), 'a tense opens to how it is going and which verbs to work on');
  await p.screenshot({ path: OUT + '/focus-tense.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(350);
  const c = p.getByTestId('journey-concentrate'); await c.scrollIntoViewIfNeeded();
  ok(await c.getByTestId('focus-areas').count() === 1, 'the journey page has "What to concentrate on"');
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  await b.close();
  execSync(`cd ${OUT} && ffmpeg -y -loglevel error -i focus-trend.png -i focus-slip.png -i focus-tense.png -filter_complex hstack=3 focus-sheets.png`);
})();
