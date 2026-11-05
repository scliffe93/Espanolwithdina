// End-to-end test of accounts + cross-device sync against the real account API.
// Needs: account API on :8787 (npx tsx server/dev-server.ts 8787 memory) and a build
// with VITE_LWD_API_URL=http://localhost:8787/account served on :4173.
const { chromium, devices } = require('playwright');
const BASE = 'http://localhost:4173/';
const API = 'http://localhost:8787/account';
const OUT = 'screenshots';
const errors = [];
const log = (...a) => console.log('•', ...a);
const tap = (loc) => loc.click({ timeout: 4000 }).catch(() => {});
const PASSWORD = 'mi cafe con dina';

const quietSpeech = () => {
  if (window.speechSynthesis) window.speechSynthesis.speak = (u) => setTimeout(() => { u.onstart && u.onstart(); setTimeout(() => u.onend && u.onend(), 50); }, 5);
};

const guestState = {
  onboardingDone: true,
  profile: {
    name: 'Sam', gender: 'f', proficiencySelf: 'basic', destinationCountry: 'España', destinationCity: 'Madrid', relocation: 'someday', interests: ['music'], career: '',
    socialGoals: [], reasons: ['relocation'], dailyMinutes: 10, activities: ['games'], difficulties: [], hasTeacher: false, region: 'spain', city: 'madrid', citiesVisited: ['madrid'],
    notes: {}, voiceNotes: [], levels: { vocabulary: 'A2', grammar: 'A1', reading: 'A2', listening: 'A1', speaking: 'A1', verbs: 'A1' }, levelSource: 'assessment', levelOverridden: false, createdAt: Date.now(),
  },
  story: { completedScenes: ['llegada'], relationships: { lucia: 30 }, flags: {}, sceneScores: { llegada: 0.9 } },
  srs: { 'vocab:maleta': { key: 'vocab:maleta', ease: 2.5, intervalDays: 1, due: Date.now() + 86400000, reps: 1, lapses: 0, attempts: 1, correct: 1, lastSeen: Date.now(), introducedAt: Date.now() } },
};

async function seedGuest(page) {
  await page.evaluate((s) => new Promise((res) => {
    const r = indexedDB.open('viva', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('recordings'); };
    r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put(s, 'state'); tx.oncomplete = res; };
  }), guestState);
}

async function idbState(page, keyPrefix) {
  return page.evaluate((prefix) => new Promise((res) => {
    const r = indexedDB.open('viva');
    r.onsuccess = () => {
      const st = r.result.transaction('kv').objectStore('kv');
      const req = st.getAllKeys();
      req.onsuccess = () => {
        const key = req.result.find((k) => String(k).startsWith(prefix));
        if (!key) return res(null);
        const g = st.get(key);
        g.onsuccess = () => res(g.result);
      };
    };
  }), keyPrefix);
}

async function waitSynced(page, label) {
  const badge = page.getByTestId('sync-badge').first();
  for (let i = 0; i < 60; i++) {
    const t = await badge.getAttribute('title').catch(() => '');
    if (t && t.startsWith('Saved to your account')) return true;
    await page.waitForTimeout(500);
  }
  errors.push(`${label}: never reached "Saved to your account" (last: ${await badge.getAttribute('title').catch(() => '?')})`);
  return false;
}

async function playScene(page, id) {
  await page.goto(`${BASE}#/scene/${id}`);
  await page.waitForTimeout(400);
  for (let step = 0; step < 120; step++) {
    if (await page.getByText('Chapter complete').isVisible().catch(() => false)) return true;
    const cont = page.locator('button', { hasText: /^(Continue|Try again)/ }).first();
    if (await cont.isVisible().catch(() => false)) { await tap(cont); await page.waitForTimeout(220); continue; }
    const finish = page.getByRole('button', { name: /Finish chapter/ });
    if (await finish.isVisible().catch(() => false)) { await tap(finish); await page.waitForTimeout(400); continue; }
    const input = page.locator('#scene-input');
    if (await input.isVisible().catch(() => false)) { await input.fill('Soy de Londres'); await tap(page.getByRole('button', { name: 'Reply' })); await page.waitForTimeout(250); continue; }
    const choice = page.locator('div.group > button.flex-1').first();
    if (await choice.isVisible().catch(() => false)) { await tap(choice); await page.waitForTimeout(280); continue; }
    await page.waitForTimeout(200);
  }
  return false;
}

