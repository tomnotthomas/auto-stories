/**
 * Pure gesture maths for the in-app elements that can be flicked away (the sparks
 * overlay today). Kept pure and framework-free so the physics is unit-tested
 * without a DOM; the thin pointer-capture wiring lives in the components.
 *
 * The caption editor keeps its own drag maths (a pinch-aware band tuned to the
 * caption box), so this stays focused on the flick-to-dismiss shared case.
 */

/** Thresholds for a flick-to-dismiss. `distance` is px of travel; `velocity` is
 * px/ms — a quick flick dismisses even when it is short (Emil Kowalski's ~0.11). */
export interface SwipeThresholds {
  readonly distance: number;
  readonly velocity: number;
}

export const DEFAULT_SWIPE: SwipeThresholds = { distance: 64, velocity: 0.11 };

/**
 * Whether a horizontal swipe should dismiss: either it travelled past the
 * distance threshold, or it was fast enough (a quick flick) regardless of
 * distance. `elapsedMs <= 0` falls back to the distance test alone (no divide).
 * Sign-agnostic — a left or right swipe both dismiss.
 */
export function swipeDismissed(
  dx: number,
  elapsedMs: number,
  thresholds: SwipeThresholds = DEFAULT_SWIPE,
): boolean {
  const travel = Math.abs(dx);
  if (travel >= thresholds.distance) return true;
  if (elapsedMs <= 0) return false;
  return travel / elapsedMs > thresholds.velocity;
}
