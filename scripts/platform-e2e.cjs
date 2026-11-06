// The owner's 9-step demo: Dina → Sam → book → assign → as Sam see + complete → Dina sees result → Anneka independently. Also persistence + mobile.
const { chromium, devices } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:4173/';
const OUT = 'screenshots';
const errors = [];
const log = (...a) => console.log('•', ...a);
const tap = (loc, t = 4000) => loc.click({ timeout: t });
const quiet = () => { if (window.speechSynthesis) window.speechSynthesis.speak = (u) => setTimeout(() => { u.onstart && u.onstart(); setTimeout(() => u.onend && u.onend(), 30); }, 5); };

async function openAs(page, who) {
  await page.goto(`${BASE}#/demo`);
  await tap(page.getByTestId(`demo-${who}`), 15000);
  await page.waitForTimeout(900);
}
async function check(cond, label) { if (cond) log('✓', label); else { errors.push(label); log('✗', label); } }
const plusDays = (n, h = '16:00') => { const d = new Date(Date.now() + n * 864e5); return [d.toISOString().slice(0, 10), h]; };

async function bookLesson(page, studentId, days, time, topic) {
  await tap(page.getByRole('button', { name: /Book a lesson/ }).first());
  await page.locator('#bk-student').selectOption(studentId).catch(() => {});
  const [date] = plusDays(days);
  await page.locator('#bk-date').fill(date);
  await page.locator('#bk-time').fill(time);
  await page.locator('#bk-topic').fill(topic);
  await page.locator('#bk-location').fill('https://meet.jit.si/lwd-demo');
  await tap(page.getByRole('button', { name: 'Book lesson', exact: true }));
  await page.waitForTimeout(1500);
  const stillOpen = await page.getByRole('dialog').isVisible().catch(() => false);
  if (stillOpen) log('   booking dialog still open:', JSON.stringify((await page.getByRole('dialog').innerText()).replace(/\s+/g, ' ').slice(-200)));
  const dlg = page.getByRole('dialog');
  if (await dlg.isVisible().catch(() => false)) log('   booking dialog still open; text:', JSON.stringify((await dlg.innerText()).replace(/\s+/g, ' ').slice(0, 400)));
}
async function assignHomework(page, title, days) {
  await tap(page.getByRole('button', { name: /Assign homework/ }).first());
  await page.locator('#hw-template').selectOption({ index: 0 }).catch(() => {});
  await page.locator('#hw-title').fill(title);
  const [date] = plusDays(days);
  await page.locator('#hw-due-date').fill(date);
  await tap(page.getByRole('button', { name: /^Assign to/ }));
  await page.waitForTimeout(900);
}
async function completeVerbSession(page) {
  for (let s = 0; s < 300; s++) {
    if (await page.getByText(/correct ·/).isVisible().catch(() => false)) break;
    const cont = page.getByRole('button', { name: /^Continue/ });
    if (await cont.isVisible().catch(() => false)) { await tap(cont); await page.waitForTimeout(150); continue; }
    const input = page.getByLabel('Your answer');
    if (await input.isVisible().catch(() => false)) { await input.fill('tengo'); await tap(page.getByRole('button', { name: 'Check' })); await page.waitForTimeout(150); continue; }
    if (await page.getByText('Tap the words in order.').isVisible().catch(() => false)) { const tiles = page.locator('div.mt-3.flex.flex-wrap.gap-2 > button:not(.invisible)'); while (await tiles.count()) { await tiles.first().click(); } await tap(page.getByRole('button', { name: 'Check' })); continue; }
    if (await page.getByText(/Match each pronoun/).isVisible().catch(() => false)) {
      const left = page.locator('div.grid.grid-cols-2 > div:first-child > button:not([disabled])'), right = page.locator('div.grid.grid-cols-2 > div:last-child > button:not([disabled])');
      for (let g = 0; g < 20 && (await left.count()); g++) { await left.first().click(); const n = await right.count(); for (let r = 0; r < n; r++) { await right.nth(r).click(); await page.waitForTimeout(60); if ((await left.count()) < n) break; } }
      continue;
    }
    const opt = page.locator('div.mt-5.grid button:not([disabled])').first();
    if (await opt.isVisible().catch(() => false)) { await tap(opt); await page.waitForTimeout(150); continue; }
    await page.waitForTimeout(200);
  }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  await ctx.addInitScript(quiet);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') log('   console:', m.text().slice(0, 200)); });
  try {
    // 0. Fresh demo data
    await page.goto(`${BASE}#/demo`); await page.waitForTimeout(800);
    await tap(page.getByRole('button', { name: /Reset demo data/ }).first(), 15000); await page.waitForTimeout(400);
    await tap(page.getByRole('dialog').getByRole('button', { name: /Reset demo data/ })); await page.waitForTimeout(1500);
    // 1. Dina's dashboard
    await openAs(page, 'dina');
    await check((await page.getByTestId('demo-pill').first().innerText()).includes('Dina'), '1. Dina’s dashboard opens');
    await page.screenshot({ path: `${OUT}/70-teacher-today.png` });
    // 2. Select Sam
    await page.goto(`${BASE}#/teach/student/demo-sam`); await page.waitForTimeout(1000);
    await check(await page.getByText('Sam').first().isVisible(), '2. Sam’s profile opens');
    await page.screenshot({ path: `${OUT}/71-teacher-sam.png`, fullPage: true });
    // 3. Book Sam a lesson (+ overlap check)
    await bookLesson(page, 'demo-sam', 4, '16:00', 'Demo lesson: ordering tapas');
    await page.goto(`${BASE}#/teach/student/demo-sam?tab=lessons`); await page.waitForTimeout(800);
    await check(await page.getByText('Demo lesson: ordering tapas').first().isVisible().catch(() => false), '3. Lesson booked for Sam');
    await bookLesson(page, 'demo-sam', 4, '16:30', 'Overlapping lesson');
    const clash = await page.getByText(/clash|overlap/i).first().isVisible().catch(() => false);
    await check(clash, '3b. Overlapping booking refused with a message');
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    // 4. Assign Sam homework
    await page.goto(`${BASE}#/teach/student/demo-sam?tab=homework`); await page.waitForTimeout(800);
    await assignHomework(page, 'Demo homework: tener & querer', 3);
    await check(await page.getByText('Demo homework: tener & querer').first().isVisible(), '4. Homework assigned to Sam');
    // 5–6. Switch to Sam, see lesson + homework
    await openAs(page, 'sam');
    await page.goto(`${BASE}#/student/calendar`); await page.waitForTimeout(800);
    await check(await page.getByText('Demo lesson: ordering tapas').first().isVisible().catch(() => false), '6a. Sam sees the new lesson');
    await page.goto(`${BASE}#/student/homework`); await page.waitForTimeout(800);
    await check(await page.getByText('Demo homework: tener & querer').first().isVisible(), '6b. Sam sees the new homework');
    await page.screenshot({ path: `${OUT}/72-student-home.png`, fullPage: true });
    // 7. Complete it as Sam
    const card = page.locator('article, div').filter({ hasText: 'Demo homework: tener & querer' }).last();
    void card;
    const myCard = page.getByText('Demo homework: tener & querer').first().locator('xpath=ancestor::*[count(.//button[starts-with(@data-testid,"hw-start-")])=1][1]');
    await tap(myCard.locator('[data-testid^="hw-start-"]').first());
    await page.waitForTimeout(1200);
    log('   after Start: hash', await page.evaluate(() => location.hash), '| text:', JSON.stringify((await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 160)));
    await completeVerbSession(page);
    log('   after session: hash', await page.evaluate(() => location.hash), '| text:', JSON.stringify((await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 200)));
    const doneBtn = page.getByRole('button', { name: /Homework done/ });
    await check(await doneBtn.isVisible().catch(() => false), '7. Homework completed as Sam (Homework done button)');
    await tap(doneBtn).catch(() => {}); await page.waitForTimeout(800);
    await check(await page.getByText(/awaiting|Submitted|feedback/i).first().isVisible().catch(() => false), '7b. Sam’s homework list shows it submitted');
    // 8. Back to Dina: see result, write feedback
    await openAs(page, 'dina');
    await check(await page.getByText('Demo homework: tener & querer').first().isVisible().catch(() => false), '8. Dina’s dashboard shows the submitted homework');
    await page.goto(`${BASE}#/teach/homework`); await page.waitForTimeout(800);
    const myRow = page.getByText('Demo homework: tener & querer').first().locator('xpath=ancestor::*[.//button][1]');
    const opener = myRow.getByRole('button', { name: /review|open|feedback|give|mark/i }).first();
    await tap(await opener.isVisible().catch(() => false) ? opener : myRow.getByRole('button').first());
    await page.waitForTimeout(600);
    await page.locator('#rv-feedback').fill('¡Muy bien, Sam! Watch the yo form of tener: tengo.');
    await tap(page.getByRole('button', { name: /Save review/ }));
    await page.waitForTimeout(800);
    await openAs(page, 'sam');
    await page.goto(`${BASE}#/student/homework`); await page.waitForTimeout(800);
    await check(await page.getByText('Watch the yo form of tener').first().isVisible().catch(() => false), '8b. Sam sees Dina’s feedback');
    // 9. Anneka independently
    await openAs(page, 'dina');
    await page.goto(`${BASE}#/teach/student/demo-anneka`); await page.waitForTimeout(900);
    await bookLesson(page, 'demo-anneka', 5, '11:00', 'Demo lesson: Valencia market');
    await page.goto(`${BASE}#/teach/student/demo-anneka?tab=homework`); await page.waitForTimeout(800);
    await assignHomework(page, 'Demo homework: Anneka verbs', 2);
    await openAs(page, 'anneka');
    await page.goto(`${BASE}#/student/calendar`); await page.waitForTimeout(800);
    await check(await page.getByText('Demo lesson: Valencia market').first().isVisible().catch(() => false), '9a. Anneka sees her lesson');
    await page.goto(`${BASE}#/student/homework`); await page.waitForTimeout(800);
    await check(await page.getByText('Demo homework: Anneka verbs').first().isVisible(), '9b. Anneka sees her homework');
    await check(!(await page.getByText('Demo homework: tener & querer').first().isVisible().catch(() => false)), '9c. Anneka does NOT see Sam’s homework');
    // Persistence
    await page.reload(); await page.waitForTimeout(1200);
    await check(await page.getByText('Demo homework: Anneka verbs').first().isVisible(), '10. Persists across reload');
    // Mobile
    const m = await browser.newContext({ ...devices['iPhone 13'] }); await m.addInitScript(quiet);
    const mp = await m.newPage(); mp.on('pageerror', (e) => errors.push(`mobile: ${e.message}`));
    await mp.goto(`${BASE}#/demo`); await tap(mp.getByTestId('demo-dina'), 15000); await mp.waitForTimeout(1200);
    await mp.screenshot({ path: `${OUT}/73-teacher-mobile.png` });
    await check(!(await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), '11. Mobile: no horizontal overflow');
  } catch (e) {
    errors.push(`crash: ${e.message.split('\n')[0]}`);
    await page.screenshot({ path: `${OUT}/fail-platform.png` }).catch(() => {});
  }
  await browser.close();
  log('errors:', errors.length ? errors : 'none');
  process.exit(errors.length ? 1 : 0);
})();