async function login(page, username, password, opts = {}) {
  await page.goto(`${BASE}#/account`);
  await page.getByRole('radio', { name: 'Log in' }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  if (opts.remember === false) await page.getByRole('checkbox', { name: /Remember me/ }).uncheck();
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
}

const allPages = [];
async function newDevice(browser, kind) {
  const ctx = await browser.newContext(kind === 'phone' ? { ...devices['iPhone 13'] } : { viewport: { width: 1360, height: 900 } });
  await ctx.addInitScript(quietSpeech);
  const page = await ctx.newPage();
  allPages.push([kind, page]);
  page.on('pageerror', (e) => errors.push(`${kind}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`${kind} console: ${m.text()}`); });
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch();

  // ── A. Phone: existing guest progress → create account (migration) ──
  const phone = await newDevice(browser, 'phone');
  await phone.page.goto(BASE);
  await seedGuest(phone.page);
  await phone.page.goto(`${BASE}#/world`);
  await phone.page.reload();
  await phone.page.waitForTimeout(800);
  await phone.page.goto(`${BASE}#/account`);
  await phone.page.waitForTimeout(500);
  await phone.page.getByLabel('Username').fill('Sam_Phone');
  await phone.page.getByLabel('Your first name').fill('Sam');
  await phone.page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await phone.page.getByLabel('Repeat password').fill(PASSWORD);
  const bring = await phone.page.getByRole('checkbox', { name: /Bring my progress/ }).isChecked();
  log('A. migration option offered and on by default:', bring);
  await phone.page.screenshot({ path: `${OUT}/60-register-phone.png` });
  await phone.page.getByRole('button', { name: 'Create my account' }).click();
  const code = (await phone.page.getByTestId('recovery-code').innerText({ timeout: 15000 })).trim();
  log('A. recovery code shown:', /^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/.test(code));
  await phone.page.screenshot({ path: `${OUT}/61-recovery-code.png` });
  log('A. no welcome dialog before the code is saved:', !(await phone.page.getByRole('dialog').isVisible()));
  await phone.page.getByRole('checkbox', { name: /saved my recovery code/ }).check();
  await phone.page.getByRole('button', { name: /^Continue/ }).click();
  const welcomeNew = await phone.page.getByRole('dialog').innerText();
  log('A. welcome dialog:', JSON.stringify(welcomeNew.split('\n')[0]));
  await phone.page.getByTestId('welcome-continue').click();
  await phone.page.goto(`${BASE}#/world`);
  await waitSynced(phone.page, 'phone after register');
  const guestAfter = await idbState(phone.page, 'state');
  log('A. guest copy kept on device (not deleted):', !!guestAfter && guestAfter.story.completedScenes.includes('llegada'));

  // Phone completes chapter 2 and syncs
  const ok = await playScene(phone.page, 'piso');
  log('A. phone completed "piso":', ok);
  await waitSynced(phone.page, 'phone after chapter');
  await phone.ctx.close(); // close the app on the phone

  // ── B. Laptop: log in on a brand-new device and continue ──
  const laptop = await newDevice(browser, 'laptop');
  await laptop.page.goto(BASE);
  await laptop.page.waitForTimeout(800);
  await laptop.page.screenshot({ path: `${OUT}/62-welcome-login-button.png` });
  await laptop.page.getByRole('button', { name: /I already have an account/ }).click();
  await laptop.page.getByRole('radio', { name: 'Log in' }).click();
  await laptop.page.getByLabel('Username').fill('sam_phone'); // case-insensitive
  await laptop.page.getByLabel('Password', { exact: true }).fill('wrong password here');
  await laptop.page.getByRole('button', { name: 'Log in', exact: true }).click();
  log('G. wrong password message:', JSON.stringify(await laptop.page.getByRole('alert').innerText()));
  await laptop.page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await laptop.page.getByRole('button', { name: 'Log in', exact: true }).click();
  const dlg = laptop.page.getByRole('dialog');
  await dlg.waitFor({ timeout: 15000 });
  const welcomeBack = (await dlg.innerText()).split('\n')[0];
  log('B. welcome back:', JSON.stringify(welcomeBack));
  if (!welcomeBack.includes('¡Hola de nuevo, Sam!')) errors.push('welcome back text wrong');
  await laptop.page.screenshot({ path: `${OUT}/63-welcome-back.png` });
  await laptop.page.getByTestId('welcome-continue').click();
  await laptop.page.waitForTimeout(800);
  const hash = await laptop.page.evaluate(() => location.hash);
  log('B. "Continue learning" went to:', hash);
  if (hash !== '#/scene/cafe') errors.push(`continue learning went to ${hash}, expected #/scene/cafe`);
  const laptopState = await idbState(laptop.page, 'state:u:');
  log('B. laptop restored chapters:', JSON.stringify(laptopState.story.completedScenes), '| level:', laptopState.profile.levels.vocabulary, '| srs cards:', Object.keys(laptopState.srs).length);
  await laptop.page.goto(`${BASE}#/journey`);
  await laptop.page.waitForTimeout(900);
  await laptop.page.screenshot({ path: `${OUT}/64-journey.png`, fullPage: true });
  log('B. journey shows Madrid 2/3:', await laptop.page.getByText('2/3 chapters').first().isVisible());

  // ── C. Offline on the laptop, then reconnect ──
  await laptop.ctx.setOffline(true);
  await laptop.page.waitForTimeout(300);
  await laptop.page.goto(`${BASE}#/verbs`).catch(() => {});
  await laptop.page.waitForTimeout(600);
  await laptop.page.getByRole('button', { name: /Start 12-exercise session/ }).click();
  for (let i = 0; i < 6; i++) {
    const opt = laptop.page.locator('div.mt-5.grid button:not([disabled])').first();
    const input = laptop.page.getByLabel('Your answer');
    if (await input.isVisible().catch(() => false)) { await input.fill('hablo'); await tap(laptop.page.getByRole('button', { name: 'Check' })); }
    else if (await opt.isVisible().catch(() => false)) await tap(opt);
    else await tap(laptop.page.locator('div.grid.grid-cols-2 button:not([disabled])').first());
    await laptop.page.waitForTimeout(300);
    await tap(laptop.page.getByRole('button', { name: /^Continue/ }));
  }
  await laptop.page.waitForTimeout(4000);
  const offlineTitle = await laptop.page.getByTestId('sync-badge').first().getAttribute('title');
  log('C. offline status:', JSON.stringify(offlineTitle));
  if (!/Offline|not yet synced/.test(offlineTitle)) errors.push('offline status not shown honestly');
  await laptop.page.screenshot({ path: `${OUT}/65-offline.png` });
  await laptop.ctx.setOffline(false);
  await waitSynced(laptop.page, 'laptop after reconnect');
  log('C. synced after reconnect');

  // ── D. Conflict: phone (re-login) and laptop both change offline, then reconnect ──
  const phone2 = await newDevice(browser, 'phone');
  await login(phone2.page, 'Sam_Phone', PASSWORD);
  await phone2.page.getByTestId('welcome-continue').click({ timeout: 15000 });
  await waitSynced(phone2.page, 'phone2 login');
  await phone2.ctx.setOffline(true);
  await laptop.ctx.setOffline(true);
  await playScene(phone2.page, 'cafe'); // phone: finishes the story offline
  await laptop.page.goto(`${BASE}#/settings`);
  await laptop.page.waitForTimeout(500);
  await laptop.page.getByRole('radio', { name: '30 min' }).click(); // laptop: changes the daily goal offline
  await laptop.page.waitForTimeout(800);
  await phone2.ctx.setOffline(false);
  await waitSynced(phone2.page, 'phone2 reconnect');
  await laptop.ctx.setOffline(false);
  await waitSynced(laptop.page, 'laptop reconnect (conflict)');
  await phone2.page.evaluate(() => window.dispatchEvent(new Event('online')));
  await waitSynced(phone2.page, 'phone2 pull');
  await phone2.page.waitForTimeout(1500);
  const lp = await idbState(laptop.page, 'state:u:');
  const pp = await idbState(phone2.page, 'state:u:');
  log('D. laptop after merge:', JSON.stringify(lp.story.completedScenes), 'goal', lp.profile.dailyMinutes);
  log('D. phone after merge: ', JSON.stringify(pp.story.completedScenes), 'goal', pp.profile.dailyMinutes);
  if (!lp.story.completedScenes.includes('cafe') || lp.profile.dailyMinutes !== 30) errors.push('laptop lost data in conflict merge');
  if (!pp.story.completedScenes.includes('cafe') || pp.profile.dailyMinutes !== 30) errors.push('phone lost data in conflict merge');

  // ── E. Recovery code on a third device ──
  const tablet = await newDevice(browser, 'laptop');
  await tablet.page.goto(`${BASE}#/account`);
  await tablet.page.getByRole('radio', { name: 'Forgot password' }).click();
  await tablet.page.getByLabel('Username').fill('Sam_Phone');
  await tablet.page.getByLabel('Recovery code').fill(code.toLowerCase());
  await tablet.page.getByLabel('New password').fill('nueva clave segura');
  await tablet.page.getByLabel('Repeat password').fill('nueva clave segura');
  await tablet.page.getByRole('button', { name: 'Reset password' }).click();
  const newCode = (await tablet.page.getByTestId('recovery-code').innerText({ timeout: 15000 })).trim();
  log('E. recovery worked, new single-use code issued:', newCode !== code);
  await tablet.page.getByRole('checkbox', { name: /saved my recovery code/ }).check();
  await tablet.page.getByRole('button', { name: /^Continue/ }).click();
  log('E. welcome back after recovery:', JSON.stringify((await tablet.page.getByRole('dialog').innerText()).split('\n')[0]));
  const oldPw = await fetch(`${API}/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'Sam_Phone', password: PASSWORD }) });
  const newPw = await fetch(`${API}/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'Sam_Phone', password: 'nueva clave segura' }) });
  log('E. old password rejected:', oldPw.status === 401, '| new password works:', newPw.status === 200);
  await tablet.ctx.close();

  // ── F. A second learner on the shared laptop sees only their own progress ──
  await laptop.page.goto(`${BASE}#/account`);
  await laptop.page.waitForTimeout(400);
  await laptop.page.getByRole('button', { name: 'Log out' }).click();
  await laptop.page.waitForTimeout(800);
  await laptop.page.getByRole('radio', { name: 'Create account' }).click();
  await laptop.page.getByLabel('Username').fill('sam_phone');
  await laptop.page.getByLabel('Your first name').fill('Copy');
  await laptop.page.getByLabel('Password', { exact: true }).fill('otra clave larga');
  await laptop.page.getByLabel('Repeat password').fill('otra clave larga');
  await laptop.page.getByRole('button', { name: 'Create my account' }).click();
  await laptop.page.waitForTimeout(1500);
  log('G. duplicate username:', JSON.stringify(await laptop.page.getByRole('alert').allInnerTexts()));
  await laptop.page.getByLabel('Username').fill('maria_l');
  await laptop.page.getByLabel('Your first name').fill('María');
  await laptop.page.getByRole('button', { name: 'Create my account' }).click();
  await laptop.page.getByTestId('recovery-code').waitFor({ timeout: 15000 });
  await laptop.page.getByRole('checkbox', { name: /saved my recovery code/ }).check();
  await laptop.page.getByRole('button', { name: /^Continue/ }).click();
  await laptop.page.getByTestId('welcome-continue').click();
  const maria = await laptop.page.evaluate(async () => JSON.parse(localStorage.getItem('lwd-session')));
  const mariaProg = await (await fetch(`${API}/progress`, { headers: { authorization: `Bearer ${maria.token}` } })).json();
  log('F. second learner starts fresh (no chapters, onboarding pending):', JSON.stringify(mariaProg.data.story.completedScenes), mariaProg.data.onboardingDone);
  if (mariaProg.data.story.completedScenes.length) errors.push('second learner received another learner’s progress');

  // Mobile layout of the account page
  const m = await newDevice(browser, 'phone');
  await m.page.goto(`${BASE}#/account`);
  await m.page.waitForTimeout(600);
  await m.page.screenshot({ path: `${OUT}/66-account-mobile.png`, fullPage: true });
  log('mobile overflow on account page:', await m.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth));

  await browser.close();
  log('errors:', errors.length ? errors : 'none');
  process.exit(errors.length ? 1 : 0);
})().catch(async (e) => {
  console.error('ACCOUNTS E2E FAILED', e.message.split('\n')[0], e.message.match(/waiting for [^\n]*/)?.[0]);
  for (const [i, [k, p]] of allPages.entries()) await p.screenshot({ path: `${OUT}/fail-${i}-${k}.png` }).catch(() => {});
  console.error('errors so far', errors);
  process.exit(1);
});
