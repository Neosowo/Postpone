const CACHE_NAME = 'postpone-v2';

const STATIC_ASSETS = [
    './',
    './index.html',
    './about.html',
    './contact.html',
    './metodo.html',
    './ciencia.html',
    './tecnicas.html',
    './faq.html',
    './privacy.html',
    './terms.html',
    './styles.css',
    './script.js',
    './animations.js',
    './manifest.json',
    './img/favicon.png',
    './img/qr.png',
];

const EXTERNAL_ASSETS = [
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,700;0,900;1,400&family=JetBrains+Mono:wght@700&display=swap',
    'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// Dominios de publicidad que NUNCA deben ser cacheados
const AD_DOMAINS = [
    'pagead2.googlesyndication.com',
    'googleads.g.doubleclick.net',
    'adservice.google.com',
    'tpc.googlesyndication.com',
    'partner.googleadservices.com',
];

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET') return;

    // Dejar pasar los anuncios sin interceptar
    if (AD_DOMAINS.some((domain) => url.hostname.includes(domain))) return;

    const isLocal = url.origin === self.location.origin;
    const isExternal = EXTERNAL_ASSETS.some((ext) => request.url.startsWith(ext));

    if (isLocal || isExternal) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;

                return fetch(request)
                    .then((response) => {
                        if (!response || response.status !== 200) return response;
                        const toCache = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, toCache));
                        return response;
                    })
                    .catch(() => {
                        if (request.destination === 'document') {
                            return caches.match('./index.html');
                        }
                    });
            })
        );
    }
});
