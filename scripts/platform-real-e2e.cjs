// Real-account teaching platform flow. Needs: API on :8787 (TEACHER_USERNAMES=dina npx tsx server/dev-server.ts 8787 memory)
// and a build with VITE_LWD_API_URL=http://localhost:8787/account served on :4173. Usage: node scripts/platform-real-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/';
const PASSWORD = 'tortilla de patatas 2026';
const log = (...a) => console.log('•', ...a);
const ok = (cond, label) => { console.log(cond ? '✓' : '✗', label); if (!cond) process.exitCode = 1; };

async function register(page, username, firstName) {
  await page.goto(BASE + '#/account'); await page.waitForTimeout(800);
  await page.getByRole('radio', { name: 'Create account' }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Your first name').fill(firstName);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Repeat password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create my account' }).click();
  await page.getByRole('checkbox', { name: /saved my recovery code/ }).check();
  await page.getByRole('button', { name: /^Continue/ }).click();
  await page.getByTestId('welcome-continue').click({ timeout: 10000 });
  await page.waitForTimeout(800);
}
async function login(page, username, password) {
  await page.goto(BASE + '#/account'); await page.waitForTimeout(800);
  await page.getByRole('radio', { name: 'Log in' }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.waitForTimeout(1200);
  const wc = page.getByTestId('welcome-continue'); if (await wc.isVisible().catch(() => false)) await wc.click();
  await page.waitForTimeout(500);
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctxD = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const dina = await ctxD.newPage(); dina.on('pageerror', (e) => errors.push('dina: ' + e));
  const stamp = Date.now().toString(36).slice(-4);

  // 1. Dina registers → teacher dashboard available
  await register(dina, 'dina', 'Dina');
  await dina.goto(BASE + '#/demo'); await dina.waitForTimeout(1200);
  const signedIn = await dina.getByTestId('platform-signed-in').textContent();
  ok(/teacher/.test(signedIn || ''), 'Dina is recognised as the teacher: ' + (signedIn || '').slice(0, 60));
  await dina.getByRole('button', { name: /Open the teacher dashboard/ }).click(); await dina.waitForTimeout(1000);
  ok(/teach/.test(dina.url()), 'teacher dashboard opens at ' + dina.url());

  // 2. Dina adds a student
  await dina.goto(BASE + '#/teach/students'); await dina.waitForTimeout(1200);
  await dina.getByTestId('add-student').click();
  await dina.locator('#ns-first').fill('Lucía');
  await dina.locator('#ns-user').fill('lucia' + stamp);
  await dina.getByTestId('ns-submit').click();
  await dina.waitForTimeout(1500);
  const details = await dina.getByTestId('new-student-details').textContent();
  const tempPw = (details.match(/Password([a-záéíóúñ ]+\d{2})/) || [])[1];
  ok(!!tempPw, 'student account created with a temporary password: ' + tempPw);
  await dina.getByRole('button', { name: 'Done' }).click(); await dina.waitForTimeout(1200);
  ok(await dina.getByRole('heading', { name: 'Lucía' }).isVisible(), 'Lucía appears in the Students list');

  // 3. Dina books a lesson and assigns homework for Lucía
  await dina.getByRole('button', { name: 'Book a lesson' }).first().click();
  await dina.waitForTimeout(500);
  const d = new Date(Date.now() + 2 * 86400000); const date = d.toISOString().slice(0, 10);
  await dina.locator('#bk-date').fill(date); await dina.locator('#bk-time').fill('10:00');
  await dina.locator('#bk-topic').fill('Ser y estar en la vida real');
  const loc = dina.locator('#bk-location'); if (await loc.count()) await loc.fill('https://meet.example/dina');
  await dina.getByRole('button', { name: 'Book lesson' }).click(); await dina.waitForTimeout(1500);
  const clashTry = dina.getByRole('button', { name: 'Book a lesson' }).first();
  await clashTry.click(); await dina.waitForTimeout(400);
  await dina.locator('#bk-date').fill(date); await dina.locator('#bk-time').fill('10:30'); await dina.locator('#bk-topic').fill('Clash');
  if (await loc.count()) await loc.fill('https://meet.example/clash');
  await dina.getByRole('button', { name: 'Book lesson' }).click(); await dina.waitForTimeout(1200);
  ok(await dina.getByText(/clash|overlap/i).first().isVisible().catch(() => false), 'overlapping lesson is refused by the server');
  await dina.keyboard.press('Escape'); await dina.waitForTimeout(400);
  await dina.getByRole('button', { name: 'Assign homework' }).first().click(); await dina.waitForTimeout(600);
  const submitHw = dina.getByRole('button', { name: /^Assign to/ });
  await submitHw.click(); await dina.waitForTimeout(1500);
  await dina.goto(BASE + '#/teach/homework'); await dina.waitForTimeout(1200);
  const hwText = await dina.locator('main, body').first().textContent();
  ok(/Lucía/.test(hwText), 'homework assigned to Lucía shows on the Homework page');

  // 4. Lucía logs in on another browser with the temporary password → sees lesson + homework
  const ctxL = await browser.newContext({ viewport: { width: 420, height: 860 } });
  const lucia = await ctxL.newPage(); lucia.on('pageerror', (e) => errors.push('lucia: ' + e));
  await login(lucia, 'lucia' + stamp, tempPw);
  await lucia.goto(BASE + '#/student'); await lucia.waitForTimeout(2000);
  const home = await lucia.locator('body').textContent();
  ok(/Ser y estar en la vida real/.test(home), 'Lucía sees her booked lesson');
  await lucia.goto(BASE + '#/student/homework'); await lucia.waitForTimeout(1500);
  const hwCount = await lucia.locator('[data-testid^="hw-start-"]').count();
  ok(hwCount >= 1, `Lucía sees ${hwCount} homework item(s)`);
  await lucia.goto(BASE + '#/demo'); await lucia.waitForTimeout(800);
  ok(/student/.test(await lucia.getByTestId('platform-signed-in').textContent()), 'Lucía is a student, not a teacher');
  ok((await lucia.getByTestId('demo-dina').count()) === 0, 'signed-in students do not see the demo switcher');

  // 5. Reload keeps everything (server-side)
  await dina.reload(); await dina.waitForTimeout(1500);
  await dina.goto(BASE + '#/teach'); await dina.waitForTimeout(1200);
  ok(/Lucía/.test(await dina.locator('body').textContent()), 'after reload Dina’s Today still lists Lucía’s lesson');
  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await dina.screenshot({ path: process.argv[2] + '/real-teacher-students.png' });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
