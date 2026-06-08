const CACHE_NAME = 'firecheck-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './favicon.svg',
  './favicon-16x16.png',
  './favicon-32x32.png',
  './favicon-48x48.png',
  './favicon-64x64.png',
  './favicon-72x72.png',
  './favicon-96x96.png',
  './favicon-128x128.png',
  './favicon-144x144.png',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-384.png',
  './icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (e) => {
  if (e.request.mode === 'navigation') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) {
        fetch(e.request).then((res) => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, res));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(e.request).catch(() => caches.match('./index.html'));
    })
  );
});
