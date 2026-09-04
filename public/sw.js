// Service Worker — Invoicing PWA
// v2: HTML nunca é servido de cache (páginas autenticadas são sempre frescas).
//     A cache serve apenas estáticos + a página offline como recurso sem rede.
const CACHE = 'invoicing-v2';
const OFFLINE_URL = '/offline.html';

const PRECACHE = [
  '/offline.html',
  '/manifest.json',
  '/assets/css/sb-admin-2.min.css',
  '/assets/css/custom.css',
  '/assets/js/sb-admin-2.min.js',
  '/assets/vendor/jquery/jquery.min.js',
  '/assets/vendor/bootstrap/js/bootstrap.bundle.min.js',
  '/assets/vendor/fontawesome-free/css/all.min.css',
  '/images/invoicing-logo-simple.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Nunca interceptar APIs (o app gere offline via IndexedDB).
  if (url.pathname.startsWith('/api/')) return;

  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  // HTML (páginas): SEMPRE rede. Nunca cacheado nem servido de cache —
  // evita servir dashboards/estados antigos. Sem rede → página offline.
  if (isHTML) {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Estáticos: cache-first, com revalidação em segundo plano.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
