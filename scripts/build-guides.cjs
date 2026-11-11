// Builds the branded how-to guides (Teacher, Student) as A4 PDFs from HTML, using the app's fonts,
// colours, logo and Dina illustration, plus screenshots captured by scripts/capture-guide-shots.cjs.
// Usage: node scripts/build-guides.cjs <shotsDir> <outDir>
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const esbuild = require('esbuild');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));

const SHOTS = path.resolve(process.argv[2] || 'guide-shots');
const OUT = path.resolve(process.argv[3] || 'public/guides');
fs.mkdirSync(OUT, { recursive: true });
const tmp = path.join(OUT, '.dina-ssr.cjs');

// Dina as static SVG markup (same component as the app).
esbuild.buildSync({
  stdin: { contents: `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server'; import { DinaArt } from './src/components/Dina'; export const dina = (size, expression) => renderToStaticMarkup(React.createElement(DinaArt, { expression, animate: false, size }));`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', outfile: tmp, logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' },
});
const { dina } = require(tmp);
fs.unlinkSync(tmp);

const font = (f) => 'file://' + path.resolve('node_modules/@fontsource-variable', f);
const shot = (name) => { const p = path.join(SHOTS, name + '.png'); return fs.existsSync(p) ? 'file://' + p : null; };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const C = { cream: '#FBF6EE', cream100: '#F6EEE1', warm: '#F4E7D3', ink: '#1E1B18', soft: '#4A433C', mute: '#71675E', terra: '#C2593A', terraDark: '#963F26', terra50: '#FBEDE6', saffron: '#E3A33B', saffron50: '#FDF4E2', olive: '#5E7149', olive50: '#EEF2E8', azul: '#1F3A5F', azul50: '#E7EEF6' };

