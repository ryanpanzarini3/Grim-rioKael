const CACHE_NAME = 'grimorio-kael-v1';
const ASSETS_TO_CACHE = [
    '/index.html',
    '/script.js',
    '/style.css',
    '/manifest.json',
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/feather-icons/dist/feather.min.js'
];

// Instala o service worker e faz cache dos assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE).catch(err => {
                // Se algum arquivo falhar, continua mesmo assim
                console.warn('Alguns assets não puderam ser cacheados', err);
                return cache.addAll([
                    '/index.html',
                    '/script.js',
                    '/style.css',
                    '/manifest.json'
                ]);
            });
        })
    );
    self.skipWaiting();
});

// Ativa o service worker e limpa caches antigos
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Estratégia Network First com fallback para Cache
self.addEventListener('fetch', (event) => {
    // Ignora requisições de API externas que não conseguimos fazer cache
    if (event.request.url.includes('cdn.tailwindcss') || 
        event.request.url.includes('feather-icons')) {
        event.respondWith(
            fetch(event.request).catch(() => {
                return new Response('Offline - CDN não disponível', {
                    status: 503,
                    statusText: 'Service Unavailable'
                });
            })
        );
        return;
    }

    // Network first para documentos
    if (event.request.headers.get('Accept')?.includes('text/html')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const clonedResponse = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, clonedResponse);
                    });
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Cache first para outros assets
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                return fetch(event.request).then((response) => {
                    const clonedResponse = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, clonedResponse);
                    });
                    return response;
                });
            })
            .catch(() => {
                return new Response('Offline - Asset não disponível', {
                    status: 503,
                    statusText: 'Service Unavailable'
                });
            })
    );
});
