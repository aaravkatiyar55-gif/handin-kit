const CACHE = 'handin-kit-v2';
const ASSETS = ['./', './index.html', './styles.css', './icon.svg', './manifest.webmanifest', './src/app.js', './src/core.js', './src/images.js', './src/zip.js'];
const urls = new Set(ASSETS.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([...urls])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('handin-kit-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !urls.has(event.request.url)) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
