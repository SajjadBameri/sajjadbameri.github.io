/* ============================================================
   Service Worker — کارنگار
   ============================================================ */

const CACHE_VERSION = "karnegar-v1.2.0";
const CACHE_STATIC = `${CACHE_VERSION}-static`;
const CACHE_DYNAMIC = `${CACHE_VERSION}-dynamic`;

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
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_STATIC && key !== CACHE_DYNAMIC)
          .map((key) => {
            console.log("[SW] Deleting old cache:", key);
            return caches.delete(key);
          })
      );

      await self.clients.claim();

      if ("periodicSync" in self.registration) {
        try {
          await self.registration.periodicSync.register("check-deadlines", {
            minInterval: 60 * 60 * 1000,
          });
          console.log("[SW] ✅ Periodic Sync registered");
        } catch (err) {
          console.warn("[SW] Periodic Sync not available:", err);
        }
      }
    })()
  );
});

/* ---------- Fetch ---------- */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (!url.protocol.startsWith("http")) return;

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

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, CACHE_STATIC));
    return;
  }

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
    return new Response("آفلاین هستید", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
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

/* ============================================================
   Periodic Background Sync
   ============================================================ */
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "check-deadlines") {
    event.waitUntil(checkDeadlinesInBackground());
  }
});

async function checkDeadlinesInBackground() {
  console.log("[SW] Checking deadlines in background...");
  try {
    const db = await openDBForSW();
    const tasks = await getAllTasksForSW(db);
    const now = Date.now();
    let notifiedCount = 0;

    for (const task of tasks) {
      if (task.completed || !task.deadline) continue;

      const deadline = new Date(task.deadline).getTime();
      const lastNotif = task.lastNotificationAt
        ? new Date(task.lastNotificationAt).getTime()
        : 0;
      const hoursSinceLast = (now - lastNotif) / 3600000;

      if (deadline <= now && (lastNotif === 0 || hoursSinceLast >= 24)) {
        await self.registration.showNotification("🔴 موعد کار رسید!", {
          body: `"${task.Title}" هنوز انجام نشده`,
          icon: "./assets/img/maskable-512.png",
          badge: "./assets/img/maskable-512.png",
          tag: "task-" + task.id,
          requireInteraction: true,
          vibrate: [300, 100, 300],
          data: { taskId: task.id },
        });

        task.lastNotificationAt = new Date().toISOString();
        await saveTaskForSW(db, task);
        notifiedCount++;
      }
    }
    console.log(`[SW] Background check complete. Notified: ${notifiedCount}`);
  } catch (err) {
    console.warn("[SW] Background check failed:", err);
  }
}

function openDBForSW() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("To do", 6);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllTasksForSW(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["To do"], "readonly");
    const req = tx.objectStore("To do").getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function saveTaskForSW(db, task) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["To do"], "readwrite");
    tx.objectStore("To do").put(task);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ============================================================
   کلیک روی نوتیفیکیشن
   ============================================================ */
self.addEventListener("notificationclick", (event) => {
  const action = event.action;
  const taskId = event.notification.data?.taskId;

  event.notification.close();

  if (action === "snooze") {
    setTimeout(() => {
      self.registration.showNotification("⏰ یادآوری مجدد", {
        body: event.notification.body,
        icon: "./assets/img/maskable-512.png",
        tag: "task-" + taskId,
        data: { taskId },
      });
    }, 2 * 60 * 60 * 1000);
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          if (action === "done" && taskId) {
            client.postMessage({ type: "MARK_DONE", taskId });
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow("./");
      }
    })
  );
});

/* ============================================================
   Push Notification (آینده)
   ============================================================ */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || "کارنگار", {
        body: data.body || "",
        icon: "./assets/img/maskable-512.png",
        badge: "./assets/img/maskable-512.png",
        tag: data.tag || "push-notif",
        data: data.data || {},
      })
    );
  } catch (err) {
    console.warn("[SW] Push parse error:", err);
  }
});