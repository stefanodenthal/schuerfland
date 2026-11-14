// Schürfland App: Offline-Speicher
// Seite: erst Netz (damit Updates sofort ankommen), sonst Kopie aus dem Speicher.
// Schriften, Icons usw.: erst Speicher, sonst Netz.
const VERSION = '__VERSION__';
const CACHE = 'schuerfland-' + VERSION;
const ASSETS = __ASSETS__;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('schuerfland-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function withTimeout(p, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(r => { clearTimeout(t); resolve(r); }, err => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Eigene Unterseite "Düsenduell" (/duell/): nicht anfassen, direkt ins Netz bzw. zum eigenen Service Worker
  if (url.pathname.startsWith(new URL('./duell', self.registration.scope).pathname)) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      withTimeout(fetch(req), 4000)
        .then(res => {
          if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); }
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
