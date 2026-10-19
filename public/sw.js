const CACHE = "thien-thien-shell-3";
const SHELL = [
  "/offline.html",
  "/manifest.webmanifest",
  "/brand/icon-192.png",
  "/brand/icon-512.png",
  "/brand/icon-maskable-192.png",
  "/brand/icon-maskable-512.png",
  "/brand/apple-touch-icon.png",
  "/favicon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/admin";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const open = clients.find((client) => "focus" in client);
      if (open && "navigate" in open) {
        return open.navigate(url).then((client) => client?.focus());
      }
      return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode !== "navigate") return;
  event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
});
