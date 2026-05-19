/**
 * Hafaza - Service Worker
 * Caches all app assets for fully offline operation
 */

const CACHE_NAME = 'hafaza-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './js/db.js',
  './js/quran.js',
  './js/memorization.js',
  './js/voice.js',
  './js/app.js',
  './data/surahs.json',
  './data/quran-full.json',
  './manifest.json'
];

// Install: cache all static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: serve from cache first, then network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip CDN requests (Transformers.js model downloads)
  const url = new URL(event.request.url);
  if (url.hostname.includes('huggingface.co') || url.hostname.includes('cdn.jsdelivr.net')) {
    // For model files, try network first, then cache
    event.respondWith(
      caches.open('hafaza-models').then(cache => {
        return cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          });
        });
      })
    );
    return;
  }

  // For app assets: cache first, then network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        // Cache successful responses for app assets
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback
      if (event.request.destination === 'document') {
        return caches.match('./index.html');
      }
    })
  );
});
