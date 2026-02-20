"use client";

import { useState, useEffect, useCallback } from "react";

/** Hook that tracks online/offline status in real-time */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

/** Hook that tracks sync status from the sync manager */
export function useSyncStatus() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // Dynamically import to avoid SSR issues
    import("@/lib/sync-manager").then(({ onSyncStatusChange }) => {
      if (!mounted) return;
      const unsubscribe = onSyncStatusChange((status) => {
        if (!mounted) return;
        setPendingCount(status.pendingCount);
        setIsSyncing(status.isSyncing);
        setLastSyncAt(status.lastSyncAt);
      });

      return () => {
        mounted = false;
        unsubscribe();
      };
    });

    return () => {
      mounted = false;
    };
  }, []);

  const triggerSync = useCallback(async () => {
    const { syncNow } = await import("@/lib/sync-manager");
    syncNow();
  }, []);

  return { pendingCount, isSyncing, lastSyncAt, triggerSync };
}
