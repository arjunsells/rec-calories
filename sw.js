'use strict';
const CACHE = 'rec-calories-shell-v5b';
const SHELL = ['./', './index.html', './style.css', './theme.css', './sprites.js', './charts.js', './app.js', './game.js', './plan-data.js', './quest.js', './fonts/press-start-2p.ttf', './fonts/OFL.txt', './scan.js', './food.js', './vendor/zxing-browser.min.js', './vendor/ZXING-LICENSE', './vendor/README.md', './manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('rec-calories-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    if (event.request.mode === 'navigate') {
      try { const response = await fetch(event.request); if (response.ok) return response; } catch { /* Offline shell below. */ }
      return cache.match('./index.html');
    }
    return (await cache.match(event.request)) || fetch(event.request);
  }));
});
