/** Tiny haptic helpers — silently no-op where the Vibration API is unavailable. */

function buzz(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch { /* ignore */ }
}

export const haptic = {
  /** Light tap — selection, emoji pick. */
  light: () => buzz(8),
  /** Medium — long-press reveal. */
  medium: () => buzz(18),
  /** Success confirmation. */
  success: () => buzz([10, 40, 14]),
  /** Warning / destructive confirm. */
  warning: () => buzz([22, 60, 22]),
};