const css = `
@font-face { font-family: 'Fraunces'; src: url('${font('fraunces/files/fraunces-latin-opsz-normal.woff2')}') format('woff2'); font-weight: 100 900; font-style: normal; }
@font-face { font-family: 'Fraunces'; src: url('${font('fraunces/files/fraunces-latin-opsz-italic.woff2')}') format('woff2'); font-weight: 100 900; font-style: italic; }
@font-face { font-family: 'Inter'; src: url('${font('inter/files/inter-latin-wght-normal.woff2')}') format('woff2'); font-weight: 100 900; font-style: normal; }
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; background: ${C.cream}; color: ${C.ink}; font-family: 'Inter', system-ui, sans-serif; font-size: 10.5pt; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 210mm; min-height: 297mm; padding: 18mm 18mm 20mm; page-break-after: always; position: relative; background: ${C.cream}; }
.page:last-child { page-break-after: auto; }
.cover { background: ${C.warm}; display: flex; flex-direction: column; justify-content: space-between; padding: 22mm 20mm; }
.cover .top { display: flex; justify-content: space-between; align-items: flex-start; }
.logo-wrap { position: relative; width: 150mm; }
.logo-card { position: relative; margin-top: 46mm; background: #fff; border-radius: 16px; padding: 7mm 8mm; box-shadow: 0 10px 30px -14px rgba(30,27,24,.35); width: 92mm; }
.logo-card .lw { font-family: 'Fraunces'; font-style: italic; color: ${C.olive}; font-size: 13pt; line-height: 1; }
.logo-card .name { font-family: 'Fraunces'; font-weight: 600; color: ${C.terra}; font-size: 36pt; letter-spacing: -.02em; line-height: .95; }
.logo-card .name b { color: ${C.saffron}; font-weight: 600; }
.logo-card .rule { height: 2px; width: 22mm; background: ${C.saffron}; margin: 4mm 0 3mm; }
.logo-card .tag-es { font-family: 'Fraunces'; font-style: italic; font-size: 10.5pt; color: ${C.soft}; }
.logo-card .tag-en { font-size: 8pt; letter-spacing: .14em; text-transform: uppercase; color: ${C.olive}; margin-top: 1mm; }
.dina-peek { position: absolute; left: 46mm; top: 0; width: 46mm; }
.dina-peek svg { width: 46mm; height: auto; display: block; }
.cover h1 { font-family: 'Fraunces'; font-weight: 600; font-size: 40pt; line-height: 1.02; letter-spacing: -.015em; margin: 14mm 0 4mm; color: ${C.ink}; }
.cover h1 em { font-style: italic; font-weight: 400; color: ${C.terra}; }
.cover .lead { font-size: 13pt; color: ${C.soft}; max-width: 130mm; }
.cover .meta { display: flex; gap: 10mm; font-size: 9pt; color: ${C.mute}; border-top: 1px solid rgba(30,27,24,.12); padding-top: 5mm; }
.cover .meta b { color: ${C.ink}; display: block; font-weight: 600; }
.eyebrow { font-size: 8pt; letter-spacing: .16em; text-transform: uppercase; color: ${C.olive}; font-weight: 700; margin: 0 0 2mm; }
h2 { font-family: 'Fraunces'; font-weight: 600; font-size: 22pt; line-height: 1.1; margin: 0 0 4mm; letter-spacing: -.01em; }
h2 .n { display: inline-grid; place-items: center; width: 9mm; height: 9mm; border-radius: 50%; background: ${C.terra}; color: #fff; font-size: 11pt; margin-right: 3mm; vertical-align: 4px; font-family: 'Inter'; font-weight: 700; }
h3 { font-family: 'Fraunces'; font-weight: 600; font-size: 13.5pt; margin: 6mm 0 2mm; }
p { margin: 0 0 3mm; color: ${C.soft}; }
ol.steps { margin: 0 0 4mm; padding: 0; list-style: none; counter-reset: s; }
ol.steps li { position: relative; padding-left: 9mm; margin-bottom: 2.6mm; color: ${C.ink}; }
ol.steps li::before { counter-increment: s; content: counter(s); position: absolute; left: 0; top: .1em; width: 6mm; height: 6mm; border-radius: 50%; background: ${C.saffron50}; color: ${C.terraDark}; font-size: 8.5pt; font-weight: 700; display: grid; place-items: center; border: 1px solid ${C.saffron}; }
ul.ticks { margin: 0 0 4mm; padding: 0; list-style: none; }
ul.ticks li { position: relative; padding-left: 7mm; margin-bottom: 2mm; color: ${C.ink}; }
ul.ticks li::before { content: ''; position: absolute; left: 0; top: .32em; width: 4mm; height: 4mm; border-radius: 50%; background: ${C.olive}; -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='none' stroke='black' stroke-width='4' stroke-linecap='round' stroke-linejoin='round' d='M4 12l5 5L20 6'/></svg>") center/contain no-repeat; mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='none' stroke='black' stroke-width='4' stroke-linecap='round' stroke-linejoin='round' d='M4 12l5 5L20 6'/></svg>") center/contain no-repeat; }
.tip { background: ${C.saffron50}; border: 1px solid rgba(227,163,59,.45); border-radius: 12px; padding: 4mm 5mm; margin: 4mm 0; font-size: 9.5pt; color: ${C.ink}; }
.tip b { color: ${C.terraDark}; }
.note { background: ${C.olive50}; border-radius: 12px; padding: 4mm 5mm; margin: 4mm 0; font-size: 9.5pt; }
.shot { border-radius: 14px; overflow: hidden; background: #fff; border: 1px solid rgba(30,27,24,.1); box-shadow: 0 10px 24px -16px rgba(30,27,24,.45); margin: 4mm 0 2mm; }
.shot img { display: block; width: 100%; height: auto; }
.shot.h { height: 88mm; } .shot.h img { height: 100%; object-fit: cover; object-position: top; }
.shot.h2 { height: 110mm; } .shot.h2 img { height: 100%; object-fit: cover; object-position: top; }
.shot.h3 { height: 70mm; } .shot.h3 img { height: 100%; object-fit: cover; object-position: top; }
.cap { font-size: 8.5pt; color: ${C.mute}; margin: 0 0 4mm; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; align-items: start; }
.phone { width: 54mm; border-radius: 18px; border: 1px solid rgba(30,27,24,.12); overflow: hidden; box-shadow: 0 10px 24px -16px rgba(30,27,24,.45); margin: 0 auto; }
.phone img { display: block; width: 100%; height: auto; }
.cards { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin: 3mm 0; }
.card { background: #fff; border-radius: 12px; padding: 4mm; border: 1px solid rgba(30,27,24,.08); }
.card h4 { font-family: 'Fraunces'; font-weight: 600; font-size: 12pt; margin: 0 0 1.5mm; }
.card p { font-size: 9.5pt; margin: 0; }
.kv { display: grid; grid-template-columns: 38mm 1fr; gap: 1.5mm 4mm; font-size: 9.5pt; margin: 2mm 0 4mm; }
.kv dt { color: ${C.mute}; } .kv dd { margin: 0; color: ${C.ink}; font-weight: 600; }
.toc { columns: 2; column-gap: 10mm; font-size: 10pt; }
.toc div { break-inside: avoid; padding: 1.4mm 0; border-bottom: 1px dotted rgba(30,27,24,.18); display: flex; justify-content: space-between; gap: 4mm; }
.toc div span:last-child { color: ${C.mute}; font-variant-numeric: tabular-nums; }
.pill { display: inline-block; background: ${C.terra50}; color: ${C.terraDark}; border-radius: 999px; padding: .5mm 3mm; font-size: 8.5pt; font-weight: 700; }
`;

