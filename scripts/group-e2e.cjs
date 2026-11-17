// A group lesson with real accounts on three devices: the teacher starts one lesson for two students, each joins on
// their own device and answers for themselves, and the teacher's screen shows who has answered and says when
// everyone has. Needs the account API on :8787 (TEACHER_USERNAMES=dina, ALLOWED_ORIGINS=http://localhost:4174) and a
// build made for it on :4174. Usage: node scripts/group-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4174/'; const API = 'http://localhost:8787/account'; const OUT = process.argv[2] || '.';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
const PW = 'tortilla de patatas 2026';
const api = async (p, body, token) => { const r = await fetch(`${API}/${p}`, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', origin: 'http://localhost:4174', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); return t ? JSON.parse(t) : null; };
async function login(p, user) {
  await p.goto(BASE + '#/account'); await p.waitForTimeout(900);
  await p.getByRole('radio', { name: 'Log in' }).click(); await p.waitForTimeout(300);
  await p.getByLabel('Username').fill(user); await p.getByLabel('Password', { exact: true }).fill(PW);
  await p.getByRole('button', { name: /^Log in/ }).last().click(); await p.waitForTimeout(2200);
  const cont = p.getByTestId('welcome-continue'); if (await cont.count()) { await cont.click().catch(() => {}); await p.waitForTimeout(500); }
}
(async () => {
  const tag = Date.now().toString(36).slice(-4); const A = `Ana${tag}`, B = `Ben${tag}`, C = `Cai${tag}`;
  await api('register', { username: 'dina', password: PW, firstName: 'Dina', remember: true });
  const d = await api('login', { username: 'dina', password: PW, remember: true });
  await api('platform/students', { username: A.toLowerCase(), firstName: A, password: PW }, d.token);
  await api('platform/students', { username: B.toLowerCase(), firstName: B, password: PW }, d.token);
  await api('platform/students', { username: C.toLowerCase(), firstName: C, password: PW }, d.token);
  const b = await chromium.launch(); const errors = [];
  const page = async (viewport) => { const p = await (await b.newContext({ viewport })).newPage(); p.on('pageerror', (e) => errors.push(String(e))); return p; };
  const t = await page({ width: 1366, height: 800 }); await login(t, 'dina');
  await t.goto(BASE + '#/teach/room'); await t.waitForTimeout(2000);
  await t.getByTestId('room-example').click(); await t.getByTestId('import-review').waitFor({ timeout: 15000 });
  await t.getByTestId('review-create').click(); await t.getByTestId('teach-sheet').waitFor();
  ok(/Nobody chosen yet/.test(await t.getByTestId('room-class-summary').innerText()), 'pressing Teach asks who the lesson is for, with nobody chosen');
  for (const n of [A, B, C]) await t.getByTestId('class-student').filter({ hasText: n }).click();
  ok(/a group of 3/.test(await t.getByTestId('room-class-summary').innerText()) && new RegExp(`A group lesson for ${A}, ${B}, ${C}`).test(await t.getByTestId('room-group-note').innerText()), 'three students are chosen: a group lesson');
  await t.getByTestId('class-save').click(); await t.getByTestId('class-name').fill(`Martes ${tag}`); await t.getByTestId('class-name-save').click(); await t.waitForTimeout(1500);
  ok(new RegExp(`Martes ${tag}: a group of 3`).test(await t.getByTestId('room-class-summary').innerText()), 'they are saved as a named group');
  await t.getByTestId('room-class-clear').click(); await t.waitForTimeout(200);
  await t.getByTestId('class-chip').filter({ hasText: `Martes ${tag}` }).click(); await t.waitForTimeout(300);
  ok((await t.locator('[data-testid="class-student"][data-on]').count()) === 3, 'the named group picks all three in one tap');
  await t.getByTestId('class-student').filter({ hasText: C }).click(); await t.waitForTimeout(200);
  await t.getByTestId('teach-go').click(); await t.getByTestId('teacher-room').waitFor({ timeout: 15000 }); await t.waitForTimeout(1200);
  ok(new RegExp(`${A}, ${B} · a group of 2`).test(await t.getByTestId('plan-for').innerText()), 'the lesson is for the two who were left chosen');
  await t.getByTestId('to-present').click(); await t.getByTestId('start-lesson').click(); await t.waitForTimeout(500); await t.getByTestId('open-all').click(); await t.waitForTimeout(1500);
  // Each student joins on their own device.
  const sa = await page({ width: 390, height: 844 }), sb = await page({ width: 820, height: 1100 });
  for (const [p, u] of [[sa, A], [sb, B]]) { await login(p, u.toLowerCase()); await p.goto(BASE + '#/student'); await p.waitForTimeout(2500); await p.getByTestId('join-lesson').click(); await p.getByTestId('student-room').waitFor({ timeout: 15000 }); }
  await t.waitForTimeout(6000);
  ok(/2 of 2 here/.test(await t.getByTestId('presence').innerText()), `both are shown as here (${(await t.getByTestId('presence').innerText()).trim()})`);
  // The teacher goes to the first gap; one student answers, then the other.
  const kinds = await t.getByTestId('block-list').locator('li').allInnerTexts(); const gapAt = kinds.findIndex((x) => /Fill the gap/.test(x));
  await t.getByTestId(`goto-${gapAt}`).click(); await t.waitForTimeout(800);
  const answer = async (p, value) => { const inp = p.locator('input[data-testid^="answer-"]').first(); await inp.scrollIntoViewIfNeeded(); const id = (await inp.getAttribute('data-testid')).replace('answer-', ''); await inp.fill(value); await p.getByTestId(`send-${id}`).click(); };
  await answer(sa, 'fui'); await t.waitForTimeout(4500);
  const g1 = await t.getByTestId('group-answers').innerText();
  ok(/1 of 2 answered/.test(g1) && new RegExp(`Waiting for ${B}`).test(g1), 'after one answer the teacher sees 1 of 2, and who she is waiting for');
  await t.getByTestId('stage').screenshot({ path: OUT + '/group-waiting.png' });
  await answer(sb, 'zzz'); await t.waitForTimeout(4500);
  const g2 = await t.getByTestId('group-answers').innerText();
  ok(/Everyone has answered/.test(g2) && /fui/.test(g2) && /zzz/.test(g2), 'when the second answers: “Everyone has answered”, with each answer beside its name');
  ok((await t.getByTestId('group-answer').count()) === 2 && (await t.locator('[data-testid="group-answer"] svg').count()) >= 2, 'each answer is marked right or wrong');
  ok(/Everyone has answered/.test(await t.locator('body').innerText()), 'and she is notified');
  await t.getByTestId('stage').screenshot({ path: OUT + '/group-all.png' });
  ok(/2\/2 answered/.test(await t.getByTestId('block-list').innerText()), 'the list of parts shows 2/2 answered');
  // One student never sees the other's answer.
  ok(!/zzz/.test(await sa.getByTestId('student-room').innerText()), 'a student does not see another student’s answer');
  await t.goto(BASE + '#/teach/room'); await t.waitForTimeout(2500);
  await t.getByTestId('student-tab').filter({ hasText: A }).click(); await t.waitForTimeout(600);
  const rows = t.getByTestId('room-open');
  ok((await rows.count()) === 1 && /Group/.test(await rows.first().innerText()) && new RegExp(B).test(await rows.first().innerText()), 'each student’s tab shows the group lesson, with who it was with');
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  await b.close();
})();
