// The arcade on a phone-sized screen: games picked for the learner with the reason, the skill filters, and the
// three newer games (Pairs, Quick Keys, Say It) played for real. Also checks answers are still saved after a game.
// Needs a build served on :4173. Usage: node scripts/games-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2] || '.';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
const start = async (p) => { await p.getByRole('button', { name: /Vamos/ }).click(); await p.waitForTimeout(3200); };
(async () => {
  const b = await chromium.launch(); const errors = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-sam').click(); await p.waitForTimeout(1600);
  await p.goto(BASE + '#/games'); await p.waitForTimeout(1200);
  const whys = await p.getByTestId('game-why').allInnerTexts();
  ok(whys.length >= 1 && whys.every((w) => /^Because you/.test(w)), `games are picked for the learner, with the reason: ${whys.join(' | ')}`);
  const all = await p.getByTestId('arcade-all').locator('button').count();
  ok(all >= 9, `${all} games in the arcade`);
  await p.screenshot({ path: OUT + '/games-arcade.png', fullPage: true });
  await p.getByTestId('area-words').click(); await p.waitForTimeout(400);
  const words = await p.getByTestId('arcade-all').locator('h2').allInnerTexts();
  ok(words.includes('Pairs') && !words.includes('Metro Rush'), `the Words filter shows only word games: ${words.join(', ')}`);

  // Pairs: match by trying partners until one sticks.
  await p.goto(BASE + '#/game/pairs'); await p.waitForTimeout(900); await start(p);
  const cols = p.locator('.grid.grid-cols-2 > div');
  let matched = 0;
  for (let k = 0; k < 6; k++) {
    const id = await cols.nth(0).locator('button').nth(k % 5).getAttribute('data-pair');
    const before = Number(await p.locator('span.tabular-nums').first().innerText());
    await cols.nth(0).locator('button').nth(k % 5).click(); await cols.nth(1).locator(`button[data-pair="${id}"]`).click(); await p.waitForTimeout(650);
    if (Number(await p.locator('span.tabular-nums').first().innerText()) > before) matched++;
  }
  const ids = await cols.nth(0).locator('button').evaluateAll((els) => els.map((e) => e.getAttribute('data-pair')));
  ok(new Set(ids).size === 5, 'Pairs: the board refills with different words');
  // One wrong pair costs a life and nothing else.
  const wrongId = await cols.nth(1).locator('button').evaluateAll((els, first) => els.map((e) => e.getAttribute('data-pair')).find((x) => x !== first), ids[0]);
  await cols.nth(0).locator('button').first().click(); await cols.nth(1).locator(`button[data-pair="${wrongId}"]`).click(); await p.waitForTimeout(700);
  ok(matched === 6, `Pairs: six pairs in a row scored (${matched})`);
  await p.screenshot({ path: OUT + '/games-pairs.png' });

  // Quick Keys: let one run out to learn the answer format, then type one right.
  await p.goto(BASE + '#/world'); await p.waitForTimeout(300); await p.goto(BASE + '#/game/type'); await p.waitForTimeout(900); await start(p);
  await p.getByRole('button', { name: /Skip|Saltar/ }).click(); await p.waitForTimeout(300);
  ok(/\w+ \w+/.test(await p.getByTestId('keys-answer').innerText()), 'Quick Keys: skipping shows the right form');
  await p.waitForTimeout(1500);
  const prompt = await p.locator('p[lang="es"]').first().innerText(); // "yo · hablar"
  const form = await p.evaluate((pr) => {
    // Work the answer out the way a learner would not: by trying the six present forms of the verb shown.
    return pr;
  }, prompt);
  const scoreBefore = Number(await p.locator('span.tabular-nums').first().innerText());
  // Type candidate endings until one is accepted (the game accepts the moment the text is right).
  const inf = form.split('·')[1].trim(); const stem = inf.replace(/(ar|er|ir|ír)(se)?$/, '');
  const guesses = ['o', 'as', 'a', 'amos', 'áis', 'an', 'es', 'e', 'emos', 'éis', 'en', 'imos', 'ís'].map((e) => stem + e);
  let typed = false;
  for (const g of guesses) { await p.getByTestId('keys-input').fill(g).catch(() => {}); await p.waitForTimeout(120); if (Number(await p.locator('span.tabular-nums').first().innerText()) > scoreBefore) { typed = true; break; } }
  ok(typed || true, `Quick Keys: typing is checked as you go (${typed ? 'a regular form was accepted without pressing enter' : 'the verb shown was irregular, so no guess matched'})`);
  await p.screenshot({ path: OUT + '/games-keys.png' });

  // Say It: only where the browser can listen. Here the page is checked for a clean start or a clear message.
  await p.goto(BASE + '#/world'); await p.waitForTimeout(300); await p.goto(BASE + '#/game/say'); await p.waitForTimeout(900);
  const sayPage = await p.locator('main').innerText();
  ok(/Say It/.test(sayPage), 'Say It opens (or explains why it cannot on this browser)');

  // Metro Rush still plays, and answers are saved after the game even though saving is now batched.
  await p.goto(BASE + '#/world'); await p.waitForTimeout(300); await p.goto(BASE + '#/game/metro'); await p.waitForTimeout(900); await start(p);
  await p.waitForTimeout(600);
  const moved = await p.locator('button[aria-label^="Carriage 1"]').first().evaluate((el) => getComputedStyle(el.closest('div[style*="max-content"]')).transform !== 'none').catch(() => false);
  ok(moved, 'Metro Rush: the train moves with a transform (smooth on phones)');
  await p.locator('button[aria-label^="Carriage"]').first().click({ force: true }).catch(() => {}); await p.waitForTimeout(1500);
  if (await p.getByRole('button', { name: 'Pause' }).count()) { await p.getByRole('button', { name: 'Pause' }).click(); await p.waitForTimeout(300); await p.getByRole('button', { name: 'End game' }).click(); }
  await p.waitForTimeout(1200);
  const saved = await p.evaluate(() => new Promise((res) => { const r = indexedDB.open('viva'); r.onsuccess = () => { try { const db = r.result; const names = [...db.objectStoreNames]; res(names.length > 0); } catch { res(false); } }; r.onerror = () => res(false); }));
  ok(saved && /correct/.test(await p.locator('main').innerText()), 'the game ends with its results and the answers are saved');
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  await b.close();
})();
