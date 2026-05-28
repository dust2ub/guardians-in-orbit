// sw.js — place this file in your project root (same level as index.html)
// Caches large assets (audio, ship images) so they're only downloaded once.

const CACHE_NAME = 'orbit-assets-v1'

// Assets to pre-cache on install
const PRECACHE_URLS = [
  '/assets/lullaby.mp3',
  '/assets/orbit.mp3',
  '/assets/earth.jpg',
  '/assets/ship-0.png',
  '/assets/ship-1.png',
  '/assets/ship-2.png',
  '/assets/ship-3.png',
  '/assets/ship-4.png',
  '/assets/ship-5.png',
  '/assets/ship-6.png',
]

// ── Install: pre-cache all listed assets ──────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache each asset individually so one failure doesn't block the rest
      return Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err =>
            console.warn(`[SW] Failed to pre-cache ${url}:`, err)
          )
        )
      )
    }).then(() => self.skipWaiting())
  )
})

// ── Activate: delete old caches ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

// ── Fetch: cache-first for assets, network-first for everything else ──────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Only intercept same-origin GET requests for /assets/
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith('/assets/')
  ) {
    return
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(event.request)
      if (cached) return cached

      // Not in cache yet — fetch, store, and return
      try {
        const response = await fetch(event.request)
        if (response.ok) {
          cache.put(event.request, response.clone())
        }
        return response
      } catch (err) {
        console.warn('[SW] Fetch failed for', url.pathname, err)
        throw err
      }
    })
  )
})