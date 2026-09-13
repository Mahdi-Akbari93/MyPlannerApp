const CACHE_NAME = 'dlp-shell-v1';
const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// فایل‌های خودِ برنامه: اول از کش (باز شدن آنی)، بعد شبکه برای آپدیت
// درخواست‌های بیرونی (فایربیس، فونت، chart.js): مستقیم از شبکه، دست نمی‌زنیم
self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);
    const isAppShell = url.origin === self.location.origin;

    if (isAppShell) {
        event.respondWith(
            caches.match(req).then((cached) => cached || fetch(req))
        );
    }
});

// کلیک روی نوتیفیکیشن: باز کردن یا فوکوس کردن برنامه
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            if (clientList.length > 0) return clientList[0].focus();
            return clients.openWindow('./index.html');
        })
    );
});
