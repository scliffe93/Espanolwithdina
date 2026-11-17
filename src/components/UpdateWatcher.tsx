import { useEffect, useState } from 'react';
import { Icon } from './Icon';

/**
 * Keeps an open copy of the app up to date. A tab left open goes on running the version it loaded, so after a new
 * release the teacher or a student could be looking at an old screen for hours. Every few minutes, and whenever the
 * app comes back into view, this asks the site which version is current. When there is a newer one it says so, and
 * moves to it by itself the next time the person changes page (never in the middle of the page they are on).
 */
export function UpdateWatcher() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const mine = (document.querySelector('script[type="module"][src*="assets/"]') as HTMLScriptElement | null)?.getAttribute('src')?.split('/').pop() ?? '';
    if (!mine) return;
    let stop = false;
    const check = async () => {
      if (stop || document.visibilityState !== 'visible') return;
      try {
        const html = await (await fetch(`./index.html?v=${Date.now()}`, { cache: 'no-store' })).text();
        const now = html.match(/assets\/(index-[^"']+\.js)/)?.[1] ?? '';
        if (now && now !== mine) setReady(true);
      } catch { /* offline: ask again later */ }
    };
    const iv = window.setInterval(() => void check(), 5 * 60 * 1000);
    const first = window.setTimeout(() => void check(), 20 * 1000);
    document.addEventListener('visibilitychange', check);
    return () => { stop = true; window.clearInterval(iv); window.clearTimeout(first); document.removeEventListener('visibilitychange', check); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const go = () => window.location.reload();
    window.addEventListener('hashchange', go);
    return () => window.removeEventListener('hashchange', go);
  }, [ready]);
  if (!ready) return null;
  return (
    <div className="fixed inset-x-3 top-3 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-cream shadow-lift print:hidden" role="status" data-testid="update-ready">
      <Icon name="refresh" size={18} />
      <span className="min-w-0 flex-1 text-sm"><b className="block">A newer version of the app is ready</b>It loads by itself when you change page.</span>
      <button type="button" className="rounded-full bg-saffron px-4 py-2 text-sm font-bold text-ink" onClick={() => window.location.reload()}>Update now</button>
    </div>
  );
}
