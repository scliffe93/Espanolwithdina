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
  if (await p.getByTestId('room-class-clear').count()) await p.getByTestId('room-class-clear').click(); await p.getByTestId('class-student').filter({ hasText: 'Sam' }).click();
  await p.getByTestId('student-tab').filter({ hasText: 'Sam' }).click(); await p.waitForTimeout(500); await p.getByTestId('room-draft').click(); await p.getByTestId('teacher-room').waitFor({ timeout: 10000 }); await p.waitForTimeout(600);
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
  await p.goto(BASE + '#/teach/room'); await p.waitForTimeout(1200); await p.getByTestId('student-tab').filter({ hasText: 'Sam' }).click(); await p.waitForTimeout(500); await p.getByTestId('room-open').first().click(); await p.getByTestId('teacher-room').waitFor({ timeout: 10000 }); await p.waitForTimeout(2500);
  ok(/answered ✗/.test(await p.getByTestId('block-list').innerText()), 'and Dina sees it on her side');
  // The ready-made example lesson.
  await p.goto(BASE + '#/teach/room'); await p.waitForTimeout(1200);
  if (await p.getByTestId('room-class-clear').count()) await p.getByTestId('room-class-clear').click(); await p.getByTestId('class-student').filter({ hasText: 'Sam' }).click(); await p.getByTestId('room-example').click(); await p.getByTestId('import-review').waitFor({ timeout: 10000 }); await p.getByTestId('review-create').click(); await p.getByTestId('teacher-room').waitFor({ timeout: 10000 }); await p.waitForTimeout(600);
  ok((await p.getByTestId('block-editor').count()) === 7 && /Example lesson/.test(await p.getByTestId('room-title').inputValue()), '“Open an example lesson” makes a finished seven-part lesson to try');
  // A lesson made from the teacher's own plan: pasted, then uploaded as a text file and as a Word document.
  const PLAN = 'El pretérito: ir y ser\n\nCalentamiento\n¿Qué hiciste el fin de semana?\n\nEXPLICACIÓN\nIr and ser have the same forms in the preterite.\n\nPráctica:\n1. Ayer yo ___ (ir) al mercado. [fui]\n2. La película ___ (ser) muy buena.\nAnswers: fue\n\n¿Ir o ser?\nEl sábado fuimos a la playa.\na) ir *\nb) ser\n\nVocabulario\nayer = yesterday\nanoche = last night\n';
  await p.goto(BASE + '#/teach/room'); await p.waitForTimeout(1200);
  if (await p.getByTestId('room-class-clear').count()) await p.getByTestId('room-class-clear').click(); await p.getByTestId('class-student').filter({ hasText: 'Sam' }).click();
  await p.getByTestId('room-paste-toggle').click(); await p.getByTestId('room-paste').fill(PLAN); await p.getByTestId('room-paste-go').click();
  await p.getByTestId('import-review').waitFor({ timeout: 10000 });
  ok((await p.getByTestId('review-title').inputValue()) === 'El pretérito: ir y ser' && (await p.getByTestId('block-editor').count()) === 6, 'a pasted plan opens for review first: title and six parts');
  ok(/6 parts: 1 explanation, 1 open question, 2 gap sentences, 1 multiple-choice question, 1 word list\./.test(await p.getByTestId('review-summary').innerText()), 'the review says what it made from the plan');
  ok(/Calentamiento/.test(await p.getByTestId('review-source').innerText()), 'her own document is shown beside the parts');
  ok(/Every gap and choice has its answer/.test(await p.getByTestId('review-missing').innerText()), 'it says every answer was found');
  const answers = await p.locator('input[data-testid="block-answer"]').evaluateAll((els) => els.map((e) => e.value));
  ok(answers.join(',') === 'fui,fue', `the answers were read from the plan (${answers.join(', ')})`);
  await p.screenshot({ path: OUT + '/room-review.png', fullPage: true });
  // Cancelling leaves no lesson behind.
  const lessonCount = async () => { await p.getByTestId('student-tab').filter({ hasText: 'Sam' }).click(); await p.waitForTimeout(500); const n = await p.getByTestId('room-open').count(); await p.getByTestId('library-all').click(); await p.waitForTimeout(300); return n; };
  const before = await (async () => { await p.getByTestId('review-cancel').click(); await p.getByTestId('room-list').waitFor(); await p.waitForTimeout(800); return lessonCount(); })();
  // A plan with a missing answer is flagged; she fixes it in the review, edits the title, removes a part, then creates.
  if (!(await p.getByTestId('room-paste').count())) await p.getByTestId('room-paste-toggle').click();
  await p.getByTestId('room-paste').fill(PLAN.replace('Answers: fue\n', '')); await p.getByTestId('room-paste-go').click();
  await p.getByTestId('import-review').waitFor({ timeout: 10000 });
  ok(/1 part needs an answer/.test(await p.getByTestId('review-missing').innerText()) && (await p.locator('[data-testid="block-editor"][data-flag]').count()) === 1, 'a part with no answer is flagged in the review');
  await p.locator('[data-testid="block-editor"][data-flag] input[data-testid="block-answer"]').fill('fue'); await p.waitForTimeout(200);
  ok(/Every gap and choice has its answer/.test(await p.getByTestId('review-missing').innerText()), 'filling it in clears the flag');
  await p.getByTestId('review-title').fill('Mi clase revisada');
  await p.getByTestId('block-editor').first().getByLabel('Delete this part').click();
  await p.getByTestId('review-create').click();
  await p.getByTestId('teacher-room').waitFor({ timeout: 10000 }); await p.waitForTimeout(600);
  ok((await p.getByTestId('room-title').inputValue()) === 'Mi clase revisada' && (await p.getByTestId('block-editor').count()) === 5, 'the lesson is created as she left it in the review');
  await p.goto(BASE + '#/teach/room'); await p.waitForTimeout(1200);
  ok((await lessonCount()) === before + 1, 'saving a plan for later made no lesson; teaching it made one');
  await p.screenshot({ path: OUT + '/room-list.png', fullPage: true });
  const upload = async (file, label, min) => {
    if (await p.getByTestId('review-cancel').count()) await p.getByTestId('review-cancel').click();
    await p.goto(BASE + '#/teach/room'); await p.waitForTimeout(1200);
    if (await p.getByTestId('room-class-clear').count()) await p.getByTestId('room-class-clear').click(); await p.getByTestId('class-student').filter({ hasText: 'Sam' }).click();
    await p.getByTestId('room-file').setInputFiles(file);
    await p.getByTestId('import-review').waitFor({ timeout: 20000 });
    const n = await p.getByTestId('block-editor').count(); const title = await p.getByTestId('review-title').inputValue();
    const kinds = await p.getByTestId('block-editor').evaluateAll((els) => els.map((e) => e.dataset.type).join(','));
    ok(n >= min && title === 'El pretérito: ir y ser', `${label} opens for review (${n} parts: ${kinds}; “${title}”)`);
    return { n, kinds };
  };
  await upload({ name: 'Mi plan de clase.txt', mimeType: 'text/plain', buffer: Buffer.from(PLAN, 'utf8') }, 'an uploaded text file', 6);
  const docx = process.argv[3];
  if (docx && require('fs').existsSync(docx)) await upload(docx, 'a Word document', 5); else console.log('- no Word file given: skipped');
  // A PDF plan, made here the way a teacher's would look: a title, headings in larger type, numbered sentences.
  const pdfPage = await b.newPage();
  await pdfPage.setContent(`<html><body style="font-family:Helvetica;font-size:12pt;line-height:1.5"><h1 style="font-size:22pt">El pretérito: ir y ser</h1><h2 style="font-size:16pt">Calentamiento</h2><p>¿Qué hiciste el fin de semana?</p><h2 style="font-size:16pt">Explicación</h2><p>Ir and ser have the same forms in the preterite.</p><h2 style="font-size:16pt">Práctica</h2><p>1. Ayer yo ___ (ir) al mercado. [fui]</p><p>2. La película ___ (ser) muy buena. [fue]</p><h2 style="font-size:16pt">¿Ir o ser?</h2><p>El sábado fuimos a la playa.</p><p>a) ir *</p><p>b) ser</p><h2 style="font-size:16pt">Vocabulario</h2><p>ayer = yesterday</p><p>anoche = last night</p></body></html>`);
  const pdf = await pdfPage.pdf({ format: 'A4' }); await pdfPage.close();
  const r = await upload({ name: 'Plan.pdf', mimeType: 'application/pdf', buffer: pdf }, 'a PDF', 6);
  ok(r.kinds === 'question,text,gap,gap,choice,vocab', 'the PDF gives the same six parts as the typed plan');
  const pa = await p.locator('input[data-testid="block-answer"]').evaluateAll((els) => els.map((e) => e.value));
  ok(pa.join(',') === 'fui,fue', `with the answers from the PDF (${pa.join(', ')})`);
  await p.screenshot({ path: OUT + '/room-review-pdf.png', fullPage: true });
  await p.getByTestId('review-create').click(); await p.getByTestId('teacher-room').waitFor({ timeout: 10000 }); await p.waitForTimeout(600);
  ok((await p.getByTestId('block-editor').count()) === 6, 'and the lesson is created from the reviewed PDF');
  await p.screenshot({ path: OUT + '/room-plan.png', fullPage: true });
  // The Word template: uploaded exactly as it is downloaded, it gives a finished lesson and leaves the guide page out.
  ok((await p.request.get(BASE + 'guides/lesson-plan-template.docx')).status() === 200, 'the template can be downloaded');
  {
    await p.goto(BASE + '#/teach/room'); await p.waitForTimeout(1200);
    ok(await p.getByTestId('room-template').count() === 1, 'the lesson room offers the Word template');
    if (await p.getByTestId('room-class-clear').count()) await p.getByTestId('room-class-clear').click(); await p.getByTestId('class-student').filter({ hasText: 'Sam' }).click();
    await p.getByTestId('room-file').setInputFiles('public/guides/lesson-plan-template.docx');
    await p.getByTestId('import-review').waitFor({ timeout: 20000 });
    const kinds = await p.getByTestId('block-editor').evaluateAll((els) => els.map((e) => e.dataset.type).join(','));
    ok(kinds === 'question,text,gap,gap,gap,choice,vocab,question', `the template gives eight parts as written (${kinds})`);
    ok((await p.getByTestId('review-title').inputValue()) === 'El pretérito de ir y ser' && /Every gap and choice has its answer/.test(await p.getByTestId('review-missing').innerText()), 'with its title and every answer');
    ok(!/How to use this template|Good to know/.test(await p.getByTestId('import-review').locator('ol').innerText()), 'the guide page after END OF LESSON is not put in the lesson');
    await p.screenshot({ path: OUT + '/room-review-template.png', fullPage: true });
    await p.getByTestId('review-create').click(); await p.getByTestId('teacher-room').waitFor({ timeout: 10000 }); await p.waitForTimeout(600);
    // The tasks of the lesson, sent as homework.
    ok(/10 tasks for Sam to do alone: 8 marked by the app, 2 for you to mark/.test(await p.getByTestId('lesson-homework-count').innerText()), `the lesson offers its tasks as homework (${await p.getByTestId('lesson-homework-count').innerText()})`);
    await p.getByTestId('lesson-homework-open').click(); await p.getByTestId('lesson-homework-send').click();
    await p.getByTestId('lesson-homework-sent').waitFor({ timeout: 10000 });
    await p.screenshot({ path: OUT + '/room-homework.png', fullPage: true });
    await as('sam');
    await p.goto(BASE + '#/student/homework'); await p.waitForTimeout(1500);
    const card = p.locator('[data-testid^="hw-card-"]').filter({ hasText: 'From our lesson: El pretérito de ir y ser' }).first();
    ok(await card.count() === 1, 'Sam finds it in his homework');
    await card.getByRole('button').first().click(); await p.waitForTimeout(1000);
    const start = p.locator('[data-testid^="hw-start-"]'); if (await start.count()) await start.first().click();
    await p.getByTestId('material-runner').waitFor({ timeout: 10000 });
    const want = { 'Ayer yo': 'fui', 'La película': 'FUE', 'Mis amigos': 'zzz' }; let right = 0, wrong = 0;
    for (let k = 0; k < 10; k++) {
      const text = await p.getByTestId('material-runner').innerText();
      if (await p.getByTestId('material-typed').count()) {
        const key = Object.keys(want).find((w) => text.includes(w));
        await p.getByTestId('material-typed').fill(key ? want[key] : 'Fui a Valencia.'); await p.getByTestId('material-check').click();
      } else {
        const opts = p.getByTestId('material-option'); const labels = await opts.allInnerTexts();
        const good = ['ir', 'yesterday', 'last night', 'last week', 'the weekend'];
        const pick = /fuimos a la playa/.test(text) ? 'ir' : /“ayer”/.test(text) ? 'yesterday' : /“anoche”/.test(text) ? 'last night' : /“la semana pasada”/.test(text) ? 'last week' : 'the weekend';
        await opts.nth(Math.max(0, labels.indexOf(pick))).click(); void good;
      }
      const fb = await p.getByTestId('material-feedback').innerText();
      if (/Eso es/.test(fb)) right++; else if (/Not quite/.test(fb)) wrong++;
      if (k === 2) await p.screenshot({ path: OUT + '/room-homework-student.png' });
      await p.getByTestId('material-next').click(); await p.waitForTimeout(400);
    }
    ok(right === 7 && wrong === 1, `he does all ten tasks: gaps and choices are marked (${right} right, ${wrong} wrong), the open questions go to Dina`);
    await p.waitForTimeout(1500);
    await as('dina');
    await p.goto(BASE + '#/teach/homework'); await p.waitForTimeout(1500);
    ok(/From our lesson: El pretérito de ir y ser/.test(await p.locator('main').innerText()) && /7\/8 correct/.test(await p.locator('main').innerText()), 'and Dina sees it handed in: 7/8 correct, 2 answers for her to mark');
  }
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  await b.close();
})();
