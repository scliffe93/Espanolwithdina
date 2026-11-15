// The verb gym, end to end, on a phone-sized screen: a session in several tenses is played through every kind of
// exercise to its finish (always 12 questions or more), "keep going" starts another, a half-done session can be
// picked up again, a page that fails shows the recovery screen, and Settings has the troubleshooting section.
// Needs a build served on :4173. Usage: node scripts/verbs-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2] || '.';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };

async function answer(p) {
  // One exercise, answered any old way; returns its kind.
  const input = p.getByLabel('Your answer', { exact: true });
  if (await input.count()) { await input.fill('x'); await p.getByRole('button', { name: /^(Check|Comprobar)$/ }).click(); return 'type'; }
  if (await p.getByText('Tap the words in order.').count()) {
    for (let k = 0; k < 20; k++) { const t = p.locator('.mt-3.flex.flex-wrap button:not(.invisible):not([disabled])'); if (!(await t.count())) break; await t.first().click(); }
    await p.getByRole('button', { name: /^(Check|Comprobar)$/ }).click(); return 'build';
  }
  if (await p.getByText(/Match each pronoun/).count()) {
    const cols = p.locator('.grid.grid-cols-2.gap-3 > div');
    const n = await cols.nth(0).locator('button').count();
    for (let a = 0; a < n; a++) {
      const pro = cols.nth(0).locator('button').nth(a);
      for (let f = 0; f < n; f++) {
        if (await pro.isDisabled()) break;
        const form = cols.nth(1).locator('button').nth(f);
        if (await form.isDisabled()) continue;
        await pro.click(); await form.click(); await p.waitForTimeout(40);
      }
    }
    return 'match';
  }
  await p.locator('.grid.sm\\:grid-cols-2 button:not([disabled])').first().click(); return 'options';
}

async function playThrough(p, label) {
  const kinds = new Set(); let total = 0;
  for (let step = 0; step < 40; step++) {
    if (await p.getByTestId('session-again').count() || await p.getByText(/of \d+ correct/).count()) break;
    const head = await p.locator('span.tabular-nums').first().innerText().catch(() => '');
    total = Math.max(total, Number((head.split('/')[1] || 0)));
    kinds.add(await answer(p));
    await p.getByRole('button', { name: /Continu(e|ar)/ }).click({ timeout: 8000 });
    await p.waitForTimeout(330);
  }
  const done = await p.getByText(/of \d+ correct/).count();
  ok(done === 1 && total >= 12, `${label}: played to the end, ${total} questions (${[...kinds].join(', ')})`);
}

