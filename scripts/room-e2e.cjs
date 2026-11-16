// The lesson room with real accounts on two devices at once: the teacher on a laptop (the screen she shares) and the
// student on a phone. She plans, starts the lesson and opens parts one at a time; he sees only what is open, his
// screen follows hers, and his answers appear on her screen. Her notes and unopened parts never reach him.
// Needs: the account API on :8787 (TEACHER_USERNAMES=dina, ALLOWED_ORIGINS=http://localhost:4174) and a build made
// with VITE_LWD_API_URL=http://localhost:8787/account served on :4174. Usage: node scripts/room-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4174/'; const API = 'http://localhost:8787/account'; const OUT = process.argv[2] || '.';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
const PW = 'tortilla de patatas 2026';
const api = async (p, body) => { const r = await fetch(`${API}/${p}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4174' }, body: JSON.stringify(body) }); return r.status; };
async function login(p, user) {
  await p.goto(BASE + '#/account'); await p.waitForTimeout(900);
  await p.getByRole('radio', { name: 'Log in' }).click(); await p.waitForTimeout(300);
  await p.getByLabel('Username').fill(user); await p.getByLabel('Password', { exact: true }).fill(PW);
  await p.getByRole('button', { name: /^Log in/ }).last().click(); await p.waitForTimeout(2200);
  const cont = p.getByTestId('welcome-continue'); if (await cont.count()) { await cont.click().catch(() => {}); await p.waitForTimeout(500); }
}
/** Waits (up to `ms`) for something to become true on a page: the two devices only meet every couple of seconds. */
async function until(fn, ms = 9000) { const end = Date.now() + ms; for (;;) { if (await fn().catch(() => false)) return true; if (Date.now() > end) return false; await new Promise((r) => setTimeout(r, 300)); } }

(async () => {
  const tag = Date.now().toString(36).slice(-4); const sam = `sam${tag}`; const first = `Sam ${tag}`; // a name of its own, so repeated runs never pick an earlier student
  await api('register', { username: 'dina', password: PW, firstName: 'Dina', remember: true });
  ok((await api('register', { username: sam, password: PW, firstName: first, remember: true })) === 201, 'a teacher and a student account');
  const b = await chromium.launch(); const errors = [];
  const tctx = await b.newContext({ viewport: { width: 1366, height: 860 } }); const t = await tctx.newPage(); t.on('pageerror', (e) => errors.push('teacher: ' + e));
  const sctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true }); const s = await sctx.newPage(); s.on('pageerror', (e) => errors.push('student: ' + e));

  // ── Before the lesson: Dina plans it. ──
  await login(t, 'dina');
  await t.goto(BASE + '#/teach/room'); await t.waitForTimeout(1500);
  await t.getByTestId('room-student').selectOption({ label: first });
  await t.getByTestId('room-blank').click(); await t.getByTestId('teacher-room').waitFor({ timeout: 10000 });
  await t.getByTestId('room-title').fill('El pretérito: ir y ser');
  await t.getByTestId('room-notes').fill('PRIVATE: Sam mixes up fui and fue. Go slowly.');
  await t.getByTestId('block-body').first().fill('¿Qué hiciste el fin de semana?');
  await t.getByTestId('add-gap').click(); await t.getByTestId('block-body').nth(1).fill('Ayer yo ___ (ir) al mercado.'); await t.getByTestId('block-answer').first().fill('fui');
  await t.getByTestId('add-choice').click(); await t.getByTestId('block-body').nth(2).fill('Madrid ___ en España.'); await t.getByTestId('block-options').fill('es\nestá'); await t.locator('select[data-testid="block-answer"]').selectOption('está');
  await t.getByTestId('add-text').click(); await t.getByTestId('block-body').nth(3).fill('SECRET PART: the answers to next week’s test.');
  ok(await until(async () => (await t.getByTestId('save-state').innerText()) === 'Saved'), 'the plan is edited and saved by itself (four parts, with private notes)');
  await t.screenshot({ path: OUT + '/room-plan.png' });
  await t.reload(); await t.getByTestId('teacher-room').waitFor({ timeout: 10000 }); await t.waitForTimeout(800);
  ok((await t.getByTestId('room-title').inputValue()) === 'El pretérito: ir y ser' && (await t.getByTestId('block-editor').count()) === 4, 'the plan is still there after reloading: she can prepare it days ahead');

  // ── Sam, before the lesson starts: nothing to join. ──
  await login(s, sam);
  await s.goto(BASE + '#/student'); await s.waitForTimeout(1500);
  ok(await s.getByTestId('join-lesson').count() === 0, 'before the lesson starts, the student is offered nothing');

  // ── The lesson starts. ──
  await t.getByTestId('to-present').click(); await t.waitForTimeout(400);
  ok((await t.getByTestId('presence').getAttribute('data-here')) === 'false', 'the teacher sees the student is not there yet');
  await t.getByTestId('start-lesson').click();
  const reqs = []; s.on('response', (r) => { if (/platform\/records\?kind=lesson/.test(r.url())) r.text().then((x) => reqs.push(x.slice(0, 140))).catch(() => {}); });
  const appeared = await until(async () => (await s.getByTestId('join-lesson').count()) === 1, 15000);
  if (!appeared) console.log('  debug: teacher save state =', await t.getByTestId('save-state').innerText(), '| teacher errors =', await t.locator('[role=alert]').allInnerTexts(), '| student got', reqs.length, 'lesson lists, last:', reqs[reqs.length - 1], '| url', s.url());
  ok(appeared, '“Your lesson is open” appears on the student’s home page by itself');
  await s.getByTestId('join-lesson').tap(); await s.getByTestId('student-room').waitFor({ timeout: 10000 });
  ok(await until(async () => (await s.getByTestId('room-waiting').count()) === 1), 'he joins and sees nothing yet: no part has been opened');
  ok(await until(async () => (await t.getByTestId('presence').getAttribute('data-here')) === 'true'), 'the teacher sees that he is here');

  // ── She opens the first part; he answers; she sees it. ──
  ok(/Only you can see this/.test(await t.getByTestId('stage-status').innerText()), 'the part on her screen is marked “Only you can see this”');
  await t.getByTestId('show-to-student').click();
  ok(await until(async () => (await s.locator('[data-testid^="block-"]').count()) === 1 && /fin de semana/.test(await s.getByTestId('student-room').innerText())), 'she shows it, and it appears on his phone');
  const firstId = (await s.locator('[data-testid^="block-"]').first().getAttribute('data-testid')).replace('block-', '');
  await s.getByTestId(`answer-${firstId}`).fill('Fui a la playa con mis amigos.'); await s.getByTestId(`send-${firstId}`).tap();
  ok(await until(async () => /Fui a la playa con mis amigos\./.test(await t.getByTestId(`shown-${firstId}`).innerText())), 'his answer appears on her shared screen');
  await t.screenshot({ path: OUT + '/room-present.png' });

  // ── She moves on. The next part stays hidden until she opens it. ──
  await t.getByTestId('next-part').click(); await t.waitForTimeout(3500);
  ok((await s.locator('[data-testid^="block-"]').count()) === 1, 'moving to the next part does not show it to him');
  await t.getByTestId('show-to-student').click();
  ok(await until(async () => (await s.locator('[data-testid^="block-"]').count()) === 2), 'opening it does');
  ok(await until(async () => (await s.locator('[data-current="true"]').count()) === 1 && /mercado/.test(await s.locator('[data-current="true"]').innerText())), 'and his screen follows her to it');
  const gapId = (await s.locator('[data-current="true"]').getAttribute('data-testid')).replace('block-', '');
  await s.getByTestId(`answer-${gapId}`).fill('fue'); await s.getByTestId(`send-${gapId}`).tap();
  ok(await until(async () => /Not quite/.test(await s.getByTestId(`verdict-${gapId}`).innerText())), 'a wrong answer is marked, and he can try again');
  await s.getByTestId(`answer-${gapId}`).fill('fui'); await s.getByTestId(`send-${gapId}`).tap();
  ok(await until(async () => /Correcto/.test(await s.getByTestId(`verdict-${gapId}`).innerText())), 'the right answer is marked right');
  ok(await until(async () => /answered ✓/.test(await t.getByTestId('block-list').innerText())), 'she sees it ticked in her list');
  await s.screenshot({ path: OUT + '/room-student.png' });

  // ── Opening a part from the list, for a quick choice question. ──
  await t.getByTestId('toggle-2').click();
  ok(await until(async () => (await s.locator('[data-testid^="option-"]').count()) === 2), 'she opens the third part from her list and it arrives');
  await s.locator('[data-testid^="option-"]', { hasText: 'está' }).tap();
  ok(await until(async () => /answered ✓/.test((await t.getByTestId('block-list').locator('li').nth(2).innerText()))), 'his choice shows on her side');

  // ── What he must never see. ──
  const his = await s.getByTestId('student-room').innerText();
  ok(!/PRIVATE|SECRET/.test(his) && (await s.locator('[data-testid^="block-"]').count()) === 3, 'her private notes and the unopened part are nowhere on his device');
  const leaked = await s.evaluate(async (apiUrl) => { const tok = JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /session/i.test(k)) || '') || '{}').token; const r = await fetch(`${apiUrl}/platform/records?kind=lesson`, { headers: { authorization: `Bearer ${tok}` } }); return await r.text(); }, API).catch(() => '');
  ok(leaked.length > 20 && !/PRIVATE|SECRET/.test(leaked), 'nor in anything the server sends his device');

  // ── She closes a part again, then ends the lesson. ──
  await t.getByTestId('toggle-0').click();
  ok(await until(async () => (await s.locator('[data-testid^="block-"]').count()) === 2), 'closing a part takes it off his screen');
  await t.getByTestId('end-lesson').click();
  ok(await until(async () => /The lesson is over/.test(await s.getByTestId('room-status').innerText())), 'when she ends the lesson, his page becomes his notes from it');
  await s.goto(BASE + '#/student'); await s.waitForTimeout(2500);
  console.log('  home card:', JSON.stringify((await s.getByTestId('room-card').innerText().catch((e) => 'none: ' + String(e).slice(0, 60))).slice(0, 160)), 'join:', await s.getByTestId('join-lesson').count());
  ok(await s.getByTestId('join-lesson').count() === 0 && /Notes from your lessons/i.test(await s.getByTestId('room-card').innerText()), 'and it is listed under “Notes from your lessons” on his home page');
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  await b.close();
})();
