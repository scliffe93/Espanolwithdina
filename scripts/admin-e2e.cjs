// Admin role: overview, accounts table, role change, password reset, teacher dashboards, removal. Needs ADMIN_USERNAMES=admin API on :8787 and an API-enabled build on :4173. Usage: node scripts/admin-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2]; const PW = 'tortilla de patatas 2026';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
async function register(p, username, firstName) {
  await p.goto(BASE + '#/account?mode=register'); await p.waitForTimeout(800);
  await p.getByLabel('Username').fill(username); await p.getByLabel('Your first name').fill(firstName);
  await p.getByLabel('Password', { exact: true }).fill(PW); await p.getByLabel('Repeat password').fill(PW);
  await p.getByRole('button', { name: 'Create my account' }).click();
  await p.getByRole('checkbox', { name: /saved my recovery code/ }).check(); await p.getByRole('button', { name: /^Continue/ }).click();
  await p.getByTestId('welcome-continue').click({ timeout: 10000 }); await p.waitForTimeout(600);
}
(async () => {
  const b = await chromium.launch(); const errors = [];
  const sctx = await b.newContext(); const s = await sctx.newPage(); await register(s, 'lucia', 'Lucía'); await sctx.close();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e)));
  await register(p, 'admin', 'Owner');
  await p.goto(BASE + '#/home'); await p.waitForTimeout(1200);
  ok(/administrator/.test(await p.getByTestId('platform-signed-in').innerText()), 'front page recognises the administrator');
  await p.getByTestId('open-admin').click(); await p.waitForTimeout(1500);
  ok(await p.getByTestId('admin-overview').isVisible(), 'admin overview renders');
  const t = await p.getByTestId('admin-users').innerText();
  ok(/Owner/.test(t) && /Lucía/.test(t), 'accounts table lists the admin and the student');
  await p.screenshot({ path: OUT + '/admin.png', fullPage: true });
  // Promote Lucía to teacher via the role select
  await p.getByLabel('Role of Lucía').selectOption('teacher'); await p.waitForTimeout(1500);
  ok((await p.getByLabel('Role of Lucía').inputValue()) === 'teacher', 'role changed to teacher');
  // Reset her password
  await p.getByTestId('reset-lucia').click(); await p.waitForTimeout(400);
  await p.getByTestId('confirm-reset').click(); await p.waitForTimeout(1500);
  const details = await p.getByTestId('reset-details').innerText();
  const newPw = (details.match(/Password\s*([a-záéíóúñ ]+\d{2})/) || [])[1];
  ok(!!newPw, 'temporary password generated: ' + newPw);
  await p.getByRole('button', { name: 'Done' }).click();
  // Lucía can log in with it and now has the teacher dashboard
  const lctx = await b.newContext(); const l = await lctx.newPage();
  await l.goto(BASE + '#/account?user=lucia'); await l.waitForTimeout(800);
  await l.getByLabel('Password', { exact: true }).fill(newPw); await l.getByRole('button', { name: 'Log in', exact: true }).click(); await l.waitForTimeout(1500);
  const wc = l.getByTestId('welcome-continue'); if (await wc.isVisible().catch(() => false)) await wc.click();
  await l.goto(BASE + '#/home'); await l.waitForTimeout(1000);
  ok(/teacher/.test(await l.getByTestId('platform-signed-in').innerText()), 'Lucía logs in with the new password as a teacher');
  await lctx.close();
  // Admin can open the teacher dashboard too
  await p.goto(BASE + '#/teach/students'); await p.waitForTimeout(1200);
  ok(await p.getByTestId('add-student').isVisible(), 'admin sees the teacher Students page');
  // Remove Lucía
  await p.goto(BASE + '#/admin'); await p.waitForTimeout(1200);
  await p.getByTestId('remove-lucia').click(); await p.waitForTimeout(400); await p.getByTestId('confirm-remove').click(); await p.waitForTimeout(1500);
  ok(!/Lucía/.test(await p.getByTestId('admin-users').innerText()), 'account removed');
  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
