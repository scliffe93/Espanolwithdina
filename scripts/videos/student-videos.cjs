// Records the short how-to videos for students (phone-sized, about 30 to 40 seconds each). Dina and Toby guide each one:
// they walk to the thing being explained and say the step in a speech bubble.
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
  if (want('1')) await make('1-getting-started', { title: 'Getting started', sub: 'Dina and Toby show you how to log in and put the app on your iPhone.', base: 'http://localhost:4174/',
    context: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' }, init: () => { window.__vgNoHide = true; delete window.PushManager; } }, async (h) => {
    const user = 'sam' + Date.now().toString(36).slice(-4);
    const r = await fetch('http://localhost:8787/account/register', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4174' }, body: JSON.stringify({ username: user, password: 'tortilla de patatas 2026', firstName: 'Sam', remember: true }) });
    if (!r.ok) throw new Error('could not create the account: ' + r.status);
    await h.go('#/account'); h.startHere();
    await h.title();
    await h.note('¡Hola! I’m Dina and this is Toby. Open the link I sent you in <u>Safari</u>.', 3200);
    const login = h.p.getByRole('radio', { name: 'Log in' });
    await h.step('Tap <u>Log in</u>.', login, 1500);
    await h.tap(login, 800);
    await h.step('Type the <u>username</u> and <u>password</u> I gave you.', h.p.getByLabel('Username'), 1200);
    await h.p.getByLabel('Username').pressSequentially(user, { delay: 80 });
    await h.p.getByLabel('Password', { exact: true }).pressSequentially('tortilla de patatas 2026', { delay: 28 }); await h.wait(600);
    const go = h.p.getByRole('button', { name: /^Log in/ }).last();
    await h.step('Now tap <u>Log in</u>.', go, 1400);
    await h.tap(go, 2400);
    await h.clear(); await h.wait(900);
    await h.p.getByTestId('welcome-continue').click({ timeout: 6000, noWaitAfter: true }).catch(() => {});
    await h.go('#/student', 1600);
    await h.note('You’re in! This is your home page.', 2400);
    await h.step('To keep me on your phone, tap <u>Share</u> in Safari, then <u>Add to Home Screen</u>.', 'push-install', 5200);
    await h.step('Open <u>Dina</u> from your Home Screen and tap <u>Turn on notifications</u>. Then I can tell you when there is something new.', 4600);
    await h.end('You’re all set. ¡Bienvenido!');
  });

  if (want('2')) await make('2-your-lessons', { title: 'Your lessons', sub: 'Dina and Toby show you when your next lesson is and what to prepare.' }, async (h) => {
    await h.asSam(); await h.go('#/student'); h.startHere();
    await h.title();
    await h.step('Tap <u>Clases</u> down here to open your lessons page.', tab(h, 'Clases'), 2600);
    await h.step('Your <u>next lesson</u> is here: the day, the time and the link to join.', h.p.getByText(/^My next lesson/i).first(), 3400);
    await h.step('Tap <u>Lessons</u> to see all of them.', nav(h, 'Lessons'), 1500);
    await h.tap(nav(h, 'Lessons'), 1300);
    await h.step('I write the topic and what to <u>prepare</u> for each one.', h.p.getByText('Prepare', { exact: true }).first(), 3400);
    const cal = h.p.getByText(/Add to calendar/).first();
    await h.step('Tap <u>Add to calendar</u> to save it on your phone.', cal, 3000);
    await h.end('See you in class. ¡Hasta pronto!');
  });

  if (want('3')) await make('3-your-homework', { title: 'Your homework', sub: 'Dina and Toby show you how to find it, do it and read the feedback.' }, async (h) => {
    await h.asSam(); await h.go('#/student'); h.startHere();
    await h.title();
    await h.step('Tap <u>Homework</u>.', nav(h, 'Homework'), 1500);
    await h.tap(nav(h, 'Homework'), 1400);
    await h.step('<u>To do</u> comes first, with the deadline and my note to you.', h.p.getByTestId('hw-card-demo-h2').getByText(/Dina says/).first(), 3400);
    await h.step('Tap <u>Start</u> to open it. It is ticked off when you finish.', 'hw-start-demo-h2', 3200);
    await h.step('<u>Submitted</u> means I have it and I will reply soon.', h.p.getByTestId('hw-card-demo-h1').getByText('Awaiting feedback').first(), 3200);
    await h.step('<u>Reviewed</u> shows your work with my feedback underneath.', h.p.getByTestId('hw-card-demo-h3').getByText(/Dina’s feedback/i).first(), 3800);
    await h.end('Little and often works best. ¡Ánimo!');
  });

  if (want('4')) await make('4-practise-on-your-own', { title: 'Practise on your own', sub: 'Dina and Toby show you verbs, words and games for a few minutes a day.' }, async (h) => {
    await h.asSam(); await h.go('#/student'); h.startHere();
    await h.title();
    await h.step('Tap <u>Verbos</u> for the verb gym.', tab(h, 'Verbos'), 1700);
    await h.tap(tab(h, 'Verbos'), 1400);
    await h.step('Choose a <u>tense</u>. Let’s try the preterite.', 'tense-preterite', 1800);
    await h.tap('tense-preterite', 1000);
    const start = h.p.getByRole('button', { name: /Start \d+-exercise session/ });
    await h.step('Tap <u>Start</u>. Each session is about ten short exercises.', start, 2000);
    await h.tap(start, 300); await h.clear(); await h.wait(1500);
    await h.note('Answer each one. If you slip, it comes back later until it sticks.', 3400);
    await h.go('#/review', 1200);
    await h.step('<u>Memoria</u> brings words back just before you would forget them.', h.p.getByRole('button', { name: /Start review/ }).first(), 3200);
    await h.step('In <u>Word packs</u>, tap <u>Learn now</u> to add ten new words.', h.p.locator('[data-testid^="pack-learn-"]').first(), 3400);
    await h.go('#/arcade', 1200);
    await h.step('<u>Juegos</u> has quick games that use your own verbs and words. Toby’s favourite!', h.p.getByText('Play & learn').first(), 3600);
    await h.end('Five minutes a day beats an hour on Sunday.');
  });

  if (want('5')) await make('5-feedback-and-progress', { title: 'Feedback and progress', sub: 'Dina and Toby show you what Dina said and how far you have come.' }, async (h) => {
    await h.asSam(); await h.go('#/student'); h.startHere();
    await h.title();
    await h.step('Tap <u>Feedback</u>.', nav(h, 'Feedback'), 1500);
    await h.tap(nav(h, 'Feedback'), 1400);
    await h.step('My <u>comments</u> from your lessons are here.', h.p.getByText(/^Comments/).first(), 3000);
    await h.step('<u>Corrections</u> are the slips to watch out for.', h.p.getByText(/^Corrections/).first(), 3200);
    await h.step('<u>Recommendations</u> tell you what to practise next.', h.p.getByText(/^Recommendations/).first(), 3200);
    await h.step('Now tap <u>Mi camino</u> to see your progress.', tab(h, 'Mi camino'), 1700);
    await h.tap(tab(h, 'Mi camino'), 1700);
    await h.note('Your level, your study time and everything you have learned so far.', 3000);
    await h.step('<u>Trends</u> show your minutes, accuracy and words over eight weeks.', h.p.getByTestId('journey-trends').getByText(/Trends/).first(), 3600);
    await h.end('Every bit of practice counts. ¡Vas muy bien!');
  });

  if (want('6')) await make('6-invoices', { title: 'Invoices', sub: 'Dina and Toby show you what is due and how to say you have paid.' }, async (h) => {
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
    await h.step('Swipe the tabs across and tap <u>Invoices</u>.', nav(h, 'Invoices'), 1800);
    await h.tap(nav(h, 'Invoices'), 1500);
    await h.note('What you owe is at the top.', 'invoice-due', 2600);
    const row = h.p.getByText(/^LWD-\d{4}-\d{4}/).first();
    await h.step('Tap an invoice to open it.', row, 1600);
    await h.tap(row, 1500);
    await h.note('It lists the lessons, the total and <u>how to pay</u>.', 3400);
    await h.p.getByRole('button', { name: 'Close' }).first().click().catch(() => h.p.keyboard.press('Escape')); await h.wait(900);
    const paid = h.p.locator('[data-testid^="report-paid-"]');
    await h.step('When you have paid, tap <u>I’ve paid this</u>.', paid, 2000);
    await h.tap(paid, 1100);
    await h.step('Choose how you paid, add a note if you like, then tap <u>Tell Dina</u>.', 1400);
    await h.p.getByTestId('report-method').selectOption('Bank transfer'); await h.p.getByTestId('report-note').pressSequentially('Sent this morning', { delay: 55 }); await h.wait(800);
    await h.tap('report-send', 1500);
    await h.note('I get a notification. It shows as paid once I have checked and confirmed it.', h.p.locator('[data-testid^="reported-"]'), 4000);
    await h.end('All done. ¡Gracias!');
  });
})();
