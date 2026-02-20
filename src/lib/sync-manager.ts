/**
 * Sync Manager — Handles background synchronization of offline data.
 * When the app comes back online, it processes the sync queue and
 * pushes pending quiz submissions to the server.
 */

import {
  getSyncQueue,
  removeSyncQueueItem,
  addToSyncQueue,
  getSyncQueueCount,
  type SyncQueueItem,
} from "./offline-db";

type SyncListener = (status: SyncStatus) => void;

export interface SyncStatus {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  lastError: string | null;
}

let syncStatus: SyncStatus = {
  isSyncing: false,
  pendingCount: 0,
  lastSyncAt: null,
  lastError: null,
};

const listeners: Set<SyncListener> = new Set();

/** Subscribe to sync status changes */
export function onSyncStatusChange(listener: SyncListener): () => void {
  listeners.add(listener);
  // Immediately notify with current status
  listener(syncStatus);
  return () => listeners.delete(listener);
}

function notifyListeners() {
  listeners.forEach((l) => l({ ...syncStatus }));
}

function updateStatus(partial: Partial<SyncStatus>) {
  syncStatus = { ...syncStatus, ...partial };
  notifyListeners();
}

/** Queue a submission for background sync */
export async function queueForSync(
  type: "submit" | "candidate",
  payload: unknown
): Promise<void> {
  await addToSyncQueue({
    type,
    payload,
    createdAt: new Date().toISOString(),
    retries: 0,
  });
  const count = await getSyncQueueCount();
  updateStatus({ pendingCount: count });

  // Try to trigger SW background sync
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "SYNC_NOW" });
  }

  // Also try to sync immediately if online
  if (navigator.onLine) {
    syncNow();
  }
}

/** Attempt to process all pending sync items */
export async function syncNow(): Promise<void> {
  if (syncStatus.isSyncing) return;
  if (!navigator.onLine) return;

  updateStatus({ isSyncing: true, lastError: null });

  let items: SyncQueueItem[];
  try {
    items = await getSyncQueue();
  } catch {
    updateStatus({ isSyncing: false, lastError: "Failed to read sync queue" });
    return;
  }

  if (items.length === 0) {
    updateStatus({ isSyncing: false, pendingCount: 0 });
    return;
  }

  let successCount = 0;

  for (const item of items) {
    try {
      const url = item.type === "submit" ? "/api/submit" : "/api/candidates";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
      });

      if (res.ok) {
        await removeSyncQueueItem(item.id!);
        successCount++;
      } else if (res.status >= 400 && res.status < 500) {
        // Client error — won't succeed on retry
        console.warn(`[Sync] Item ${item.id} failed with ${res.status}, removing`);
        await removeSyncQueueItem(item.id!);
      }
      // 5xx stays in queue
    } catch {
      // Network error — stop trying
      console.warn("[Sync] Network error, stopping sync");
      break;
    }
  }

  const remaining = await getSyncQueueCount();
  updateStatus({
    isSyncing: false,
    pendingCount: remaining,
    lastSyncAt: new Date().toISOString(),
    lastError: remaining > 0 ? `${remaining} items still pending` : null,
  });

  if (successCount > 0) {
    console.log(`[Sync] Successfully synced ${successCount} items`);
  }
}

/** Get current pending count */
export async function refreshPendingCount(): Promise<number> {
  const count = await getSyncQueueCount();
  updateStatus({ pendingCount: count });
  return count;
}

/** Initialize sync manager — setup online/offline listeners */
export function initSyncManager(): () => void {
  const handleOnline = () => {
    console.log("[Sync] Back online — syncing...");
    syncNow();
  };

  const handleSWMessage = (event: MessageEvent) => {
    if (event.data?.type === "SYNC_COMPLETE") {
      refreshPendingCount();
    }
  };

  window.addEventListener("online", handleOnline);

  // Listen for SW sync complete messages
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", handleSWMessage);
  }

  // Initial sync attempt
  if (navigator.onLine) {
    syncNow();
  } else {
    refreshPendingCount();
  }

  // Periodic sync every 30 seconds when online
  const interval = setInterval(() => {
    if (navigator.onLine && syncStatus.pendingCount > 0) {
      syncNow();
    }
  }, 30000);

  return () => {
    window.removeEventListener("online", handleOnline);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.removeEventListener("message", handleSWMessage);
    }
    clearInterval(interval);
  };
}
