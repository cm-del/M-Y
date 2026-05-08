const CACHE = 'ay-v1';
const ASSETS = [
    '/','index.html','offline.html','css/style.css','css/print.css',
    'js/utils.js','js/db.js','js/weather.js','js/analytics.js','js/charts.js',
    'js/export.js','js/modals.js','js/ui.js','js/app.js','js/sw-register.js','js/notifications.js',
    'https://unpkg.com/dexie@3.2.4/dist/dexie.min.js','https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js',
    'https://cdn.jsdelivr.net/npm/toastify-js','https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x!==CACHE).map(x => caches.delete(x)))).then(() => clients.claim())); });
self.addEventListener('fetch', e => { e.respondWith(caches.match(e.request).then(c => c || fetch(e.request).catch(() => e.request.mode==='navigate' ? caches.match('offline.html') : new Response(null,{status:408}))))); });
