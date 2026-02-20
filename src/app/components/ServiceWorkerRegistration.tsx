"use client";

import { useEffect } from "react";

/**
 * Registers the Service Worker and initializes the sync manager.
 * Aggressively auto-updates to prevent stale cached JS bundles.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Register Service Worker
    navigator.serviceWorker
      .register("/sw.js?v=4", { scope: "/" })
      .then(async (registration) => {
        console.log("[PWA] Service Worker registered:", registration.scope);

        // Immediately check for a new version
        try {
          await registration.update();
        } catch (e) {
          console.warn("[PWA] SW update check failed:", e);
        }

        // Auto-activate new workers without waiting for user action
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed") {
              if (navigator.serviceWorker.controller) {
                // New SW is ready — tell it to activate immediately
                newWorker.postMessage({ type: "SKIP_WAITING" });
                console.log("[PWA] New SW installed, activating...");
              }
            }
          });
        });

        // When a new SW takes over, reload the page to get fresh assets
        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (!refreshing) {
            refreshing = true;
            console.log("[PWA] New SW active, reloading for fresh assets...");
            window.location.reload();
          }
        });

        // Check for updates every 60 seconds (aggressive)
        setInterval(() => {
          registration.update();
        }, 60 * 1000);
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

  // No visible UI — updates happen automatically
  return null;
}
