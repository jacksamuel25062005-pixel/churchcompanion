// Boot for the offline-first runtime. Call `initOffline()` once on the
// client. Sets up sync triggers (online, focus, periodic, route changes via
// `document.visibilitychange`) and resumes any pending uploads.

import { log as logDiag } from "../lib/diagnostics";
import { refreshPendingCount, runSync } from "./sync/engine";
import { processQueue } from "./uploads/queue";
import { prefetchAllImages } from "./prefetch";

let initialized = false;

export function initOffline(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const trigger = (why: string) => {
    logDiag("log", `offline: trigger sync (${why})`);
    void runSync();
    void processQueue();
    // Kick a background image prefetch on major triggers (throttled inside)
    void prefetchAllImages();
  };

  // Online / focus / visibility — silent sync triggers
  window.addEventListener("online", () => trigger("online"));
  window.addEventListener("focus", () => trigger("focus"));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") trigger("visible");
  });

  // Listen for background-sync replay from the service worker so we refresh
  // local Dexie state the moment queued writes reach Supabase.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (ev) => {
      const t = (ev.data as { type?: string } | undefined)?.type;
      if (t === "cc-writes-replayed" || t === "SKIP_WAITING") trigger("sw-replay");
    });
  }

  // Initial run + pending count
  void refreshPendingCount();
  void runSync();
  void processQueue();
  // Defer image prefetch until the app is interactive
  if ("requestIdleCallback" in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void) => void })
      .requestIdleCallback(() => void prefetchAllImages());
  } else {
    setTimeout(() => void prefetchAllImages(), 2000);
  }

  // Silent 90-second heartbeat — cheap delta pull keeps every device in sync
  // in the background without any user-visible refresh.
  setInterval(() => {
    if (!navigator.onLine) return;
    if (document.visibilityState !== "visible") return;
    void runSync();
  }, 90_000);

  // Slower 10-minute image prefetch sweep
  setInterval(() => {
    if (!navigator.onLine) return;
    if (document.visibilityState !== "visible") return;
    void prefetchAllImages();
  }, 10 * 60_000);
}

export * from "./hooks";
export { runSync, getSyncState, subscribeSync } from "./sync/engine";
export { enqueueOutbox } from "./outbox";
export {
  enqueueUpload,
  removeUpload,
  retryUpload,
  processQueue,
} from "./uploads/queue";
export { getDB, metaGet, metaSet, META_KEYS } from "./db";
export { prefetchAllImages, getCachedImageStats, isColdCacheEmpty } from "./prefetch";
