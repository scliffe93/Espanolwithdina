// Records the short how-to videos for students (phone-sized, under a minute each). Dina and Toby guide each one:
// Dina walks on, talks you through it out loud (English with a Spanish accent) and Toby trots to each thing to tap.
// The voice needs Piper: set PIPER_PYTHON and PIPER_MODEL, or put a venv and the model under scripts/videos/voice-env (see docs/PLATFORM.md).
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
  if (want('1')) await make('1-getting-started', { title: 'Getting started', sub: 'Log in and put the app on your iPhone.', base: 'http://localhost:4174/',
    hello: "[es]¡Hola![/es] I'm Dina, and this is Toby. Welcome! Let us get you started.", bye: { title: 'You’re all set. ¡Bienvenido!', say: "You are all set. Welcome! [es]¡Chau![/es]" },
    context: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' }, init: () => { window.__vgNoHide = true; delete window.PushManager; },
    setup: async () => {
      const user = 'sam' + Date.now().toString(36).slice(-4);
      const r = await fetch('http://localhost:8787/account/register', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4174' }, body: JSON.stringify({ username: user, password: 'tortilla de patatas 2026', firstName: 'Sam', remember: true }) });
      if (!r.ok) throw new Error('could not create the account: ' + r.status);
      return { user };
    } }, async (h, { user }) => {
    await h.go('#/account'); h.startHere();
    await h.title();
    await h.note('Open the link I sent you, in *Safari*.');
    const login = h.p.getByRole('radio', { name: 'Log in' });
    await h.step('Tap *Log in*.', login);
    await h.tap(login, 700);
    await h.step('Type the *username* and *password* I gave you.', h.p.getByLabel('Username'), 200);
    await h.p.getByLabel('Username').pressSequentially(user, { delay: 80 });
    await h.p.getByLabel('Password', { exact: true }).pressSequentially('tortilla de patatas 2026', { delay: 28 }); await h.wait(500);
    const go = h.p.getByRole('button', { name: /^Log in/ }).last();
    await h.step('Now tap *Log in*.', go);
    await h.tap(go, 2300);
    await h.clear(); await h.wait(700);
    await h.p.getByTestId('welcome-continue').click({ timeout: 6000, noWaitAfter: true }).catch(() => {});
    await h.go('#/student', 1600);
    await h.note("You're in! This is your home page.");
    await h.step('To keep us on your phone, tap *Share* in Safari, then *Add to Home Screen*.', 'push-install', 1600);
    await h.step('Then open *Dina* from your Home Screen, and tap *Turn on notifications*. I will tell you when there is something new.', 600);
    await h.end();
  });

  if (want('2')) await make('2-your-lessons', { title: 'Your lessons', sub: 'When your next lesson is and what to prepare.',
    hello: "[es]¡Hola![/es] I'm Dina, and this is Toby. Let us show you where your lessons are.", bye: { title: 'See you in class. ¡Hasta pronto!', say: "That's it! See you in class. [es]¡Chau![/es]" } }, async (h) => {
    await h.asSam(); await h.go('#/student'); h.startHere();
    await h.title();
    await h.step('Tap *Clases*, down here, to open your lessons page.', tab(h, 'Clases'));
    await h.step('Your *next lesson* is here: the day, the time and the link to join.', h.p.getByText(/^My next lesson/i).first());
    await h.step('Tap *Lessons* to see all of them.', nav(h, 'Lessons'));
    await h.tap(nav(h, 'Lessons'), 1200);
    await h.step('I write the topic, and what to *prepare*, for each one.', h.p.getByText('Prepare', { exact: true }).first());
    await h.step('Tap *Add to calendar* to save it on your phone.', h.p.getByText(/Add to calendar/).first());
    await h.end();
  });

  if (want('3')) await make('3-your-homework', { title: 'Your homework', sub: 'Find it, do it and read my feedback.',
    hello: "[es]¡Hola![/es] It's Dina and Toby. Let us show you how your homework works.", bye: { title: 'Little and often works best. ¡Ánimo!', say: "Little and often works best. You can do it! [es]¡Chau![/es]" } }, async (h) => {
    await h.asSam(); await h.go('#/student'); h.startHere();
    await h.title();
    await h.step('Tap *Homework*.', nav(h, 'Homework'));
    await h.tap(nav(h, 'Homework'), 1300);
    await h.step('*To do* comes first, with the deadline and my note to you.', h.p.getByTestId('hw-card-demo-h2').getByText(/Dina says/).first());
    await h.step('Tap *Start* to open it. It is ticked off when you finish.', 'hw-start-demo-h2');
    await h.step('*Submitted* means I have it, and I will reply soon.', h.p.getByTestId('hw-card-demo-h1').getByText('Awaiting feedback').first());
    await h.step('*Reviewed* shows your work, with my feedback underneath.', h.p.getByTestId('hw-card-demo-h3').getByText(/Dina’s feedback/i).first(), 900);
    await h.end();
  });

  if (want('4')) await make('4-practise-on-your-own', { title: 'Practise on your own', sub: 'Verbs, words and games, a few minutes a day.',
    hello: "[es]¡Hola![/es] Dina and Toby here. Let us show you how to practise on your own.", bye: { title: 'Five minutes a day beats an hour on Sunday.', say: "Five minutes a day is better than one hour on Sunday. [es]¡Chau![/es]" } }, async (h) => {
    await h.asSam(); await h.go('#/student'); h.startHere();
    await h.title();
    await h.step('Tap *Verbos* for the verb gym.', tab(h, 'Verbos'));
    await h.tap(tab(h, 'Verbos'), 1300);
    await h.step("Choose a *tense*. Let's try the preterite.", 'tense-preterite');
    await h.tap('tense-preterite', 900);
    const start = h.p.getByRole('button', { name: /Start \d+-exercise session/ });
    await h.step('Tap *Start*. Each session is about ten short exercises.', start);
    await h.tap(start, 300); await h.clear(); await h.wait(1300);
    await h.note('Answer each one. If you slip, it comes back later, until it sticks.', 700);
    await h.go('#/review', 1200);
    await h.step('*Memoria* brings words back, just before you would forget them.', h.p.getByRole('button', { name: /Start review/ }).first());
    await h.step('In *Word packs*, tap *Learn now* to add ten new words.', h.p.locator('[data-testid^="pack-learn-"]').first());
    await h.go('#/arcade', 1200);
    await h.step("*Juegos* has quick games with your own verbs and words. Toby's favourite!", h.p.getByText('Play & learn').first(), 800);
    await h.end();
  });

  if (want('5')) await make('5-feedback-and-progress', { title: 'Feedback and progress', sub: 'What I said, and how far you have come.',
    hello: "[es]¡Hola![/es] It's Dina and Toby. Let us show you my feedback, and your progress.", bye: { title: 'Every bit of practice counts. ¡Vas muy bien!', say: "Every bit of practice counts. You are doing great! [es]¡Chau![/es]" } }, async (h) => {
    await h.asSam(); await h.go('#/student'); h.startHere();
    await h.title();
    await h.step('Tap *Feedback*.', nav(h, 'Feedback'));
    await h.tap(nav(h, 'Feedback'), 1300);
    await h.step('My *comments* from your lessons are here.', h.p.getByText(/^Comments/).first());
    await h.step('*Corrections* are the slips to watch out for.', h.p.getByText(/^Corrections/).first());
    await h.step('*Recommendations* tell you what to practise next.', h.p.getByText(/^Recommendations/).first());
    await h.step('Now tap *Mi camino* to see your progress.', tab(h, 'Mi camino'));
    await h.tap(tab(h, 'Mi camino'), 1600);
    await h.note('Your level, your study time, and everything you have learned so far.', 700);
    await h.step('*Trends* show your minutes, accuracy and words, over eight weeks.', h.p.getByTestId('journey-trends').getByText(/Trends/).first(), 900);
    await h.end();
  });

  if (want('6')) await make('6-invoices', { title: 'Invoices', sub: 'What is due, and how to say you have paid.',
    hello: "[es]¡Hola![/es] Dina and Toby here. Let us show you your invoices.", bye: { title: 'All done. ¡Gracias!', say: "All done. Thank you! [es]¡Chau![/es]" } }, async (h) => {
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
    await h.step('Swipe the tabs across, and tap *Invoices*.', nav(h, 'Invoices'));
    await h.tap(nav(h, 'Invoices'), 1400);
    await h.note('What you owe is at the top.', 'invoice-due');
    const row = h.p.getByText(/^LWD-\d{4}-\d{4}/).first();
    await h.step('Tap an invoice to open it.', row);
    await h.tap(row, 1400);
    await h.note('It lists the lessons, the total, and *how to pay*.', 900);
    await h.clear();
    await h.p.getByRole('button', { name: 'Close' }).first().click().catch(() => h.p.keyboard.press('Escape')); await h.wait(900);
    const paid = h.p.locator('[data-testid^="report-paid-"]');
    await h.step("When you have paid, tap *I've paid this*.", paid);
    await h.tap(paid, 1000);
    await h.step('Choose how you paid, add a note if you like, then tap *Tell Dina*.', 300);
    await h.p.getByTestId('report-method').selectOption('Bank transfer'); await h.p.getByTestId('report-note').pressSequentially('Sent this morning', { delay: 55 }); await h.wait(700);
    await h.tap('report-send', 1400);
    await h.note('I get a notification. It shows as paid, once I have checked and confirmed it.', h.p.locator('[data-testid^="reported-"]'), 900);
    await h.end();
  });
})();
