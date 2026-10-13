// Service worker «Периоды родов».
// Файл собирается плагином sw-plugin.ts: версия сборки и список файлов
// подставляются при `vite build`. Стратегия: cache-first, всё приложение
// предзагружается при установке, после этого сеть не нужна.

const CACHE_PREFIX = 'rody-';
const CACHE = 'rody-v1-__BUILD__';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit =
        (await cache.match(req, { ignoreSearch: true })) ||
        (req.mode === 'navigate' ? await cache.match('./index.html') : undefined);
      return hit || fetch(req);
    }),
  );
});
