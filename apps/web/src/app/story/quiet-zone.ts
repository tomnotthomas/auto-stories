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

/**
 * The free-space map (decision 7.25, slice 2).
 *
 * Bands answer "which third should the design hang in". They cannot answer
 * "where does this small tag go", which needs two dimensions — so stickers get a
 * grid. 4×8 is deliberate: a sticker is roughly an eighth of the frame tall, and
 * finer cells would place tags at a precision the eye cannot verify while making
 * the busyness score noisier.
 *
 * The pipeline hands this map from stage to stage. Each stage **subtracts** what
 * it used, so a later layer can never land on an earlier one — that is the whole
 * mechanism, and it is why the location used to sit on top of the headline.
 */
export const GRID_COLS = 4;
export const GRID_ROWS = 8;

/** A rectangle on the frame, in % of frame width / height. */
export interface Box {
  readonly xPct: number;
  readonly yPct: number;
  readonly wPct: number;
  readonly hPct: number;
}

/** One cell's centre, in % of the frame. */
export interface Cell {
  readonly xPct: number;
  readonly yPct: number;
  readonly busy: number;
}

export interface FreeSpace {
  readonly cols: number;
  readonly rows: number;
  /** Busyness per cell, row-major, 0 (flat) … 1 (noisy). */
  readonly busy: readonly number[];
  /** Cells an earlier stage has claimed, row-major. */
  readonly taken: readonly boolean[];
}

/** Above this a cell is too busy to drop a sticker onto. */
export const CELL_BUSY_LIMIT = 0.45;

/** A map with nothing measured and nothing taken — the honest starting value
 * when the photo has not been read (or there is no canvas, e.g. in tests). */
export function emptySpace(): FreeSpace {
  const size = GRID_COLS * GRID_ROWS;
  return {
    cols: GRID_COLS,
    rows: GRID_ROWS,
    busy: new Array<number>(size).fill(0),
    taken: new Array<boolean>(size).fill(false),
  };
}

/** Score every cell of a `size`×`size` RGBA buffer. Pure and deterministic. */
export function scoreGrid(rgba: Uint8ClampedArray, size: number): FreeSpace {
  const base = emptySpace();
  if (size <= 0 || rgba.length < size * size * 4) return base;

  const busy: number[] = [];
  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      const x0 = Math.floor((col * size) / GRID_COLS);
      const x1 = col === GRID_COLS - 1 ? size : Math.floor(((col + 1) * size) / GRID_COLS);
      const y0 = Math.floor((row * size) / GRID_ROWS);
      const y1 = row === GRID_ROWS - 1 ? size : Math.floor(((row + 1) * size) / GRID_ROWS);
      busy.push(cellBusyness(rgba, size, x0, x1, y0, y1));
    }
  }
  return { ...base, busy };
}

/** Mark every cell a box overlaps as taken. Pure — returns a new map, so a
 * stage can never mutate what an earlier stage handed it. */
export function claim(space: FreeSpace, box: Box): FreeSpace {
  const taken = [...space.taken];
  const left = box.xPct;
  const right = box.xPct + box.wPct;
  const top = box.yPct;
  const bottom = box.yPct + box.hPct;

  for (let row = 0; row < space.rows; row += 1) {
    for (let col = 0; col < space.cols; col += 1) {
      const cellLeft = (col / space.cols) * 100;
      const cellRight = ((col + 1) / space.cols) * 100;
      const cellTop = (row / space.rows) * 100;
      const cellBottom = ((row + 1) / space.rows) * 100;
      const overlaps = left < cellRight && right > cellLeft && top < cellBottom && bottom > cellTop;
      if (overlaps) taken[row * space.cols + col] = true;
    }
  }
  return { ...space, taken };
}

/**
 * The calmest free cell, or null when nothing is free enough. Returning null is
 * the point: a sticker with nowhere honest to go is dropped, because nothing is
 * better than a collision (7.25).
 */
export function bestCell(space: FreeSpace, limit = CELL_BUSY_LIMIT): Cell | null {
  let best: Cell | null = null;
  for (let row = 0; row < space.rows; row += 1) {
    for (let col = 0; col < space.cols; col += 1) {
      const index = row * space.cols + col;
      if (space.taken[index]) continue;
      const busy = space.busy[index] ?? 0;
      if (busy > limit) continue;
      if (best && busy >= best.busy) continue;
      best = {
        xPct: ((col + 0.5) / space.cols) * 100,
        yPct: ((row + 0.5) / space.rows) * 100,
        busy,
      };
    }
  }
  return best;
}

/** The box a cell covers, so placing into it can claim it. */
export function cellBox(space: FreeSpace, cell: Cell): Box {
  const wPct = 100 / space.cols;
  const hPct = 100 / space.rows;
  return { xPct: cell.xPct - wPct / 2, yPct: cell.yPct - hPct / 2, wPct, hPct };
}

/** Luminance variance + edge density over one cell — the same blend the bands
 * use, so "busy" means the same thing at both resolutions. */
function cellBusyness(
  rgba: Uint8ClampedArray,
  size: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): number {
  let sum = 0;
  let sumSq = 0;
  let edges = 0;
  let count = 0;
  let pairs = 0;

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const lum = luminance(rgba, (y * size + x) * 4);
      sum += lum;
      sumSq += lum * lum;
      count += 1;
      if (x + 1 < x1) {
        edges += Math.abs(lum - luminance(rgba, (y * size + x + 1) * 4));
        pairs += 1;
      }
      if (y + 1 < y1) {
        edges += Math.abs(lum - luminance(rgba, ((y + 1) * size + x) * 4));
        pairs += 1;
      }
    }
  }
  if (count === 0) return 0;

  const mean = sum / count;
  const variance = Math.sqrt(Math.max(0, sumSq / count - mean * mean)) / 0.35;
  const edginess = pairs === 0 ? 0 : edges / pairs / 0.25;
  return clamp01(variance * 0.45 + edginess * 0.55);
}

/** Decode the photo once and score the grid. Impure; an empty map where there is
 * no 2D context, so placement degrades to "nothing is busy" rather than crashing. */
export function sampleGrid(bitmap: ImageBitmap): FreeSpace {
  const N = 48;
  const canvas = new OffscreenCanvas(N, N);
  const ctx = canvas.getContext('2d');
  if (!ctx) return emptySpace();
  ctx.drawImage(bitmap, 0, 0, N, N);
  return scoreGrid(ctx.getImageData(0, 0, N, N).data, N);
}
