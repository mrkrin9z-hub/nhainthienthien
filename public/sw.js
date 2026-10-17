const CACHE = "thien-thien-shell-1";
const SHELL = ["/offline.html", "/manifest.webmanifest", "/brand/icon-192.png", "/brand/icon-512.png", "/brand/apple-touch-icon.png", "/favicon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
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
