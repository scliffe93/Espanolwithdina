// What a student loves: Dina ticks golf, tennis and classic cars for Sam; Sam's verb gym says so and his session
// uses sentences about them. Needs a build on :4173. Usage: node scripts/topics-e2e.cjs <outDir>
const path = require('path'); const fs = require('fs'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2] || '.';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
const src = fs.readFileSync(path.join(__dirname, 'verbs-e2e.cjs'), 'utf8');
const answer = eval('(' + src.slice(src.indexOf('async function answer'), src.indexOf('async function playThrough')).trim() + ')');
const as = async (p, who) => { await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-' + who).click(); await p.waitForTimeout(1600); };
const ABOUT = /golf|hoyo|torneo|hándicap|tenis|raqueta|saque|Wimbledon|pista|Jaguar|coche|motor|garaje|música|canto|guitarra|concierto|fútbol|partido|equipo|estadio|cocino|receta|sopa|tortilla|mercado/i;
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
  { const v = await p.getByTestId('verbs-topics').innerText(); ok(/golf course/.test(v) && /tennis court/.test(v) && /classic cars/.test(v) && /football/.test(v), `the student’s verb gym says the practice is made for them, including the interests they gave at sign-up (${v.slice(0, 120)})`); }
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
  // The games follow the same topics.
  await p.goto(BASE + '#/games'); await p.getByTestId('arcade-topics').waitFor({ timeout: 10000 });
  ok(/golf course/.test(await p.getByTestId('arcade-topics').innerText()), 'the arcade says the games are made for them');
  for (const [game, label] of [['swipe', 'the right-or-wrong game'], ['lineup', 'the sentence-order game'], ['pairs', 'the word pairs game']]) {
    await p.goto(BASE + '#/game/' + game); await p.waitForTimeout(900);
    await p.locator('main button.bg-white.rounded-full').first().click(); await p.waitForTimeout(5200);
    const text = await p.locator('main').innerText();
    ok(ABOUT.test(text) || /el palo|la pelota|la bandera|césped|gorra|la red|el punto|volante|la rueda|carretera|la pieza|mecánico|entrenador|árbitro|la final|el jugador|carrocería|el golpe|el partido/i.test(text) || (game === 'lineup' && /Made for you/.test(text)), `${label} opens on something they love (${text.replace(/\s+/g, ' ').slice(0, 80)})`);
    await p.screenshot({ path: OUT + `/topics-game-${game}.png` });
  }
  // The student says what they are into, in their own words.
  await p.goto(BASE + '#/world'); await p.waitForTimeout(300); await p.goto(BASE + '#/verbs'); await p.getByTestId('likes').waitFor({ timeout: 10000 });
  await p.getByTestId('likes-open').click(); await p.getByTestId('likes-text').fill('Cooking for friends, chess and golf'); await p.getByTestId('likes-save').click(); await p.waitForTimeout(800);
  const st = await p.getByTestId('likes-status').innerText();
  ok(/about golf, cooking/.test(st) && /chess/.test(st) && /will be added/.test(st), `their own words are matched to topics, and what is missing is noted (${st.slice(0, 90)})`);
  ok(/cooking and food/.test(await p.getByTestId('verbs-topics').innerText()), 'cooking joins the topics their teacher ticked');
  ok((await p.getByTestId('likes-topics').locator('button').count()) === 20, 'twenty topics are offered to tap');
  await p.getByTestId('like-wine').click(); await p.getByTestId('like-dogs').click(); await p.waitForTimeout(500);
  ok(/wine/.test(await p.getByTestId('verbs-topics').innerText()) && /dogs/.test(await p.getByTestId('verbs-topics').innerText()) && (await p.getByTestId('like-golf').isDisabled()), 'the student taps wine and dogs, and the teacher’s golf stays ticked');
  await p.getByTestId('likes').screenshot({ path: OUT + '/topics-likes.png' });
  await p.waitForTimeout(1500);
  await as(p, 'dina');
  await p.goto(BASE + '#/teach/student/demo-sam'); await p.getByTestId('student-topics').waitFor({ timeout: 10000 }); await p.waitForTimeout(800);
  const own = await p.getByTestId('student-topics').innerText();
  ok(/Picked by \w+: [^.]*Football[^.]*Wine, Dogs/.test(own) && /Cooking for friends, chess and golf/.test(own) && /No sentences yet for: chess/.test(own), 'the teacher sees their words and that chess still needs writing');
  await p.getByTestId('student-topics').screenshot({ path: OUT + '/topics-teacher.png' });
  // Anyone can choose what Julian has: golf, tennis and classic cars are in the interests on the Me page.
  await as(p, 'anneka');
  await p.goto(BASE + '#/settings'); await p.waitForTimeout(1200);
  const interests = p.getByRole('group', { name: 'Interests' });
  ok((await interests.getByRole('button', { name: 'Golf' }).count()) === 1 && (await interests.getByRole('button', { name: 'Tennis' }).count()) === 1 && (await interests.getByRole('button', { name: 'Classic cars' }).count()) === 1, 'golf, tennis and classic cars are in every student’s interests');
  await interests.getByRole('button', { name: 'Golf' }).click(); await interests.getByRole('button', { name: 'Classic cars' }).click();
  const more = p.getByRole('group', { name: 'More for your practice' });
  await more.getByRole('button', { name: 'Sailing' }).click(); await p.waitForTimeout(500);
  ok((await interests.getByRole('button', { name: 'Golf' }).getAttribute('aria-pressed')) === 'true' && (await more.getByRole('button', { name: 'Sailing' }).getAttribute('aria-pressed')) === 'true' && (await more.getByRole('button', { name: 'Golf' }).count()) === 0, 'another student picks golf and classic cars as interests, and sailing for practice');
  await p.getByRole('group', { name: 'Interests' }).screenshot({ path: OUT + '/topics-me.png' });
  await p.goto(BASE + '#/world'); await p.waitForTimeout(300); await p.goto(BASE + '#/verbs'); await p.getByTestId('verbs-topics').waitFor({ timeout: 10000 });
  { const v = await p.getByTestId('verbs-topics').innerText(); ok(/golf course/.test(v) && /classic cars/.test(v) && /sailing/.test(v), `their verb gym is now made for them too (${v.slice(0, 110)})`); }
  ok(await p.getByTestId('like-golf').getAttribute('aria-pressed') === 'true' && !(await p.getByTestId('like-golf').isDisabled()), 'golf shows as theirs in the verb gym picker and can be untapped there');
  await p.getByTestId('like-golf').click(); await p.waitForTimeout(400);
  await p.goto(BASE + '#/settings'); await p.waitForTimeout(1000);
  ok((await p.getByRole('group', { name: 'Interests' }).getByRole('button', { name: 'Golf' }).getAttribute('aria-pressed')) === 'false', 'untapping golf in the verb gym takes it off their interests too: one list');
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  await b.close();
})();
