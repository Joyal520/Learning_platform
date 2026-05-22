const CACHE_NAME = 'edtechra-v7';
try {
  importScripts('./firebase-messaging-sw.js');
} catch (error) {
  console.warn('[ServiceWorker] Firebase messaging worker unavailable:', error);
}

const APP_BASE_PATH = (() => {
  const pathname = self.location.pathname || '/sw.js';
  const lastSlash = pathname.lastIndexOf('/');
  return lastSlash >= 0 ? pathname.slice(0, lastSlash + 1) : '/';
})();
const withBase = (path = '') => {
  const normalized = String(path || '').replace(/^\/+/, '');
  return `${APP_BASE_PATH}${normalized}`.replace(/\/{2,}/g, '/');
};
const ASSETS_TO_CACHE = [
  withBase(''),
  withBase('index.html'),
  withBase('manifest.json'),
  withBase('assets/css/styles.css'),
  withBase('assets/css/explore_recovered.css'),
  withBase('icons/icon-192.png'),
  withBase('icons/icon-512.png'),
  withBase('public/favicon.ico?v=6'),
  withBase('public/favicon-32x32.png?v=6'),
  withBase('public/favicon-16x16.png?v=6'),
  withBase('public/icons/apple-touch-icon.png?v=6')
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const apiPrefix = withBase('api/');
  if (url.origin === self.location.origin && url.pathname.startsWith(apiPrefix)) {
    return;
  }

  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Exclude Supabase requests from caching and SPA fallbacks entirely.
  if (url.hostname.includes('supabase.co')) return;

  const isVersionedImageRequest = event.request.destination === 'image'
    && (url.searchParams.has('v') || url.searchParams.has('cacheBust'));

  if (isVersionedImageRequest) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  event.respondWith(
    // Network-first strategy for dynamic/updatable files
    fetch(event.request).then((networkResponse) => {
      // Don't cache if not a valid response or if it's an opaque response (like from a different origin unless handled)
      if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
        return networkResponse;
      }
      return caches.open(CACHE_NAME).then((cache) => {
        // Cache the updated version
        cache.put(event.request, networkResponse.clone());
        return networkResponse;
      });
    }).catch(() => {
      // If network fails (offline), try to serve from cache
      return caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        // If it's a navigation request and not in cache, fallback to index.html
        if (event.request.mode === 'navigate') {
          return caches.match(withBase('index.html'));
        }
      });
    })
  );
});
