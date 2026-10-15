const CACHE_NAME = 'mensuales-cache-v3';
const urlsToCache = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./changui.js",
  "./changui.css",
  "./changui-extra.css",
  "./pocki.js",
  "./pocki.css",
  "./pasar-a-changui.js",
  "./manifest.json",
  "./icono.png"
];

// Instalación segura (si falta algún archivo, se omite y no se rompe)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for (const url of urlsToCache) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn('Archivo omitido en caché:', url);
        }
      }
    })
  );
  self.skipWaiting();
});

// Activación y limpieza de versiones viejas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => (key !== CACHE_NAME ? caches.delete(key) : null)))
    )
  );
  self.clients.claim();
});

// Primero internet (así siempre ves la última versión); si no hay conexión, usa lo guardado
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Firebase, CDN, etc. van directo

  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
