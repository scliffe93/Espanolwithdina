// The lesson room in the demo (no account needed): Dina drafts a lesson from Sam's week, starts it and opens the
// parts; switching to Sam shows his side with only those parts; his answer is there when switching back.
// Needs a build served on :4173. Usage: node scripts/room-demo-e2e.cjs <outDir> [a .docx lesson plan to upload]
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
  // The ready-made example lesson.
  await p.goto(BASE + '#/teach/room'); await p.waitForTimeout(1200);
  await p.getByTestId('room-student').selectOption({ label: 'Sam' }); await p.getByTestId('room-example').click(); await p.getByTestId('teacher-room').waitFor({ timeout: 10000 }); await p.waitForTimeout(600);
  ok((await p.getByTestId('block-editor').count()) === 7 && /Example lesson/.test(await p.getByTestId('room-title').inputValue()), '“Open an example lesson” makes a finished seven-part lesson to try');
  // A lesson made from the teacher's own plan: pasted, then uploaded as a text file and as a Word document.
  const PLAN = 'El pretérito: ir y ser\n\nCalentamiento\n¿Qué hiciste el fin de semana?\n\nEXPLICACIÓN\nIr and ser have the same forms in the preterite.\n\nPráctica:\n1. Ayer yo ___ (ir) al mercado. [fui]\n2. La película ___ (ser) muy buena.\nAnswers: fue\n\n¿Ir o ser?\nEl sábado fuimos a la playa.\na) ir *\nb) ser\n\nVocabulario\nayer = yesterday\nanoche = last night\n';
  await p.goto(BASE + '#/teach/room'); await p.waitForTimeout(1200);
  await p.getByTestId('room-student').selectOption({ label: 'Sam' });
  await p.getByTestId('room-paste-toggle').click(); await p.getByTestId('room-paste').fill(PLAN); await p.getByTestId('room-paste-go').click();
  await p.getByTestId('teacher-room').waitFor({ timeout: 10000 }); await p.waitForTimeout(600);
  ok((await p.getByTestId('room-title').inputValue()) === 'El pretérito: ir y ser' && (await p.getByTestId('block-editor').count()) === 6, 'a pasted lesson plan becomes a lesson: title and six parts');
  ok(/6 parts: 1 explanation, 1 open question, 2 gap sentences, 1 multiple-choice question, 1 word list\./.test(await p.getByTestId('import-note').innerText()), 'it says what it made from the plan');
  const answers = await p.locator('input[data-testid="block-answer"]').evaluateAll((els) => els.map((e) => e.value));
  ok(answers.join(',') === 'fui,fue', `the answers were read from the plan (${answers.join(', ')})`);
  await p.screenshot({ path: OUT + '/room-imported.png', fullPage: true });
  await p.goto(BASE + '#/teach/room'); await p.waitForTimeout(1200);
  await p.getByTestId('room-student').selectOption({ label: 'Sam' });
  await p.getByTestId('room-file').setInputFiles({ name: 'Mi plan de clase.txt', mimeType: 'text/plain', buffer: Buffer.from(PLAN, 'utf8') });
  await p.getByTestId('teacher-room').waitFor({ timeout: 15000 }); await p.waitForTimeout(600);
  ok((await p.getByTestId('block-editor').count()) === 6, 'an uploaded text file does the same');
  const docx = process.argv[3];
  if (docx && require('fs').existsSync(docx)) {
    await p.goto(BASE + '#/teach/room'); await p.waitForTimeout(1200);
    await p.getByTestId('room-student').selectOption({ label: 'Sam' });
    await p.getByTestId('room-file').setInputFiles(docx);
    await p.getByTestId('teacher-room').waitFor({ timeout: 20000 }); await p.waitForTimeout(600);
    const n = await p.getByTestId('block-editor').count();
    ok(n >= 5 && (await p.getByTestId('room-title').inputValue()) === 'El pretérito: ir y ser', `a Word document is read too (${n} parts)`);
  } else console.log('- no Word file given: skipped');
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  await b.close();
})();
