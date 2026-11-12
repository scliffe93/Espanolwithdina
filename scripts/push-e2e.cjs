// Phone notifications in the app, with real accounts on a local API. The browser's push service is stubbed
// (headless browsers cannot reach one), so this checks the app's side: the prompt, turning on and off, the
// iPhone "add to Home Screen" steps, and that the server stored and removed the device.
// Needs: API on :8787 with VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY set, and a build with VITE_LWD_API_URL=http://localhost:8787/account on :4173.
// Usage: node scripts/push-e2e.cjs <outDir>
const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const BASE = 'http://localhost:4173/'; const OUT = process.argv[2] || '.'; const PASSWORD = 'tortilla de patatas 2026';
const ok = (c, l) => { console.log(c ? '✓' : '✗', l); if (!c) process.exitCode = 1; };
const STUB = () => {
  const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  let sub = null;
  // Headless browsers report notifications as denied; behave like a phone where the person taps Allow.
  let permission = 'default';
  Object.defineProperty(Notification, 'permission', { get: () => permission });
  Notification.requestPermission = async () => { permission = 'granted'; return permission; };
  const make = async (opts) => {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const p256dh = b64u(await crypto.subtle.exportKey('raw', pair.publicKey)); const auth = b64u(crypto.getRandomValues(new Uint8Array(16)));
    const endpoint = 'https://web.push.apple.com/e2e-' + Math.random().toString(36).slice(2);
    return { endpoint, options: { applicationServerKey: opts.applicationServerKey.buffer }, toJSON: () => ({ endpoint, keys: { p256dh, auth } }), unsubscribe: async () => { sub = null; return true; } };
  };
  PushManager.prototype.subscribe = async function (opts) { sub = await make(opts); return sub; };
  PushManager.prototype.getSubscription = async function () { return sub; };
};
async function register(page, username, firstName) {
  await page.goto(BASE + '#/account'); await page.waitForTimeout(800);
  await page.getByRole('radio', { name: 'Create account' }).click();
  await page.getByLabel('Username').fill(username); await page.getByLabel('Your first name').fill(firstName);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD); await page.getByLabel('Repeat password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create my account' }).click();
  await page.getByRole('checkbox', { name: /saved my recovery code/ }).check();
  await page.getByRole('button', { name: /^Continue/ }).click();
  await page.getByTestId('welcome-continue').click({ timeout: 10000 }); await page.waitForTimeout(800);
}
(async () => {
  const b = await chromium.launch(); const errors = [];
  const u = 'push' + Date.now().toString(36);
  // 1. A phone-sized browser that supports notifications.
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['notifications'] });
  await ctx.addInitScript(STUB);
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e)));
  await register(p, u, 'Sam');
  const token = await p.evaluate(() => { for (const s of [localStorage, sessionStorage]) for (let i = 0; i < s.length; i++) { try { const v = JSON.parse(s.getItem(s.key(i))); if (v && v.token) return v.token; } catch (e) {} } return null; });
  const status = async () => (await (await fetch('http://localhost:8787/account/push/status', { headers: { authorization: 'Bearer ' + token, origin: 'http://localhost:4173' } })).json());
  ok(!!token, 'registered a real account');
  await p.goto(BASE + '#/student'); await p.waitForTimeout(2500);
  ok(await p.getByTestId('push-turn-on').isVisible(), 'the student home offers "Turn on notifications"');
  await p.screenshot({ path: OUT + '/push-prompt.png' });
  await p.getByTestId('push-turn-on').click(); await p.waitForTimeout(2500);
  ok((await p.getByTestId('push-card').count()) === 0, 'after turning on, the prompt goes away');
  ok((await status()).devices === 1, 'the server stored this device: ' + JSON.stringify(await status()));
  await p.goto(BASE + '#/account'); await p.waitForTimeout(2500);
  ok(await p.getByTestId('push-on').isVisible(), 'the account page shows notifications are on');
  await p.getByTestId('push-on').scrollIntoViewIfNeeded(); await p.screenshot({ path: OUT + '/push-settings-on.png' });
  await p.getByTestId('push-turn-off').click(); await p.waitForTimeout(2000);
  ok(await p.getByTestId('push-off').isVisible() && (await status()).devices === 0, 'turning off removes the device from the server');
  await p.getByTestId('push-turn-on').click(); await p.waitForTimeout(2500);
  ok((await status()).devices === 1, 'it can be turned on again');
  await ctx.close();
  // 2. An iPhone in Safari that has not added the app to the Home Screen: no push support yet, so show the steps.
  const ios = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  await ios.addInitScript(() => { delete window.PushManager; });
  const q = await ios.newPage(); q.on('pageerror', (e) => errors.push(String(e)));
  await q.goto(BASE + '#/account'); await q.waitForTimeout(800);
  await q.getByRole('radio', { name: 'Log in' }).click(); await q.getByLabel('Username').fill(u); await q.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await q.getByRole('button', { name: /^Log in/ }).last().click(); await q.waitForTimeout(3000);
  await q.getByTestId('welcome-continue').click({ timeout: 8000 }).catch(() => {}); await q.waitForTimeout(600);
  await q.goto(BASE + '#/student'); await q.waitForTimeout(2500);
  ok(await q.getByTestId('push-install').isVisible() && /Add to Home Screen/.test(await q.getByTestId('push-install').innerText()), 'an iPhone that has not installed the app sees the Home Screen steps');
  await q.screenshot({ path: OUT + '/push-iphone-install.png' });
  await q.getByTestId('push-dismiss').click(); await q.waitForTimeout(300);
  ok((await q.getByTestId('push-card').count()) === 0, 'the prompt can be hidden');
  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
})();
