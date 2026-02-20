"use client";

import { useEffect, useState } from "react";

/**
 * Registers the Service Worker and initializes the sync manager.
 * This is a client-only component that renders nothing visible.
 */
export default function ServiceWorkerRegistration() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Register Service Worker
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        console.log("[PWA] Service Worker registered:", registration.scope);

        // Check for updates periodically
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // New version available
              setUpdateAvailable(true);
            }
          });
        });

        // Check for updates every 5 minutes
        setInterval(() => {
          registration.update();
        }, 5 * 60 * 1000);
      })
      .catch((err) => {
        console.warn("[PWA] Service Worker registration failed:", err);
      });

    // Initialize sync manager
    let cleanupSync: (() => void) | undefined;
    import("@/lib/sync-manager").then(({ initSyncManager }) => {
      cleanupSync = initSyncManager();
    });

    return () => {
      cleanupSync?.();
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-blue-500 text-white text-center px-4 py-2 text-sm">
      <span>A new version is available!</span>
      <button
        onClick={() => {
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: "SKIP_WAITING",
            });
          }
          window.location.reload();
        }}
        className="ml-3 px-3 py-0.5 bg-white text-blue-500 rounded-full text-xs font-bold hover:bg-blue-50 transition-colors"
      >
        Update Now
      </button>
    </div>
  );
}