function page(inner, cls = '') { return `<section class="page ${cls}">${inner}</section>`; }
function figure(name, cls = '', cap = '') { const src = shot(name); return src ? `<div class="shot ${cls}"><img src="${src}" alt=""></div>${cap ? `<p class="cap">${cap}</p>` : ''}` : ''; }
function cover({ title, titleEm, lead, who, date }) {
  return page(`
    <div class="top"><div class="logo-wrap"><div class="logo-card"><div class="lw">Learning with</div><div class="name">Dina<b>.</b></div><div class="rule"></div><div class="tag-es">Tu vida en español empieza aquí</div><div class="tag-en">Your Spanish life starts here</div></div><div class="dina-peek">${dina(174, 'beam')}</div></div></div>
    <div><p class="eyebrow">Cómo se usa · How to use</p><h1>${title} <em>${titleEm}</em></h1><p class="lead">${lead}</p></div>
    <div class="meta"><div><b>For</b>${who}</div><div><b>App</b>scliffe93.github.io/Espanolwithdina</div><div><b>Version</b>${date}</div></div>`, 'cover');
}
function toc(items) { return page(`<p class="eyebrow">Contents</p><h2>What’s inside</h2><div class="toc">${items.map((t, i) => `<div><span>${i + 1}. ${t}</span><span>${i + 3}</span></div>`).join('')}</div>`); }

const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

