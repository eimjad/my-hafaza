/**
 * Hafaza - Service Worker
 * Uses network-first for HTML/JS/CSS (app shell) to avoid stale cache issues
 * Cache-first for data files (quran JSON) since they rarely change
 */

const CACHE_VERSION = 2;
const APP_CACHE = `hafaza-app-v${CACHE_VERSION}`;
const DATA_CACHE = `hafaza-data-v${CACHE_VERSION}`;

const APP_ASSETS = [
  '/',
  '/index.html',
  '/css/app.css',
  '/js/db.js',
  '/js/quran.js',
  '/js/memorization.js',
  '/js/voice.js',
  '/js/app.js',
  '/manifest.json'
];

const DATA_ASSETS = [
  '/data/surahs.json',
  '/data/quran-full.json',
  '/data/search-index.json'
];

// Install: cache all assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(APP_CACHE).then(cache => {
        console.log('[SW] Caching app assets');
        return cache.addAll(APP_ASSETS);
      }),
      caches.open(DATA_CACHE).then(cache => {
        console.log('[SW] Caching data assets');
        return cache.addAll(DATA_ASSETS);
      })
    ])
  );
  // Force activate immediately - don't wait for old SW to die
  self.skipWaiting();
});

// Activate: clean old caches and take control immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== APP_CACHE && key !== DATA_CACHE && !key.startsWith('hafaza-models'))
          .map(key => {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => {
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // CDN requests (model downloads): network first, cache fallback
  if (url.hostname.includes('huggingface.co') || url.hostname.includes('cdn.jsdelivr.net')) {
    event.respondWith(
      caches.open('hafaza-models').then(cache => {
        return fetch(event.request).then(response => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        }).catch(() => cache.match(event.request));
      })
    );
    return;
  }

  // Same-origin only
  if (url.origin !== self.location.origin) return;

  // Data files: cache first, network fallback (data rarely changes)
  if (url.pathname.startsWith('/data/')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(DATA_CACHE).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // App shell (HTML/JS/CSS): network first, cache fallback
  // This ensures users always get the latest version without hard reload
  event.respondWith(
    fetch(event.request).then(response => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(APP_CACHE).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => {
      return caches.match(event.request).then(cached => {
        if (cached) return cached;
        // Fallback to index for navigation requests
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
