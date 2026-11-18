// What a student loves: Dina ticks golf, tennis and classic cars for Sam; Sam's verb gym says so and his session
// uses sentences about them. Needs a build on :4173. Usage: node scripts/topics-e2e.cjs <outDir>
const path = require('path'); const fs = require('fs'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2] || '.';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
const src = fs.readFileSync(path.join(__dirname, 'verbs-e2e.cjs'), 'utf8');
const answer = eval('(' + src.slice(src.indexOf('async function answer'), src.indexOf('async function playThrough')).trim() + ')');
const as = async (p, who) => { await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-' + who).click(); await p.waitForTimeout(1600); };
const ABOUT = /golf|hoyo|torneo|hándicap|tenis|raqueta|saque|Wimbledon|pista|Jaguar|coche|motor|garaje/i;
(async () => {
  const b = await chromium.launch(); const errors = [];
  const p = await (await b.newContext({ viewport: { width: 1100, height: 900 } })).newPage(); p.on('pageerror', (e) => errors.push(String(e)));
  await as(p, 'dina');
  await p.goto(BASE + '#/teach/student/demo-sam'); await p.getByTestId('student-topics').waitFor({ timeout: 10000 });
  ok(/Nothing chosen/.test(await p.getByTestId('topics-current').innerText()), 'nothing is chosen for the student to begin with');
  for (const t of ['golf', 'tennis', 'classic-cars']) { await p.getByTestId('topic-' + t).click(); await p.waitForTimeout(1100); }
  ok((await p.getByTestId('topics-current').innerText()) === 'Golf, Tennis, Classic cars', 'the teacher ticks golf, tennis and classic cars');
  await p.getByTestId('sentence-5').click(); await p.waitForTimeout(1200);
  ok((await p.getByTestId('topics-current').innerText()) === 'Golf, Tennis, Classic cars', 'changing another setting keeps them');
  await p.getByTestId('student-topics').screenshot({ path: OUT + '/topics-teacher.png' });
  await as(p, 'sam');
  await p.goto(BASE + '#/verbs'); await p.getByTestId('verbs-topics').waitFor({ timeout: 10000 });
  ok(/golf course, the tennis court and classic cars/.test(await p.getByTestId('verbs-topics').innerText()), 'the student’s verb gym says the practice is made for them');
  await p.getByTestId('verbs-hero').screenshot({ path: OUT + '/topics-hero.png' });
  let themed = 0, grow = '', shot = false;
  for (let round = 0; round < 3 && (themed < 2 || !ABOUT.test(grow)); round++) {
    await p.goto(BASE + '#/world'); await p.waitForTimeout(300);
    await p.goto(BASE + '#/verbs?start=1&tense=present&hw='); await p.waitForTimeout(1200);
    for (let k = 0; k < 40; k++) {
      if (await p.getByText(/of \d+ correct/).count()) break;
      if (await p.getByTestId('extend').count()) { grow = await p.getByTestId('extend').innerText(); break; }
      const text = await p.locator('main').innerText();
      if (ABOUT.test(text)) { themed++; if (!shot) { shot = true; await p.screenshot({ path: OUT + '/topics-question.png' }); } }
      await answer(p);
      await p.getByRole('button', { name: /Continu(e|ar)/ }).click({ timeout: 8000 }); await p.waitForTimeout(330);
    }
  }
  ok(themed >= 2, `the session asks questions about what they love (${themed} seen)`);
  ok(ABOUT.test(grow), `and ends with a growing sentence about it (${grow.replace(/\s+/g, ' ').slice(0, 70)})`);
  await p.screenshot({ path: OUT + '/topics-grow.png' });
  // The student says what they are into, in their own words.
  await p.goto(BASE + '#/world'); await p.waitForTimeout(300); await p.goto(BASE + '#/verbs'); await p.getByTestId('likes').waitFor({ timeout: 10000 });
  await p.getByTestId('likes-open').click(); await p.getByTestId('likes-text').fill('Cooking for friends, sailing and golf'); await p.getByTestId('likes-save').click(); await p.waitForTimeout(800);
  const st = await p.getByTestId('likes-status').innerText();
  ok(/about golf, cooking/.test(st) && /sailing/.test(st) && /will be added/.test(st), `their own words are matched to topics, and what is missing is noted (${st.slice(0, 90)})`);
  ok(/cooking and food/.test(await p.getByTestId('verbs-topics').innerText()), 'cooking joins the topics their teacher ticked');
  await p.getByTestId('likes').screenshot({ path: OUT + '/topics-likes.png' });
  await p.waitForTimeout(1500);
  await as(p, 'dina');
  await p.goto(BASE + '#/teach/student/demo-sam'); await p.getByTestId('student-topics').waitFor({ timeout: 10000 }); await p.waitForTimeout(800);
  const own = await p.getByTestId('student-topics').innerText();
  ok(/Cooking for friends, sailing and golf/.test(own) && /No sentences yet for: sailing/.test(own), 'the teacher sees their words and that sailing still needs writing');
  await p.getByTestId('student-topics').screenshot({ path: OUT + '/topics-teacher.png' });
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  await b.close();
})();