// ───────────────────────────── Teacher guide ─────────────────────────────
const teacherSections = [
  ['Logging in', `
    <p>Everything you do as the teacher happens in the same app your students use. Your account is the one with the username <b>dina</b>; it unlocks the teacher dashboards on any device you log in on.</p>
    <ol class="steps"><li>Open <b>scliffe93.github.io/Espanolwithdina</b>. The front page is <i>Lessons with Dina</i>.</li><li>Tap <b>Log in</b>, enter your username and password, and keep <i>Remember me</i> ticked on your own devices.</li><li>You land on <b>Today</b>. The menu has Today, Calendar, Students, Homework, Account and How to use.</li></ol>
    ${figure('home-fresh', 'h3', 'The front page. Returning people appear under “Who is this?” for a one-tap return.')}
    <div class="tip"><b>Keep your recovery code safe.</b> There is no email reset. If you forget your password, the recovery code is the only way back in. You can also be reset by the administrator.</div>`],
  ['Today: your day at a glance', `
    <p><b>Today</b> shows your lessons for the day, homework waiting for your review, students who need support, and recent activity across everyone.</p>
    ${figure('t-today', 'h2', 'Today, with upcoming lessons, homework to review and student flags.')}
    <ul class="ticks"><li><b>Needs support</b> flags appear when a student hasn’t studied for five days, their accuracy drops below 60%, or they struggle to remember what they learned.</li><li>Tap any student to open their profile; tap a homework item to review it straight away.</li></ul>`],
  ['Adding students', `
    <p>You are the one teacher, so every account is automatically your student. Add them yourself or let them register.</p>
    <ol class="steps"><li>Go to <b>Students</b> and tap <b>Add a student</b>.</li><li>Enter their first name and a username. Leave the password empty to generate a simple temporary one.</li><li>The login details and recovery code are shown <b>once</b>. Copy them and pass them on privately. The student can change the password later in their settings.</li></ol>
    ${figure('real-teacher-students', 'h', 'The Students page with “Add a student” and each learner’s week at a glance.')}
    <div class="note">Students who create their own account on the front page appear in your list automatically. There is nothing to link.</div>`],
  ['A student’s profile', `
    <p>Open any student to see their <b>Journey</b> (levels, verbs, vocabulary, storylines), <b>Analytics</b>, <b>Lessons</b>, <b>Homework</b>, <b>Feedback</b> and <b>Activity</b>. The buttons at the top are your main actions.</p>
    ${figure('t-profile', 'h2', 'The profile header with Lesson debrief &amp; week plan, Book a lesson and Assign homework.')}
    <ul class="ticks"><li><b>Lesson debrief &amp; week plan</b>: the main way to set the week’s work (next pages).</li><li><b>Book a lesson</b>: date, time, duration, online or face to face. Clashes with other lessons are refused. Students see the time in their own time zone.</li><li><b>Assign homework</b>: a single task when you need one outside the plan.</li></ul>`],
  ['After each lesson: the debrief', `
    <p>Spend two minutes after every lesson. The debrief is both the note your student reads and the brief the app uses to build their week.</p>
    <ol class="steps"><li>Open the student and tap <b>Lesson debrief &amp; week plan</b>.</li><li>Tick the <b>tenses</b> and type the <b>verbs</b> you covered (the app suggests infinitives as you type), the <b>themes</b> you talked about and, if you used one, the <b>storyline chapter</b>.</li><li>Write a short <b>note for the student</b>: what went well, what you did.</li><li>Tick <b>what to fix this week</b>: verb endings, accents, stem changes, irregular verbs, ser vs estar, vocabulary, listening, speaking, pronunciation, spelling, confidence.</li><li>Add up to three <b>goals</b> and the <b>minutes a day</b> to aim for, then tap <b>Generate the week’s plan</b>.</li></ol>
    ${figure('t-debrief-form', 'h2', 'The debrief form: what you covered, your note, what to fix, goals and minutes a day. Above it (scrolled off here) sits last week’s plan: done, on time, average score, recurring slips.')}`],
  ['The generated week plan', `
    <p>The plan is built from your notes <i>and</i> the student’s own data: the verbs they actually get wrong, their next storyline chapter, their interests (football fans get the football games). Every task is a real activity in the app.</p>
    ${figure('t-debrief-plan', 'h2', 'Review the plan: move a task to another day or remove it, then send notes and tasks together.')}
    <ul class="ticks"><li>Tasks are spread Monday to Sunday and due at 8 pm, never earlier than tomorrow evening.</li><li>The student sees your note, the goals and the day-by-day tasks on their home page, with reminders in the app as each is due.</li><li>Your next debrief opens with the evidence: done, on time, average score, recurring slips.</li></ul>
    <div class="tip"><b>The app adapts on its own during the week.</b> Under 60% on a task adds a shorter re-try two days later. 90% or more on a verb drill adds a stretch task in the next tense. Spaced repetition keeps bringing back whatever the student forgets.</div>`],
  ['Reviewing homework', `
    <p>Everything students submit appears under <b>Homework</b>, grouped by status. Games and drills score themselves; written and speaking homework show you the text or the recording.</p>
    ${figure('t-homework', 'h2', 'The Homework page: awaiting review, assigned, reviewed.')}
    <ol class="steps"><li>Open a submitted item. You see the score, attempts and a short summary, plus the written answer or the player for a recording.</li><li>Go through the answers one by one (accept one the app rejected, or leave a note on it), give a mark or a grade, and for written or spoken work add corrections: quote the student’s words, say what they should be and tag the type of slip. Then write your feedback and tap <b>Save marking</b>. The student sees the mark, the corrections over their own words and your notes on their home page and Feedback page, and the tagged slips pre-fill <i>what to fix</i> in your next debrief.</li><li>Outside homework, use the <b>Feedback</b> tab on a profile for comments, corrections and recommendations.</li></ol>`],
  ['Analytics and reports', `
    <p>The <b>Analytics</b> tab on each profile is computed from the student’s recorded activity: nothing is estimated.</p>
    ${figure('t-analytics', 'h2', 'Consistency heatmap, eight-week trends, accuracy by exercise type, mistakes with real examples, tenses, vocabulary deck, homework and the generated focus for your next lesson.')}
    <ul class="ticks"><li><b>Download PDF report</b> on the Analytics tab gives you a printable report for one student.</li><li><b>Class summary (CSV)</b> on the Students page opens in Excel or Numbers: one row per student.</li></ul>`],
  ['Calendar and lessons', `
    <p>The <b>Calendar</b> shows the week or the month. Book, move or cancel lessons here or from a student’s profile.</p>
    ${figure('t-calendar', 'h2', 'Week view. Lessons show in your time zone; students see them in theirs.')}
    <ul class="ticks"><li>Online lessons can carry a meeting link; face-to-face lessons an address. Both appear on the student’s next-lesson card.</li><li>Reminders 24 hours and 1 hour before appear inside the app while it is open.</li></ul>`],
  ['Invoices', `
    <p>Bill the lessons you have taught without leaving the app. Students see their invoices in their own app, with how to pay, and can download the PDF.</p>
    <ol class="steps"><li>Once: <b>Invoices → Rates &amp; payment details</b>. Your business name, currency, rate for a 60-minute lesson (other lengths are priced in proportion), days until due, invoice prefix, and <b>how students pay</b> (bank details or a payment link). This prints on every invoice.</li><li><b>New invoice</b>: choose the student. The lessons you have taught and not yet billed are listed; tick the ones to include. Add any other line (a workbook, a lesson pack, a discount as a negative price).</li><li><b>Save and send to student</b>: it appears in their app at once. Use <b>Email</b> to send the summary by email too, or <b>PDF</b> to download it.</li><li>When the money arrives, <b>Mark paid</b> with the date and method. Overdue invoices are flagged on your Today page and on the student’s home page.</li></ol>
    ${figure('t-invoice-new', 'h2', 'A new invoice: tick the taught lessons, add a line, see the total before sending.')}
    ${figure('t-invoices', 'h3', 'The Invoices page: outstanding, overdue, paid this month, and every invoice with its actions.')}
    <div class="note">Invoice numbers run LWD-2026-0001, 0002… and are never reused. A sent invoice can be voided, never deleted; drafts can be deleted.</div>
    <h3>Lesson packages</h3>
    <p>Sell lessons in blocks and let the app count them. In <b>Rates &amp; payment details → Lesson packages</b> define each package: name, number of lessons, minutes per lesson, price, and how many months it stays valid.</p>
    <ol class="steps"><li><b>Sell a package</b> (Invoices page, or the Lessons tab of a student’s profile): choose the student and the package, the purchase date, and tick “already paid” if the money is in. The invoice is created for you.</li><li>From the purchase date, every lesson you teach that student uses one credit. Lessons you bill one by one are never counted.</li><li>The balance (“3 of 10 left · 2 booked”) shows on the Students page, on the profile and on the student’s own home page. When it is down to one lesson, Today flags it so you can offer the next package.</li></ol>
    ${figure('t-balance', 'h3', 'A student’s balance on the Lessons tab, with the packages bought and lessons used.')}`],
  ['Housekeeping and tips', `
    <div class="cards">
      <div class="card"><h4>Change your password</h4><p>Account → change password. Also where you log out or switch to another account on a shared device.</p></div>
      <div class="card"><h4>Reset a student’s password</h4><p>Ask the administrator (Admin → Accounts → Reset password). A new temporary password and recovery code are shown once.</p></div>
      <div class="card"><h4>Phone or tablet</h4><p>Open the site in the browser and add it to the home screen. It installs like an app and works offline for learning content.</p></div>
      <div class="card"><h4>How to use, in the app</h4><p>The menu has this guide and the student guide at any time.</p></div>
    </div>
    <h3>A good weekly rhythm</h3>
    <ol class="steps"><li>Before a lesson: open the profile, glance at Analytics and last week’s plan.</li><li>After the lesson: debrief, generate, adjust, send. Two minutes.</li><li>Midweek: Today shows who is behind; a quick comment helps.</li><li>Before the next lesson: review submitted homework so the feedback lands while it is fresh.</li></ol>`],
];

