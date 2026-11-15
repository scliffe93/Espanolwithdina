// Troubleshooting: a short list of the last things that went wrong, kept on this device only.
// Nothing is sent anywhere. The learner can read it in Settings and copy or share it with their teacher.

export interface Issue {
  at: number;
  /** crash = a page failed to draw; error = a script error; voice = speech would not play; note = anything else. */
  kind: 'crash' | 'error' | 'voice' | 'note';
  message: string;
  /** The page the learner was on. */
  where: string;
  detail?: string;
}

const KEY = 'lwd-diagnostics';
const MAX = 30;
const listeners = new Set<() => void>();

function read(): Issue[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

export function getIssues(): Issue[] {
  return read();
}

export function onIssuesChange(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Records a problem. Never throws, and ignores an exact repeat within a few seconds. */
export function logIssue(kind: Issue['kind'], message: string, detail?: string): void {
  try {
    const list = read();
    const where = typeof location !== 'undefined' ? location.hash.replace(/^#\/?/, '').split('?')[0] || 'home' : '';
    const msg = String(message).slice(0, 300);
    const last = list[list.length - 1];
    if (last && last.message === msg && Date.now() - last.at < 5000) return;
    list.push({ at: Date.now(), kind, message: msg, where, ...(detail ? { detail: String(detail).slice(0, 600) } : {}) });
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
    listeners.forEach((l) => l());
  } catch { /* storage full or blocked: nothing to do */ }
}

export function clearIssues(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

/** A plain-text report the learner can paste into a message. It holds no name, password or answers. */
export function buildReport(extra: string[] = []): string {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const lines = [
    'Learning with Dina: troubleshooting report',
    `When: ${new Date().toISOString()}`,
    `App version: ${typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'}`,
    `Device: ${nav?.userAgent ?? 'unknown'}`,
    `Online: ${nav?.onLine ?? 'unknown'} · Installed app: ${typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (nav as unknown as { standalone?: boolean })?.standalone === true)}`,
    ...extra,
    '',
    'Recent problems:',
    ...(read().length ? read().slice().reverse().map((i) => `- ${new Date(i.at).toISOString()} [${i.kind}] on "${i.where}": ${i.message}${i.detail ? `\n    ${i.detail.replace(/\n/g, '\n    ')}` : ''}`) : ['- none recorded']),
  ];
  return lines.join('\n');
}

let installed = false;
/** Catches script errors anywhere in the app so they are on the list instead of vanishing. */
export function installDiagnostics(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (e) => {
    if (!e.message || /ResizeObserver loop/i.test(e.message)) return;
    logIssue('error', e.message, e.error?.stack ?? `${e.filename}:${e.lineno}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as { message?: string; stack?: string; name?: string } | undefined;
    if (r?.name === 'AbortError') return;
    logIssue('error', r?.message ?? String(e.reason), r?.stack);
  });
}

/** Clears the offline copy of the app and reloads, so a stale or half-updated copy cannot keep causing trouble. Progress is kept. */
export async function refreshApp(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) await Promise.all((await navigator.serviceWorker.getRegistrations()).map((r) => r.unregister()));
    if (typeof caches !== 'undefined') await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
  } catch { /* reload anyway */ }
  location.reload();
}
