// Exam practice and the weekly recap in the demo, on a phone-sized screen: a reading task answered and explained,
// a listening task (heard twice at most), a writing task sent to Dina, Dina marking it with a correction on the
// student's own words, the student seeing that, and the weekly recap.
// Needs a build served on :4173. Usage: node scripts/dele-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2] || '.';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const errors = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e)));
  const as = async (who) => { await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-' + who).click(); await p.waitForTimeout(1600); };

  // Dina sets Sam to A2: he sees the A1 and A2 papers and nothing above.
  await as('dina');
  await p.goto(BASE + '#/teach/student/demo-sam'); await p.waitForTimeout(1800);
  await p.getByTestId('level-edit').click(); await p.getByTestId('level-select').selectOption('A2'); await p.getByTestId('level-save').click(); await p.waitForTimeout(1200);
  await as('sam');
  await p.goto(BASE + '#/dele'); await p.waitForTimeout(1200);
  const levels = await p.locator('[data-testid^="dele-level-"]').allInnerTexts();
  ok(levels.join(',') === 'A1,A2', `a student at A2 sees the A1 and A2 papers only: ${levels.join(', ')}`);
  ok(await p.locator('[data-testid^="dele-a2-"]').count() === 3, 'three tasks at A2: reading, listening, writing');
  await p.screenshot({ path: OUT + '/dele-home.png' });

  // Reading: answer all (right answers), check, see the score and the reasons.
  await p.getByTestId('dele-a2-reading-1').click(); await p.waitForTimeout(900);
  ok((await p.getByTestId('dele-text-read').innerText()).length > 400 && /\d+:\d\d/.test(await p.getByTestId('dele-clock').innerText()), 'the reading task shows its text and the exam clock');
  const qs = p.getByTestId('dele-question'); const n = await qs.count();
  for (let i = 0; i < n; i++) await qs.nth(i).locator(i === 0 ? 'button:not([data-right])' : 'button[data-right="true"]').first().click();
  await p.getByTestId('dele-check').click(); await p.waitForTimeout(600);
  const res = await p.getByTestId('dele-result').innerText();
  ok(new RegExp(`${n - 1} of ${n}`).test(res) && /60%/.test(res), `it is scored against the exam's pass mark: ${res.split('\n')[0]}`);
  ok(/The answer is [abc]\./.test(await qs.first().innerText()), 'a wrong answer shows the right one and where it was in the text');
  await p.screenshot({ path: OUT + '/dele-reading.png', fullPage: false });

  // Listening: two plays at most, script hidden until checked.
  await p.goto(BASE + '#/dele/a2-listening-1'); await p.waitForTimeout(900);
  ok(await p.getByTestId('dele-script').count() === 0, 'the listening script is hidden while answering');
  ok(await p.getByTestId('dele-play').count() === 1, 'there is a play button, limited to two plays as in the exam');

  // Writing: write, finish, self-check, send to Dina.
  await p.goto(BASE + '#/dele/a2-writing-1'); await p.waitForTimeout(900);
  const text = 'Hola Pablo: estoy muy contento por tu visita. En mayo hace sol y no hace frio. Tienes que ver el museo, porque es muy bonito, y el parque grande del centro. El primer dia vamos a comer paella en la playa y despues vamos a pasear por el barrio antiguo. Yo estoy de Londres pero vivo aqui. Un abrazo, Sam';
  await p.getByTestId('dele-text').fill(text); await p.waitForTimeout(300);
  ok(/\d+ \/ 60–70 words/.test(await p.getByTestId('dele-words').innerText()), `the word count is checked against the exam's range: ${await p.getByTestId('dele-words').innerText()}`);
  await p.getByTestId('dele-finish').click(); await p.waitForTimeout(400);
  ok(await p.getByTestId('dele-selfcheck').locator('input[type=checkbox]').count() >= 4, 'an examiner-style checklist appears');
  await p.getByTestId('dele-send').click(); await p.waitForTimeout(1200);
  ok(await p.getByTestId('dele-sent').count() === 1, 'the writing is sent to Dina');
  await p.screenshot({ path: OUT + '/dele-writing.png' });

  // Dina marks it: a correction on the student's own words, a mark and feedback.
  await as('dina');
  await p.goto(BASE + '#/teach/homework'); await p.waitForTimeout(1500);
  await p.locator('article', { hasText: 'Exam practice A2' }).first().getByRole('button', { name: /Review|Details/ }).click(); await p.waitForTimeout(1000);
  ok(/Yo estoy de Londres/.test(await p.getByTestId('rv-text').innerText()), 'Dina sees the student’s text, ready to mark');
  await p.getByTestId('rv-quote').fill('estoy de Londres'); await p.getByTestId('rv-correction').fill('soy de Londres');
  await p.getByTestId('rv-add-correction').click(); await p.waitForTimeout(400);
  await p.getByTestId('rv-mark').fill('70');
  await p.locator('#rv-feedback').fill('Muy bien, Sam. Cuidado con ser y estar, y con los acentos: frío, día, aquí.');
  await p.getByTestId('rv-save').click(); await p.waitForTimeout(1500);

  // Sam sees the correction laid over his own words.
  await as('sam');
  await p.goto(BASE + '#/student/homework'); await p.waitForTimeout(1500);
  const body = await p.locator('main').innerText();
  ok(/Exam practice A2/.test(body), 'the piece is in Sam’s homework list');
  ok(/1 correction/i.test(await p.locator('article', { hasText: 'Exam practice A2' }).first().innerText()), 'with Dina’s feedback and the number of corrections');
  await p.locator('article', { hasText: 'Exam practice A2' }).first().getByRole('button', { name: /View/ }).click(); await p.waitForTimeout(1200);
  ok(await p.getByTestId('hw-correction').count() >= 1 && /soy de Londres/.test(await p.getByTestId('hw-correction').first().innerText()), 'Sam sees Dina’s correction on his own words');
  await p.screenshot({ path: OUT + '/dele-marked.png' });

  // The weekly recap.
  await p.goto(BASE + '#/recap'); await p.waitForTimeout(1500);
  ok(await p.getByTestId('recap-better').count() === 1, 'the weekly recap says what got better');
  ok(await p.getByTestId('recap-lesson').count() === 1 && /Going into your next lesson/.test(await p.getByTestId('recap-lesson').innerText()), 'and what to take to the next lesson');
  await p.screenshot({ path: OUT + '/recap.png', fullPage: true });
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  await b.close();
})();
