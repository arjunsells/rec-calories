'use strict';
// Bump CACHE with every release: a changed worker is what tells installed copies to update.
const CACHE = 'rec-calories-shell-v12e';
const SHELL = ['./', './index.html', './theme12.css', './icons8.js', './motion8.js', './charts8.js', './game10.js', './scan9.js', './scan12.js', './food9.js', './plan11.js', './train10.js', './quest12.js', './gym11.js', './builder11.js', './ux12.js', './app12.js', './fonts/press-start-2p.ttf', './fonts/OFL.txt', './vendor/zxing-browser.min.js', './vendor/ZXING-LICENSE', './vendor/README.md', './manifest.webmanifest', './icons/icon.svg', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/mark.svg'];
self.addEventListener('install', event => {
  // cache: 'reload' skips the HTTP cache, so a new shell can never be assembled from stale files.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL.map(url => new Request(url, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('rec-calories-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('message', event => {
  if (event.data === 'version') event.ports[0]?.postMessage(CACHE);
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    // The page and its assets always come from the same cache generation: instant launch, works offline,
    // and never a new page running old scripts. app12.js reloads once when a newer shell takes over.
    if (event.request.mode === 'navigate') return (await cache.match('./index.html')) || fetch(event.request);
    return (await cache.match(event.request, { ignoreSearch: true })) || fetch(event.request);
  }));
});
