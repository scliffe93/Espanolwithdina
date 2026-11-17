const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4174/'; const API = 'http://localhost:8787/account'; const OUT = process.argv[2] || '.';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
const PW = 'tortilla de patatas 2026';
const api = async (p, body, token) => { const r = await fetch(`${API}/${p}`, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', origin: 'http://localhost:4174', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); return { status: r.status, json: t ? JSON.parse(t) : null }; };
async function login(p, user) {
  await p.goto(BASE + '#/account'); await p.waitForTimeout(900);
  await p.getByRole('radio', { name: 'Log in' }).click(); await p.waitForTimeout(300);
  await p.getByLabel('Username').fill(user); await p.getByLabel('Password', { exact: true }).fill(PW);
  await p.getByRole('button', { name: /^Log in/ }).last().click(); await p.waitForTimeout(2200);
  const cont = p.getByTestId('welcome-continue'); if (await cont.count()) { await cont.click().catch(() => {}); await p.waitForTimeout(500); }
}
// The report-a-problem button: a logged-in student writes a note from any screen and the administrator sees it in
// Problems; someone not logged in is given the note to copy. Needs the account API on :8787 (ADMIN_USERNAMES=admin,
// ALLOWED_ORIGINS=http://localhost:4174) and a build made for it on :4174. Usage: node scripts/report-e2e.cjs <outDir>
(async () => {
  const tag = Date.now().toString(36).slice(-4); const sam = `sam${tag}`;
  const b = await chromium.launch(); const errors = [];
  await api('register', { username: 'admin', password: PW, firstName: 'Owner', remember: true });
  await api('register', { username: sam, password: PW, firstName: 'Sam', remember: true });
  for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 1024, height: 768 }]]) {
    const p = await (await b.newContext({ viewport })).newPage(); p.on('pageerror', (e) => errors.push(String(e)));
    await login(p, sam);
    await p.goto(BASE + '#/verbs'); await p.waitForTimeout(1500);
    const btn = p.getByTestId('report-open'); const box = await btn.boundingBox();
    ok(!!box && box.y + box.height <= viewport.height && box.x + box.width <= viewport.width, `${name}: the button is on screen on the verb page`);
    const nav = await p.locator('nav').last().boundingBox().catch(() => null);
    ok(!nav || name !== 'phone' || box.y + box.height <= nav.y + 2, `${name}: it sits above the bottom menu`);
    await btn.click(); await p.getByTestId('report-text').fill(`The verb page looked odd on my ${name} (${tag}).`);
    if (name === 'phone') await p.screenshot({ path: OUT + '/report-form.png' });
    await p.getByTestId('report-send').click(); await p.getByTestId('report-done').waitFor({ timeout: 8000 });
    ok(/has been sent/.test(await p.getByTestId('report-done').innerText()), `${name}: Sam’s note is sent`);
    await p.context().close();
  }
  const a = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); a.on('pageerror', (e) => errors.push(String(e)));
  await login(a, 'admin');
  await a.goto(BASE + '#/admin'); await a.waitForTimeout(2500);
  await a.getByRole('radio', { name: 'Problems' }).click().catch(async () => { await a.getByText('Problems', { exact: true }).click(); });
  await a.waitForTimeout(1500);
  const text = await a.getByTestId('admin-problems').innerText();
  ok(new RegExp(`looked odd on my phone \\(${tag}\\)`).test(text) && new RegExp(`looked odd on my tablet \\(${tag}\\)`).test(text) && /Sam/.test(text) && /on “(verbs|welcome)”/.test(text), 'the administrator sees both notes in Problems, with who wrote them and the page');
  await a.getByTestId('admin-problems').screenshot({ path: OUT + '/report-admin.png' });
  // Not logged in: nothing can be sent, so the note is copied.
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] }); const g = await ctx.newPage(); g.on('pageerror', (e) => errors.push(String(e)));
  await g.goto(BASE + '#/guide'); await g.waitForTimeout(1500);
  await g.getByTestId('report-open').click(); await g.getByTestId('report-text').fill('I cannot log in.'); await g.getByTestId('report-send').click();
  await g.getByTestId('report-done').waitFor({ timeout: 8000 });
  ok(/Copied/.test(await g.getByTestId('report-done').innerText()) && /I cannot log in\./.test(await g.evaluate(() => navigator.clipboard.readText())), 'someone not logged in gets the note copied to send themselves');
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  await b.close();
})();
