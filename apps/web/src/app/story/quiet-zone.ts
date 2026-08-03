/**
 * The quiet-zone map (decision 7.24) — where on a photo type can sit without
 * fighting the picture. A Look states which horizontal band it prefers; this
 * module says whether that band is calm enough, so a headline never lands on the
 * busiest part of the image.
 *
 * Busyness is two things ORed together, because they fail in opposite ways:
 *
 * 1. **Texture** — luminance variance + edge density. Answers "would type get
 *    lost here", but cannot tell a *subject* from clutter: a plate of food and a
 *    patterned rug score the same, and a face on a plain wall scores *calm*,
 *    which is the worst case (live review: type landed on faces and on food).
 * 2. **Subject** — cheap colour saliency (see `subjectScore`). Answers "does
 *    something here matter", so a region holding a face or a meal reads as
 *    unavailable even when it is smooth.
 *
 * It is deliberately NOT face detection — `FaceDetector` is Chromium-only
 * (absent on iOS Safari), so depending on it would make placement differ by
 * browser. Everything here runs on the 48×48 downscale the app already decodes:
 * no dependency, no model, a few passes over 2304 pixels.
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
 */
export function scoreBands(rgba: Uint8ClampedArray, size: number): BandScores {
  if (size <= 0 || rgba.length < size * size * 4) return { ...EMPTY };

  const third = size / 3;
  const frame = frameStats(rgba, size);
  const scores = { ...EMPTY };

  for (const [index, band] of BANDS.entries()) {
    const y0 = Math.floor(index * third);
    const y1 = index === BANDS.length - 1 ? size : Math.floor((index + 1) * third);
    scores[band] = regionBusyness(rgba, size, 0, size, y0, y1, frame);
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

  const frame = frameStats(rgba, size);
  const busy: number[] = [];
  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      const x0 = Math.floor((col * size) / GRID_COLS);
      const x1 = col === GRID_COLS - 1 ? size : Math.floor(((col + 1) * size) / GRID_COLS);
      const y0 = Math.floor((row * size) / GRID_ROWS);
      const y1 = row === GRID_ROWS - 1 ? size : Math.floor(((row + 1) * size) / GRID_ROWS);
      busy.push(regionBusyness(rgba, size, x0, x1, y0, y1, frame));
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

// ---------------------------------------------------------------------------
// Scoring one region. Bands and cells run the identical code on different
// rectangles, so "busy" means the same thing at both resolutions.
// ---------------------------------------------------------------------------

/**
 * How busy the rectangle `[x0,x1) × [y0,y1)` is, 0…1.
 *
 * Texture and subject are combined as a probabilistic OR (`t + s − t·s`) rather
 * than a weighted sum: either reason alone is enough to rule a region out, and
 * the two together should saturate rather than average each other down. Both
 * inputs are 0…1, so the result is too.
 */
function regionBusyness(
  rgba: Uint8ClampedArray,
  size: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  frame: FrameStats,
): number {
  const texture = textureBusyness(rgba, size, x0, x1, y0, y1);
  const subject = subjectScore(rgba, size, x0, x1, y0, y1, frame);
  return clamp01(texture + subject - texture * subject);
}

/**
 * Luminance variance + edge density: "would type get lost here".
 *
 * Either signal alone misreads — a smooth gradient has high variance but is fine
 * behind text; fine texture has low variance but shreds legibility.
 *
 * Blind to: anything about *meaning*. A face on a plain wall is smooth and
 * scores near zero here; that is what `subjectScore` exists to cover.
 */
function textureBusyness(
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
      // Compare rightward and downward only, so each pair is counted once.
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
  // Standard deviation, normalised: 0.35 of the 0..1 range is already a very
  // mixed region, so treat that as the top of the scale.
  const deviation = Math.sqrt(Math.max(0, sumSq / count - mean * mean)) / 0.35;
  // Mean neighbour delta; 0.25 is a hard, contrasty texture.
  const edginess = pairs === 0 ? 0 : edges / pairs / 0.25;

  return clamp01(deviation * 0.45 + edginess * 0.55);
}

// ---------------------------------------------------------------------------
// Subject saliency — the cheap stand-in for "something here matters".
//
// Two pieces of evidence (skin chroma, colour cluster) and one positional prior
// (centre bias). Each has a stated failure mode below; none is trustworthy
// alone. Both evidence signals are measured *against the rest of the frame*,
// because contrast with the surrounding photo is what separates a subject from
// a surface — absolute thresholds would flag a whole beach or a wooden table.
//
// What the pair cannot see at all: a subject that is neither warm nor more
// colourful than its background, and not textured either — a white dog on
// snow, a grey cat on concrete. Those score as free space, same as before.
// ---------------------------------------------------------------------------

/** Rec. 601 chroma bounds for skin, from Chai & Ngan. Deliberately luma-free:
 * melanin moves Y a great deal and Cb/Cr very little, so one window covers the
 * whole tone range (verified on samples from #FFE0BD to #3B2219, Y 40…229). */
const SKIN_CB = [77, 127] as const;
const SKIN_CR = [133, 173] as const;
/** Ignore near-black and blown-out pixels, where chroma is quantisation noise. */
const SKIN_LUMA = [30, 250] as const;

/** Skin coverage above the frame's own level that reads as a full subject. */
const SKIN_EXCESS_REF = 0.45;
/** Frame-wide skin coverage at which the signal is fully discounted (below).
 * Half a frame of sand is a surface; a person is a minority of the picture. */
const SKIN_UBIQUITY = [0.25, 0.5] as const;
/** Chroma above the frame mean that reads as a full colour cluster. */
const CHROMA_EXCESS_REF = 0.1;
/** Mean neighbour delta at which a colour cluster counts as "detailed". */
const CHROMA_DETAIL_REF = 0.05;
/** How far a subject at the very frame edge is discounted. */
const EDGE_DISCOUNT = 0.35;
/** A full-strength central subject's contribution to busyness. Below 1 so the
 * texture signal can still push a busy subject higher than a smooth one. */
const SUBJECT_WEIGHT = 0.85;

interface FrameStats {
  /** Fraction of the whole frame that is skin-like, 0…1. */
  readonly skin: number;
  /** Mean chroma of the whole frame, 0…~1. */
  readonly chroma: number;
}

/** Chroma (distance from grey) in Rec. 601 Cb/Cr, normalised to roughly 0…1. */
function chroma(cb: number, cr: number): number {
  return Math.hypot(cb - 128, cr - 128) / 128;
}

/** Whether one pixel's chroma sits inside the skin window. */
function isSkin(lum: number, cb: number, cr: number): boolean {
  return (
    lum >= SKIN_LUMA[0] &&
    lum <= SKIN_LUMA[1] &&
    cb >= SKIN_CB[0] &&
    cb <= SKIN_CB[1] &&
    cr >= SKIN_CR[0] &&
    cr <= SKIN_CR[1]
  );
}

/** Skin coverage and mean chroma over one rectangle. */
function colourStats(
  rgba: Uint8ClampedArray,
  size: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): FrameStats {
  let skin = 0;
  let chromaSum = 0;
  let count = 0;

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * size + x) * 4;
      const r = rgba[i];
      const g = rgba[i + 1];
      const b = rgba[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      if (isSkin(lum, cb, cr)) skin += 1;
      chromaSum += chroma(cb, cr);
      count += 1;
    }
  }
  if (count === 0) return { skin: 0, chroma: 0 };
  return { skin: skin / count, chroma: chromaSum / count };
}

