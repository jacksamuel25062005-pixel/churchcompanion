import { useEffect } from "react";

/**
 * Home-only guard: when the user presses the Android/browser back button while
 * on Home (i.e. there's nothing left in our in-app stack), intercept the pop
 * and ask before letting the browser/PWA actually close the tab/app.
 *
 * Implementation: push a sentinel history entry on mount. If popstate fires
 * and lands us back on Home, prompt to exit. On "Yes" we let the next back
 * proceed (history.back). On "No" we re-push the sentinel to stay put.
 */
export function useExitConfirmation(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const SENTINEL = { __ccExitGuard: true } as const;
    // Push once so the first Back press triggers popstate instead of exiting.
    window.history.pushState(SENTINEL, "");

    const onPop = (_e: PopStateEvent) => {
      const confirmExit = window.confirm("Do you want to exit Church Companion?");
      if (confirmExit) {
        // Let the browser close the tab / PWA. One more back pops the sentinel origin.
        window.history.back();
      } else {
        // Re-arm the guard.
        window.history.pushState(SENTINEL, "");
      }
    };

    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Best-effort cleanup: if our sentinel is still on top, pop it silently.
      const st = window.history.state as { __ccExitGuard?: boolean } | null;
      if (st?.__ccExitGuard) {
        window.history.back();
      }
    };
  }, [enabled]);
}
