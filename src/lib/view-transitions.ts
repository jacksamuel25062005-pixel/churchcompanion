// Wire TanStack Router navigations through the View Transitions API so every
// route change gets an animated fade + slide (out on the old view, in on the
// new one). Direction is inferred from history length to distinguish forward
// vs. back navigation.
import type { AnyRouter } from "@tanstack/react-router";

type DocWithVT = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => { finished: Promise<void> };
};

export function initViewTransitions(router: AnyRouter) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const doc = document as DocWithVT;
  if (typeof doc.startViewTransition !== "function") return;

  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  let lastLen = window.history.length;
  let lastPath = window.location.pathname;

  router.subscribe("onBeforeNavigate", (evt: { toLocation?: { pathname?: string } }) => {
    const nextPath = evt?.toLocation?.pathname ?? lastPath;
    if (nextPath === lastPath) return;

    const nextLen = window.history.length;
    const dir = nextLen < lastLen ? "back" : "forward";
    document.documentElement.dataset.navDir = dir;
    lastLen = nextLen;
    lastPath = nextPath;

    try {
      // Fire-and-forget: let the router swap the DOM on its own tick.
      // The browser captures the old snapshot immediately and cross-fades
      // to whatever is painted next — no artificial rAF wait needed.
      doc.startViewTransition?.(() => {});
    } catch {
      // ignore — fall through to a normal navigation
    }
  });
}

