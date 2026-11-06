// Focused browser test for the Dina character. Usage: node scripts/dina-e2e.cjs [baseUrl]
const { chromium, devices } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:4173/';
const OUT = 'screenshots';
const errors = [];
const log = (...a) => console.log('•', ...a);

// Records speech requests instead of relying on headless audio.
const speechStub = () => {
  window.__spoken = [];
  if (!window.speechSynthesis) return;
  window.speechSynthesis.speak = (u) => {
    window.__spoken.push({ text: u.text, lang: u.lang });
    setTimeout(() => { u.onstart && u.onstart(); setTimeout(() => u.onend && u.onend(), 250); }, 10);
  };
};
const noSpeech = () => { delete window.speechSynthesis; window.__spoken = []; };

const profile = {
  name: 'Sam', gender: 'f', proficiencySelf: 'basic', destinationCountry: 'España', destinationCity: 'Madrid', relocation: 'someday',
  interests: ['music'], career: '', socialGoals: [], reasons: ['relocation'], dailyMinutes: 10, activities: ['games'], difficulties: [],
  hasTeacher: true, region: 'spain', city: 'madrid', citiesVisited: ['madrid'], notes: {}, voiceNotes: [],
  levels: { vocabulary: 'A1', grammar: 'A1', reading: 'A1', listening: 'A1', speaking: 'A1', verbs: 'A1' }, levelSource: 'zero', levelOverridden: false, createdAt: Date.now(),
};
const seed = (p) => new Promise((res) => {
  const r = indexedDB.open('viva', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('recordings'); };
  r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put({ profile: p, onboardingDone: true, story: { completedScenes: ['llegada'], relationships: {}, flags: {}, sceneScores: {} } }, 'state'); tx.oncomplete = res; };
});

async function tapDina(page, label) {
  await page.getByRole('button', { name: /Dina, your Spanish tutor/ }).first().click();
  await page.getByRole('status').filter({ hasText: 'Learning with Dina' }).first().waitFor({ timeout: 4000 });
  const bubble = await page.getByRole('status').filter({ hasText: 'Learning with Dina' }).first().innerText();
  await page.waitForFunction(() => !window.speechSynthesis || window.__spoken.some((s) => s.text.trim()), null, { timeout: 5000 }).catch(() => {});
  const spoken = await page.evaluate(() => window.__spoken.filter((s) => s.text.trim())); // ignore the silent warm-up utterance
  await page.evaluate(() => { window.__spoken = window.speechSynthesis ? [] : window.__spoken; });
  log(`${label}: bubble →`, JSON.stringify(bubble.split('\n')[0]), '| speech →', JSON.stringify(spoken.at(-1) ?? null));
  return { bubble, spoken };
}

(async () => {
  const browser = await chromium.launch();

  // 1. Welcome screen (desktop), first open → entrance animation then greeting.
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 } });
  await ctx.addInitScript(speechStub);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(BASE);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/50-dina-entrance-start.png`, clip: { x: 0, y: 0, width: 520, height: 330 } });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/51-dina-welcome.png` });
  const w = await tapDina(page, 'welcome');
  if (!w.bubble.includes('¡Hola! ¡Bienvenida a Learning with Dina!')) errors.push('welcome bubble text wrong');
  if (!w.spoken.some((s) => s.lang === 'es-AR' && s.text === '¡Hola! ¡Bienvenida a Learning with Dina!')) errors.push('welcome speech not es-AR greeting');
  await page.screenshot({ path: `${OUT}/52-dina-greeting.png`, clip: { x: 0, y: 0, width: 600, height: 420 } });

  // 2. In-app shell (desktop sidebar) with saved progress — check it is preserved.
  await page.evaluate(seed, profile);
  await page.goto(`${BASE}#/world`);
  await page.reload();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${OUT}/53-dina-sidebar.png`, clip: { x: 0, y: 0, width: 700, height: 420 } });
  const kept = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('viva'); r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('state'); g.onsuccess = () => res(g.result.story.completedScenes); }; }));
  log('progress preserved:', JSON.stringify(kept));
  await tapDina(page, 'sidebar');

  // 3. Mobile header.
  const m = await browser.newContext({ ...devices['iPhone 13'] });
  await m.addInitScript(speechStub);
  const mp = await m.newPage();
  mp.on('pageerror', (e) => errors.push(`mobile: ${e.message}`));
  await mp.goto(BASE);
  await mp.evaluate(seed, profile);
  await mp.goto(`${BASE}#/world`);
  await mp.reload();
  await mp.waitForTimeout(1800);
  await mp.screenshot({ path: `${OUT}/54-dina-mobile.png` });
  await tapDina(mp, 'mobile');
  await mp.screenshot({ path: `${OUT}/55-dina-mobile-greeting.png` });
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  log('mobile horizontal overflow:', overflow);

  // 4. Reduced motion: no entrance animation, still greets.
  const r = await browser.newContext({ viewport: { width: 1360, height: 860 }, reducedMotion: 'reduce' });
  await r.addInitScript(speechStub);
  const rp = await r.newPage();
  rp.on('pageerror', (e) => errors.push(`reduced: ${e.message}`));
  await rp.goto(BASE);
  await rp.waitForTimeout(150);
  const op = await rp.getByRole('button', { name: /Dina, your Spanish tutor/ }).first().evaluate((el) => getComputedStyle(el).opacity);
  log('reduced motion: visible immediately (opacity', op + ')');
  await tapDina(rp, 'reduced-motion');

  // 5. No speech synthesis at all → text alternative.
  const n = await browser.newContext({ viewport: { width: 1360, height: 860 } });
  await n.addInitScript(noSpeech);
  const np = await n.newPage();
  np.on('pageerror', (e) => errors.push(`no-tts: ${e.message}`));
  await np.goto(BASE);
  await np.waitForTimeout(1500);
  const nb = await tapDina(np, 'no-audio');
  log('text alternative shown:', nb.bubble.includes('Audio isn’t available'));

  await browser.close();
  log('errors:', errors.length ? errors : 'none');
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error('DINA E2E FAILED', e); process.exit(1); });