// ───────────────────────────── Student guide ─────────────────────────────
const studentSections = [
  ['Logging in', `
    <p>Dina gives you a username and a password (or you create an account yourself on the front page). Your progress saves automatically and follows you to any phone, tablet or computer.</p>
    <ol class="steps"><li>Open <b>scliffe93.github.io/Espanolwithdina</b>.</li><li>Tap <b>Log in</b>, or your name if you have used that device before, and enter your password.</li><li>The first time, the app shows you a <b>recovery code</b>. Save it somewhere safe: it is the only way to reset your password.</li></ol>
    ${figure('home-fresh', 'h3', 'The front page.')}
    <div class="tip"><b>Change the temporary password</b> Dina gave you: Settings → Account → change password.</div>`],
  ['Your home: My lessons', `
    <div class="two"><div>
      <p><b>My lessons</b> is your home page. It shows your next lesson with Dina (in your time zone, with the meeting link or address), <b>This week with Dina</b>, your homework and her latest feedback.</p>
      <p><b>This week with Dina</b> is the note she wrote after your lesson, your goals for the week, and the tasks day by day. Tap <b>Start</b> on a task and the app opens the real activity: a verb drill, a game, a chapter, a recording.</p>
      <ul class="ticks"><li>Green = done. Red = overdue. Reminders appear in the app as tasks come due.</li><li>Some tasks are added by the app itself: a shorter re-try when something went badly, a stretch task when it went very well.</li></ul>
    </div><div class="phone">${shot('s-home-phone') ? `<img src="${shot('s-home-phone')}" alt="">` : ''}</div></div>
    ${figure('s-home', 'h3', 'On a laptop: next lesson, this week with Dina, homework and feedback side by side.')}`],
  ['Doing your homework', `
    <p>The <b>Homework</b> page lists everything Dina has set, with the deadline and what each task involves.</p>
    ${figure('s-homework', 'h2', 'Homework: due soon, assigned, submitted and reviewed.')}
    <ul class="ticks"><li><b>Verb drills and games</b> score themselves; you see the result straight away and Dina sees it too.</li><li><b>Written homework</b> opens an editor with a word count. <b>Speaking homework</b> opens the recorder; listen back, re-record if you like, then submit. Recordings stay on your device unless you share them.</li><li>Dina’s feedback on a task appears under the task and on your Feedback page.</li></ul>`],
  ['Learning on your own', `
    <p>Between lessons the whole app is yours. Ten minutes a day beats an hour once a week.</p>
    <div class="cards">
      <div class="card"><h4>My city</h4><p>Live your city in Spanish, chapter by chapter. Speak your replies out loud.</p></div>
      <div class="card"><h4>Verbs</h4><p>Type the forms. Use <i>Help me remember</i> when one will not stick: it joins your memory deck.</p></div>
      <div class="card"><h4>Memory</h4><p>Spaced repetition brings back exactly the words and verbs you are about to forget.</p></div>
      <div class="card"><h4>Arcade</h4><p>Seven games built on your verbs, listening and vocabulary, including the football games for your city.</p></div>
    </div>
    ${figure('s-world', 'h3', 'My city: your storyline, practice and games for the city you chose.')}`],
  ['The arcade and the football games', `
    ${figure('s-arcade', 'h3', 'The arcade.')}
    <div class="two"><div>${figure('game-penalty', '', 'Penalty Shoot-out: verb forms as penalties against the rival club’s keeper.')}</div><div>${figure('game-derbi', '', 'The Derby Quiz: football words the way your region says them, plus your city’s clubs.')}</div></div>
    <p>Line-up plays you a line of match commentary about your city’s clubs; put the words in order. Everything you answer in a game counts as practice and feeds your memory deck.</p>`],
  ['Verbs and memory', `
    <div class="two"><div>${figure('s-verbs', '', 'Verb gym: choose a tense and the verbs to drill.')}</div><div>${figure('s-review', '', 'Memory review: the cards due today.')}</div></div>
    <ul class="ticks"><li>Accents matter: type them. On a phone, hold the letter; on a computer use the keys shown.</li><li>Add a personal association to a card you keep forgetting; the app tracks which memory techniques work for you.</li></ul>`],
  ['How the app adapts to you', `
    <p>You never have to decide what to practise. The app watches what you do and adjusts.</p>
    <dl class="kv"><dt>Under 60% on a task</dt><dd>A shorter re-try appears two days later.</dd><dt>90% or more on a verb drill</dt><dd>A stretch task appears in the next tense.</dd><dt>Memory deck</dt><dd>Words and verbs come back just before you would forget them.</dd><dt>Your mistakes</dt><dd>Drills lean towards the verbs and patterns you get wrong most.</dd><dt>Dina’s debrief</dt><dd>Each week’s plan is built from her notes and your own data.</dd></dl>
    <div class="note">Nothing here uses an outside AI service. It is the app’s own rules over what you actually did, and Dina can see every result.</div>`],
  ['Your journey and feedback', `
    ${figure('s-journey', 'h2', 'My journey: level per skill, study days, trends, your most common slips and what to work on.')}
    ${figure('s-feedback', 'h3', 'Feedback: Dina’s lesson notes, comments, corrections and recommendations.')}`],
  ['Your invoices', `
    <p>Dina’s invoices for your lessons appear under <b>Invoices</b> on your lessons pages. A banner on your home page tells you when something is due.</p>
    ${figure('s-invoices', 'h3', 'My invoices: what is to pay, what is paid.')}
    <ul class="ticks"><li>Open an invoice to see the lessons it covers and <b>how to pay</b> (Dina’s bank details or payment link). Use the invoice number as the payment reference.</li><li><b>Download PDF</b> gives you a copy for your records.</li><li>Once Dina marks it paid, it moves to “paid” and the banner disappears.</li></ul>
    ${figure('s-invoice-detail', 'h3', 'An invoice with its payment details.')}
    <h3>Lesson packages</h3>
    <p>If you buy a block of lessons, your home page shows your <b>lesson balance</b>: how many are used, how many are left, how many are already booked, and until when the package is valid. When you are down to your last lesson, ask Dina for the next package.</p>
    ${figure('s-balance', 'h3', 'Your lesson balance on your home page.')}`],
  ['Settings and your account', `
    ${figure('s-settings', 'h2', 'Settings: voice and speech speed, translations, your city, data and account.')}
    <div class="cards">
      <div class="card"><h4>Voice</h4><p>Pick the Spanish voice you like best; natural voices are marked. Slow the speech down while you are learning.</p></div>
      <div class="card"><h4>Password and recovery</h4><p>Change your password any time. Forgotten it? Use your recovery code on the login page; a new code is issued.</p></div>
      <div class="card"><h4>Install on your phone</h4><p>Open the site in your browser and add it to the home screen. It works offline; progress syncs when you are back online.</p></div>
      <div class="card"><h4>Logging out</h4><p>Settings → Account → Log out. On a shared device, your name stays on the front page for a quick return; tap the × to remove it.</p></div>
    </div>`],
];

