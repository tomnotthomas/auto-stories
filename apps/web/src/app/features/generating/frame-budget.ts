/**
 * Whether the device is keeping up with the lane.
 *
 * The screen has to run on a cheap phone, and the expensive part of it — a
 * depth blur whose radius changes every frame, over a print the size of the
 * screen — costs whatever that phone's fill rate says it costs. There is no
 * property to read that off: a budget Android reports the same pixel ratio as a
 * flagship. So the screen watches its own frame times and sheds the blur if it
 * cannot afford it (decision 7.34).
 */

/** A frame slower than this missed the budget — below roughly 42fps. */
export const SLOW_FRAME_MS = 24;
/** How many recent frames the verdict is based on. ~1/3 of a second at 60fps. */
export const SAMPLE_WINDOW = 20;

/**
 * True when the recent frames say the device cannot hold the budget.
 *
 * Judged on the **median** of the window, so one long frame — a garbage
 * collection, a decode, the tab coming back — is a hiccup rather than a verdict,
 * while a device that is genuinely behind sheds within a third of a second.
 */
export function shouldLighten(frameTimes: readonly number[]): boolean {
  if (frameTimes.length < SAMPLE_WINDOW) return false;
  const recent = [...frameTimes.slice(-SAMPLE_WINDOW)].sort((a, b) => a - b);
  return recent[Math.floor(recent.length / 2)] >= SLOW_FRAME_MS;
}
