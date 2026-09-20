const CACHE_NAME = 'digitalflora-v3';
const ASSETS_TO_CACHE = [
  '/manifest.json',
  '/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // No self.skipWaiting() here: a new SW stays in "waiting" until the page
  // explicitly asks it to take over (SKIP_WAITING message below), so users
  // get an update prompt instead of being force-reloaded mid-session.
});

// Lets the page opt a waiting SW into activating immediately, once the
// visitor has clicked the "new version available" reload prompt.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // CRITICAL: Never intercept cross-origin requests (for example Google APIs or other external services).
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Do not intercept API requests or non-GET requests
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  // Network-first for navigations/HTML: users always get the latest
  // index.html when online, so a deployed fix or content change shows up
  // on next load instead of being stuck behind a stale cached shell.
  // Cache-first stays for static assets below (fine to serve stale-then-
  // revalidate for those; they're versioned by CACHE_NAME).
  const isNavigation = event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html');
  if (isNavigation) {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.url.match(/\.(png|jpg|jpeg|svg|css|js)$/i)) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/');
        }
      });
    })
  );
});
