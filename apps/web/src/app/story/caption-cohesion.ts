import { averageLuminance } from './caption-style';

/**
 * Neutral photo cohesion: nudge each frame's exposure toward a shared mid so a
 * set shot in varying light reads as one piece — matching, not a filter. Only
 * brightness moves (no white-balance / colour shift), and the nudge is capped so
 * it can never wash out a deliberately dark or bright photo. Same filter string
 * is used by the canvas export and the DOM preview, so they match exactly.
 */
const TARGET_LUMINANCE = 0.5;
const STRENGTH = 0.35;
const CAP = 0.08;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** A CSS/canvas `filter` string (`brightness(x)`) that pulls `meanLuminance`
 * toward the shared mid, capped; `'none'` when there's nothing to correct. */
export function cohesionFilter(meanLuminance: number): string {
  if (!(meanLuminance > 0)) return 'none';
  const delta = clamp((TARGET_LUMINANCE - meanLuminance) * STRENGTH, -CAP, CAP);
  const brightness = Math.round((1 + delta) * 1000) / 1000;
  return brightness === 1 ? 'none' : `brightness(${brightness})`;
}

/** Mean relative luminance of the whole frame (impure: decodes to a tiny
 * canvas). Returns {@link TARGET_LUMINANCE} — i.e. no correction — when a 2D
 * context isn't available. */
export function frameLuminance(bitmap: ImageBitmap): number {
  const W = 24;
  const H = 24;
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext('2d');
  if (!ctx) return TARGET_LUMINANCE;
  ctx.drawImage(bitmap, 0, 0, W, H);
  return averageLuminance(ctx.getImageData(0, 0, W, H).data);
}
