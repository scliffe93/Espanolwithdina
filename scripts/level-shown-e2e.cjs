// A student sees one level, the same on every screen, and it is the teacher's once she has set it.
// Needs a build served on :4173. Usage: node scripts/level-shown-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2] || '.';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const errors = [];
  const p = await (await b.newContext({ viewport: { width: 1100, height: 900 } })).newPage(); p.on('pageerror', (e) => errors.push(String(e)));
  const as = async (who) => { await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-' + who).click(); await p.waitForTimeout(1600); };
  const seen = async () => {
    await p.goto(BASE + '#/student'); await p.waitForTimeout(1500);
    const homeText = (await p.getByTestId('journey-summary').innerText()).replace(/\s+/g, ' '); const home = homeText.match(/current level ([ABC][12])|([ABC][12]) current level/i); const homeLevel = home ? (home[1] || home[2]) : `? [${homeText.slice(0, 120)}]`;
    const moving = await p.getByTestId('moving-up').count() ? (await p.getByTestId('moving-up').innerText()) : '';
    await p.goto(BASE + '#/journey'); await p.waitForTimeout(1500);
    const main = await p.locator('main').innerText();
    const journey = (main.match(/CURRENT LEVEL\s*([ABC][12])/i) || [])[1] || '?';
    const source = await p.getByTestId('level-source').innerText();
    const skills = await p.getByTestId('skill-levels').isVisible();
    const movingJ = await p.getByTestId('moving-up').count() ? (await p.getByTestId('moving-up').first().innerText()) : moving;
    return { homeLevel, journey, source, skills, moving: (movingJ || moving).replace(/\s+/g, ' ') };
  };
  await as('sam');
  const before = await seen();
  ok(before.homeLevel === before.journey, `before the teacher sets anything, Sam sees one level on both screens (${before.homeLevel}, ${before.journey}; ${before.source})`);
  ok(!before.moving || new RegExp(`You are at ${before.journey}`).test(before.moving), `the next-level card starts from that same level (${before.moving.slice(0, 70)})`);
  // Dina sets Sam's level to B1.
  await as('dina');
  await p.goto(BASE + '#/teach/student/demo-sam'); await p.waitForTimeout(1500);
  await p.getByTestId('level-edit').click(); await p.getByTestId('level-select').selectOption('B1'); await p.getByTestId('level-save').click(); await p.waitForTimeout(1200);
  await as('sam');
  const after = await seen();
  ok(after.homeLevel === 'B1' && after.journey === 'B1' && /set by Dina/.test(after.source), `once Dina sets B1, both screens show B1, “${after.source}”`);
  ok(/You are at B1.*B2/.test(after.moving), `and the next-level card says B1, next B2 (${after.moving.slice(0, 70)})`);
  ok(after.skills === false, 'his own skill-by-skill estimates are no longer shown beside it');
  await p.screenshot({ path: OUT + '/level-shown.png' });
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  await b.close();
})();
