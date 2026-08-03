/**
 * The story's accent colour (decision 7.23) — one designer's pop of colour the
 * layout agent can paint onto an element or a hand-underline. We pull it from the
 * photo so it harmonises with the image, keeping the colour choice on the device
 * (7.10). The pure pick lives here; the decode+sample step is in the renderer.
 */

/** Warm coral, used when a photo is too grey/flat to yield a vivid colour. */
export const DEFAULT_ACCENT = '#e8663a';

/**
 * Pick a vibrant accent from RGBA pixels: the most saturated colour in a
 * mid-luminance band (near-black and near-white make dull, muddy accents). Pure
 * and deterministic. Returns {@link DEFAULT_ACCENT} when nothing vivid is found.
 */
export function vibrantColor(rgba: Uint8ClampedArray): string {
  let best = -1;
  let br = 0;
  let bg = 0;
  let bb = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lum = (max + min) / 510; // 0..1
    if (lum < 0.2 || lum > 0.85) continue; // skip too dark / too bright
    const sat = max === 0 ? 0 : (max - min) / max; // 0..1
    // Vivid and mid-toned scores highest.
    const score = sat * (1 - Math.abs(lum - 0.5) * 1.4);
    if (score > best) {
      best = score;
      br = r;
      bg = g;
      bb = b;
    }
  }
  if (best <= 0.08) return DEFAULT_ACCENT; // nothing vivid enough → warm default
  return `rgb(${br}, ${bg}, ${bb})`;
}

/**
 * Decode the photo into a small canvas and pick its {@link vibrantColor}. Impure;
 * returns {@link DEFAULT_ACCENT} where a 2D context isn't available (e.g. tests).
 */
export function sampleAccent(bitmap: ImageBitmap): string {
  const N = 32;
  const canvas = new OffscreenCanvas(N, N);
  const ctx = canvas.getContext('2d');
  if (!ctx) return DEFAULT_ACCENT;
  ctx.drawImage(bitmap, 0, 0, N, N);
  return vibrantColor(ctx.getImageData(0, 0, N, N).data);
}
