"use client";

import { useOnlineStatus, useSyncStatus } from "@/hooks/useOnlineStatus";

/** Floating banner showing offline/online status and pending sync count */
export default function NetworkStatusBar() {
  const isOnline = useOnlineStatus();
  const { pendingCount, isSyncing, triggerSync } = useSyncStatus();

  // Don't show anything if online and nothing pending
  if (isOnline && pendingCount === 0 && !isSyncing) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm font-medium transition-all duration-300 ${
        isOnline
          ? "bg-yellow-accent text-gray-900"
          : "bg-red-500 text-white"
      }`}
    >
      <div className="max-w-4xl mx-auto flex items-center justify-center gap-2">
        {!isOnline ? (
          <>
            <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
            <span>You&apos;re offline — quiz works normally, data will sync when reconnected</span>
          </>
        ) : isSyncing ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Syncing {pendingCount} pending submission{pendingCount !== 1 ? "s" : ""}...</span>
          </>
        ) : pendingCount > 0 ? (
          <>
            <span className="inline-block w-2 h-2 rounded-full bg-yellow-600" />
            <span>{pendingCount} submission{pendingCount !== 1 ? "s" : ""} pending sync</span>
            <button
              onClick={triggerSync}
              className="ml-2 px-3 py-0.5 bg-green-deep text-white text-xs rounded-full hover:bg-green-medium transition-colors"
            >
              Sync Now
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
