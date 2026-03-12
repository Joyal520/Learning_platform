const CACHE_NAME = 'edtechra-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/css/styles.css',
  '/assets/css/explore_recovered.css',
  '/assets/images/dc8e6aed-ed39-4e4c-9412-c66626efcd6c.png'
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
  // Only handle GET requests
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  // Exclude API/Supabase requests from standard caching entirely
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