function build(kind, sections, meta) {
  const body = [cover(meta), toc(sections.map(([t]) => t)), ...sections.map(([t, inner], i) => page(`<p class="eyebrow">${kind} guide · ${i + 1} of ${sections.length}</p><h2><span class="n">${i + 1}</span>${t}</h2>${inner}`))].join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Learning with Dina — ${kind} guide</title><style>${css}</style></head><body>${body}</body></html>`;
}

(async () => {
  const browser = await chromium.launch();
  const jobs = [
    ['teacher-guide', build('Teacher', teacherSections, { title: 'Teacher', titleEm: 'guide', lead: 'From adding your students to sending the week’s plan after each lesson, and everything the dashboards tell you.', who: 'Dina', date: today })],
    ['student-guide', build('Student', studentSections, { title: 'Student', titleEm: 'guide', lead: 'Logging in, this week with Dina, doing your homework, learning on your own, and how the app adapts to you.', who: 'Dina’s students', date: today })],
  ];
  for (const [name, html] of jobs) {
    const htmlPath = path.join(OUT, `.${name}.html`);
    fs.writeFileSync(htmlPath, html);
    const page = await browser.newPage();
    await page.goto('file://' + htmlPath, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.pdf({ path: path.join(OUT, `${name}.pdf`), format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: `<div style="width:100%;font-family:Inter,system-ui,sans-serif;font-size:7.5pt;color:#71675E;padding:0 18mm;display:flex;justify-content:space-between"><span>Learning with Dina · ${name === 'teacher-guide' ? 'Teacher' : 'Student'} guide</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`, margin: { top: '0', bottom: '12mm', left: '0', right: '0' } });
    await page.close();
    fs.unlinkSync(htmlPath);
    console.log('•', path.join(OUT, `${name}.pdf`), Math.round(fs.statSync(path.join(OUT, `${name}.pdf`)).size / 1024) + ' KB');
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
