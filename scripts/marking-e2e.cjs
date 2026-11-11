// Marking in the demo: Sam submits written homework and a verb session; Dina marks them (mark, corrections, per-answer notes);
// Sam sees the marking; Dina's next debrief is pre-filled from it. Needs a build served on :4173. Usage: node scripts/marking-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2] || '.';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
const tap = (loc) => loc.click({ force: true });
// Answers every exercise of a verb session (ported from scripts/platform-e2e.cjs): typed forms get "tengo", choices take the first option.
async function completeVerbSession(page) {
  for (let s = 0; s < 300; s++) {
    if (await page.getByText(/correct ·/).isVisible().catch(() => false)) break;
    const cont = page.getByRole('button', { name: /^Continue/ });
    if (await cont.isVisible().catch(() => false)) { await tap(cont); await page.waitForTimeout(150); continue; }
    const input = page.getByLabel('Your answer');
    if (await input.isVisible().catch(() => false)) { await input.fill('tengo'); await tap(page.getByRole('button', { name: 'Check' })); await page.waitForTimeout(150); continue; }
    if (await page.getByText('Tap the words in order.').isVisible().catch(() => false)) { const tiles = page.locator('div.mt-3.flex.flex-wrap.gap-2 > button:not(.invisible)'); while (await tiles.count()) { await tiles.first().click(); } await tap(page.getByRole('button', { name: 'Check' })); continue; }
    if (await page.getByText(/Match each pronoun/).isVisible().catch(() => false)) {
      const left = page.locator('div.grid.grid-cols-2 > div:first-child > button:not([disabled])'), right = page.locator('div.grid.grid-cols-2 > div:last-child > button:not([disabled])');
      for (let g = 0; g < 20 && (await left.count()); g++) { await left.first().click(); const n = await right.count(); for (let r = 0; r < n; r++) { await right.nth(r).click(); await page.waitForTimeout(60); if ((await left.count()) < n) break; } }
      continue;
    }
    const opt = page.locator('div.mt-5.grid button:not([disabled])').first();
    if (await opt.isVisible().catch(() => false)) { await tap(opt); await page.waitForTimeout(150); continue; }
    await page.waitForTimeout(200);
  }
}
const asActor = async (p, who) => { await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId(`demo-${who}`).click(); await p.waitForTimeout(1600); };
(async () => {
  const b = await chromium.launch(); const errors = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 950 } }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e)));
  // Dina assigns written homework to Sam.
  await asActor(p, 'dina');
  await p.goto(BASE + '#/teach/student/demo-sam'); await p.waitForTimeout(1500);
  await p.getByRole('button', { name: 'Assign homework' }).first().click(); await p.waitForTimeout(900);
  await p.locator('#hw-template').selectOption({ label: 'Written homework' }); await p.waitForTimeout(300);
  await p.locator('#hw-prompt').fill('Preséntate: de dónde eres y qué haces.');
  await p.locator('#hw-minwords').fill('5');
  await p.locator('#hw-title').fill('Written: present yourself');
  await p.getByTestId('hw-assign-submit').click({ noWaitAfter: true }); await p.waitForTimeout(1800);
  // ...and a short verb session with two verbs.
  await p.getByRole('button', { name: 'Assign homework' }).first().click(); await p.waitForTimeout(900);
  await p.locator('#hw-template').selectOption({ index: 0 }); await p.waitForTimeout(200);
  await p.locator('#hw-verb-search').fill('tener'); await p.waitForTimeout(200); await p.getByRole('group', { name: 'Verbs' }).getByRole('button').first().click();
  await p.locator('#hw-verb-search').fill('hablar'); await p.waitForTimeout(200); await p.getByRole('group', { name: 'Verbs' }).getByRole('button').first().click();
  await p.locator('#hw-title').fill('Verbs: tener and hablar (set by Dina)');
  await p.getByTestId('hw-assign-submit').click({ noWaitAfter: true }); await p.waitForTimeout(1800);
  // Sam writes an answer with a ser/estar slip and submits.
  await asActor(p, 'sam');
  await p.goto(BASE + '#/student/homework'); await p.waitForTimeout(1500);
  const card = p.locator('article', { hasText: 'Written: present yourself' }).first();
  ok(await card.isVisible(), 'Sam sees the written homework');
  await card.locator('[data-testid^="hw-start-"]').click(); await p.waitForTimeout(1200);
  await p.getByTestId('hw-text').fill('Hola, yo estoy de Londres y trabajo en un banco. Me gusta mucho Madrid.');
  await p.getByTestId('hw-submit').click(); await p.waitForTimeout(1500);
  ok(await p.getByTestId('hw-submitted').isVisible(), 'written homework submitted');
  // Sam also does a verb session as homework (answers are captured).
  await p.goto(BASE + '#/student/homework'); await p.waitForTimeout(1500);
  const verbCard = p.locator('article', { hasText: 'Verbs: tener and hablar (set by Dina)' }).first();
  const hasVerb = (await verbCard.count()) > 0;
  ok(hasVerb, 'Sam has a verb homework to do');
  if (hasVerb) {
    await verbCard.locator('[data-testid^="hw-start-"]').click(); await p.waitForTimeout(1800);
    await completeVerbSession(p);
    const done = p.getByRole('button', { name: /Homework done/ });
    ok(await done.count() > 0, 'verb session finished as homework');
    if (await done.count()) { await done.first().click(); await p.waitForTimeout(1200); }
  }
  // Dina marks the written homework.
  await asActor(p, 'dina');
  await p.goto(BASE + '#/teach/student/demo-sam?tab=homework'); await p.waitForTimeout(1500);
  await p.locator('article', { hasText: 'Written: present yourself' }).first().getByRole('button', { name: /Review|Details/ }).click(); await p.waitForTimeout(900);
  ok(/yo estoy de Londres/.test(await p.getByTestId('rv-text').innerText()), 'review sheet shows Sam’s text');
  await p.getByTestId('rv-quote').fill('estoy de Londres');
  await p.getByTestId('rv-correction').fill('soy de Londres');
  await p.getByTestId('rv-category').selectOption('ser-estar');
  await p.getByTestId('rv-add-correction').click(); await p.waitForTimeout(300);
  ok(/Corrections · 1/i.test(await p.getByTestId('rv-corrections').innerText()), 'correction added');
  ok((await p.getByTestId('rv-text').locator('mark').count()) === 1, 'the quoted words are highlighted in the text');
  await p.getByTestId('rv-mark').fill('70');
  await p.getByTestId('rv-grade').fill('B');
  await p.locator('#rv-feedback').fill('Buen trabajo. Recuerda: origen → ser.');
  await p.screenshot({ path: OUT + '/marking-teacher.png', fullPage: false });
  await p.getByTestId('rv-save').click(); await p.waitForTimeout(1500);
  // Dina marks the verb session answer by answer (if it was done).
  if (hasVerb) {
    await p.goto(BASE + '#/teach/student/demo-sam?tab=homework'); await p.waitForTimeout(1500);
    const row = p.locator('article', { hasText: 'Verbs: tener and hablar (set by Dina)' }).first();
    if (await row.count()) {
      await row.getByRole('button', { name: /Review|Details/ }).click(); await p.waitForTimeout(900);
      const answers = await p.locator('[data-testid^="rv-answer-"]').count();
      ok(answers > 0, `review sheet lists ${answers} answers from the verb session`);
      if (answers) {
        await p.getByTestId('rv-note-0').click(); await p.getByTestId('rv-note-input-0').fill('Watch the ending here.');
        await p.locator('#rv-feedback').fill('Good session.');
        await p.getByTestId('rv-save').click(); await p.waitForTimeout(1500);
      }
    } else ok(false, 'submitted verb homework row found');
  }
  // Sam sees the marking.
  await asActor(p, 'sam');
  await p.goto(BASE + '#/student/feedback'); await p.waitForTimeout(1500);
  ok(/marked B/.test(await p.locator('body').innerText()), 'feedback page shows the mark');
  await p.locator('li', { hasText: 'Written: present yourself' }).first().getByRole('button', { name: 'See the marking' }).click(); await p.waitForTimeout(1500);
  ok(await p.getByTestId('hw-marked').isVisible() && (await p.getByTestId('hw-mark').innerText()) === 'B', 'Sam sees the mark on the homework');
  ok((await p.getByTestId('hw-corrected-text').locator('mark').count()) === 1 && /soy de Londres/.test(await p.getByTestId('hw-correction').first().innerText()), 'Sam sees the correction over his own words');
  await p.screenshot({ path: OUT + '/marking-student.png', fullPage: true });
  // Dina's next debrief is pre-filled from the marking.
  await asActor(p, 'dina');
  await p.goto(BASE + '#/teach/student/demo-sam'); await p.waitForTimeout(1500);
  await p.getByTestId('lesson-debrief').click(); await p.waitForTimeout(800);
  ok(/Ser vs estar/.test(await p.getByTestId('marked-slips').innerText()), 'debrief shows the marked slips');
  ok((await p.getByTestId('fix-ser-estar').getAttribute('aria-pressed')) === 'true', '"Ser vs estar" is pre-ticked in what to fix');
  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
