/**
 * smoothness.ts (T1)
 * High-refresh-rate / 90fps hints for the Liquid Glass surfaces.
 *
 * - Marks glass surfaces with `content-visibility: auto` so off-screen
 *   panels skip paint while scrolling.
 * - Warms the compositor on first paint by toggling `will-change` on body.
 *
 * Safe to call multiple times — the warmup runs once via `{ once: true }`.
 */
export function initHighRefreshRate(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const applyContentVisibility = () => {
    try {
      if (
        "CSS" in window &&
        typeof CSS.supports === "function" &&
        CSS.supports("content-visibility", "auto")
      ) {
        document
          .querySelectorAll<HTMLElement>(".glass, .glass-card, .glass-modal, .glass-dark")
          .forEach((el) => {
            el.style.contentVisibility = "auto";
          });
      }
    } catch {
      /* no-op */
    }
  };

  const warmup = () => {
    document.body.style.willChange = "transform";
    requestAnimationFrame(() => {
      document.body.style.willChange = "auto";
      applyContentVisibility();
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", warmup, { once: true });
  } else {
    warmup();
  }
}
