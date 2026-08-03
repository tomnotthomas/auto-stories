/**
 * The quiet-zone map (decision 7.24) — where on a photo type can sit without
 * fighting the picture. A Look states which horizontal band it prefers; this
 * module says whether that band is calm enough, so a headline never lands on the
 * busiest part of the image.
 *
 * P1 is a Layer-3 heuristic only: luminance variance + edge density over a
 * downscaled copy. It is deliberately NOT face detection — `FaceDetector` is
 * Chromium-only (absent on iOS Safari), so depending on it would make placement
 * differ by browser. Real saliency is P4.
 *
 * Same shape as `accent-color.ts`: the scoring is pure and unit-tested, the
 * decode+sample step is a thin impure wrapper.
 */

/** The horizontal thirds a Look can anchor to. */
export const BANDS = ['top', 'middle', 'bottom'] as const;

export type Band = (typeof BANDS)[number];

/** Busyness per band, 0 (flat) … 1 (maximally noisy). */
export type BandScores = Record<Band, number>;

/** Below this a band is calm enough that a Look keeps its preferred placement. */
export const QUIET_THRESHOLD = 0.34;

const EMPTY: BandScores = { top: 0, middle: 0, bottom: 0 };

/**
 * Score how busy each horizontal third of a downscaled photo is. `rgba` is a
 * `size`×`size` RGBA buffer. Pure and deterministic.
 *
 * Busyness blends two cheap signals that together track "would type get lost
 * here": luminance *variance* (a band of mixed light and dark) and *edge
 * density* (neighbouring pixels that jump). Either alone misreads — a smooth
 * gradient has high variance but is fine behind text; fine texture has low
 * variance but shreds legibility.
 */
export function scoreBands(rgba: Uint8ClampedArray, size: number): BandScores {
  if (size <= 0 || rgba.length < size * size * 4) return { ...EMPTY };

  const third = size / 3;
  const scores = { ...EMPTY };

  for (const [index, band] of BANDS.entries()) {
    const y0 = Math.floor(index * third);
    const y1 = index === BANDS.length - 1 ? size : Math.floor((index + 1) * third);
    scores[band] = bandBusyness(rgba, size, y0, y1);
  }
  return scores;
}

/**
 * Pick where type should go: the first `prefer`red band that is quiet enough,
 * else the calmest band overall. Preference order breaks ties, so a Look's
 * intended placement wins whenever the photo allows it.
 */
export function quietestBand(scores: BandScores, prefer: readonly Band[]): Band {
  const preferred = prefer.find((band) => scores[band] < QUIET_THRESHOLD);
  if (preferred) return preferred;

  // Every preferred band is busy — take the calmest, still honouring the Look's
  // order when two bands are equally calm.
  const order = [...prefer, ...BANDS.filter((band) => !prefer.includes(band))];
  return order.reduce((best, band) => (scores[band] < scores[best] ? band : best), order[0]);
}

/** Blend luminance variance and edge density for one horizontal band. */
function bandBusyness(rgba: Uint8ClampedArray, size: number, y0: number, y1: number): number {
  let sum = 0;
  let sumSq = 0;
  let edges = 0;
  let count = 0;
  let pairs = 0;

  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < size; x++) {
      const lum = luminance(rgba, (y * size + x) * 4);
      sum += lum;
      sumSq += lum * lum;
      count++;

      // Compare rightward and downward only, so each pair is counted once.
      if (x + 1 < size) {
        edges += Math.abs(lum - luminance(rgba, (y * size + x + 1) * 4));
        pairs++;
      }
      if (y + 1 < y1) {
        edges += Math.abs(lum - luminance(rgba, ((y + 1) * size + x) * 4));
        pairs++;
      }
    }
  }
  if (count === 0) return 0;

  const mean = sum / count;
  // Standard deviation, normalised: 0.35 of the 0..1 range is already a very
  // mixed band, so treat that as the top of the scale.
  const variance = Math.sqrt(Math.max(0, sumSq / count - mean * mean)) / 0.35;
  // Mean neighbour delta; 0.25 is a hard, contrasty texture.
  const edginess = pairs === 0 ? 0 : edges / pairs / 0.25;

  return clamp01(variance * 0.45 + edginess * 0.55);
}

/** Perceived luminance, 0..1 (Rec. 601 — cheap and good enough at this size). */
function luminance(rgba: Uint8ClampedArray, i: number): number {
  return (rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114) / 255;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Decode the photo into a small canvas and score its bands. Impure; returns a
 * flat "quiet everywhere" map where a 2D context isn't available (e.g. tests),
 * so a Look always keeps its preferred placement rather than crashing.
 */
export function sampleBands(bitmap: ImageBitmap): BandScores {
  const N = 48;
  const canvas = new OffscreenCanvas(N, N);
  const ctx = canvas.getContext('2d');
  if (!ctx) return { ...EMPTY };
  ctx.drawImage(bitmap, 0, 0, N, N);
  return scoreBands(ctx.getImageData(0, 0, N, N).data, N);
}
