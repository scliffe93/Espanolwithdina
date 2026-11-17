// The plan library with real accounts: a plan the teacher uploads is still in her library after a reload, keeps its
// status, and becomes a lesson for a student. Needs the account API on :8787 (TEACHER_USERNAMES=dina,
// ALLOWED_ORIGINS=http://localhost:4174) and a build made for it on :4174. Usage: node scripts/library-cloud-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4174/'; const API = 'http://localhost:8787/account';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
const PW = 'tortilla de patatas 2026';
const api = async (p, body, token) => { const r = await fetch(`${API}/${p}`, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', origin: 'http://localhost:4174', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); return t ? JSON.parse(t) : null; };
const PLAN = ['# Spanish A2 — Lesson 3: Food and Drink', '', 'CEFR Level:\tA2\tDuration:\t25 Minutes', '', '# 1. Key Phrases', '', 'Spanish Expression\tEnglish Meaning', 'el pan / el agua\tbread / water', '¿Qué quieres? — Quiero...\tWhat do you want? — I want...', 'la cuenta\tthe bill', '', '0–5 MINS\tStage 1: Warm-Up', 'Board Setup: Write five words on the board: menú, café, tomate, limón, sal.', '', '5–25 MINS\tStage 2: Presentation', 'Drill: Ask "¿Qué quieres?" around the class.', '', 'Exercise A: Match', '1. el pan\t[ ___ ]\ta. water', '2. el agua\t[ ___ ]\tb. bread', '', 'Answer Key: Ex A: 1-b, 2-a'].join('\n');
(async () => {
  const tag = Date.now().toString(36).slice(-4);
  await api('register', { username: 'dina', password: PW, firstName: 'Dina', remember: true });
  const d = await api('login', { username: 'dina', password: PW, remember: true });
  await api('platform/students', { username: `leo${tag}`, firstName: `Leo${tag}`, password: PW }, d.token);
  const b = await chromium.launch(); const errors = [];
  const p = await (await b.newContext({ viewport: { width: 1366, height: 800 } })).newPage(); p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(BASE + '#/account'); await p.waitForTimeout(900);
  await p.getByRole('radio', { name: 'Log in' }).click(); await p.waitForTimeout(300);
  await p.getByLabel('Username').fill('dina'); await p.getByLabel('Password', { exact: true }).fill(PW);
  await p.getByRole('button', { name: /^Log in/ }).last().click(); await p.waitForTimeout(2200);
  const cont = p.getByTestId('welcome-continue'); if (await cont.count()) { await cont.click().catch(() => {}); await p.waitForTimeout(500); }
  await p.goto(BASE + '#/teach/room'); await p.waitForTimeout(2000);
  if (await p.getByTestId('room-class-clear').count()) await p.getByTestId('room-class-clear').click(); await p.getByTestId('class-student').filter({ hasText: `Leo${tag}` }).click(); await p.waitForTimeout(600);
  const before = await p.getByTestId('library-plan').count();
  await p.getByTestId('room-file').setInputFiles({ name: `Food ${tag}.txt`, mimeType: 'text/plain', buffer: Buffer.from(PLAN, 'utf8') });
  await p.getByTestId('import-review').waitFor({ timeout: 15000 });
  ok((await p.getByTestId('review-level').inputValue()) === 'A2', 'the plan is read and filed under its level');
  await p.getByTestId('review-ready').click(); await p.waitForTimeout(1500);
  await p.reload(); await p.waitForTimeout(2500);
  const mine = p.getByTestId('library-plan').filter({ hasText: `Food ${tag}.txt` });
  ok((await p.getByTestId('library-plan').count()) === before + 1 && (await mine.getAttribute('data-status')) === 'ready', 'after a reload it is still in the library, marked ready');
  if (await p.getByTestId('room-class-clear').count()) await p.getByTestId('room-class-clear').click(); await p.getByTestId('class-student').filter({ hasText: `Leo${tag}` }).click(); await p.waitForTimeout(600);
  await mine.getByTestId('library-use').click(); await p.getByTestId('teacher-room').waitFor({ timeout: 10000 }); await p.waitForTimeout(800);
  ok(new RegExp(`Leo${tag} · level`).test(await p.getByTestId('plan-for').innerText()) && (await p.getByTestId('block-editor').count()) >= 5, 'and it becomes a lesson for the student');
  await p.goto(BASE + '#/teach/room'); await p.waitForTimeout(2000);
  await p.getByTestId('library-plan').filter({ hasText: `Food ${tag}.txt` }).getByTestId('library-review').click(); await p.getByTestId('import-review').waitFor();
  p.once('dialog', (dlg) => void dlg.accept()); await p.getByTestId('review-delete').click(); await p.waitForTimeout(1500);
  await p.reload(); await p.waitForTimeout(2500);
  ok((await p.getByTestId('library-plan').filter({ hasText: `Food ${tag}.txt` }).count()) === 0 && (await (async () => { await p.getByTestId('student-tab').filter({ hasText: `Leo${tag}` }).click(); await p.waitForTimeout(600); return p.getByTestId('room-open').count(); })()) >= 1, 'deleting the plan removes it from the library and keeps the lesson made from it');
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  await b.close();
})();
