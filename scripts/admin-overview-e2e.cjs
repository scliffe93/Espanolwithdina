// Admin "brain": a student logs in, the teacher sends a plan, the admin sees everyone, the teacher activity and the feed. Needs ADMIN_USERNAMES=admin API on :8787 and an API-enabled build on :4173. Usage: node scripts/admin-overview-e2e.cjs <outDir>
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
  // Student: register, onboard quickly via welcome? Use 'learn solo' path: go to world requires onboarding; play a game directly (games route needs onboarding). Use the demo-free path: #/welcome → skip? Simplest: play via #/game/penalty after onboardingDone... We'll set onboarding through the welcome flow quickly.
  const sctx = await b.newContext(); const s = await sctx.newPage(); s.on('pageerror', (e) => errors.push('student: ' + e));
  await register(s, 'lucia', 'Lucía');
  await s.goto(BASE + '#/welcome'); await s.waitForTimeout(1000);
  const start = s.getByRole('button', { name: /Start|Empezar|Begin|Let’s go|Choose/i }).first();
  if (await start.isVisible().catch(() => false)) { await start.click(); await s.waitForTimeout(800); }
  // Instead of the long onboarding, mark onboarding done via the store? Not accessible. Fall back: the login event alone is logged.
  await sctx.close();
  // Teacher: register, debrief for Lucía → plan sent
  const tctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const t = await tctx.newPage(); t.on('pageerror', (e) => errors.push('teacher: ' + e));
  await register(t, 'dina', 'Dina');
  await t.goto(BASE + '#/teach/students'); await t.waitForTimeout(1500);
  await t.getByTestId('open-student-lucía').click().catch(async () => t.getByRole('button', { name: /Open profile/ }).first().click()); await t.waitForTimeout(1200);
  await t.getByTestId('lesson-debrief').click(); await t.waitForTimeout(500);
  await t.locator('#db-verbs').fill('querer'); await t.locator('#db-well').fill('Good start, Lucía.'); await t.getByTestId('fix-listening').click();
  await t.getByTestId('generate-plan').click(); await t.waitForTimeout(500); await t.getByTestId('send-plan').click(); await t.waitForTimeout(3000);
  ok(/Plan sent/.test(await t.locator('body').innerText()), 'teacher sent a plan to Lucía');
  await tctx.close();
  // Admin: register, open Admin → overview, everyone table, teacher activity, feed with login + plan
  const actx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const a = await actx.newPage(); a.on('pageerror', (e) => errors.push('admin: ' + e));
  await register(a, 'admin', 'Owner');
  await a.goto(BASE + '#/admin'); await a.waitForTimeout(3000);
  ok(await a.getByTestId('admin-overview').isVisible(), 'admin overview tiles');
  const every = await a.getByTestId('everyone-table').innerText();
  ok(/Lucía/.test(every) && /pending/.test(every), 'everyone table lists Lucía with pending homework');
  const ta = await a.getByTestId('teacher-activity').innerText();
  ok(/Lesson debriefs sent\s*1/.test(ta.replace(/\n/g, ' ')) && /Homework assigned\s*\d+/.test(ta.replace(/\n/g, ' ')), 'teacher activity counts debrief and homework');
  await a.screenshot({ path: OUT + '/admin-overview.png', fullPage: true });
  await a.getByRole('radio', { name: 'Activity' }).click().catch(async () => a.getByText('Activity', { exact: true }).first().click()); await a.waitForTimeout(800);
  const feed = await a.getByTestId('activity-feed').innerText();
  ok(/Logged in/.test(feed), 'feed shows Lucía logging in');
  ok(/Lesson notes and week plan sent to Lucía/.test(feed) && /Homework assigned/.test(feed), 'feed shows the teacher’s plan and homework');
  await a.screenshot({ path: OUT + '/admin-feed.png', fullPage: true });
  await a.getByRole('radio', { name: 'Accounts' }).click().catch(async () => a.getByText('Accounts', { exact: true }).first().click()); await a.waitForTimeout(600);
  ok(await a.getByTestId('admin-users').isVisible(), 'accounts tab still works');
  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
