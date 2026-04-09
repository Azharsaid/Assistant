
self.addEventListener("install", event => {
  event.waitUntil(caches.open("life-os-v2").then(cache => cache.addAll([
    "./","./index.html","./styles.css","./app.js","./firebase-config.js","./manifest.webmanifest"
  ])));
  self.skipWaiting();
});
self.addEventListener("fetch", event => {
  event.respondWith(caches.match(event.request).then(r => r || fetch(event.request)));
});
