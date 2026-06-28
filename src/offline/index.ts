// Boot for the offline-first runtime. Call `initOffline()` once on the
// client. Sets up sync triggers (online, focus, periodic, route changes via
// `document.visibilitychange`) and resumes any pending uploads.

import { logDiag } from "../lib/diagnostics";
import { refreshPendingCount, runSync } from "./sync/engine";
import { processQueue } from "./uploads/queue";

let initialized = false;

export function initOffline(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const trigger = (why: string) => {
    logDiag("log", `offline: trigger sync (${why})`);
    void runSync();
    void processQueue();
  };

  // Online / focus
  window.addEventListener("online", () => trigger("online"));
  window.addEventListener("focus", () => trigger("focus"));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") trigger("visible");
  });

  // Initial run + pending count
  void refreshPendingCount();
  void runSync();
  void processQueue();

  // Periodic 5-minute heartbeat (cheap; pull is delta-based)
  setInterval(() => {
    if (!navigator.onLine) return;
    if (document.visibilityState !== "visible") return;
    void runSync();
  }, 5 * 60_000);
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
