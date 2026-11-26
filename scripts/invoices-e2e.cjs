// Invoicing and packages in the demo: Dina sets rates, bills Sam's taught lessons, sends, Sam sees it, Dina marks it paid, defines a package, sells it to Sam, both see the balance.
// Needs a build served on :4173. Usage: node scripts/invoices-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2];
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
const HIDE = `[data-testid="demo-pill"], [title*="fictional"] { display: none !important; }`;
(async () => {
  const b = await chromium.launch(); const errors = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e)));
  const shot = async (n) => { await p.addStyleTag({ content: HIDE }); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/${n}.png` }); };
  await p.goto(BASE + '#/demo'); await p.waitForTimeout(1000);
  const reset = p.getByRole('button', { name: 'Reset demo data' }); if (await reset.isVisible().catch(() => false)) { await reset.click(); await p.getByRole('button', { name: 'Reset demo data' }).last().click(); await p.waitForTimeout(1500); }
  await p.getByTestId('demo-dina').click(); await p.waitForTimeout(1500);
  await p.goto(BASE + '#/teach/invoices'); await p.waitForTimeout(1500);
  ok(await p.getByTestId('invoice-summary').isVisible(), 'Invoices page renders with summary');
  // Settings
  await p.getByTestId('invoice-settings').click(); await p.waitForTimeout(400);
  await p.locator('#cf-rate').fill('40'); await p.locator('#cf-pay').fill('Bank transfer to Dina García\nSort code 00-00-00 · Account 12345678\nReference: your invoice number');
  await shot('t-invoice-settings');
  await p.getByTestId('save-settings').click(); await p.waitForTimeout(1200);
  // New invoice from Sam's taught lessons
  await p.getByTestId('new-invoice').click(); await p.waitForTimeout(600);
  await p.locator('#in-student').selectOption('demo-sam');
  await p.waitForTimeout(400);
  const lessons = p.locator('[data-testid="unbilled-lessons"] input[type=checkbox]');
  const n = await lessons.count();
  ok(n >= 1, `${n} unbilled lesson(s) offered for Sam`);
  for (let i = 0; i < Math.min(n, 2); i++) await lessons.nth(i).check();
  await p.getByTestId('add-line').click(); const lines = p.locator('[data-testid="invoice-lines"] li'); const last = lines.nth((await lines.count()) - 1);
  await last.getByLabel('Description').fill('Workbook: Ser y estar'); await last.getByLabel('Unit price').fill('6');
  const totalText = await p.getByTestId('invoice-total').innerText();
  ok(/£/.test(totalText) && totalText !== '£0.00', 'total computed: ' + totalText);
  await shot('t-invoice-new');
  await p.getByTestId('save-send').click(); await p.waitForTimeout(1500);
  const list = await p.getByTestId('invoice-list').innerText();
  ok(/LWD-\d{4}-0001/.test(list) && /outstanding/i.test(list), 'invoice LWD-…-0001 saved as outstanding');
  await shot('t-invoices');
  // Sam sees it
  await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-sam').click(); await p.waitForTimeout(1500);
  await p.goto(BASE + '#/student'); await p.waitForTimeout(1500);
  ok(await p.getByTestId('invoice-nudge').isVisible(), 'Sam’s home shows the amount to pay');
  await p.goto(BASE + '#/student/invoices'); await p.waitForTimeout(1500);
  const st = await p.getByTestId('student-invoices').innerText();
  ok(/to pay/.test(st) && /LWD-/.test(st), 'Sam’s Invoices page lists it as to pay');
  await shot('s-invoices');
  await p.getByRole('button', { name: /LWD-/ }).first().click(); await p.waitForTimeout(500);
  ok(/Bank transfer to Dina/.test(await p.locator('[role=dialog]').innerText()), 'invoice detail shows how to pay');
  await shot('s-invoice-detail');
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.getByRole('button', { name: 'Download PDF' }).click()]);
  ok(/LWD-\d{4}-0001\.pdf/.test(dl.suggestedFilename()), 'PDF downloads as ' + dl.suggestedFilename());
  await dl.saveAs(`${OUT}/invoice-sample.pdf`);
  await p.keyboard.press('Escape');
  // Dina marks it paid
  await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-dina').click(); await p.waitForTimeout(1500);
  await p.goto(BASE + '#/teach'); await p.waitForTimeout(1500);
  ok(await p.getByTestId('invoice-nudge').isVisible(), 'Dina’s Today shows the outstanding amount');
  await p.goto(BASE + '#/teach/invoices'); await p.waitForTimeout(1500);
  const num = (await p.getByTestId('invoice-list').innerText()).match(/LWD-\d{4}-0001/)[0];
  await p.getByTestId(`pay-${num}`).click(); await p.waitForTimeout(300); await p.getByTestId(`confirm-pay-${num}`).click(); await p.waitForTimeout(1500);
  ok(/paid/.test(await p.getByTestId('invoice-list').innerText()), 'marked as paid');
  const summary = await p.getByTestId('invoice-summary').innerText();
  const paidTile = summary.split(/paid this month/i)[1] || ''; ok(/£(?!0\.00)\d/.test(paidTile), 'summary shows paid this month: ' + paidTile.trim().split('\n')[0]);
  // Packages: define one, sell it to Sam (paid), balance appears for both
  await p.getByTestId('invoice-settings').click(); await p.waitForTimeout(400);
  await p.getByTestId('add-package').click(); await p.waitForTimeout(200);
  ok((await p.locator('[data-testid="package-list"] li').count()) >= 2, 'package row added in settings');
  await shot('t-packages');
  await p.getByTestId('save-settings').click(); await p.waitForTimeout(1200);
  await p.getByTestId('sell-package-top').click(); await p.waitForTimeout(400);
  await p.locator('#sp-student').selectOption('demo-sam'); await p.getByRole('checkbox', { name: /Already paid/ }).check();
  await shot('t-sell-package');
  await p.getByTestId('confirm-sell').click(); await p.waitForTimeout(1500);
  ok(/Package sold/.test(await p.locator('[role=dialog]').innerText()), 'package sold with its invoice');
  await p.getByRole('button', { name: 'Done' }).click(); await p.waitForTimeout(400);
  ok(/LWD-\d{4}-0002/.test(await p.getByTestId('invoice-list').innerText()), 'package invoice LWD-…-0002 listed');
  await p.goto(BASE + '#/teach/students'); await p.waitForTimeout(1500);
  { const t = await p.locator('body').innerText(); ok(/lesson balance/i.test(t) && /of (5|10) left/.test(t), 'Students page shows Sam’s lesson balance'); }
  await p.goto(BASE + '#/teach/student/demo-sam?tab=lessons'); await p.waitForTimeout(1500);
  ok(await p.getByTestId('balance-card').isVisible() && await p.getByTestId('balance-chip').isVisible(), 'profile shows balance card and chip');
  await shot('t-balance');
  // Checking the count: the card lists which lessons used a credit, and which taught ones did not, with the reason.
  const label0 = await p.getByTestId('balance-card').locator('p.font-display').innerText();
  await p.getByTestId('balance-breakdown').locator('summary').click(); await p.waitForTimeout(300);
  { const used = (await p.getByTestId('balance-card').innerText()).match(/(\d+) used/); const listed = await p.getByTestId('balance-counted').locator('li').count().catch(() => 0);
    ok(used && Number(used[1]) === listed, `the breakdown lists each lesson that used a credit (${listed}, card says ${used && used[1]} used)`); }
  ok((await p.getByTestId('balance-not-counted').count()) === 0 || /before the first package|cancelled|billed on its own invoice/.test(await p.getByTestId('balance-not-counted').innerText()), 'any lesson not counted says why');
  await shot('t-balance-breakdown');
  // A lesson taught in the lesson room with nothing in the calendar that day is flagged, and Count it uses a credit.
  await p.goto(BASE + '#/teach/room'); await p.waitForTimeout(1200);
  await p.getByTestId('room-example').click(); await p.getByTestId('import-review').waitFor({ timeout: 10000 }); await p.getByTestId('review-create').click(); await p.getByTestId('teach-sheet').waitFor(); await p.getByTestId('class-student').filter({ hasText: 'Sam' }).click(); await p.getByTestId('teach-go').click(); await p.getByTestId('teacher-room').waitFor({ timeout: 10000 }); await p.waitForTimeout(600);
  await p.getByTestId('to-present').click(); await p.getByTestId('start-lesson').click(); await p.waitForTimeout(1500);
  await p.goto(BASE + '#/teach/student/demo-sam?tab=lessons'); await p.waitForTimeout(1800);
  const todayBooked = /Today/.test(await p.locator('main').innerText());
  if (await p.getByTestId('balance-room-only').count()) {
    ok(/Example lesson/.test(await p.getByTestId('balance-room-only').innerText()), 'a lesson taught in the lesson room with nothing in the calendar is flagged on the balance');
    await p.getByTestId('balance-room-only').screenshot({ path: OUT + '/t-balance-room-only.png' });
    await p.getByTestId('balance-count-room').first().click(); await p.waitForTimeout(1800);
    const label1 = await p.getByTestId('balance-card').locator('p.font-display').innerText();
    const left = (t) => Number((t.match(/^(-?\d+) of/) || [])[1]);
    ok(await p.getByTestId('balance-room-only').count() === 0 && left(label1) === left(label0) - 1, `Count it adds it to the calendar as taught and uses one credit (${label0} → ${label1})`);
  } else ok(todayBooked, 'no lesson-room warning because Sam already has a lesson in the calendar today');
  await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-sam').click(); await p.waitForTimeout(1500);
  await p.goto(BASE + '#/student'); await p.waitForTimeout(1500);
  ok(await p.getByTestId('balance-card').isVisible(), 'Sam’s home shows his lesson balance');
  await shot('s-balance');
  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
