// The lesson room in the demo (no account needed): Dina drafts a lesson from Sam's week, starts it and opens the
// parts; switching to Sam shows his side with only those parts; his answer is there when switching back.
// Needs a build served on :4173. Usage: node scripts/room-demo-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2] || '.';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const errors = [];
  const p = await (await b.newContext({ viewport: { width: 1280, height: 860 } })).newPage(); p.on('pageerror', (e) => errors.push(String(e)));
  const as = async (who) => { await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId('demo-' + who).click(); await p.waitForTimeout(1600); };
  await as('dina');
  await p.goto(BASE + '#/teach/room'); await p.waitForTimeout(1500);
  await p.getByTestId('room-student').selectOption({ label: 'Sam' });
  await p.getByTestId('room-draft').click(); await p.getByTestId('teacher-room').waitFor({ timeout: 10000 }); await p.waitForTimeout(600);
  const parts = await p.getByTestId('block-editor').count();
  ok(parts >= 5, `“Draft it from their week” writes a lesson from Sam’s own mistakes (${parts} parts)`);
  const bodies = await p.getByTestId('block-body').evaluateAll((els) => els.map((e) => e.value));
  ok(bodies.some((x) => /___ \(/.test(x)) && bodies.some((x) => /→/.test(x)), 'with gap exercises on the forms he missed and his own wrong answers quoted');
  await p.screenshot({ path: OUT + '/room-draft.png', fullPage: true });
  await p.getByTestId('to-present').click(); await p.getByTestId('start-lesson').click(); await p.getByTestId('open-all').click(); await p.waitForTimeout(1200);
  await as('sam');
  await p.goto(BASE + '#/student'); await p.waitForTimeout(1500);
  ok(await p.getByTestId('join-lesson').count() === 1, 'Sam’s home page offers the lesson');
  await p.getByTestId('join-lesson').click(); await p.getByTestId('student-room').waitFor({ timeout: 10000 }); await p.waitForTimeout(2500);
  ok((await p.locator('[data-testid^="block-"]').count()) === parts, 'he sees every part she opened');
  const gap = p.locator('input[data-testid^="answer-"]').first(); const gid = (await gap.getAttribute('data-testid')).replace('answer-', '');
  await gap.fill('zzz'); await p.getByTestId(`send-${gid}`).click(); await p.waitForTimeout(1500);
  ok(/Not quite/.test(await p.getByTestId(`verdict-${gid}`).innerText()), 'his answer is checked');
  await as('dina');
  await p.goto(BASE + '#/teach/room'); await p.waitForTimeout(1200); await p.getByTestId('room-open').first().click(); await p.getByTestId('teacher-room').waitFor({ timeout: 10000 }); await p.waitForTimeout(2500);
  ok(/answered ✗/.test(await p.getByTestId('block-list').innerText()), 'and Dina sees it on her side');
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  await b.close();
})();
