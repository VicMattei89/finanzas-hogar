// Service Worker - Gestor Finanzas del Hogar PWA
// Versión 4.0.0 - Almacenamiento 100% Local + Gráficos

const CACHE_NAME = 'finanzas-hogar-v4';

const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/app.js',
    '/sw.js'
];

const EXTERNAL_RESOURCES = [
    'https://cdn.jsdelivr.net/npm/chart.js'
];

// Instalar Service Worker
self.addEventListener('install', event => {
    console.log('🔧 Service Worker: Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('✅ Cache abierto:', CACHE_NAME);
            return cache.addAll(ASSETS_TO_CACHE).catch(err => {
                console.log('⚠️ Algunos archivos no pudieron cachearse (esperado en desarrollo)');
                return Promise.resolve();
            });
        })
    );
    self.skipWaiting();
});

// Activar Service Worker
self.addEventListener('activate', event => {
    console.log('🚀 Service Worker: Activando...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Eliminando cache antiguo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Interceptar requests
self.addEventListener('fetch', event => {
    // Solo procesar GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    const url = new URL(event.request.url);

    // Estrategia de cache para assets locales
    if (url.origin === location.origin) {
        event.respondWith(
            caches.match(event.request).then(response => {
                if (response) {
                    return response;
                }

                return fetch(event.request).then(response => {
                    if (!response || response.status !== 200 || response.type === 'error') {
                        return response;
                    }

                    const clonedResponse = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clonedResponse);
                    });
                    return response;
                }).catch(() => {
                    return caches.match(event.request).then(response => {
                        if (response) {
                            return response;
                        }
                        return caches.match('/index.html');
                    });
                });
            })
        );
    } else {
        // Estrategia para recursos externos (CDN)
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (!response || response.status !== 200) {
                        return response;
                    }

                    const clonedResponse = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clonedResponse);
                    });
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request);
                })
        );
    }
});

// Escuchar mensajes desde la app
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

console.log('✅ Service Worker v4.0.0 registrado correctamente');