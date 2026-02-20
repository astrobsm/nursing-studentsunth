// ============================================
// UNTH Nursing Quiz — Service Worker
// Offline-first with background sync
// ============================================

const CACHE_NAME = "nursing-quiz-v4";
const SYNC_TAG = "quiz-sync";

// Core app shell files to precache
const PRECACHE_URLS = [
  "/",
  "/instructions",
  "/quiz",
  "/results",
  "/admin",
  "/logo.png",
  "/favicon.png",
  "/manifest.json",
];

// ---- INSTALL: Precache the app shell ----
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[SW] Precaching app shell");
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// ---- ACTIVATE: Aggressively clean ALL old caches, claim clients ----
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        console.log("[SW] Cleaning caches. Current:", CACHE_NAME, "Found:", keys);
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => {
              console.log("[SW] Deleting old cache:", key);
              return caches.delete(key);
            })
        );
      })
      .then(() => {
        console.log("[SW] Claiming all clients");
        return self.clients.claim();
      })
  );
});

// ---- FETCH: Network-first for API, cache-first for assets ----
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET for caching (POST requests like API calls)
  if (request.method !== "GET") {
    // For POST /api/submit — intercept and queue if offline
    if (url.pathname === "/api/submit" && request.method === "POST") {
      event.respondWith(handleSubmitRequest(request));
      return;
    }
    // For POST /api/candidates — queue if offline
    if (url.pathname === "/api/candidates" && request.method === "POST") {
      event.respondWith(handleCandidateRequest(request));
      return;
    }
    return;
  }

  // For navigation requests (HTML pages) — network first, fallback to cache
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/")))
    );
    return;
  }

  // For static assets — stale-while-revalidate
  if (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/logo") ||
    url.pathname.startsWith("/favicon") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".json")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // Default: network first, cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// ---- SYNC: Background sync when online ----
self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(processSyncQueue());
  }
});

// Also try syncing when a message is received
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SYNC_NOW") {
    processSyncQueue().then(() => {
      // Notify all clients that sync completed
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: "SYNC_COMPLETE" });
        });
      });
    });
  }

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ---- Handle offline submit ----
async function handleSubmitRequest(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch (err) {
    // Network failed — queue it
    const body = await request.clone().json();
    await addToSyncQueue("submit", body);
    return new Response(
      JSON.stringify({
        success: true,
        offline: true,
        message: "Queued for sync when online",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// ---- Handle offline candidate registration ----
async function handleCandidateRequest(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch (err) {
    const body = await request.clone().json();
    await addToSyncQueue("candidate", body);
    return new Response(
      JSON.stringify({
        success: true,
        offline: true,
        message: "Queued for sync when online",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// ---- IndexedDB helpers for sync queue ----
// MUST match the app-side offline-db.ts DB_NAME and DB_VERSION
const DB_NAME = "nursing_quiz_offline";
const DB_VERSION = 2;
const STORE_NAME = "sync_queue";

function openSyncDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      // Must create ALL stores that offline-db.ts expects (same schema)
      if (!db.objectStoreNames.contains("quiz_state")) {
        db.createObjectStore("quiz_state", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("results")) {
        const resultStore = db.createObjectStore("results", {
          keyPath: "id",
          autoIncrement: true,
        });
        resultStore.createIndex("studentId", "studentId", { unique: false });
        resultStore.createIndex("submittedAt", "submittedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const syncStore = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        syncStore.createIndex("type", "type", { unique: false });
        syncStore.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function addToSyncQueue(type, payload) {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.add({
      type,
      payload,
      createdAt: new Date().toISOString(),
      retries: 0,
    });
    tx.oncomplete = () => {
      resolve();
      // Request background sync if available
      if (self.registration && self.registration.sync) {
        self.registration.sync.register(SYNC_TAG).catch(() => {});
      }
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllFromSyncQueue() {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function removeFromSyncQueue(id) {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---- Process the sync queue ----
async function processSyncQueue() {
  let items;
  try {
    items = await getAllFromSyncQueue();
  } catch {
    return;
  }

  if (!items || items.length === 0) return;

  console.log(`[SW] Processing ${items.length} queued items`);

  for (const item of items) {
    try {
      let url;
      if (item.type === "submit") {
        url = "/api/submit";
      } else if (item.type === "candidate") {
        url = "/api/candidates";
      } else {
        // Unknown type, remove
        await removeFromSyncQueue(item.id);
        continue;
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
      });

      if (res.ok) {
        console.log(`[SW] Synced item ${item.id} (${item.type})`);
        await removeFromSyncQueue(item.id);
      } else if (res.status >= 400 && res.status < 500) {
        // Client error — won't succeed on retry, remove
        console.warn(`[SW] Item ${item.id} failed with ${res.status}, removing`);
        await removeFromSyncQueue(item.id);
      }
      // 5xx errors will remain in queue for next sync
    } catch (err) {
      console.warn(`[SW] Failed to sync item ${item.id}:`, err);
      // Network still unavailable, stop processing
      break;
    }
  }
}
