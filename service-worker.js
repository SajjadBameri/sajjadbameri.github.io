/* ============================================================
   Service Worker — کارنگار
     ============================================================ */

const CACHE_VERSION = "yaddasht-yar-v1.0.0";
const CACHE_STATIC = `${CACHE_VERSION}-static`;
const CACHE_DYNAMIC = `${CACHE_VERSION}-dynamic`;

/* ============ OneSignal Integration ============ */
try {
  importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
  console.log("[SW] ✅ OneSignal SW loaded");
} catch (err) {
  console.warn("[SW] ⚠️ OneSignal SW not loaded:", err);
}


const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/css/style.css",
  "./assets/js/app.js",
  "./assets/img/maskable-512.png",
  "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css",
  "https://cdn.jsdelivr.net/npm/persian-datepicker@1.2.0/dist/css/persian-datepicker.min.css",
  "https://code.jquery.com/jquery-3.7.1.min.js",
  "https://cdn.jsdelivr.net/npm/persian-date@1.1.0/dist/persian-date.min.js",
  "https://cdn.jsdelivr.net/npm/persian-datepicker@1.2.0/dist/js/persian-datepicker.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
];

/* ---------- نصب ---------- */
self.addEventListener("install", (event) => {
  console.log("[SW] Installing...");
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn("[SW] Skipped:", url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

/* ---------- فعال‌سازی ---------- */
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating...");
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_STATIC && key !== CACHE_DYNAMIC)
          .map((key) => {
            console.log("[SW] Deleting old cache:", key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

/* ---------- Fetch ---------- */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (!url.protocol.startsWith("http")) return;

  // CDNها → Cache First
  if (
    url.origin !== self.location.origin &&
    (url.hostname.includes("jsdelivr") ||
      url.hostname.includes("code.jquery.com") ||
      url.hostname.includes("cdnjs") ||
      url.hostname.includes("unpkg") ||
      url.hostname.includes("fonts.googleapis.com") ||
      url.hostname.includes("fonts.gstatic.com"))
  ) {
    event.respondWith(cacheFirst(request, CACHE_DYNAMIC));
    return;
  }

  // فایل‌های خودی → Stale While Revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, CACHE_STATIC));
    return;
  }

  // بقیه → Network First
  event.respondWith(networkFirst(request, CACHE_DYNAMIC));
});

/* ---------- استراتژی‌ها ---------- */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.status === 200) cache.put(request, response.clone());
    return response;
  } catch (err) {
    return new Response("آفلاین هستید", { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await networkPromise) || new Response("آفلاین", { status: 503 });
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.status === 200) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response("آفلاین", { status: 503 });
  }
}

/* ---------- پیام از کلاینت ---------- */
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/* ---------- کلیک روی نوتیفیکیشن ---------- */
self.addEventListener("notificationclick", (event) => {
  const action = event.action;
  const taskId = event.notification.data?.taskId;

  event.notification.close();

  if (action === "snooze") {
    // ۲ ساعت بعد دوباره نوتیف بده
    setTimeout(() => {
      self.registration.showNotification("⏰ یادآوری مجدد", {
        body: event.notification.body,
        icon: "./assets/img/maskable-512.png",
        tag: "task-" + taskId,
      });
    }, 2 * 60 * 60 * 1000);
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // اگه تب باز هست، فوکوس کن
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          if (action === "done" && taskId) {
            client.postMessage({ type: "MARK_DONE", taskId });
          }
          return client.focus();
        }
      }
      // وگرنه باز کن
      if (self.clients.openWindow) {
        return self.clients.openWindow("./");
      }
    })
  );
});