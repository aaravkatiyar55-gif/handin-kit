const CACHE = 'handin-kit-v5';
const ASSETS = ['./', './index.html', './styles.css', './icon.svg', './manifest.webmanifest', './src/app.js', './src/core.js', './src/images.js', './src/zip.js', './src/recipes.js', './src/workbench.js'];
const urls = new Set(ASSETS.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([...urls])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('handin-kit-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  // The documented source server must show fresh edits, rather than cached releases.
  if (self.location.hostname === '127.0.0.1' && self.location.port === '4190') return;
  const requested = new URL(event.request.url);
  // A navigation fragment such as #marketplace is not a different app asset.
  requested.hash = '';
  if (event.request.method !== 'GET' || !urls.has(requested.href)) return;
  event.respondWith(caches.match(requested.href).then(cached => cached || fetch(event.request)));
});
