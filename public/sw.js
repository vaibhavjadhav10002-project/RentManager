const STATIC_CACHE = 'pg-manager-static-v2'
// Only truly static, unchanging assets are cached — never pages or API
// responses. This app shows live rent/payment data; caching that would
// risk showing stale financial numbers, so every navigation and data
// request always goes to the network — EXCEPT when there's no network at
// all, in which case navigations fall back to the offline page below.
const STATIC_ASSETS = ['/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png', '/offline.html']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    )
    return
  }
  if (event.request.mode === 'navigate') {
    // Still network-first for every page — this only kicks in when the network
    // request itself fails outright (i.e. actually offline), not on slow requests
    // or app-level errors, so live data is never served stale.
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/offline.html'))
    )
  }
  // Everything else (API, Supabase calls) — always network, never cached.
})

// ─── Push notifications ────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'PG Manager', body: event.data.text() }
  }

  const { title = 'PG Manager', body = '', url = '/', tag } = payload

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url },
      tag: tag || undefined,
      renotify: !!tag,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const clientUrl = new URL(client.url)
        if (clientUrl.origin === self.location.origin && 'focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})

// ─── Subscription rotation ──────────────────────────────────────────────────
// Browsers occasionally invalidate a push subscription on their own (key
// rotation, expiry) and fire this event so the app gets a chance to silently
// resubscribe. Without handling it, a user who'd already enabled notifications
// would just stop receiving them with no visible error anywhere.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const oldEndpoint = event.oldSubscription?.endpoint
        const res = await fetch('/api/push/vapid-public-key')
        const { key } = await res.json()
        if (!key) return

        const newSubscription = event.newSubscription || await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        })
        const json = newSubscription.toJSON()

        await fetch('/api/push/resubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            old_endpoint: oldEndpoint, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth_key: json.keys.auth,
          }),
        })
      } catch {
        // Best-effort — if this fails, the user falls back to re-enabling
        // notifications manually next time they see the banner/settings toggle.
      }
    })()
  )
})
