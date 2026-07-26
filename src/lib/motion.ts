import type { Transition, Variants } from "framer-motion";

/** iOS-style spring — tabs, cards, sheets, dialogs. */
export const IOS_SPRING: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 32,
  mass: 0.8,
};

/** Snappier spring — chips, buttons, tap feedback. */
export const IOS_SPRING_SNAP: Transition = {
  type: "spring",
  stiffness: 460,
  damping: 28,
  mass: 0.7,
};

/** Dock indicator glide — matches Teacher's Diary liquid feel. */
export const DOCK_SPRING: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 30,
  mass: 0.7,
};

/** Fade + slide entry variant, used with staggerContainer. */
export const STAGGER_FADE: Variants = {
  initial: { opacity: 0, y: 12, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: IOS_SPRING },
  exit: { opacity: 0, y: 8, scale: 0.98 },
};

export const staggerContainer = (staggerChildren = 0.05): Variants => ({
  initial: {},
  animate: { transition: { staggerChildren, delayChildren: 0.02 } },
});
