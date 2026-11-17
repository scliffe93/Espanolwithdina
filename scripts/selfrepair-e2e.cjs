// Self-repair with real accounts: a lesson that will not open is retried by the app itself, the student is told
// calmly, the administrator is sent what was tried, and the lesson appears by itself once the fault is gone.
// Needs the account API on :8787 (TEACHER_USERNAMES=dina, ADMIN_USERNAMES=admin, ALLOWED_ORIGINS=http://localhost:4174)
// and a build made for it on :4174. Usage: node scripts/selfrepair-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4174/'; const API = 'http://localhost:8787/account'; const OUT = process.argv[2] || '.';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
const PW = 'tortilla de patatas 2026';
const api = async (p, body, token, method) => { const r = await fetch(`${API}/${p}`, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', origin: 'http://localhost:4174', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); return t ? JSON.parse(t) : null; };
(async () => {
  const tag = Date.now().toString(36).slice(-4); const name = `Sol${tag}`;
  await api('register', { username: 'admin', password: PW, firstName: 'Owner', remember: true });
  await api('register', { username: 'dina', password: PW, firstName: 'Dina', remember: true });
  const d = await api('login', { username: 'dina', password: PW, remember: true });
  const made = await api('platform/students', { username: name.toLowerCase(), firstName: name, password: PW }, d.token);
  const id = `lesson-${tag}0123456789abcdef`;
  await api('platform/records', { kind: 'lesson', id, studentId: made.user.id, data: { title: 'Ir y ser', blocks: [{ id: 'q1abc', type: 'question', title: '', body: '¿Qué hiciste ayer?', open: true }], live: { on: true, current: 'q1abc', startedAt: new Date().toISOString() } } }, d.token, 'PUT');
  const b = await chromium.launch(); const errors = [];
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(BASE + '#/account'); await p.waitForTimeout(900);
  await p.getByRole('radio', { name: 'Log in' }).click(); await p.waitForTimeout(300);
  await p.getByLabel('Username').fill(name.toLowerCase()); await p.getByLabel('Password', { exact: true }).fill(PW);
  await p.getByRole('button', { name: /^Log in/ }).last().click(); await p.waitForTimeout(2200);
  const cont = p.getByTestId('welcome-continue'); if (await cont.count()) { await cont.click().catch(() => {}); await p.waitForTimeout(500); }
  // The server fails every time the lesson is asked for, as it did on the live site.
  let calls = 0; let broken = true; const reports = [];
  await p.route('**/account/platform/lessons/sync', (route) => { if (!broken) return route.continue(); calls++; return route.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': 'http://localhost:4174' }, body: JSON.stringify({ error: 'server_error', message: 'Something went wrong. Please try again.' }) }); });
  p.on('request', (r) => { if (/\/account\/report$/.test(r.url()) && r.method() === 'POST') { try { reports.push(JSON.parse(r.postData() || '{}')); } catch { /* ignore */ } } });
  await p.goto(BASE + `#/student/room/${id}`); await p.waitForTimeout(3500);
  ok(/trying again by itself/.test(await p.getByTestId('room-trouble').innerText()), 'the student is told the app is trying again by itself, not shown an error');
  ok(calls >= 3, `each try asks three times (${calls} requests so far)`);
  await p.screenshot({ path: OUT + '/repair-trying.png' });
  await p.getByTestId('room-trouble').filter({ hasText: 'will not open yet' }).waitFor({ timeout: 60000 });
  const told = await p.getByTestId('room-trouble').innerText();
  ok(/The team has been told what happened and what was tried/.test(told) && /still trying/.test(told), 'after several tries it says the team has been told, and that it is still trying');
  await p.screenshot({ path: OUT + '/repair-told.png' });
  await p.waitForTimeout(1500);
  const sent = reports.find((r) => /A lesson would not open/.test(r.message || ''));
  ok(!!sent && sent.kind === 'crash' && /What the app tried by itself/.test(sent.detail || '') && /Kept asking/.test(sent.detail || ''), 'the administrator is sent the problem with every step the app tried');
  // The fault is cured (as the backend fix will): the lesson appears with nobody doing anything.
  broken = false;
  await p.getByTestId('student-room').waitFor({ timeout: 20000 });
  ok(/Qué hiciste ayer/.test(await p.getByTestId('student-room').innerText()), 'once the fault is gone the lesson opens by itself');
  const a = await api('login', { username: 'admin', password: PW, remember: true });
  const list = await api('admin/reports', null, a.token);
  const row = (list.reports || []).find((r) => /A lesson would not open/.test(r.message) && r.firstName === name);
  ok(!!row && /What the app tried by itself/.test(row.detail), 'and it is in the administrator’s Problems list, with what was tried');
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  await b.close();
})();