/** Colour statistics for the whole photo — computed once per scoring pass and
 * handed to every region, since both evidence signals are measured against it. */
function frameStats(rgba: Uint8ClampedArray, size: number): FrameStats {
  return colourStats(rgba, size, 0, size, 0, size);
}

/**
 * How likely the rectangle holds a *subject* (a face, a meal) rather than a
 * surface, 0…1. Scored on sub-blocks of roughly a sixth of the frame and
 * reduced with `max`, so a face that fills a tenth of a band is not averaged
 * away by the wall around it.
 */
function subjectScore(
  rgba: Uint8ClampedArray,
  size: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  frame: FrameStats,
): number {
  const block = Math.max(4, Math.round(size / 6));
  const cols = Math.max(1, Math.round((x1 - x0) / block));
  const rows = Math.max(1, Math.round((y1 - y0) / block));
  let best = 0;

  for (let row = 0; row < rows; row += 1) {
    const by0 = y0 + Math.floor((row * (y1 - y0)) / rows);
    const by1 = y0 + Math.floor(((row + 1) * (y1 - y0)) / rows);
    for (let col = 0; col < cols; col += 1) {
      const bx0 = x0 + Math.floor((col * (x1 - x0)) / cols);
      const bx1 = x0 + Math.floor(((col + 1) * (x1 - x0)) / cols);
      if (bx1 <= bx0 || by1 <= by0) continue;

      const centreX = (bx0 + bx1) / 2 / size;
      const centreY = (by0 + by1) / 2 / size;
      const score =
        blockSubject(rgba, size, bx0, bx1, by0, by1, frame) * centreBias(centreX, centreY);
      if (score > best) best = score;
    }
  }
  return clamp01(best * SUBJECT_WEIGHT);
}

