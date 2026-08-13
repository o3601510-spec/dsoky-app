/* ============================================================
  ⚙️ Service Worker — شبكة Abu Ismael

  وظيفته:
  - يخزّن الملفات الثابتة (CSS / JS / أيقونات / خطوط) على جهاز
    الزبون، فالصفحة تفتح أسرع في الزيارات التالية.
  - 🚫 لا يلمس أبدًا صفحات الهوتسبوت الديناميكية (status/login)
    ولا طلبات الـ API — لأنها تحمل بيانات المستخدم (الرصيد، IP،
    الجلسة) ويجب أن تأتي من الشبكة دائمًا حتى لا تظهر بيانات
    زبون قديم لزبون آخر.

  ملاحظة مهمة: المتصفحات تشغّل الـ Service Worker على اتصال
  HTTPS فقط (أو localhost). لو الشبكة HTTP (كابتف بورتال
  الميكروتك) يتخطّى التسجيل بصمت من غير أي تأثير على الصفحة.

  عند تحديث أي ملف ثابت: غيّر رقم الإصدار في CACHE_NAME بالأسفل
  (v1 → v2) فيتحدث الكاش تلقائيًا عند كل الزبائن.
============================================================ */
var CACHE_NAME = 'abu-ismael-static-v1';

/* الملفات الثابتة الأساسية: تُخزّن فور أول تشغيل */
var PRECACHE = [
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/icon-180.png',
  './icons/icon.svg',
  './manifest.json'
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

/* 3) الطلبات: سياسة الكاش الذكية */
self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  var path = url.pathname;

  /* 🚫 صفحة HTML أو طلب API → من الشبكة دائمًا، ممنوع الكاش نهائيًا
     (حماية بيانات المستخدم من الخلط بين الزبائن) */
  if (path.indexOf('.html') !== -1 || path.indexOf('quota') !== -1) {
    event.respondWith(fetch(req));
    return;
  }

  /* ✅ ملف ثابت (css/js/أيقونة/خط/مانيفست):
     من الكاش فورًا (سرعة) + تحديث من الشبكة خلف الكواليس
     ولو الجهاز أوفلاين → نسخة الكاش القديمة تخدم كبديل */
  if (path.match(/\.(css|js|png|svg|ico|json|webmanifest|woff2?|ttf|eot)(\?|$)/)) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        var network = fetch(req).then(function (res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
          }
          return res;
        }).catch(function () { return cached; });
        return cached || network;
      })
    );
  }
  /* أي شيء آخر → الشبكة مباشرة بدون تدخل */
});
