/**
 * IndexedDB storage layer for offline-first quiz data.
 * Provides persistent storage that survives browser restarts,
 * and a sync queue for pending server submissions.
 */

const DB_NAME = "nursing_quiz_offline";
const DB_VERSION = 2;

// Store names
const STORES = {
  QUIZ_STATE: "quiz_state",
  RESULTS: "results",
  SYNC_QUEUE: "sync_queue",
  META: "meta",
} as const;

type StoreNames = (typeof STORES)[keyof typeof STORES];

/** Open the IndexedDB database */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Quiz state store (holds current quiz progress)
      if (!db.objectStoreNames.contains(STORES.QUIZ_STATE)) {
        db.createObjectStore(STORES.QUIZ_STATE, { keyPath: "key" });
      }

      // Results store (all quiz results)
      if (!db.objectStoreNames.contains(STORES.RESULTS)) {
        const resultStore = db.createObjectStore(STORES.RESULTS, {
          keyPath: "id",
          autoIncrement: true,
        });
        resultStore.createIndex("studentId", "studentId", { unique: false });
        resultStore.createIndex("submittedAt", "submittedAt", { unique: false });
      }

      // Sync queue (pending server submissions)
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, {
          keyPath: "id",
          autoIncrement: true,
        });
        syncStore.createIndex("type", "type", { unique: false });
        syncStore.createIndex("createdAt", "createdAt", { unique: false });
      }

      // Meta store (sync timestamps, etc.)
      if (!db.objectStoreNames.contains(STORES.META)) {
        db.createObjectStore(STORES.META, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---- Generic helpers ----

async function dbPut<T>(storeName: StoreNames, data: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(data);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGet<T>(storeName: StoreNames, key: string | number): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetAll<T>(storeName: StoreNames): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(storeName: StoreNames, key: string | number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbClear(storeName: StoreNames): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---- Quiz State (offline-safe) ----

export async function saveQuizStateIDB(state: unknown): Promise<void> {
  await dbPut(STORES.QUIZ_STATE, { key: "current", data: state });
}

export async function getQuizStateIDB<T>(): Promise<T | null> {
  const result = await dbGet<{ key: string; data: T }>(STORES.QUIZ_STATE, "current");
  return result?.data ?? null;
}

export async function clearQuizStateIDB(): Promise<void> {
  await dbDelete(STORES.QUIZ_STATE, "current");
}

// ---- Results storage ----

export interface OfflineResult {
  id?: number;
  studentId: string;
  submittedAt: string;
  synced: boolean;
  data: unknown;
}

export async function saveResultIDB(result: OfflineResult): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.RESULTS, "readwrite");
    const req = tx.objectStore(STORES.RESULTS).add(result);
    req.onsuccess = () => resolve(req.result as number);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllResultsIDB(): Promise<OfflineResult[]> {
  return dbGetAll<OfflineResult>(STORES.RESULTS);
}

export async function markResultSynced(id: number): Promise<void> {
  const result = await dbGet<OfflineResult>(STORES.RESULTS, id);
  if (result) {
    result.synced = true;
    await dbPut(STORES.RESULTS, result);
  }
}

export async function getUnsyncedResults(): Promise<OfflineResult[]> {
  const all = await getAllResultsIDB();
  return all.filter((r) => !r.synced);
}

// ---- Sync Queue ----

export interface SyncQueueItem {
  id?: number;
  type: "submit" | "candidate";
  payload: unknown;
  createdAt: string;
  retries: number;
}

export async function addToSyncQueue(item: Omit<SyncQueueItem, "id">): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SYNC_QUEUE, "readwrite");
    const req = tx.objectStore(STORES.SYNC_QUEUE).add(item);
    req.onsuccess = () => resolve(req.result as number);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  return dbGetAll<SyncQueueItem>(STORES.SYNC_QUEUE);
}

export async function removeSyncQueueItem(id: number): Promise<void> {
  return dbDelete(STORES.SYNC_QUEUE, id);
}

export async function clearSyncQueue(): Promise<void> {
  return dbClear(STORES.SYNC_QUEUE);
}

export async function getSyncQueueCount(): Promise<number> {
  const items = await getSyncQueue();
  return items.length;
}

// ---- Meta ----

export async function setMeta(key: string, value: unknown): Promise<void> {
  await dbPut(STORES.META, { key, value });
}

export async function getMeta<T>(key: string): Promise<T | null> {
  const result = await dbGet<{ key: string; value: T }>(STORES.META, key);
  return result?.value ?? null;
}

// ---- Check if IDB is available ----
export function isIndexedDBAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!window.indexedDB;
  } catch {
    return false;
  }
}
