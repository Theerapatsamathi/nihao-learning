const CACHE_NAME = 'nihao-cache-v25';
const AUDIO_CACHE = 'nihao-audio-v1';
const META_CACHE = 'nihao-meta-v1';
const PRESERVED_CACHES = new Set([CACHE_NAME, AUDIO_CACHE, META_CACHE]);

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
      .then((keys) => Promise.all(
        keys.filter((k) => !PRESERVED_CACHES.has(k)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (data.type === 'SYNC_REMINDER_STATE') {
    event.waitUntil(
      caches.open(META_CACHE).then((cache) => {
        const res = new Response(JSON.stringify({
          enabled: Boolean(data.enabled),
          times: Array.isArray(data.times) ? data.times : [],
          todayKey: String(data.todayKey || ''),
          studiedToday: Boolean(data.studiedToday),
          updatedAt: Date.now()
        }), { headers: { 'Content-Type': 'application/json' } });
        return cache.put('/__nihao_reminder_state__', res);
      }).catch(() => {})
    );
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag !== 'nihao-reminder') return;
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(META_CACHE);
      const res = await cache.match('/__nihao_reminder_state__');
      if (!res) return;
      const state = await res.json();
      if (!state.enabled) return;

      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      if (state.studiedToday && state.todayKey === todayKey) return;

      await self.registration.showNotification('你好 Nihao · ถึงเวลาฝึกภาษาจีนแล้ว!', {
        body: 'มาทบทวนคำศัพท์หรือทำแผนเรียนวันนี้ 5–10 นาที เพื่อรักษา Streak ของคุณ',
        icon: '/icon.svg',
        badge: '/icon.svg',
        tag: 'nihao-study-reminder',
        renotify: true,
        data: { url: '/' }
      });
    } catch {
      // ignore background sync notification errors
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  // Never cache /api/* except opt-in pre-fetched TTS audio stored in AUDIO_CACHE
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) {
    if (url.pathname === '/api/tts') {
      event.respondWith(
        caches.open(AUDIO_CACHE)
          .then((cache) => cache.match(event.request))
          .then((cached) => cached || fetch(event.request))
      );
    }
    return;
  }

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

  // Network-first with cache fallback for HTML & data packs (including lazy lexicon.js)
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
