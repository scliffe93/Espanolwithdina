// Front page flow: fresh visit, create account, continue as the teacher, log out, quick-pick and log back in. Needs the API on :8787 and an API-enabled build on :4173. Usage: node scripts/home-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2]; const PW = 'tortilla de patatas 2026';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const errors = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(BASE); await p.waitForTimeout(1500);
  ok(/#\/home$/.test(p.url()) || p.url() === BASE, 'root opens the front page: ' + p.url());
  const t = await p.locator('body').innerText();
  ok(/Lessons with Dina/.test(t) && /Create a new account/.test(t) && /Start learning/.test(t) && !/Try the demonstration/i.test(t), 'front page has account and solo options, no demo cards');
  await p.screenshot({ path: OUT + '/home-fresh.png', fullPage: true });
  // Register Dina via the front page button
  await p.getByTestId('create-account').click(); await p.waitForTimeout(800);
  ok(await p.getByLabel('Your first name').isVisible(), 'Create account opens the register form');
  await p.getByLabel('Username').fill('dina'); await p.getByLabel('Your first name').fill('Dina');
  await p.getByLabel('Password', { exact: true }).fill(PW); await p.getByLabel('Repeat password').fill(PW);
  await p.getByRole('button', { name: 'Create my account' }).click();
  await p.getByRole('checkbox', { name: /saved my recovery code/ }).check(); await p.getByRole('button', { name: /^Continue/ }).click();
  await p.getByTestId('welcome-continue').click({ timeout: 10000 }); await p.waitForTimeout(800);
  await p.goto(BASE + '#/home'); await p.waitForTimeout(1200);
  ok(/teacher/.test(await p.getByTestId('platform-signed-in').innerText()), 'front page shows Dina signed in as teacher');
  await p.getByTestId('continue-signed-in').click(); await p.waitForTimeout(1000);
  ok(/#\/teach/.test(p.url()), 'Continue opens the teacher dashboard');
  // Log out → Dina appears as a known person
  await p.goto(BASE + '#/account'); await p.waitForTimeout(800);
  await p.getByRole('button', { name: 'Log out' }).click(); await p.waitForTimeout(1500);
  const anyway = p.getByRole('button', { name: /Log out anyway/ }); if (await anyway.isVisible().catch(() => false)) { await anyway.click(); await p.waitForTimeout(1000); }
  await p.goto(BASE + '#/home'); await p.waitForTimeout(1200);
  ok(await p.getByTestId('known-dina').isVisible(), 'Dina listed under "Who is this?" after logging out');
  await p.screenshot({ path: OUT + '/home-known.png', fullPage: true });
  await p.getByTestId('known-dina').click(); await p.waitForTimeout(800);
  ok((await p.getByLabel('Username').inputValue()) === 'dina', 'login form prefilled with dina');
  await p.getByLabel('Password', { exact: true }).fill(PW); await p.getByRole('button', { name: 'Log in', exact: true }).click(); await p.waitForTimeout(1500);
  const wc = p.getByTestId('welcome-continue'); if (await wc.isVisible().catch(() => false)) await wc.click();
  await p.goto(BASE + '#/home'); await p.waitForTimeout(1000);
  ok(/teacher/.test(await p.getByTestId('platform-signed-in').innerText()), 'logged back in as the teacher');
  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
