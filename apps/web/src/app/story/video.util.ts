/**
 * Video support — pure foundations (Phase 2/3, separate from the layout agent).
 *
 * The plan: a user can pick videos alongside photos. For a video, the phone
 * extracts a few frames as *captioning context* and the model treats them as one
 * story item — the backend never learns about video; the whole clip is handed off
 * to Instagram raw (nothing is re-encoded here). This file holds the deterministic,
 * unit-tested pieces: telling a video from a photo, and choosing which timestamps
 * to grab frames at. The actual decode-to-canvas extraction is device-side (a
 * `<video>` element) and lands in a later slice.
 */

/** How many frames to pull from a video for captioning context — enough for the
 * model to understand the clip, few enough to keep the payload (and latency) small. */
export const DEFAULT_VIDEO_FRAMES = 3;

/** True when the picked file is a video (any container the OS picker returns). */
export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/');
}

/**
 * Choose `count` timestamps (seconds) to sample a clip of `durationSec`, spread
 * evenly and kept off the very start/end (titles, fades, black frames). One frame
 * → the midpoint. Returns `[]` for a non-positive duration or count.
 */
export function sampleTimestamps(durationSec: number, count: number): number[] {
  if (!(durationSec > 0) || count <= 0) return [];
  if (count === 1) return [durationSec / 2];

  // Skip the first/last slice of the clip; never cross the midpoint on a short one.
  const pad = Math.min(durationSec * 0.08, durationSec / 2);
  const start = pad;
  const span = durationSec - 2 * pad;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(start + (span * i) / (count - 1));
  }
  return out;
}
