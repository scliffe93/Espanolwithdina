// Marking in the demo: Sam submits written homework and a verb session; Dina marks them (mark, corrections, per-answer notes);
// Sam sees the marking; Dina's next debrief is pre-filled from it. Needs a build served on :4173. Usage: node scripts/marking-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2] || '.';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
const tap = (loc) => loc.click({ force: true });
// Answers every exercise of a verb session (ported from scripts/platform-e2e.cjs): typed forms get "tengo", choices take the first option.
// Plays a verb session to its end, answering each kind of exercise (the helper is shared with the verb gym test).
const vsrc = require('fs').readFileSync(require('path').join(__dirname, 'verbs-e2e.cjs'), 'utf8');
const answerAny = eval('(' + vsrc.slice(vsrc.indexOf('async function answer'), vsrc.indexOf('async function playThrough')).trim() + ')');
async function completeVerbSession(page) {
  for (let s = 0; s < 70; s++) {
    if (await page.getByText(/of \d+ correct/).count() || await page.getByRole('button', { name: /Homework done/ }).count()) break;
    if (await page.getByTestId('extend').count()) { await page.getByTestId('extend-input').fill('x'); await page.getByRole('button', { name: /^(Check|Comprobar)$/ }).click(); }
    else await answerAny(page);
    await page.getByRole('button', { name: /Continu(e|ar)/ }).click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(330);
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
  if (await p.getByTestId('hw-mode-list').count()) { await p.getByTestId('hw-mode-list').click(); await p.waitForTimeout(300); }
  await p.locator('#hw-template').selectOption({ label: 'Written homework' }); await p.waitForTimeout(300);
  await p.locator('#hw-prompt').fill('Preséntate: de dónde eres y qué haces.');
  await p.locator('#hw-minwords').fill('5');
  await p.locator('#hw-title').fill('Written: present yourself');
  await p.getByTestId('hw-assign-submit').click({ noWaitAfter: true }); await p.waitForTimeout(1800);
  // ...and a short verb session with two verbs.
  await p.getByRole('button', { name: 'Assign homework' }).first().click(); await p.waitForTimeout(900);
  if (await p.getByTestId('hw-mode-list').count()) { await p.getByTestId('hw-mode-list').click(); await p.waitForTimeout(300); }
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
      // The teacher sees each question as the student saw it: the sentence with its gap, the jumbled words, the mistake.
      const sheet = await p.getByTestId('rv-answers').innerText();
      const kinds = { gap: /Fill the gap: .*___.* \(\w+\) · /.test(sheet), build: /Build the sentence: .+ \/ .+ · /.test(sheet), fix: /Fix the mistake: .+ · /.test(sheet) };
      console.log('- in this session:', Object.entries(kinds).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none of the three');
      if (kinds.gap) ok(true, 'a fill-the-gap answer shows the Spanish sentence with its gap, the verb and the meaning');
      if (kinds.build) ok(true, 'a build-the-sentence answer shows the jumbled words that were given');
      if (kinds.fix) ok((await p.getByTestId('rv-answers').locator('s').count()) >= 1, 'a fix-the-mistake answer shows the sentence with the mistake struck through');
      const match = p.locator('[data-testid^="rv-answer-"]').filter({ hasText: 'Match each pronoun' }).first();
      if (await match.count()) ok(/Mixed up: .+ \+ .+|Matched every pair first time/.test(await match.innerText()), 'a matching answer says what was matched or mixed up');
      await p.getByTestId('rv-answers').screenshot({ path: OUT + '/rv-original.png' });
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
  ok((await p.locator('[data-testid^="fix-"][aria-pressed="true"]').count()) === 2, 'the two most frequent slips are pre-ticked in what to fix');
  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
