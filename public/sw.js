const CACHE_NAME = 'hico-esim-v5'; // BrowserRouter and pre-rendered pages require a fresh shell.
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.svg'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Force bypass of browser HTTP cache to fetch fresh versions
      const cleanRequests = ASSETS_TO_CACHE.map(url => new Request(url, { cache: 'reload' }));
      return cache.addAll(cleanRequests);
    })
  );
  self.skipWaiting(); // Force active immediately
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith(self.location.origin)) return;

  const url = new URL(event.request.url);

  // Exclude API requests from service worker caching
  if (url.pathname.startsWith('/api/')) return;

  // 1. Network-First Strategy for HTML/Page Navigations (prevents old index.html cache lock)
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Update the cached index.html with the latest version from network
          if (networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // 2. Cache-First or Stale-While-Revalidate for static assets (.js, .css, images)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache for next time, but do not block
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {/* Ignore network errors offline */});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});
