const CACHE_NAME = 'zoryanyi-klas-v6';
const ASSETS = [
  './',
  './index.html',
  './teacher/index.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './styles/base.css',
  './styles/tokens.css',
  './vendor/jsQR.min.js',
  './vendor/qrcode.min.js',
  './src/app.js',
  './src/teacher.js',
  './src/components/genshin-icons.js',
  './src/components/star-icon.js',
  './src/data/firebase.js',
  './src/data/firebase-config.js',
  './src/data/repo.js',
  './src/data/tx.js',
  './src/data/names-db.js',
  './src/data/default-config.js',
  './src/data/export.js',
  './src/engine/time.js',
  './src/engine/economy.js',
  './src/engine/helpers.js',
  './src/engine/qr-protocol.js',
  './src/engine/quests.js',
  './src/engine/redeem.js',
  './src/engine/undo.js',
  './src/engine/utils.js',
  './src/i18n/uk.js',
  './src/student/app.js',
  './src/student/home.js',
  './src/student/qr.js',
  './src/student/shop.js',
  './src/student/quests.js',
  './src/student/history.js',
  './src/ui/app.js',
  './src/ui/auth.js',
  './src/ui/scanner.js',
  './src/ui/student-panel.js',
  './src/ui/student-list.js',
  './src/ui/admin.js',
  './src/ui/budget.js',
  './src/ui/ops.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of ASSETS) {
        try {
          await cache.add(asset);
        } catch (e) {
          console.warn('Failed to cache asset:', asset, e);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Never intercept Firestore API calls & Google Auth
  if (event.request.url.includes('firestore.googleapis.com') || 
      event.request.url.includes('identitytoolkit.googleapis.com') ||
      event.request.url.includes('gstatic.com')) {
    return;
  }

  // Network-first strategy: always fetch fresh from network, fallback to cache if offline
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
