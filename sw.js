/* ============================================================
  ⚙️ Service Worker — تطبيق شبكة أبو إسماعيل (v2)

  السياسة المعتمدة:
  - 🧭 طلبات التنقل (index.html + أي صفحة HTML): network-first
    → الشبكة هي الأساس: أي تحديث يوصلك فورًا عند كل فتح.
    ولو الجهاز أوفلاين → نسخة الكاش تخدم كبديل (التطبيق المثبّت
    بيفتح حتى بدون نت ويعرض رسالة «اتصل بالشبكة أولًا»).
  - 🎨 الأيقونات فقط (png/svg/ico): cache-first → تظهر فورًا
    من الجهاز بدون طلب شبكة، وتتحدث من الشبكة عند غيابها.
  - ⛔ أي شيء آخر (CSS/JS خارجية، خطوط، manifest، API):
    شبكة مباشرة بدون كاش وبدون تدخل.
  - 🚫 لا يلمس أبدًا صفحات الهوتسبوت (10.0.0.1) ولا الـ API —
    لأنها تحمل بيانات المستخدم (الرصيد، IP، الجلسة).

  ملاحظة مهمة: المتصفحات تشغّل الـ Service Worker على اتصال
  HTTPS فقط (أو localhost). نسخة sw.js الموجودة على الراوتر
  (شبكة HTTP) لا تُفعَّل أبدًا — تسجيلها محمي بشرط isSecureContext.

  عند تحديث أي ملف ثابت: غيّر رقم الإصدار في CACHE_NAME بالأسفل
  (v2 → v3) فيتحدث الكاش تلقائيًا عند كل الزبائن.
============================================================ */
var CACHE_NAME = 'abu-ismael-app-v2';

/* الأساسيات: واجهة التطبيق + الأيقونات + المانيفست — تُخزّن فور التثبيت
   (index.html أساسية عشان التطبيق يفتح أوفلاين ويعرض رسالة الاتصال) */
var PRECACHE = [
  './index.html',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

/* 1) التثبيت: خزّن الأساسيات + فعّل النسخة الجديدة فورًا */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(PRECACHE); })
      .then(function () { return self.skipWaiting(); })
  );
});

/* 2) التفعيل: احذف أي كاش قديم من إصدارات سابقة */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

function isIcon(url) {
  return /\.(png|svg|ico)(\?|$)/i.test(url.pathname);
}

function isNavigation(req, url) {
  return req.mode === 'navigate' ||
         url.pathname === '/' ||
         /\.html?(\?|$)/i.test(url.pathname);
}

/* 🧭 network-first: الشبكة أولًا (التحديثات فورًا)، والكاش بديل عند الفشل */
function networkFirst(req) {
  return fetch(req).then(function (res) {
    if (res && res.ok) {
      var copy = res.clone();
      caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (hit) {
      if (hit) return hit;
      /* بديل أخير: لو فُتح '/' ومسجلة index.html تحت مسارها الصريح */
      return caches.match('./index.html');
    });
  });
}

/* 🎨 cache-first: الكاش أولًا (سرعة قصوى)، والشبكة عند غياب النسخة */
function cacheFirst(req) {
  return caches.match(req).then(function (hit) {
    if (hit) return hit;
    return fetch(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
      }
      return res;
    });
  });
}

/* 3) الطلبات: السياسة الذكية */
self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  /* 🚫 أي طلب خارج نطاق التطبيق (10.0.0.1، CDN خارجي، API) →
     شبكة مباشرة بدون تدخل */
  if (url.origin !== location.origin) return;

  if (isNavigation(req, url)) { event.respondWith(networkFirst(req)); return; }
  if (isIcon(url)) { event.respondWith(cacheFirst(req)); return; }

  /* الباقي (manifest.json وغيره): شبكة مباشرة بدون كاش */
});
