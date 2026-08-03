/**
 * Readability, computed on the device from the pixels — never by the model
 * (decision 7.10). The Look owns placement and its own scrim (7.25); what is
 * left here is the one thing a Look with `ink: 'auto'` still needs: is the photo
 * dark or light where the type lands.
 */

/** What the device computes for readability (never the model): text colour and
 * whether a scrim is drawn behind the type. */
export interface Readable {
  /** true → light (white) text on a dark area; false → dark text on a light area. */
  readonly light: boolean;
  /** true → draw a scrim behind the caption (contrast is ambiguous). */
  readonly scrim: boolean;
}

/** Midpoint of relative luminance (0..1). Below it the area is dark → white text. */
const CONTRAST_MID = 0.5;
/** Within this band of the midpoint, neither colour is safe → add a scrim. */
const SCRIM_BAND = 0.18;

/**
 * Average relative luminance (0..1, Rec. 709) of RGBA pixels — the brightness of
 * the photo under the type. Pure; the impure "decode + sample the region" step
 * lives in the renderer.
 */
export function averageLuminance(rgba: Uint8ClampedArray): number {
  const pixels = Math.floor(rgba.length / 4);
  if (pixels === 0) return 0;
  let sum = 0;
  for (let i = 0; i < pixels * 4; i += 4) {
    sum += (0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]) / 255;
  }
  return sum / pixels;
}

/**
 * Given the average luminance under the type, pick white-vs-dark text and
 * whether a scrim is needed. Deterministic and pure — this is the readability
 * the model does NOT decide (decisions 7.10).
 */
export function pickReadable(luminance: number): Readable {
  return {
    light: luminance < CONTRAST_MID,
    scrim: Math.abs(luminance - CONTRAST_MID) < SCRIM_BAND,
  };
}

/**
 * Sample the photo's average luminance in the band centred on `yPct` (a
 * percentage of the frame height — where the composition hangs its type), so
 * {@link pickReadable} can pick a legible colour. Impure (decodes to a canvas);
 * returns 0.5 (→ scrim, white text) if a 2D context isn't available.
 */
export function sampleLuminance(bitmap: ImageBitmap, yPct: number): number {
  const W = 32;
  const H = 12;
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext('2d');
  if (!ctx) return CONTRAST_MID;
  const sx = bitmap.width * 0.1;
  const sw = bitmap.width * 0.8;
  const bandH = bitmap.height * 0.16;
  const sy = Math.max(0, Math.min(bitmap.height - bandH, (bitmap.height * yPct) / 100 - bandH / 2));
  ctx.drawImage(bitmap, sx, sy, sw, bandH, 0, 0, W, H);
  return averageLuminance(ctx.getImageData(0, 0, W, H).data);
}
