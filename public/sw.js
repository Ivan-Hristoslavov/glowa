/**
 * GLOWA service worker.
 *
 * Two jobs, deliberately no more:
 *
 *   1. Receive push notifications, so a salon owner's phone buzzes when a
 *      booking lands without an app store being involved.
 *   2. Serve a readable page when the network is gone, instead of the
 *      browser's dinosaur.
 *
 * What it does NOT do is cache the application shell or API responses. A
 * booking calendar that quietly serves yesterday's data is worse than one that
 * says it is offline: the whole product is about which minutes are actually
 * free right now.
 */

const VERSION = "glowa-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icon-192.png"]))
      // Take over without waiting for every tab to close: a stale worker
      // holding an old offline page helps nobody.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

/**
 * Network only, with the offline page as the fallback for navigations.
 * Anything else that fails simply fails, which is the honest answer.
 */
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(VERSION);
      return (await cache.match(OFFLINE_URL)) ?? Response.error();
    }),
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "GLOWA", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "GLOWA", {
      body: payload.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      lang: payload.locale ?? "bg",
      // Collapses repeats of the same event rather than stacking them.
      tag: payload.tag,
      renotify: Boolean(payload.tag),
      data: { url: payload.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        // Reuse a tab that is already on GLOWA instead of piling up new ones.
        for (const client of windows) {
          if (client.url.includes(new URL(target, self.location.origin).pathname)) {
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