/** The subject signals for one block. */
function blockSubject(
  rgba: Uint8ClampedArray,
  size: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  frame: FrameStats,
): number {
  const stats = colourStats(rgba, size, x0, x1, y0, y1);

  // (1) Skin chroma. Measured as coverage *above* the frame's own level and
  // damped when the frame is largely skin-like, because the window also catches
  // wood, sand, terracotta and brick — a warm surface fills the frame, a person
  // does not. Blind to: a close-up that is nothing but face (no excess to find,
  // which is honest — no part of that frame is free of the subject), and to a
  // person shot against a wooden wall.
  const skinExcess = clamp01((stats.skin - frame.skin) / SKIN_EXCESS_REF);
  const localised = clamp01(
    (SKIN_UBIQUITY[1] - frame.skin) / (SKIN_UBIQUITY[1] - SKIN_UBIQUITY[0]),
  );
  const skin = skinExcess * localised;

  // (2) Colour cluster: chroma well above the frame mean, gated on the block
  // actually having detail. Food is saturated *and* detailed against a duller
  // table; a blue sky is just as saturated but flat, and without the gate it
  // would read as a subject. Not restricted to warm hues — a green salad or a
  // blue-plated dish is a subject too, and warmth is already signal (1)'s job.
  // Blind to: a subject the same colour as its surroundings (a grey cat on
  // concrete), which only texture can catch.
  const detail = clamp01(meanDelta(rgba, size, x0, x1, y0, y1) / CHROMA_DETAIL_REF);
  const cluster = clamp01((stats.chroma - frame.chroma) / CHROMA_EXCESS_REF) * detail;

  // The two are largely independent evidence, so take the stronger and let the
  // weaker nudge it up, rather than averaging (which would halve a clear face).
  return clamp01(Math.max(skin, cluster) + 0.25 * Math.min(skin, cluster));
}

/** Mean absolute neighbour delta in luminance over a block, 0…1. */
function meanDelta(
  rgba: Uint8ClampedArray,
  size: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): number {
  let edges = 0;
  let pairs = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const lum = luminance(rgba, (y * size + x) * 4);
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
  return pairs === 0 ? 0 : edges / pairs;
}

/**
 * (3) Centre bias. Subjects sit near the centre or on the thirds; frame edges
 * are usually background that happens to be colourful. Cubic, so the thirds are
 * barely touched (×0.98) and only the outer margin is discounted (×0.65 at the
 * very edge). Blind to: a deliberately edge-framed subject, which is
 * under-weighted — hence the gentle curve rather than a hard mask.
 */
function centreBias(x: number, y: number): number {
  const edge = Math.max(Math.abs(x - 0.5), Math.abs(y - 0.5)) * 2;
  return 1 - EDGE_DISCOUNT * edge * edge * edge;
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
