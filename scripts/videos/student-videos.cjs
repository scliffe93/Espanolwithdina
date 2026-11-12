// Records the short how-to videos for students (phone-sized, captioned, about 30 seconds each).
// Needs: the normal build served on :4173 (npx vite preview --port 4173 --strictPort) for videos 2 to 6, which use the demo
// workspace with its demo labels hidden. Video 1 (logging in) needs real accounts: an API on :8787
// (ALLOWED_ORIGINS=http://localhost:4174 npx tsx server/dev-server.ts 8787 memory) and a build made with
// VITE_LWD_API_URL=http://localhost:8787/account served on :4174. Needs ffmpeg. Output: scripts/videos/out/*.mp4.
// Usage: node scripts/videos/student-videos.cjs [1 2 3 ...]
const { make } = require('./lib.cjs');
const only = process.argv.slice(2);
const want = (n) => !only.length || only.some((o) => n.startsWith(o));
const nav = (h, name) => h.p.getByTestId('student-nav').getByText(name, { exact: true });
const tab = (h, name) => h.p.locator('nav').last().getByText(name, { exact: true });
(async () => {
  if (want('1')) await make('1-getting-started', { title: 'Getting started', sub: 'Log in and put Dina on your iPhone’s Home Screen.', base: 'http://localhost:4174/',
    context: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' }, init: () => { window.__vgNoHide = true; delete window.PushManager; } }, async (h) => {
    const user = 'sam' + Date.now().toString(36).slice(-4);
    const r = await fetch('http://localhost:8787/account/register', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4174' }, body: JSON.stringify({ username: user, password: 'tortilla de patatas 2026', firstName: 'Sam', remember: true }) });
    if (!r.ok) throw new Error('could not create the account: ' + r.status);
    await h.go('#/account'); h.startHere();
    await h.title();
    await h.step('Open the link Dina sent you, in <u>Safari</u>.', 2400);
    await h.step('Tap <u>Log in</u>.', 800);
    await h.tap(h.p.getByRole('radio', { name: 'Log in' }), 900);
    await h.step('Type the <u>username</u> and <u>password</u> Dina gave you.', 600);
    await h.p.getByLabel('Username').pressSequentially(user, { delay: 80 });
    await h.p.getByLabel('Password', { exact: true }).pressSequentially('tortilla de patatas 2026', { delay: 28 }); await h.wait(700);
    await h.step('Tap <u>Log in</u>.', 600);
    await h.tap(h.p.getByRole('button', { name: /^Log in/ }).last(), 2600);
    await h.step('Tap <u>Continue learning</u>.', 700);
    await h.tap('welcome-continue', 900);
    await h.clear(); await h.go('#/student', 1600);
    await h.note('You are in. This is your home page.', 2400);
    await h.step('To use it like an app, tap <u>Share</u> in Safari, then <u>Add to Home Screen</u>.', 800);
    await h.show('push-install', 5200);
    await h.step('Open <u>Dina</u> from your Home Screen and tap <u>Turn on notifications</u>.', 3800);
    await h.end('You’re all set. ¡Bienvenido!');
  });

  if (want('2')) await make('2-your-lessons', { title: 'Your lessons', sub: 'See when your next lesson is and what to prepare.' }, async (h) => {
    await h.asSam(); await h.go('#/student'); h.startHere();
    await h.title();
    await h.step('Tap <u>Clases</u> at the bottom to open your lessons page.', 2200);
    await h.step('Your <u>next lesson</u> is at the top: day, time and the link to join.', 1200);
    await h.show(h.p.getByText('My next lesson').first(), 2600);
    await h.step('Tap <u>Lessons</u> to see all of them.', 900);
    await h.tap(nav(h, 'Lessons'), 1400);
    await h.step('Each one shows the topic and what to <u>prepare</u>.', 1000);
    await h.scroll(330, 2600);
    await h.step('Tap <u>Add to calendar</u> to save it to your phone.', 800);
    await h.show(h.p.getByText(/Add to calendar/).first(), 2600);
    await h.end('See you in class. ¡Hasta pronto!');
  });

  if (want('3')) await make('3-your-homework', { title: 'Your homework', sub: 'Find it, do it, and read Dina’s feedback.' }, async (h) => {
    await h.asSam(); await h.go('#/student'); h.startHere();
    await h.title();
    await h.step('Tap <u>Homework</u>.', 900);
    await h.tap(nav(h, 'Homework'), 1500);
    await h.step('<u>To do</u> is first, with the deadline and Dina’s note.', 800);
    await h.show('hw-card-demo-h2', 2800);
    await h.step('Tap <u>Start</u> to open it. It is marked done when you finish.', 800);
    await h.show('hw-start-demo-h2', 2600);
    await h.step('<u>Submitted</u> means Dina has it and will reply.', 800);
    await h.show('hw-card-demo-h1', 2800);
    await h.step('<u>Reviewed</u> shows your work with Dina’s feedback.', 800);
    await h.show('hw-card-demo-h3', 1500); await h.p.evaluate(() => window.scrollBy({ top: 260, behavior: 'instant' })); await h.wait(3000);
    await h.end('Little and often works best. ¡Ánimo!');
  });

  if (want('4')) await make('4-practise-on-your-own', { title: 'Practise on your own', sub: 'Verbs, words and games, a few minutes a day.' }, async (h) => {
    await h.asSam(); await h.go('#/student'); h.startHere();
    await h.title();
    await h.step('Tap <u>Verbos</u> for the verb gym.', 900);
    await h.tap(tab(h, 'Verbos'), 1500);
    await h.step('Choose a <u>tense</u>.', 900);
    await h.tap('tense-preterite', 1200);
    await h.step('Tap <u>Start</u>. Each session is about ten short exercises.', 900);
    await h.tap(h.p.getByRole('button', { name: /Start \d+-exercise session/ }), 2600);
    await h.note('Answer each one. Mistakes come back later until they stick.', 3000);
    await h.clear(); await h.go('#/review', 1200);
    await h.step('<u>Memoria</u> brings back words just before you forget them.', 2600);
    await h.step('Scroll to <u>Word packs</u> and tap <u>Learn now</u> to add ten new words.', 800);
    await h.show('word-packs', 1800); await h.p.evaluate(() => window.scrollBy({ top: 150, behavior: 'instant' })); await h.wait(2400);
    await h.clear(); await h.go('#/arcade', 1200);
    await h.step('<u>Juegos</u> has quick games that use your own verbs and words.', 1000);
    await h.show(h.p.getByText('Play & learn').first(), 2800);
    await h.end('Five minutes a day beats an hour on Sunday.');
  });

  if (want('5')) await make('5-feedback-and-progress', { title: 'Feedback and progress', sub: 'What Dina said, and how far you have come.' }, async (h) => {
    await h.asSam(); await h.go('#/student'); h.startHere();
    await h.title();
    await h.step('Tap <u>Feedback</u>.', 900);
    await h.tap(nav(h, 'Feedback'), 1500);
    await h.step('Dina’s <u>comments</u> from your lessons are here.', 2600);
    await h.step('<u>Corrections</u> are the slips to watch out for.', 700);
    await h.show(h.p.getByText('Slips to watch out for').first(), 2600);
    await h.step('<u>Recommendations</u> tell you what to practise next.', 700);
    await h.show(h.p.getByText('What to practise next').first(), 2600);
    await h.step('Now tap <u>Mi camino</u> to see your progress.', 900);
    await h.tap(tab(h, 'Mi camino'), 1800);
    await h.note('Your level, your study time and what you have learned so far.', 1500);
    await h.scroll(520, 2600);
    await h.step('<u>Trends</u> show your minutes, accuracy and words over eight weeks.', 600);
    await h.show('journey-trends', 3000);
    await h.end('Every bit of practice counts. ¡Vas muy bien!');
  });

  if (want('6')) await make('6-invoices', { title: 'Invoices', sub: 'See what is due and tell Dina when you have paid.' }, async (h) => {
    // Setup (not recorded): Dina bills Sam for a lesson.
    await h.asDina(); await h.go('#/teach/invoices');
    await h.p.getByTestId('invoice-settings').click(); await h.wait(500);
    await h.p.locator('#cf-pay').fill('Bank transfer to Dina García\nSort code 00-00-00 · Account 12345678\nReference: your invoice number');
    await h.p.getByTestId('save-settings').click(); await h.wait(1200);
    await h.p.getByTestId('new-invoice').click(); await h.wait(600);
    await h.p.locator('#in-student').selectOption('demo-sam'); await h.wait(400);
    await h.p.locator('[data-testid="unbilled-lessons"] input[type=checkbox]').first().check();
    await h.p.getByTestId('save-send').click(); await h.wait(1500);
    await h.asSam(); await h.go('#/student'); h.startHere();
    await h.title();
    await h.step('Tap <u>Invoices</u>. You may need to swipe the tabs across.', 900);
    await h.tap(nav(h, 'Invoices'), 1600);
    await h.step('What you owe is at the top. Tap an invoice to open it.', 1600);
    await h.tap(h.p.getByText(/^LWD-\d{4}-\d{4}/).first(), 1600);
    await h.note('It shows the lessons, the total and <u>how to pay</u>.', 3200);
    await h.p.getByRole('button', { name: 'Close' }).first().click().catch(() => h.p.keyboard.press('Escape')); await h.wait(900);
    await h.step('When you have paid, tap <u>I’ve paid this</u>.', 900);
    await h.tap(h.p.locator('[data-testid^="report-paid-"]'), 1200);
    await h.step('Choose how you paid, add a note if you like, then tap <u>Tell Dina</u>.', 600);
    await h.p.getByTestId('report-method').selectOption('Bank transfer'); await h.p.getByTestId('report-note').pressSequentially('Sent this morning', { delay: 55 }); await h.wait(900);
    await h.tap('report-send', 1600);
    await h.note('Dina gets a notification. It shows as paid once she confirms it.', 3600);
    await h.end('All done. ¡Gracias!');
  });
})();
