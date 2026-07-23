// Wire TanStack Router navigations through the View Transitions API so every
// route change gets an animated cross-fade. Transitions are serialized in a
// small queue: if the user taps a new tab while one is still running, we let
// the current one finish (or skip it cleanly) before starting the next, so
// animations never "jump" or get dropped mid-flight.
import type { AnyRouter } from "@tanstack/react-router";

type ViewTransition = { finished: Promise<void>; skipTransition?: () => void };
type DocWithVT = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => ViewTransition;
};

export function initViewTransitions(router: AnyRouter) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const doc = document as DocWithVT;
  if (typeof doc.startViewTransition !== "function") return;

  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  let lastLen = window.history.length;
  let lastPath = window.location.pathname;
  let current: ViewTransition | null = null;
  let pending: Promise<void> = Promise.resolve();

  router.subscribe("onBeforeNavigate", (evt: { toLocation?: { pathname?: string } }) => {
    const nextPath = evt?.toLocation?.pathname ?? lastPath;
    if (nextPath === lastPath) return;

    const nextLen = window.history.length;
    const dir = nextLen < lastLen ? "back" : "forward";
    document.documentElement.dataset.navDir = dir;
    lastLen = nextLen;
    lastPath = nextPath;

    // Serialize: wait for any in-flight transition's snapshot phase to end
    // before starting the next. If one is still animating, skip it so the
    // new transition can start immediately from the current painted state
    // — no dropped frames, no stacked animations.
    const start = () => {
      try {
        if (current) {
          current.skipTransition?.();
        }
        const vt = doc.startViewTransition?.(() => {});
        if (vt) {
          current = vt;
          vt.finished.finally(() => {
            if (current === vt) current = null;
          });
          return vt.finished.catch(() => {});
        }
      } catch {
        // ignore
      }
      return Promise.resolve();
    };

    pending = pending.then(start, start);
  });
}
