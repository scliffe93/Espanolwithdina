// Real accounts, end to end: the daily reminder control, the phone menu with "More", and a problem on a student's
// device reaching the administrator's Problems tab.
// Needs: the account API on :8787 started with VAPID keys, CRON_SECRET, ADMIN_USERNAMES=admin, TEACHER_USERNAMES=dina
// and ALLOWED_ORIGINS=http://localhost:4174, and a build made with VITE_LWD_API_URL=http://localhost:8787/account
// served on :4174. Usage: node scripts/upgrades-e2e.cjs <outDir>
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
(async () => {
  const tag = Date.now().toString(36).slice(-4);
  const sam = `sam${tag}`;
  await api('register', { username: 'admin', password: PW, firstName: 'Owner', remember: true });
  await api('register', { username: 'dina', password: PW, firstName: 'Dina', remember: true });
  const s = await api('register', { username: sam, password: PW, firstName: 'Sam', remember: true });
  ok(s.status === 201, 'accounts created');
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true }); const p = await ctx.newPage();

  await login(p, sam);
  await p.goto(BASE + '#/student'); await p.waitForTimeout(1500);
  const tabs = await p.locator('nav[aria-label="Main"]').last().locator('button').allInnerTexts();
  ok(tabs.length === 5 && /Más/.test(tabs[4]), `the phone menu is five tabs: ${tabs.map((t) => t.trim()).join(' | ')}`);
  ok(await p.getByTestId('streak').count() === 1, 'the home page shows the streak');
  await p.getByTestId('tab-more').click(); await p.waitForTimeout(500);
  ok(/Arcade/.test(await p.getByTestId('more-menu').innerText()), '"More" lists the rest');
  await p.screenshot({ path: OUT + '/upg-more.png' });
  await p.getByTestId('more-menu').getByRole('button', { name: /Me/ }).click(); await p.waitForTimeout(1500);

  // The daily reminder (Sam has not set up the storyline, so "Me" is the account page).
  ok(await p.getByTestId('troubleshooting').count() === 1, 'the account page has Troubleshooting');
  const card = p.getByTestId('reminder-card'); await card.scrollIntoViewIfNeeded();
  ok(await card.count() === 1, 'and the daily reminder');
  await p.getByTestId('reminder-time').fill('07:45'); await p.waitForTimeout(600);
  await p.getByTestId('reminder-toggle').check(); await p.waitForTimeout(800);
  const saved = await api('reminder', null, s.json.token);
  ok(saved.json.enabled === true && saved.json.time === '07:45' && !!saved.json.tz, `the reminder is saved on the server: ${saved.json.time} ${saved.json.tz}`);
  ok(await p.getByTestId('reminder-needs-push').count() === 1, 'it says notifications must be on for the reminder to arrive');
  await card.screenshot({ path: OUT + '/upg-reminder.png' });

  // Something fails on Sam's phone: the administrator sees it without anyone sending anything.
  await p.evaluate(() => { setTimeout(() => { throw new Error('Test fault from the end-to-end check'); }, 0); });
  await p.waitForTimeout(1500);
  ok(/Test fault/.test(await p.getByTestId('troubleshooting').innerText()), 'the problem is listed on Sam’s own Troubleshooting');
  await ctx.close();

  const actx = await b.newContext({ viewport: { width: 1200, height: 900 } }); const a = await actx.newPage();
  await login(a, 'admin');
  await a.goto(BASE + '#/admin'); await a.waitForTimeout(2500);
  await a.getByRole('radio', { name: 'Problems' }).click().catch(async () => { await a.getByText('Problems', { exact: true }).click(); });
  await a.waitForTimeout(1500);
  const text = await a.getByTestId('admin-problems').innerText();
  ok(/Something failed/.test(text) && /Test fault/.test(text) && /Sam/.test(text), 'the administrator’s Problems tab lists it, with who it happened to');
  await a.getByTestId('admin-problems').screenshot({ path: OUT + '/upg-problems.png' });
  const before = await a.getByRole('button', { name: 'Done' }).count();
  await a.getByRole('button', { name: 'Done' }).first().click(); await a.waitForTimeout(1200);
  ok(await a.getByRole('button', { name: 'Done' }).count() === before - 1, '"Done" clears one problem');
  await a.getByRole('button', { name: 'Clear all' }).click().catch(() => {}); await a.waitForTimeout(1200);
  ok(await a.getByTestId('no-problems').count() === 1, '"Clear all" empties the list');
  await b.close();
})();
