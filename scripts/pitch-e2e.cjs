// The pitch page (#/pitch): personalised headline and brand card, the email's penalty result, the real game for the
// prospect's city with Back instead of Arcade, parameter fallbacks, and the phone layout. Needs a build on :4173.
// Usage: node scripts/pitch-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium, devices } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2] || '.';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const errors = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(BASE + '#/pitch?to=Laura&school=Academia%20Sol&city=valencia'); await p.waitForTimeout(1800);
  ok(/#\/pitch/.test(p.url()), 'stays on the pitch page (no onboarding redirect): ' + p.url());
  const t = await p.locator('body').innerText();
  ok(/Hi Laura, this is what Academia Sol’s own app could look like\./.test(t), 'headline is personalised');
  ok(/Academia Sol\./.test(await p.getByTestId('pitch-brand').innerText()), 'brand card carries the school name');
  ok(/students in Valencia would play for Valencia CF/.test(t) && /el Levante/.test(t), 'penalty section names the city club and its rival');
  ok(/This week with Academia Sol/i.test(await p.getByTestId('pitch-plan').innerText()), 'sample week is in the school’s name');
  ok(/Walkthrough|Reply to/.test(await p.getByTestId('pitch-book').first().innerText()), 'book-a-walkthrough call to action present');
  ok(await p.getByRole('heading', { name: 'Simple pricing' }).isVisible(), 'pricing section present');
  await p.screenshot({ path: OUT + '/pitch-desktop.png', fullPage: true });
  // Play the real game: ¡Vamos!, countdown, one shot
  await p.getByRole('button', { name: /¡Vamos!/ }).click(); await p.waitForTimeout(3400);
  ok(await p.getByTestId('shot-0').isVisible(), 'game started: three posts to shoot at');
  await p.getByTestId('shot-1').click(); await p.waitForTimeout(250);
  ok(/¡GOL!|¡Parada!/.test(await p.locator('body').innerText()), 'a shot registers as a goal or a save');
  await p.getByTestId('shot-0').scrollIntoViewIfNeeded(); await p.screenshot({ path: OUT + '/pitch-game.png' });
  await p.getByRole('button', { name: 'Pause' }).click(); await p.waitForTimeout(400);
  await p.getByRole('button', { name: 'End game' }).click(); await p.waitForTimeout(900);
  ok(await p.getByRole('button', { name: 'Back', exact: true }).isVisible(), 'game over offers Back');
  ok(!(await p.getByRole('button', { name: 'Arcade' }).isVisible().catch(() => false)), 'no Arcade link for a visitor');
  await p.getByRole('button', { name: 'Back', exact: true }).click(); await p.waitForTimeout(700);
  ok(/#\/pitch/.test(p.url()), 'Back stays on the pitch page');
  // Arriving from the email's penalty module
  await p.goto(BASE + '#/pitch?to=Laura&city=madrid&shot=hablas'); await p.waitForTimeout(1400);
  ok(/¡GOL!/.test(await p.getByTestId('pitch-shot-result').innerText()), 'shot=hablas from the email shows ¡GOL!');
  ok(/students in Madrid would play for Real Madrid/.test(await p.locator('body').innerText()), 'city switched to Madrid');
  await p.goto(BASE + '#/pitch?to=Laura&city=madrid&shot=hablo'); await p.waitForTimeout(1200);
  ok(/¡Parada!.*it was “hablas”/.test(await p.getByTestId('pitch-shot-result').innerText()), 'shot=hablo from the email shows ¡Parada! with the answer');
  // Fallbacks: unknown city, bad shot, markup in the name
  await p.goto(BASE + '#/pitch?city=narnia&shot=xyz&to=' + encodeURIComponent('<b>Laura</b>')); await p.waitForTimeout(1200);
  const t3 = await p.locator('body').innerText();
  ok(/students in Madrid/.test(t3), 'unknown city falls back to Madrid');
  ok(!(await p.getByTestId('pitch-shot-result').isVisible().catch(() => false)), 'unknown shot is ignored');
  ok(/Hi <b>Laura<\/b>, this is what your own app/.test(t3) && (await p.locator('h1 b').count()) === 0, 'name renders as text, never as markup');
  await p.goto(BASE + '#/pitch'); await p.waitForTimeout(1000);
  ok(/this is what your own app could look like/.test(await p.locator('body').innerText()) && /Dina\./.test(await p.getByTestId('pitch-brand').innerText()), 'no parameters: generic headline, Dina on the card');
  // Phone
  const m = await b.newContext({ ...devices['iPhone 13'] }); const pm = await m.newPage(); pm.on('pageerror', (e) => errors.push(String(e)));
  await pm.goto(BASE + '#/pitch?to=Laura&school=Academia%20Sol&city=valencia&shot=hablas'); await pm.waitForTimeout(1800);
  ok(await pm.getByTestId('pitch-shot-result').isVisible(), 'phone: the email result is visible');
  ok(await pm.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'phone: no horizontal scroll');
  await pm.screenshot({ path: OUT + '/pitch-phone.png', fullPage: true });
  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
