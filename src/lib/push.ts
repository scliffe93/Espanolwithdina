import { pushApi } from './cloud';

// ───────────────────────────────────────────────────────────────
// Phone notifications (Web Push). Each device opts in: the browser
// creates a subscription, the server stores it against the signed-in
// account and sends encrypted messages to it. On iPhone and iPad this
// only works once the app has been added to the Home Screen.
// ───────────────────────────────────────────────────────────────

export type PushSupport = 'ok' | 'needs-install' | 'unsupported';
export type PushStatus = 'on' | 'off' | 'blocked';

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}
export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported';
  const has = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (has) return 'ok';
  return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported';
}

function keyBytes(b64: string): Uint8Array {
  const raw = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
/** The service worker, or null when there isn't one (development builds, private modes). */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
}

export async function pushStatus(): Promise<PushStatus> {
  if (pushSupport() !== 'ok') return 'off';
  if (Notification.permission === 'denied') return 'blocked';
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

/** Turns notifications on for this device and account. Must be called from a tap (browsers require it to ask permission). */
export async function enablePush(token: string): Promise<PushStatus> {
  if (pushSupport() !== 'ok') throw new Error('This browser cannot receive notifications.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';
  const reg = await registration();
  if (!reg) throw new Error('The app is still installing. Close it, open it again and try once more.');
  const { key } = await pushApi.key(token);
  if (!key) throw new Error('Notifications are not switched on for this school yet.');
  let sub = await reg.pushManager.getSubscription();
  // A subscription made with an older server key cannot be used: replace it.
  const current = sub?.options.applicationServerKey ? btoa(String.fromCharCode(...new Uint8Array(sub.options.applicationServerKey))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : null;
  if (sub && current && current !== key) { await sub.unsubscribe(); sub = null; }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
  const json = sub.toJSON();
  await pushApi.subscribe(token, { endpoint: sub.endpoint, keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' } }, true);
  return 'on';
}

/** Turns notifications off for this device (also called when logging out). */
export async function disablePush(token: string): Promise<void> {
  if (pushSupport() !== 'ok') return;
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await pushApi.unsubscribe(token, sub.endpoint).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}

/** After logging in on a device that already allowed notifications, point it at this account (no prompt). */
export async function refreshPush(token: string): Promise<void> {
  if (pushSupport() !== 'ok' || Notification.permission !== 'granted') return;
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const json = sub.toJSON();
  await pushApi.subscribe(token, { endpoint: sub.endpoint, keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' } }).catch(() => undefined);
}

// ── Installing the app (Android, Windows, Mac, Chromebook) ──
// Chrome and Edge fire `beforeinstallprompt` when the app can be installed; keeping the event lets the
// app offer its own "Install" button. Safari on iPhone has no such event: people use Share, Add to Home Screen.
interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let installEvent: InstallEvent | null = null;
const installListeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e as InstallEvent; installListeners.forEach((f) => f()); });
  window.addEventListener('appinstalled', () => { installEvent = null; installListeners.forEach((f) => f()); });
}
export const canInstall = () => !!installEvent && !isStandalone();
export function onInstallChange(f: () => void): () => void { installListeners.add(f); return () => { installListeners.delete(f); }; }
/** Shows the browser's install dialog. Resolves true when the person accepted. */
export async function installApp(): Promise<boolean> {
  const e = installEvent;
  if (!e) return false;
  await e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome === 'accepted') { installEvent = null; installListeners.forEach((f) => f()); }
  return outcome === 'accepted';
}
