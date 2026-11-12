// "I've paid this" in the demo: Sam reports an invoice as paid, Dina sees the flag and confirms it.
// Needs a build served on :4173. Usage: node scripts/payment-report-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2] || '.';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const errors = [];
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e)));
  const as = async (who) => { await p.goto(BASE + '#/demo'); await p.waitForTimeout(900); await p.getByTestId('demo-' + who).click(); await p.waitForTimeout(1700); };
  const go = async (hash) => { await p.goto(BASE + hash); await p.waitForTimeout(1600); };
  // Dina bills Sam for a taught lesson and sends the invoice.
  await as('dina'); await go('#/teach/invoices');
  await p.getByTestId('new-invoice').click(); await p.waitForTimeout(600);
  await p.locator('#in-student').selectOption('demo-sam'); await p.waitForTimeout(400);
  await p.locator('[data-testid="unbilled-lessons"] input[type=checkbox]').first().check();
  await p.getByTestId('save-send').click(); await p.waitForTimeout(1500);
  await as('sam'); await go('#/student/invoices');
  const btn = p.locator('[data-testid^="report-paid-"]').first();
  ok(await btn.isVisible(), 'an unpaid invoice offers "I’ve paid this"');
  const number = (await btn.getAttribute('data-testid')).replace('report-paid-', '');
  await btn.click(); await p.waitForTimeout(300);
  await p.getByTestId('report-method').selectOption('Bank transfer'); await p.getByTestId('report-note').fill('Sent this morning');
  await p.getByTestId('student-invoices').screenshot({ path: OUT + '/pay-student-form.png' });
  await p.getByTestId('report-send').click(); await p.waitForTimeout(1500);
  ok(/You told Dina you paid this/.test(await p.getByTestId('reported-' + number).innerText()), 'Sam sees that Dina has been told');
  ok(await p.getByTestId('invoice-due').isVisible(), 'the invoice still counts as to pay until Dina confirms');
  await p.waitForTimeout(5500); await p.getByTestId('student-invoices').screenshot({ path: OUT + '/pay-student-told.png' });
  // Dina: nudge on Today, flag on the invoice, confirm.
  await as('dina'); await go('#/teach');
  ok(new RegExp('Sam says ' + number + ' is paid').test(await p.getByTestId('reported-nudge').innerText()), 'Dina’s home shows "Sam says … is paid"');
  await p.getByTestId('reported-nudge').click(); await p.waitForTimeout(1500);
  const flag = await p.getByTestId('reported-' + number).innerText();
  ok(/Sam says this is paid/.test(flag) && /Bank transfer/.test(flag) && /Sent this morning/.test(flag), 'the invoice shows who, how and the note');
  await p.getByTestId('reported-' + number).scrollIntoViewIfNeeded(); await p.screenshot({ path: OUT + '/pay-teacher-flag.png' });
  await p.getByTestId('pay-' + number).click(); await p.waitForTimeout(300);
  ok((await p.getByLabel('Payment method').inputValue()) === 'bank transfer', 'Mark paid starts from the method Sam gave');
  await p.getByRole('button', { name: /^(Confirm|Save|Paid)/ }).first().click(); await p.waitForTimeout(1500);
  ok((await p.getByTestId('reported-' + number).count()) === 0, 'once confirmed, the flag is gone from Dina’s list');
  await go('#/teach'); ok((await p.getByTestId('reported-nudge').count()) === 0, 'and the nudge is gone');
  await as('sam'); await go('#/student/invoices');
  ok((await p.getByTestId('report-paid-' + number).count()) === 0 && (await p.getByTestId('reported-' + number).count()) === 0, 'Sam sees the invoice as paid, with nothing left to do');
  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
})();