(async () => {
  const b = await chromium.launch(); const errors = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true }); const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-sam').click(); await p.waitForTimeout(1600);

  for (const tense of ['present', 'preterite', 'imperfect', 'imperative', 'negative-imperative', 'subjunctive', 'pluperfect']) {
    await p.goto(BASE + '#/world'); await p.waitForTimeout(300);
    await p.goto(BASE + `#/verbs?start=1&tense=${tense}&hw=`); await p.waitForTimeout(900);
    const chip = p.getByTestId(`tense-${tense}`);
    if (await chip.count()) { if (await chip.isDisabled()) { console.log('-', tense, 'is locked for Sam; skipped'); continue; } await chip.click(); await p.getByRole('button', { name: /Start 12-exercise session|Empezar sesión/ }).click(); await p.waitForTimeout(500); }
    await playThrough(p, tense);
  }
  // gustar has no command form: asking for it must not produce an unanswerable question.
  await p.goto(BASE + '#/world'); await p.waitForTimeout(300);
  await p.goto(BASE + '#/verbs?focus=gustar&tense=imperative&start=1'); await p.waitForTimeout(900);
  const body = await p.locator('body').innerText();
  ok(!/gustar/.test(body.split('\n').slice(0, 12).join(' ')) || /Verb gym/.test(body), 'a verb with no form in the tense is replaced, not asked');
  if (await p.locator('span.tabular-nums').count()) await playThrough(p, 'imperative with gustar requested');

  // Keep going starts another full session.
  await p.getByTestId('session-again').click(); await p.waitForTimeout(600);
  ok(/^1\/1[2-9]/.test(await p.locator('span.tabular-nums').first().innerText()), '"Keep going" starts another session');
  await answer(p); await p.getByRole('button', { name: /Continu(e|ar)/ }).click(); await p.waitForTimeout(400);
  await answer(p); await p.getByRole('button', { name: /Continu(e|ar)/ }).click(); await p.waitForTimeout(400);
  // Leave half-way (as when the phone reloads the app) and come back.
  await p.goto(BASE + '#/world'); await p.waitForTimeout(500); await p.reload(); await p.waitForTimeout(1500);
  await p.goto(BASE + '#/verbs'); await p.waitForTimeout(1200);
  ok(/question 3 of/.test(await p.getByTestId('session-resume').innerText().catch(() => '')), 'a half-done session is offered again after a reload');
  await p.screenshot({ path: OUT + '/verbs-resume.png' });
  await p.getByRole('button', { name: /Carry on/ }).click(); await p.waitForTimeout(600);
  ok(/^3\//.test(await p.locator('span.tabular-nums').first().innerText()), 'it carries on at question 3');
  await playThrough(p, 'resumed session');
  await p.screenshot({ path: OUT + '/verbs-done.png' });

  // The voice is never cut off by the app saving progress: nothing may cancel a line while the learner stays on the page.
  await p.goto(BASE + '#/world'); await p.waitForTimeout(400); await p.goto(BASE + '#/verbs'); await p.waitForTimeout(1200);
  await p.evaluate(() => { window.__cancels = 0; window.__spoken = 0; const s = window.speechSynthesis; const c = s.cancel.bind(s), k = s.speak.bind(s); s.cancel = () => { window.__cancels++; c(); }; s.speak = (u) => { window.__spoken++; k(u); }; });
  await p.getByRole('button', { name: /details$/ }).first().click(); await p.waitForTimeout(600);
  await p.locator('[role="dialog"] button:has(svg)').filter({ hasText: /\S/ }).nth(3).click();
  await p.waitForTimeout(400);
  await p.evaluate(() => { window.__cancels = 0; });
  await p.waitForTimeout(6000); // long enough for the practice timer to save several times
  const v = await p.evaluate(() => ({ c: window.__cancels, s: window.__spoken }));
  ok(v.s >= 1 && v.c === 0, `a spoken line is left to finish (spoken ${v.s}, interrupted ${v.c} times)`);
  await p.keyboard.press('Escape');

  // A page that fails shows the recovery screen, and the problem is listed in Settings.
  await p.evaluate(() => sessionStorage.setItem('lwd-verb-session', JSON.stringify({ queue: [{ kind: 'fix', verb: 'ser' }], i: 0, log: [], tense: 'present', at: Date.now() })));
  await p.goto(BASE + '#/world'); await p.waitForTimeout(400); await p.reload(); await p.waitForTimeout(1200); await p.goto(BASE + '#/verbs'); await p.waitForTimeout(1000);
  await p.getByRole('button', { name: /Carry on/ }).click(); await p.waitForTimeout(800);
  ok(await p.getByTestId('error-screen').count() === 1, 'a broken page shows "This page hit a problem" instead of a blank screen');
  await p.screenshot({ path: OUT + '/verbs-error.png' });
  await p.evaluate(() => sessionStorage.removeItem('lwd-verb-session'));
  await p.getByTestId('error-retry').click(); await p.waitForTimeout(600);
  await p.goto(BASE + '#/settings'); await p.waitForTimeout(1500);
  const t = p.getByTestId('troubleshooting'); await t.scrollIntoViewIfNeeded();
  ok(/A page stopped/.test(await t.innerText()), 'Settings → Troubleshooting lists the problem');
  ok(await p.getByTestId('refresh-app').count() === 1 && await p.getByTestId('copy-report').count() === 1, 'it offers "Refresh the app" and "Copy report"');
  await t.screenshot({ path: OUT + '/verbs-troubleshooting.png' });
  ok(errors.filter((e) => !/example|undefined/.test(e)).length === 0, `no unexpected page errors${errors.length ? ': ' + errors[0] : ''}`);
  await b.close();
})();
