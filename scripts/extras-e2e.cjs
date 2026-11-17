// The whiteboard, the teacher's notes, the student's notes and the word and verb banks, with real accounts on two
// devices. Needs the account API on :8787 (TEACHER_USERNAMES=dina, ALLOWED_ORIGINS=http://localhost:4174) and a build
// made for it on :4174. Usage: node scripts/extras-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4174/'; const API = 'http://localhost:8787/account'; const OUT = process.argv[2] || '.';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
const PW = 'tortilla de patatas 2026';
const api = async (p, body, token, method) => { const r = await fetch(`${API}/${p}`, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', origin: 'http://localhost:4174', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); return t ? JSON.parse(t) : null; };
async function login(p, user) {
  await p.goto(BASE + '#/account'); await p.waitForTimeout(900);
  await p.getByRole('radio', { name: 'Log in' }).click(); await p.waitForTimeout(300);
  await p.getByLabel('Username').fill(user); await p.getByLabel('Password', { exact: true }).fill(PW);
  await p.getByRole('button', { name: /^Log in/ }).last().click(); await p.waitForTimeout(2200);
  const cont = p.getByTestId('welcome-continue'); if (await cont.count()) { await cont.click().catch(() => {}); await p.waitForTimeout(500); }
}
(async () => {
  const tag = Date.now().toString(36).slice(-4); const name = `Nia${tag}`;
  await api('register', { username: 'dina', password: PW, firstName: 'Dina', remember: true });
  const d = await api('login', { username: 'dina', password: PW, remember: true });
  const made = await api('platform/students', { username: name.toLowerCase(), firstName: name, password: PW }, d.token);
  const id = `lesson-${tag}0123456789abcdef`;
  await api('platform/records', { kind: 'lesson', id, studentId: made.user.id, data: { title: `En la playa ${tag}`, blocks: [
    { id: 'q1abc', type: 'question', title: '', body: '¿Adónde vas en verano?' },
    { id: 'v1abc', type: 'vocab', title: '', body: '', pairs: [{ es: 'la playa', en: 'the beach' }, { es: 'comer', en: 'to eat' }] },
  ], live: { on: false, current: null } } }, d.token, 'PUT');
  const b = await chromium.launch(); const errors = [];
  const page = async (viewport) => { const p = await (await b.newContext({ viewport })).newPage(); p.on('pageerror', (e) => errors.push(String(e))); return p; };
  const t = await page({ width: 1366, height: 820 }); await login(t, 'dina');
  await t.goto(BASE + `#/teach/room/${id}`); await t.getByTestId('teacher-room').waitFor({ timeout: 15000 }); await t.waitForTimeout(800);
  ok((await t.getByTestId('block-editor').count()) === 2, 'the lesson has its two parts');
  await t.getByTestId('to-present').click(); await t.getByTestId('start-lesson').click(); await t.waitForTimeout(500); await t.getByTestId('open-all').click(); await t.waitForTimeout(800);
  // The whiteboard: typed text and a pen stroke.
  await t.getByRole('radio', { name: 'Whiteboard' }).click(); await t.getByTestId('whiteboard').waitFor();
  await t.getByTestId('board-type').fill('ir = to go\nHoy vamos a hablar');
  const box = await t.getByTestId('board-surface').boundingBox();
  await t.getByTestId('board-ink-1').click();
  await t.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.6); await t.mouse.down();
  for (let k = 1; k <= 12; k++) await t.mouse.move(box.x + box.width * (0.3 + k * 0.03), box.y + box.height * (0.6 + Math.sin(k) * 0.05));
  await t.mouse.up(); await t.waitForTimeout(1800);
  ok((await t.getByTestId('board-surface').getAttribute('data-strokes')) === '1' && /Hoy vamos a hablar/.test(await t.getByTestId('board-text').innerText()), 'the teacher types and draws on the whiteboard');
  await t.getByTestId('stage').screenshot({ path: OUT + '/extras-board.png' });
  // Her own notes, under the screen.
  await t.getByTestId('present-notes').locator('summary').click(); await t.getByTestId('present-notes-text').fill(`Privado ${tag}: repasar el pretérito`); await t.waitForTimeout(1500);
  // The student joins: no whiteboard yet, no teacher's notes, and a place for their own.
  const s = await page({ width: 820, height: 1100 }); await login(s, name.toLowerCase());
  await s.goto(BASE + `#/student/room/${id}`); await s.getByTestId('student-room').waitFor({ timeout: 15000 }); await s.waitForTimeout(2500);
  const first = await s.getByTestId('student-room').innerText();
  ok((await s.locator('[data-testid^="block-"]').count()) === 2 && await s.getByTestId('student-board').count() === 0 && !/Privado/.test(first), 'the student sees the two parts, not the whiteboard yet, and never the teacher’s notes');
  await s.getByTestId('student-notes-text').fill(`Me gusta la palabra playa ${tag}`); await s.waitForTimeout(2500);
  await s.reload(); await s.getByTestId('student-room').waitFor({ timeout: 15000 }); await s.waitForTimeout(2500);
  ok((await s.getByTestId('student-notes-text').inputValue()) === `Me gusta la palabra playa ${tag}`, 'the student’s own notes are saved with the lesson');
  // Ending the lesson publishes the whiteboard to the student.
  await t.getByTestId('end-lesson').click(); await t.waitForTimeout(1500);
  await s.waitForTimeout(6000);
  ok(await s.getByTestId('student-board').count() === 1 && /ir = to go/.test(await s.getByTestId('student-board').innerText()) && (await s.getByTestId('student-board').locator('path').count()) === 1, 'when the lesson ends the whiteboard is there for the student, text and drawing');
  ok((await s.getByTestId('student-notes-text').inputValue()) === `Me gusta la palabra playa ${tag}`, 'and their notes are still there after the lesson');
  await s.screenshot({ path: OUT + '/extras-student.png', fullPage: true });
  // After the lesson: the teacher banks words and verbs.
  await t.getByRole('radio', { name: 'Plan' }).click(); await t.waitForTimeout(600);
  ok((await t.getByTestId('block-editor').count()) === 2, 'the whiteboard and notes are not listed among the lesson’s parts');
  await t.getByTestId('lesson-bank-open').click();
  const words = await t.getByTestId('bank-word').allInnerTexts(), verbs = await t.getByTestId('bank-verb').allInnerTexts();
  ok(words.some((w) => /la playa/.test(w)) && ['comer', 'ir', 'hablar'].every((v) => verbs.some((x) => x.startsWith(v))) && (await t.locator('[data-testid="bank-word"][data-on], [data-testid="bank-verb"][data-on]').count()) === 0, `it offers the lesson’s words and verbs, none ticked (${words.length} words; verbs: ${verbs.map((x) => x.split(/[a-z](?=[A-Z])|to /)[0]).join(', ')})`);
  await t.getByTestId('bank-word').filter({ hasText: 'la playa' }).click();
  await t.getByTestId('bank-verb').filter({ hasText: 'comer' }).click(); await t.getByTestId('bank-verb').filter({ hasText: 'hablar' }).click();
  await t.getByTestId('bank-add').fill('el verano = the summer'); await t.getByTestId('bank-add-go').click();
  await t.screenshot({ path: OUT + '/extras-bank.png', fullPage: true });
  await t.getByTestId('lesson-bank-save').click(); await t.waitForTimeout(1800);
  ok(/2 words and 2 verbs banked/.test(await t.getByTestId('lesson-bank-count').innerText()), 'she banks the ones she ticked, and one of her own');
  await s.goto(BASE + '#/student'); await s.waitForTimeout(6000);
  await s.getByTestId('my-bank-open').click(); await s.waitForTimeout(300);
  const bank = await s.getByTestId('my-bank').innerText();
  ok(/2 words and 2 verbs/.test(bank) && /la playa/.test(bank) && /el verano/.test(bank) && /comer/.test(bank) && /hablar/.test(bank) && !/\bir\b · to go/.test(bank), 'the student finds them in their word and verb bank');
  ok(await s.getByTestId('lesson-note').filter({ hasText: `En la playa ${tag}` }).count() === 1, 'and the lesson is in their notes to go back to');
  await s.screenshot({ path: OUT + '/extras-home.png' });
  // Verbs are released one by one.
  await t.goto(BASE + `#/teach/student/${made.user.id}`); await t.waitForTimeout(2000);
  await t.getByTestId('release-on').click(); await t.waitForTimeout(1500);
  await t.getByTestId('release-next-verbs').click(); await t.getByTestId('release-choose-verbs').waitFor();
  const boxes = t.locator('[data-testid^="release-verb-"]'); await boxes.nth(1).check(); await boxes.nth(2).check();
  await t.getByTestId('release-choose-verbs').screenshot({ path: OUT + '/extras-verbs.png' });
  await t.getByTestId('release-ticked').click(); await t.waitForTimeout(1500);
  ok(/14 verbs in 1 of/.test(await t.getByTestId('release-summary').innerText()), 'the next verbs are checked first and only the two she ticked are released');
  const rec = (await api(`platform/records?kind=student&studentId=${made.user.id}`, null, d.token)).records[0];
  ok(rec.stepped === true && rec.verbs.length === 2 && rec.unlocked.length >= 1, `the student’s record holds exactly those two extra verbs (${rec.verbs.join(', ')})`);
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  await b.close();
})();
