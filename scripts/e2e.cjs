// End-to-end journey test in Chromium. Usage: node scripts/e2e.cjs [baseUrl]
const { chromium } = require('playwright');
const fs = require('node:fs');
const BASE = process.argv[2] || 'http://localhost:4173/';
const OUT = 'screenshots';
const log = (...a) => console.log('•', ...a);
const errors = [];
const tap = (loc) => loc.click({ timeout: 3000 }).catch(() => {});

async function playScene(page, id) {
  await page.goto(`${BASE}#/scene/${id}`);
  await page.waitForTimeout(400);
  for (let step = 0; step < 120; step++) {
    if (await page.getByText('Chapter complete').isVisible().catch(() => false)) return true;
    const btn = async (name) => page.getByRole('button', { name, exact: false }).first();
    const cont = page.locator('button', { hasText: /^(Continue|Try again)/ }).first();
    if (await cont.isVisible().catch(() => false)) { await tap(cont); await page.waitForTimeout(250); continue; }
    const finish = await btn('Finish chapter');
    if (await finish.isVisible().catch(() => false)) { await tap(finish); await page.waitForTimeout(400); continue; }
    const input = page.locator('#scene-input');
    if (await input.isVisible().catch(() => false)) {
      await input.fill('Estoy de Londres');           // deliberate ser/estar error first
      await tap(page.getByRole('button', { name: 'Reply' }));
      await page.waitForTimeout(150);
      await input.fill('Soy de Londres');
      await tap(page.getByRole('button', { name: 'Reply' }));
      await page.waitForTimeout(250);
      continue;
    }
    const choice = page.locator('div.group > button.flex-1').first();
    if (await choice.isVisible().catch(() => false)) { await tap(choice); await page.waitForTimeout(300); continue; }
    await page.waitForTimeout(200);
  }
  return false;
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

  await page.goto(BASE);
  await page.getByRole('button', { name: /Start my Spanish life/ }).waitFor();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/01-welcome-desktop.png` });
  await page.getByRole('button', { name: /Start my Spanish life/ }).click();

  // VIVA Discover
  await page.locator('#q-name').fill('Sam');
  await page.screenshot({ path: `${OUT}/02-discover.png` });
  const next = () => page.getByRole('button', { name: /^(Continue|Choose my level)/ }).click();
  await next(); // name
  await page.getByRole('radio', { name: /Feminine/ }).click(); await next();
  await page.getByRole('radio', { name: /A few words/ }).click(); await next();
  await page.getByRole('radio', { name: /Buenos Aires/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/02b-city-picker.png` });
  await next(); // city
  await next(); // relocation
  await page.getByRole('checkbox', { name: /Moving abroad/ }).click(); await next();
  await page.getByRole('checkbox', { name: /Football/ }).click();
  await page.getByRole('checkbox', { name: /Live music/ }).click(); await next();
  await page.locator('#q-career').fill('Product designer'); await next();
  await page.getByRole('checkbox', { name: /Dating/ }).click(); await next();
  await next(); // minutes
  await page.getByRole('checkbox', { name: /Games/ }).click(); await next();
  await page.getByRole('checkbox', { name: /Ser vs estar/ }).click(); await next();
  await page.getByRole('radio', { name: /Sí, tengo profe/ }).click();
  await page.getByLabel('Teacher’s name').fill('Dina');
  await page.getByLabel('Teacher’s email').fill('dina@example.com');
  await next();
  log('onboarding done');

  // Placement assessment
  await page.getByRole('button', { name: /Find my level/ }).click();
  for (let i = 0; i < 23; i++) {
    const opts = page.locator('main button.rounded-2xl.px-5, div.mt-5.grid button');
    await page.locator('div.mt-5.grid button').nth(i % 3 === 0 ? 1 : 0).click();
    if (i === 0) await page.screenshot({ path: `${OUT}/03-assessment.png` });
    await page.getByRole('button', { name: /^(Next|See my levels)/ }).click();
  }
  await page.screenshot({ path: `${OUT}/04-assessment-result.png` });
  await page.getByRole('button', { name: /Use these levels/ }).click();
  await page.getByText('Here’s your Spanish DNA').waitFor();
  await page.screenshot({ path: `${OUT}/05-dna.png`, fullPage: false });
  await page.getByRole('button', { name: /Land in/ }).first().click();
  log('assessment + DNA done');

  // Scenes
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/06-scene-arrival.png` });
  for (const id of ['ba-llegada', 'ba-depto', 'ba-cafe']) {
    const ok = await playScene(page, id);
    log(`scene ${id}`, ok ? 'completed' : 'DID NOT COMPLETE');
    if (id === 'ba-cafe') await page.screenshot({ path: `${OUT}/08-scene-complete.png` });
  }
  // capture a mid-scene shot with feedback
  await page.goto(`${BASE}#/scene/ba-depto`);
  for (let k = 0; k < 2; k++) { await tap(page.locator('button', { hasText: /^Continue/ }).first()); await page.waitForTimeout(400); }
  await tap(page.locator('div.group > button.flex-1').nth(2));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/07-scene-feedback.png` });

  // World
  await page.goto(`${BASE}#/world`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/09-world-desktop.png` });

  // Verb gym session
  await page.goto(`${BASE}#/verbs`);
  await page.getByRole('button', { name: /Start 12-exercise session/ }).click();
  for (let s = 0; s < 40; s++) {
    if (await page.getByText(/correct ·/).isVisible().catch(() => false)) break;
    const cont = page.getByRole('button', { name: /^Continue/ });
    if (await cont.isVisible().catch(() => false)) { await tap(cont); await page.waitForTimeout(250); continue; }
    const input = page.getByLabel('Your answer');
    if (await input.isVisible().catch(() => false)) { await input.fill(s % 2 ? 'hablo' : 'tieno'); await page.getByRole('button', { name: 'Check' }).click(); await page.waitForTimeout(150); if (s === 5) await page.screenshot({ path: `${OUT}/10-verb-feedback.png` }); continue; }
    const tiles = page.locator('div.mt-3.flex.flex-wrap.gap-2 > button:not(.invisible)');
    if (await page.getByText('Tap the words in order.').isVisible().catch(() => false)) {
      while (await tiles.count()) { await tiles.first().click(); await page.waitForTimeout(60); }
      await page.getByRole('button', { name: 'Check' }).click(); continue;
    }
    if (await page.getByText(/Match each pronoun/).isVisible().catch(() => false)) {
      const left = page.locator('div.grid.grid-cols-2 > div:first-child > button:not([disabled])');
      const right = page.locator('div.grid.grid-cols-2 > div:last-child > button:not([disabled])');
      for (let g = 0; g < 20 && (await left.count()); g++) {
        await left.first().click();
        const n = await right.count();
        for (let r = 0; r < n; r++) { await right.nth(r).click(); await page.waitForTimeout(80); if ((await left.count()) < n) break; }
      }
      if (s < 3) await page.screenshot({ path: `${OUT}/11-verb-match.png` });
      continue;
    }
    const opt = page.locator('div.mt-5.grid button:not([disabled])').first();
    if (await opt.isVisible().catch(() => false)) { await opt.click(); await page.waitForTimeout(150); continue; }
    await page.waitForTimeout(200);
  }
  await page.screenshot({ path: `${OUT}/12-verb-summary.png` });
  log('verb session done');

  // Review
  await page.goto(`${BASE}#/review`);
  await page.screenshot({ path: `${OUT}/13-review.png` });
  await page.getByRole('button', { name: /Start review/ }).click();
  for (let s = 0; s < 30; s++) {
    if (await page.getByText('Review complete').isVisible().catch(() => false)) break;
    const learn = page.getByRole('button', { name: /test me/ });
    if (await learn.isVisible().catch(() => false)) { await learn.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(400); continue; }
    const hint = page.getByRole('button', { name: 'Help me remember' });
    if (s === 1 && await hint.isVisible().catch(() => false)) { await hint.click(); await page.screenshot({ path: `${OUT}/14-help-me-remember.png` }); }
    const input = page.getByLabel('Your answer');
    if (await input.isEnabled({ timeout: 500 }).catch(() => false)) { await input.fill('maleta').catch(() => {}); await page.getByRole('button', { name: 'Check' }).click({ timeout: 2000 }).catch(() => {}); }
    const nxt = page.getByRole('button', { name: /^Next/ });
    if (await nxt.isVisible().catch(() => false)) await nxt.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(120);
  }
  log('review done');

  // Arcade
  await page.goto(`${BASE}#/games`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/30-arcade.png` });
  for (const g of ['metro', 'order', 'swipe', 'serestar']) {
    await page.goto(`${BASE}#/game/${g}`);
    await page.getByRole('button', { name: /¡Vamos!/ }).click();
    await page.waitForTimeout(2900);
    for (let k = 0; k < 14; k++) {
      if (g === 'metro') await tap(page.locator('button[aria-label^="Carriage"]').nth(k % 4));
      if (g === 'order') {
        await tap(page.locator('div.grid.grid-cols-2 > button').nth(k % 8));
        if (k % 3 === 2) await tap(page.getByRole('button', { name: /Serve/ }));
      }
      if (g === 'swipe') await tap(page.getByRole('button', { name: k % 2 ? 'Correct' : 'Incorrect' }));
      if (g === 'serestar') await tap(page.getByRole('button', { name: k % 2 ? 'Ser' : 'Estar', exact: true }));
      await page.waitForTimeout(g === 'metro' ? 500 : 650);
      if (k === 5) await page.screenshot({ path: `${OUT}/31-game-${g}.png` });
    }
    // end the game
    await tap(page.getByRole('button', { name: 'Pause' }));
    await tap(page.getByRole('button', { name: 'End game' }));
    await page.waitForTimeout(700);
    const over = await page.getByRole('button', { name: /Play again/ }).isVisible().catch(() => false);
    log(`game ${g}:`, over ? 'played to end screen' : 'NO END SCREEN');
    if (g === 'metro') await page.screenshot({ path: `${OUT}/32-game-over.png` });
  }

  // Progress + teacher
  await page.waitForTimeout(6000); // let the active timer flush
  await page.goto(`${BASE}#/progress`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/15-progress.png`, fullPage: true });
  await page.goto(`${BASE}#/teacher`);
  await page.waitForTimeout(500);
  const mail = await page.getByRole('link', { name: /Email my teacher/ }).getAttribute('href');
  log('mailto ok:', mail.startsWith('mailto:dina@example.com?subject=Learning%20with%20Dina') && mail.includes('&body='), `(${mail.length} chars)`);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download PDF report/ }).click()]);
  const pdfPath = `${OUT}/report.pdf`;
  await dl.saveAs(pdfPath);
  const head = fs.readFileSync(pdfPath).subarray(0, 5).toString();
  log('pdf', head, fs.statSync(pdfPath).size, 'bytes');
  await page.screenshot({ path: `${OUT}/16-teacher.png`, fullPage: true });
  await page.goto(`${BASE}#/recap`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/17-recap.png`, fullPage: true });

  // Persistence check
  await page.goto(`${BASE}#/world`);
  await page.reload();
  await page.waitForTimeout(800);
  const greet = await page.locator('h1').first().textContent();
  const stored = await page.evaluate(() => new Promise((res) => {
    const r = indexedDB.open('viva');
    r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('state'); g.onsuccess = () => res(g.result); };
  }));
  const day = Object.values(stored.days)[0];
  log('persisted greeting:', greet);
  log('stored: scenes', stored.story.completedScenes, 'activeSeconds', day.activeSeconds, 'attempted', day.exercisesAttempted, 'correct', day.exercisesCorrect, 'mistakes', day.mistakes.length, 'srs cards', Object.keys(stored.srs).length, 'achievements', stored.achievements.map((a) => a.id));
  log('mistake categories', [...new Set(day.mistakes.map((m) => m.category))]);

  // City tour (desktop)
  for (const city of ['madrid', 'valencia', 'barcelona', 'sevilla', 'cdmx', 'buenosaires', 'medellin']) {
    await page.evaluate((c) => new Promise((res) => {
      const r = indexedDB.open('viva');
      r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'); const st = tx.objectStore('kv'); const g = st.get('state'); g.onsuccess = () => { const v = g.result; v.profile.city = c; v.profile.region = { madrid: 'spain', valencia: 'spain', barcelona: 'spain', sevilla: 'spain', cdmx: 'mexico', buenosaires: 'argentina', medellin: 'colombia' }[c]; st.put(v, 'state'); }; tx.oncomplete = res; };
    }), city);
    await page.goto(`${BASE}#/world`);
    await page.reload();
    await page.waitForTimeout(1300);
    await page.screenshot({ path: `${OUT}/40-city-${city}.png` });
  }

  // Mobile
  const m = await browser.newContext({ ...require('playwright').devices['iPhone 13'] });
  const mp = await m.newPage();
  mp.on('pageerror', (e) => errors.push(`mobile pageerror: ${e.message}`));
  await mp.goto(BASE);
  await mp.waitForTimeout(1500);
  await mp.screenshot({ path: `${OUT}/20-welcome-mobile.png` });
  // copy state into the mobile context via import of exported state
  await mp.evaluate((s) => new Promise((res) => {
    const r = indexedDB.open('viva', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('recordings'); };
    r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put(s, 'state'); tx.oncomplete = res; };
  }), stored);
  for (const [route, name] of [['world', '21-world-mobile'], ['scene/ba-cafe', '22-scene-mobile'], ['games', '26-arcade-mobile'], ['game/order', '27-order-mobile'], ['verbs', '23-verbs-mobile'], ['progress', '24-progress-mobile'], ['settings', '25-dna-mobile']]) {
    await mp.goto(`${BASE}#/${route}`);
    await mp.reload();
    await mp.waitForTimeout(1000);
    await mp.screenshot({ path: `${OUT}/${name}.png` });
  }
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  log('mobile horizontal overflow:', overflow);

  await browser.close();
  log('errors:', errors.length ? errors : 'none');
})().catch((e) => { console.error('E2E FAILED', e); process.exit(1); });
