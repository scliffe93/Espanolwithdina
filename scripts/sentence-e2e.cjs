// Growing sentences: Dina sets how long Sam's sentences get; Sam's verb session then ends with a sentence that
// grows that many steps, each step typed and checked. Needs a build on :4173. Usage: node scripts/sentence-e2e.cjs <outDir>
const path = require('path'); const fs = require('fs'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2] || '.';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
// The helper that answers any ordinary exercise is shared with the verb gym test.
const src = fs.readFileSync(path.join(__dirname, 'verbs-e2e.cjs'), 'utf8');
const answer = eval('(' + src.slice(src.indexOf('async function answer'), src.indexOf('async function playThrough')).trim() + ')');
const as = async (p, who) => { await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-' + who).click(); await p.waitForTimeout(1600); };
(async () => {
  const b = await chromium.launch(); const errors = [];
  const p = await (await b.newContext({ viewport: { width: 1100, height: 900 } })).newPage(); p.on('pageerror', (e) => errors.push(String(e)));
  await as(p, 'dina');
  await p.goto(BASE + '#/teach/student/demo-sam'); await p.waitForTimeout(1500);
  await p.getByTestId('sentence-level').waitFor({ timeout: 10000 });
  ok(/the usual for/.test(await p.getByTestId('sentence-level').innerText()), 'the teacher sees the sentence length, following the level to begin with');
  await p.getByTestId('sentence-4').click(); await p.waitForTimeout(1200);
  ok(/With a reason or a contrast/.test(await p.getByTestId('sentence-current').innerText()) && /set by you/.test(await p.getByTestId('sentence-level').innerText()), 'she moves it to step 4');
  await p.getByTestId('sentence-level').screenshot({ path: OUT + '/sentence-teacher.png' });
  await as(p, 'sam');
  await p.goto(BASE + '#/world'); await p.waitForTimeout(300);
  await p.goto(BASE + '#/verbs?start=1&tense=present&hw='); await p.waitForTimeout(1200);
  const steps = []; const ANS = { 0: null };
  for (let k = 0; k < 60; k++) {
    if (await p.getByText(/of \d+ correct/).count()) break;
    if (await p.getByTestId('extend').count()) {
      const text = await p.getByTestId('extend').innerText();
      // Work out the missing part from the ladders: the test knows the three present-tense sentences.
      const table = [['en casa.', ['como', 'hoy', 'y ceno pronto', 'porque tengo sueño']], ['en Madrid', ['vivo', 'ahora', 'pero trabajo en Toledo', 'aunque está lejos']], ['clase de español', ['tengo', 'más tarde', 'y después quedo con una amiga', 'porque queremos ir al cine']]];
      const row = table.find(([key]) => text.includes(key));
      const n = await p.getByTestId('extend').locator('span.bg-olive').count(); // steps already climbed
      if (n === 1) await p.screenshot({ path: OUT + '/sentence-student.png' });
      await p.getByTestId('extend-input').fill(row[1][n]);
      await p.getByRole('button', { name: /^(Check|Comprobar)$/ }).click(); await p.waitForTimeout(300);
      ok(/Continu(e|ar)/.test(await p.locator('main').innerText()) && !/Answer:|Respuesta:/.test(await p.locator('main').innerText()), `step ${n + 1} accepted: “${row[1][n]}”`);
      steps.push(n);
      if (n === 3) await p.screenshot({ path: OUT + '/sentence-student-4.png' });
    } else await answer(p);
    await p.getByRole('button', { name: /Continu(e|ar)/ }).click({ timeout: 8000 }); await p.waitForTimeout(330);
  }
  ok(steps.join(',') === '0,1,2,3', `Sam’s session ends with a sentence that grows four steps (${steps.join(', ')})`);
  const m = (await p.locator('main').innerText()).match(/(\d+) of (\d+) correct/);
  ok(!!m && Number(m[2]) >= 16, `the session is the usual questions plus the four steps (${m ? m[0] : 'not finished'})`);
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  await b.close();
})();
