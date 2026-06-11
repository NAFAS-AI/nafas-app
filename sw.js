const CACHE_NAME = 'nafas-v5.1';
const PRECACHE = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/manifest.json'
];

// === INSTALL: حفظ الملفات الأساسية + تفعيل فوري ===
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// === ACTIVATE: حذف كل الكاش القديم + السيطرة فوراً ===
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
     .then(() => {
       // إشعار كل النوافذ المفتوحة بالتحديث
       return self.clients.matchAll({ type: 'window' }).then(clients => {
         clients.forEach(client => client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME }));
       });
     })
  );
});

// === FETCH: Network-First للـ HTML/CSS/JS — التحديث يوصل دايماً ===
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // API calls — شبكة فقط، بلا كاش
  if (e.request.url.includes('supabase.co') || e.request.url.includes('googleapis.com') || e.request.url.includes('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), { headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }

  // HTML/CSS/JS — Network-First: حاول الشبكة أولاً، الكاش كـ fallback
  e.respondWith(
    fetch(e.request).then(resp => {
      if (resp.ok) {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      }
      return resp;
    }).catch(() =>
      caches.match(e.request).then(r =>
        r || (e.request.mode === 'navigate' ? caches.match('/') : new Response('', { status: 503 }))
      )
    )
  );
});

// === MESSAGE: السماح بتحديث يدوي من التطبيق ===
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
