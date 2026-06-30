import { useEffect, useState, type ReactNode } from "react";

/**
 * ScreenTransition (T1)
 * Wraps a screen and animates it in: scale 0.95→1, translateY 40px→0,
 * opacity 0→1 over 320ms with a soft spring curve.
 *
 * Honors `prefers-reduced-motion` via the global CSS rule that disables
 * the `.cc-screen-enter` keyframe.
 */
export interface ScreenTransitionProps {
  children: ReactNode;
  /** Delay in milliseconds before the animation runs. Default 0. */
  delay?: number;
}

export default function ScreenTransition({ children, delay = 0 }: ScreenTransitionProps) {
  const [armed, setArmed] = useState(delay === 0);

  useEffect(() => {
    if (delay === 0) return;
    const id = window.setTimeout(() => setArmed(true), delay);
    return () => window.clearTimeout(id);
  }, [delay]);

  return (
    <div
      className={armed ? "animated cc-screen-enter" : "animated"}
      style={armed ? undefined : { opacity: 0 }}
    >
      {children}
    </div>
  );
}

export { ScreenTransition };
