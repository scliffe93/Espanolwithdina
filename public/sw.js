// VIVA service worker: network-first for pages, cache-first for built assets.
const CACHE = 'viva-v1';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icon.svg'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Videos are streamed in ranges, which cannot be cached; let the browser fetch them directly.
  if (req.headers.has('range') || /\.(mp4|webm)$/.test(new URL(req.url).pathname)) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { caches.open(CACHE).then((c) => c.put('./index.html', res.clone())); return res; }).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })));
});

// Phone notifications. The server sends an encrypted { title, body, url, tag }; the browser decrypts it before this runs.
self.addEventListener('push', (e) => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch (_) { m = {}; }
  e.waitUntil(self.registration.showNotification(m.title || 'Learning with Dina', {
    body: m.body || '', icon: './icon-192.png', badge: './icon-192.png', tag: m.tag || undefined, data: { url: m.url || '' },
  }));
});
// Tapping a notification opens the app on the right screen (reusing an open window when there is one).
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const hash = (e.notification.data && e.notification.data.url) || '';
  const target = self.registration.scope + (hash.charAt(0) === '#' ? hash : '');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
    const win = wins.find((w) => w.url.indexOf(self.registration.scope) === 0);
    if (win) return win.focus().then((w) => (w && w.navigate ? w.navigate(target).catch(() => undefined) : undefined));
    return self.clients.openWindow(target);
  }));
});
