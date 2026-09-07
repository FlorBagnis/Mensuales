const CACHE_NAME = 'mensuales-cache-v1';
const urlsToCache = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icono.png"
];

// Instalación segura del Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for (const url of urlsToCache) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn('No se pudo guardar en caché el archivo:', url, err);
        }
      }
    })
  );
  self.skipWaiting();
});

// Activación y limpieza de cachés antiguas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clientsClaim();
});

// Interceptar peticiones para que funcione offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    }).catch(() => {
      // Si falla la red y no está en caché, puedes retornar una página offline si lo deseas
    })
  );
});
