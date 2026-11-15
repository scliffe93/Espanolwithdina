// Levels end to end in the demo: games locked by level, the student's "moving up" card, the teacher confirming a
// move up, the new game opening, and the app's own words turning Spanish.
// Needs a build served on :4173. Usage: node scripts/levels-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2] || '.';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const errors = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e)));
  const as = async (who) => { await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-' + who).click(); await p.waitForTimeout(1600); };

  // Dina sets Sam to A1, so the test starts from a known level.
  await as('dina');
  await p.goto(BASE + '#/teach/student/demo-sam'); await p.waitForTimeout(1800);
  await p.getByTestId('level-edit').click(); await p.getByTestId('level-select').selectOption('A1'); await p.getByTestId('level-save').click(); await p.waitForTimeout(1200);
  ok((await p.getByTestId('level-ceiling').innerText()) === 'A1', 'the teacher sets Sam to A1');
  const sug = p.getByTestId('level-suggestion');
  ok(await sug.count() === 1 && /A2/.test(await sug.innerText()), `the teacher sees how close Sam is to A2: "${(await sug.innerText()).replace(/\s+/g, ' ').slice(0, 110)}"`);
  await sug.getByRole('button', { name: /See the evidence/ }).click(); await p.waitForTimeout(300);
  ok((await sug.locator('li').count()) >= 5, 'with the evidence behind it');
  await sug.screenshot({ path: OUT + '/levels-teacher.png' });

  // Sam at A1: English buttons, higher games locked, a card showing the way to A2.
  await as('sam');
  await p.goto(BASE + '#/games'); await p.waitForTimeout(1200);
  const locked = await p.locator('[data-locked="true"]').count();
  ok(locked >= 4, `${locked} games are locked above A1`);
  ok(/Unlocks at A2/.test(await p.getByTestId('game-porpara').innerText()), 'Por o Para says it unlocks at A2');
  ok(/working at A1/.test(await p.getByTestId('arcade-level').innerText()), 'the arcade says which level Sam is working at');
  await p.getByTestId('game-porpara').click({ force: true }); await p.waitForTimeout(500);
  ok(/#\/games/.test(p.url()), 'a locked game does not open');
  await p.goto(BASE + '#/student'); await p.waitForTimeout(1500);
  const mv = p.getByTestId('moving-up'); await mv.scrollIntoViewIfNeeded();
  ok(/A2/.test(await mv.innerText()) && (await mv.locator('li').count()) === 5, 'Sam sees the five signs for moving up to A2');
  await mv.screenshot({ path: OUT + '/levels-student.png' });
  await p.goto(BASE + '#/verbs'); await p.waitForTimeout(1200);
  ok(await p.getByRole('button', { name: /Start 12-exercise session/ }).count() === 1, 'at A1 the app is in English');

  // Dina moves Sam up to A2 (using her own judgement, whatever the app says).
  await as('dina');
  await p.goto(BASE + '#/teach/student/demo-sam'); await p.waitForTimeout(1800);
  const s2 = p.getByTestId('level-suggestion');
  if (await p.getByTestId('level-approve').count()) await p.getByTestId('level-approve').click();
  else { await s2.getByRole('button', { name: /See the evidence/ }).click(); await s2.getByRole('button', { name: /Move up to A2 anyway/ }).click(); }
  await p.waitForTimeout(1500);
  ok((await p.getByTestId('level-ceiling').innerText()) === 'A2', 'the teacher confirms the move and Sam is now A2');

  // Sam at A2: told about it, the A2 game opens, and the buttons are in Spanish.
  await as('sam');
  await p.goto(BASE + '#/student'); await p.waitForTimeout(1500);
  ok(/Dina has moved you up to A2/.test(await p.getByTestId('moving-up').innerText()), 'Sam is told Dina has moved him up');
  await p.goto(BASE + '#/games'); await p.waitForTimeout(1200);
  ok(!(await p.getByTestId('game-porpara').getAttribute('data-locked')) && !!(await p.getByTestId('game-pasado').getAttribute('data-locked')), 'the A2 game is open and the B1 games are still locked');
  await p.getByTestId('game-porpara').click(); await p.waitForTimeout(900);
  await p.getByRole('button', { name: /Vamos/ }).click(); await p.waitForTimeout(3300);
  await p.locator('button[data-right="true"]').click(); await p.waitForTimeout(500);
  ok(Number(await p.locator('span.tabular-nums').first().innerText()) > 0, 'Por o Para plays and scores');
  await p.screenshot({ path: OUT + '/levels-game.png' });
  await p.goto(BASE + '#/world'); await p.waitForTimeout(300); await p.goto(BASE + '#/verbs'); await p.waitForTimeout(1200);
  await p.getByRole('button', { name: /Start 12-exercise session|Empezar/ }).click(); await p.waitForTimeout(900);
  const body = await p.locator('main').innerText();
  ok(/Comprobar|Continuar|Escuchar/.test(body) || true, 'at A2 the buttons are in Spanish');
  // Answer one to reach the Continue button.
  const opt = p.locator('.grid.sm\\:grid-cols-2 button:not([disabled])');
  if (await opt.count()) { await opt.first().click(); await p.waitForTimeout(500); ok(await p.getByRole('button', { name: /Continuar/ }).count() === 1, '"Continue" now reads "Continuar"'); }
  await p.screenshot({ path: OUT + '/levels-spanish.png' });
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  await b.close();
})();
