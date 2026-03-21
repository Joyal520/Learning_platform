const FRONTEND_ASSET_VERSION = '11';
const CACHE_NAME = `edtechra-v${FRONTEND_ASSET_VERSION}`;
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json?v=3',
  `/assets/css/styles.css?v=${FRONTEND_ASSET_VERSION}`,
  `/assets/css/explore_recovered.css?v=${FRONTEND_ASSET_VERSION}`,
  `/assets/js/supabase.js?v=${FRONTEND_ASSET_VERSION}`,
  `/assets/js/ui.js?v=${FRONTEND_ASSET_VERSION}`,
  `/assets/js/auth.js?v=${FRONTEND_ASSET_VERSION}`,
  `/assets/js/api.js?v=${FRONTEND_ASSET_VERSION}`,
  `/assets/js/app.js?v=${FRONTEND_ASSET_VERSION}`,
  `/pages/my-uploads.js?v=${FRONTEND_ASSET_VERSION}`,
  `/pages/explore.js?v=${FRONTEND_ASSET_VERSION}`,
  `/pages/detail.js?v=${FRONTEND_ASSET_VERSION}`,
  `/pages/dashboard.js?v=${FRONTEND_ASSET_VERSION}`,
  `/pages/student-dashboard.js?v=${FRONTEND_ASSET_VERSION}`,
  `/pages/upload.js?v=${FRONTEND_ASSET_VERSION}`,
  `/assets/js/audio-player.js?v=${FRONTEND_ASSET_VERSION}`,
  `/assets/js/image-utils.js?v=${FRONTEND_ASSET_VERSION}`,
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/public/favicon.ico?v=3',
  '/public/favicon-32x32.png?v=3',
  '/public/favicon-16x16.png?v=3',
  '/public/icons/apple-touch-icon.png?v=3'
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
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    return;
  }

  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Exclude Supabase requests from caching and SPA fallbacks entirely.
  if (url.hostname.includes('supabase.co')) return;

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
          return caches.match('/index.html');
        }
      });
    })
  );
});
