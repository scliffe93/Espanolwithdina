// The teacher's own homework, in the demo: Dina uploads an explanation (the learning) and a file of questions,
// Sam reads both, answers and hands in, and the explanation stays in his learning bank. Also: the assign sheet
// fits a short window and scrolls to its last row. Needs a build served on :4173. Usage: node scripts/own-homework-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2] || '.';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
const asActor = async (p, who) => { await p.goto(BASE + '#/demo'); await p.waitForTimeout(800); await p.getByTestId(`demo-${who}`).click(); await p.waitForTimeout(1600); };
const sheet = (title, body) => `<html><body style="font-family:sans-serif;padding:40px"><h1>${title}</h1>${body}</body></html>`;
(async () => {
  const b = await chromium.launch(); const errors = [];
  // Two small PDFs to upload.
  const maker = await b.newPage();
  await maker.setContent(sheet('Los pronombres', '<table border="1" cellpadding="10"><tr><td>yo</td><td>I</td></tr><tr><td>tú</td><td>you</td></tr><tr><td>él / ella</td><td>he / she</td></tr></table><p>We leave the pronoun out when the verb ending already says who.</p>'));
  await maker.pdf({ path: OUT + '/Los pronombres.pdf' });
  await maker.setContent(sheet('Ejercicios', '<ol><li>___ soy de Londres.</li><li>¿___ eres de Madrid?</li></ol>'));
  await maker.pdf({ path: OUT + '/Ejercicios.pdf' });
  await maker.close();
  // A small Word file with a table, as a teacher would make.
  const { zipSync, strToU8 } = require('fflate');
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const cell = (t) => `<w:tc><w:p><w:r><w:t>${t}</w:t></w:r></w:p></w:tc>`;
  require('fs').writeFileSync(OUT + '/Tabla de pronombres.docx', Buffer.from(zipSync({
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body><w:p><w:r><w:t>Pronombres de sujeto</w:t></w:r></w:p><w:tbl><w:tr>${cell('yo')}${cell('I')}</w:tr><w:tr>${cell('nosotros')}${cell('we')}</w:tr></w:tbl></w:body></w:document>`),
  })));

  // A short, wide window, like a small laptop with the browser's bars taking room.
  const ctx = await b.newContext({ viewport: { width: 1280, height: 620 } }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e)));
  await asActor(p, 'dina');
  await p.goto(BASE + '#/teach/student/demo-sam'); await p.waitForTimeout(1500);
  await p.getByRole('button', { name: 'Assign homework' }).first().click(); await p.waitForTimeout(900);
  ok(await p.getByTestId('hw-mode-own').isVisible() && await p.getByTestId('hw-mode-list').isVisible(), 'the sheet opens on two choices: my own homework, or an activity from the list');
  await p.screenshot({ path: OUT + '/own-1-choice.png' });

  // The list still works, and the sheet fits the window and scrolls to its last row.
  await p.getByTestId('hw-mode-list').click(); await p.waitForTimeout(400);
  ok(await p.locator('#hw-template').isVisible(), 'the list of activities is there');
  const dlg = p.getByRole('dialog');
  const box = await dlg.boundingBox();
  ok(box.y >= 0 && box.y + box.height <= 620 - 40, `the sheet stays clear of the bottom of the window (ends at ${Math.round(box.y + box.height)} of 620)`);
  await dlg.evaluate((el) => el.scrollTo(0, el.scrollHeight)); await p.waitForTimeout(300);
  const last = await p.locator('#hw-instructions').boundingBox();
  ok(last && last.y + last.height <= 620 - 60, `the last field scrolls well clear of the bottom (ends at ${last && Math.round(last.y + last.height)})`);
  await p.screenshot({ path: OUT + '/own-2-list-scrolled.png' });
  await dlg.evaluate((el) => el.scrollTo(0, 0));
  await p.getByTestId('hw-mode-back').click(); await p.waitForTimeout(300);

  // My own homework: the learning and the questions.
  await p.getByTestId('hw-mode-own').click(); await p.waitForTimeout(400);
  ok(!(await p.locator('#hw-template').count()), 'no activities or drills on this side');
  await p.getByTestId('hw-learning-input').setInputFiles(OUT + '/Los pronombres.pdf'); await p.waitForTimeout(900);
  await p.getByTestId('hw-questions-input').setInputFiles([OUT + '/Ejercicios.pdf']); await p.waitForTimeout(900);
  ok((await p.getByTestId('hw-learning-item').count()) === 1 && (await p.getByTestId('hw-questions-item').count()) === 1, 'both files are uploaded and listed');
  await p.getByTestId('hw-questions-input').setInputFiles({ name: 'notes.zip', mimeType: 'application/zip', buffer: Buffer.from('x') }); await p.waitForTimeout(400);
  ok(await p.getByText('can’t be used').count() > 0, 'a file the app cannot take is refused with a reason');
  ok((await p.locator('#hw-title').inputValue()) === 'Ejercicios', 'the title comes from the questions file');
  await p.screenshot({ path: OUT + '/own-3-form.png', fullPage: true });
  await p.getByTestId('hw-assign-submit').click({ noWaitAfter: true }); await p.waitForTimeout(1800);
  ok(!(await p.getByTestId('hw-mode-back').count()), 'assigned and the sheet closed');
  await p.getByText('Homework', { exact: true }).last().click(); await p.waitForTimeout(800);
  ok(await p.getByTestId('teach-learning-bank').getByText('Los pronombres.pdf').count() > 0, 'Dina sees the explanation in Sam’s learning bank');

  // Learning only: no homework, straight to the bank.
  await p.getByRole('button', { name: 'Assign homework' }).first().click(); await p.waitForTimeout(700);
  await p.getByTestId('hw-mode-own').click(); await p.waitForTimeout(300);
  await p.getByTestId('hw-learning-input').setInputFiles({ name: 'Ser y estar.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') }); await p.waitForTimeout(700);
  ok(!(await p.locator('#hw-due-date').count()), 'with learning only there is no deadline to set');
  ok(/learning bank/.test(await p.getByTestId('hw-assign-submit').innerText()), 'the button says it goes to the learning bank');
  await p.getByTestId('hw-assign-submit').click({ noWaitAfter: true }); await p.waitForTimeout(1500);
  ok((await p.getByTestId('teach-learning-bank').getByTestId('file-card').count()) === 2, 'the bank now holds two items');

  // Straight into the bank from the student's page: a Word file and a JPEG whose type the device does not give.
  await p.getByTestId('bank-add-input').setInputFiles(OUT + '/Tabla de pronombres.docx'); await p.waitForTimeout(1500);
  await p.getByTestId('bank-add-input').setInputFiles({ name: 'Foto de la pizarra.JPG', mimeType: '', buffer: Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=', 'base64') }); await p.waitForTimeout(1500);
  ok((await p.getByTestId('teach-learning-bank').getByTestId('file-card').count()) === 4, 'a Word file and a JPEG go straight into the bank from Sam’s page');
  await p.screenshot({ path: OUT + '/own-3b-teacher-bank.png', fullPage: true });

  // Sam: reads the learning, sees the questions, answers.
  await asActor(p, 'sam');
  await p.setViewportSize({ width: 820, height: 1100 });
  await p.goto(BASE + '#/student/homework'); await p.waitForTimeout(1500);
  const card = p.locator('article', { hasText: 'Ejercicios' }).first();
  ok(await card.isVisible(), 'Sam sees the homework');
  ok(/1 explanation to read and 1 file of questions/.test(await card.innerText()), 'the card says what is inside');
  await card.locator('[data-testid^="hw-start-"]').click(); await p.waitForTimeout(2500);
  ok(await p.getByTestId('hw-learning-files').isVisible() && await p.getByTestId('hw-question-files').isVisible(), 'the learning comes first, then the questions');
  ok((await p.getByTestId('hw-learning-files').getByTestId('file-page').count()) >= 1, 'the explanation PDF is drawn in the page');
  await p.getByTestId('hw-question-files').getByTestId('file-open').click(); await p.waitForTimeout(2000);
  ok((await p.getByTestId('hw-question-files').getByTestId('file-page').count()) >= 1, 'the questions PDF opens in the page');
  await p.screenshot({ path: OUT + '/own-4-student.png', fullPage: true });
  await p.getByTestId('hw-text').fill('1. Yo soy de Londres. 2. ¿Tú eres de Madrid?');
  await p.getByTestId('hw-submit').click(); await p.waitForTimeout(1500);
  ok(await p.getByTestId('hw-submitted').isVisible(), 'Sam hands in his answers');

  // The learning bank: always there.
  await p.goto(BASE + '#/student/learning'); await p.waitForTimeout(1500);
  ok((await p.getByTestId('student-learning').getByTestId('file-card').count()) === 4, 'Sam’s learning bank holds all four');
  await p.getByTestId('file-card').filter({ hasText: 'Los pronombres' }).getByTestId('file-open').click(); await p.waitForTimeout(2000);
  ok((await p.getByTestId('file-page').count()) >= 1, 'an explanation opens from the bank');
  await p.getByTestId('file-card').filter({ hasText: 'Ser y estar' }).getByTestId('file-open').click(); await p.waitForTimeout(800);
  ok(await p.getByTestId('file-image').isVisible(), 'a photo opens too');
  await p.getByTestId('file-card').filter({ hasText: 'Tabla de pronombres' }).getByTestId('file-open').click(); await p.waitForTimeout(2500);
  ok(/nosotros/.test(await p.getByTestId('file-word').innerText()) && (await p.getByTestId('file-word').locator('table').count()) === 1, 'a Word file is shown in the page with its table');
  ok((await p.getByTestId('file-card').filter({ hasText: 'Foto de la pizarra' }).innerText()).includes('Photo'), 'the JPEG with no type is taken as a photo');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByTestId('file-card').filter({ hasText: 'Tabla de pronombres' }).getByTestId('file-download').first().click()]);
  ok(dl.suggestedFilename() === 'Tabla de pronombres.docx', 'Download saves the file under its own name: ' + dl.suggestedFilename());
  await p.screenshot({ path: OUT + '/own-5-bank.png', fullPage: true });

  // Dina deletes the homework: the explanation stays in the bank. She can mark the answers first.
  await asActor(p, 'dina');
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.goto(BASE + '#/teach/homework'); await p.waitForTimeout(1500);
  ok(await p.getByText('Ejercicios').count() > 0, 'the handed-in homework reaches Dina');

  // A phone and an iPad: the sheet fits the visible window.
  for (const [name, w, h] of [['phone', 390, 700], ['ipad', 1024, 700]]) {
    await p.setViewportSize({ width: w, height: h });
    await p.goto(BASE + '#/teach/homework'); await p.waitForTimeout(500);
    await p.goto(BASE + '#/teach/student/demo-sam'); await p.waitForTimeout(1200);
    await p.getByRole('button', { name: 'Assign homework' }).first().click(); await p.waitForTimeout(700);
    await p.getByTestId('hw-mode-list').click(); await p.waitForTimeout(400);
    const d = p.getByRole('dialog'); const r = await d.boundingBox();
    ok(r.y >= 0 && r.y + r.height <= h, `${name}: the sheet is inside the window (${Math.round(r.y)} to ${Math.round(r.y + r.height)} of ${h})`);
    await d.evaluate((el) => el.scrollTo(0, el.scrollHeight)); await p.waitForTimeout(300);
    const btn = await p.getByTestId('hw-assign-submit').boundingBox();
    ok(btn && btn.y + btn.height <= h - 30, `${name}: the Assign button scrolls clear of the bottom (ends at ${btn && Math.round(btn.y + btn.height)})`);
    await p.screenshot({ path: `${OUT}/own-6-${name}.png` });
  }
  ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
})();
