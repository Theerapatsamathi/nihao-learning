const CACHE_NAME = 'nihao-cache-v19';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/vendor/hanzi-writer.min.js',
  '/data/level1-data.js',
  '/data/pinyin-chart-data.js',
  '/data/writing-speaking-data.js',
  '/data/daily-plan-data.js',
  '/data/engagement-data.js',
  '/data/level2-hsk1-data.js',
  '/data/pro-pack-data.js',
  '/data/fun-pack-data.js'
];

// Trusted external origins to cache for offline character strokes
const CACHEABLE_EXTERNAL_ORIGINS = new Set([
  'https://cdn.jsdelivr.net',
  'https://esm.sh'
]);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) return;

  const isSameOrigin = url.origin === self.location.origin;
  const isCacheableExternal = CACHEABLE_EXTERNAL_ORIGINS.has(url.origin);
  if (!isSameOrigin && !isCacheableExternal) return;

  // Cache-first for immutable Vite hashed bundles, vendored libs, and stroke JSONs
  if (
    (isSameOrigin && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/vendor/'))) ||
    (isCacheableExternal && url.hostname === 'cdn.jsdelivr.net')
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  // Network-first with cache fallback for HTML & data packs
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
