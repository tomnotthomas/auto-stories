import {
  BANDS,
  bestCell,
  CELL_BUSY_LIMIT,
  QUIET_THRESHOLD,
  quietestBand,
  scoreBands,
  scoreGrid,
  type Band,
} from './quiet-zone';

const N = 48;

type RGB = readonly [number, number, number];

/** Build an N×N RGBA buffer from a per-pixel grey function. */
function grid(grey: (x: number, y: number) => number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      const v = grey(x, y);
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return data;
}

/** Build an N×N RGBA buffer from a per-pixel colour function. */
function rgbGrid(pixel: (x: number, y: number) => RGB): Uint8ClampedArray {
  const data = new Uint8ClampedArray(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      const [r, g, b] = pixel(x, y);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return data;
}

function rgb(hex: string): RGB {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A plain, evenly lit interior wall — the calm background every fixture uses. */
const WALL: RGB = [205, 205, 205];

/** Fitzpatrick-spanning skin samples, light through deep. */
const SKIN_TONES: readonly RGB[] = [
  rgb('#ffe0bd'),
  rgb('#f1c27d'),
  rgb('#e0ac69'),
  rgb('#c68642'),
  rgb('#8d5524'),
  rgb('#5c3836'),
];

function inOval(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

/** A head-and-shoulders subject on a plain wall, sitting in the middle third. */
function faceOnWall(tone: RGB): Uint8ClampedArray {
  return rgbGrid((x, y) => (inOval(x, y, 24, 24, 7, 9) ? tone : WALL));
}

/** Deterministic ±amount jitter, so fixtures have grain without randomness. */
function grain(x: number, y: number, amount: number): number {
  return (((x * 7 + y * 13) % 5) - 2) * (amount / 2);
}

function shade([r, g, b]: RGB, delta: number): RGB {
  return [r + delta, g + delta, b + delta];
}

/** Flat blue sky: strongly saturated, no detail — saturation alone is not a subject. */
const FLAT_SKY = rgbGrid(() => rgb('#6fa8dc'));

/** A warm wooden table filling the frame: skin-like chroma everywhere, no subject. */
const WOOD_TABLE = rgbGrid((x, y) => shade(rgb('#c19a6b'), grain(x, y, 8)));

/** A plate of food low in the frame, on that same wooden table. */
const FOOD: readonly RGB[] = [rgb('#e03b24'), rgb('#d98e33'), rgb('#6aa84f'), rgb('#f2f2f0')];
const PLATE = rgbGrid((x, y) => {
  if (inOval(x, y, 24, 38, 10, 8)) return FOOD[(x * 3 + y * 5) % FOOD.length];
  return shade(rgb('#c19a6b'), grain(x, y, 8));
});

/** Half a frame of sand under sky: sand sits inside the skin window, so this is
 * the false positive the frame-wide damping exists to kill. */
const BEACH = rgbGrid((x, y) =>
  y < N / 2 ? rgb('#6fa8dc') : shade(rgb('#e4d5b7'), grain(x, y, 6)),
);

/** A person pushed hard to the bottom edge — centre bias must not hide them. */
const EDGE_PERSON = rgbGrid((x, y) => (inOval(x, y, 24, 44, 6, 8) ? rgb('#8d5524') : WALL));

/** A busy tree line across the bottom third, under an even overcast sky. */
const TREE_LINE = rgbGrid((x, y) =>
  y >= (2 * N) / 3 ? shade(rgb('#4c7a3f'), grain(x, y, 90)) : [214, 216, 220],
);

/** A 10×10 warm patch, placed either dead centre or hard into the top-left corner. */
function patchAt(x0: number, y0: number): Uint8ClampedArray {
  return rgbGrid((x, y) =>
    x >= x0 && x < x0 + 10 && y >= y0 && y < y0 + 10 ? rgb('#c68642') : WALL,
  );
}

function maxBusy(rgba: Uint8ClampedArray): number {
  return Math.max(...scoreGrid(rgba, N).busy);
}

/** Flat grey everywhere — no band is busier than another. */
const FLAT = grid(() => 128);

/** Noisy top third, flat elsewhere. */
const BUSY_TOP = grid((x, y) => (y < N / 3 ? ((x * 7 + y * 13) % 2 ? 20 : 235) : 128));

/** Noisy bottom third, flat elsewhere. */
const BUSY_BOTTOM = grid((x, y) => (y >= (2 * N) / 3 ? ((x * 7 + y * 13) % 2 ? 20 : 235) : 128));

describe('scoreBands', () => {
  it('scores every band', () => {
    const scores = scoreBands(FLAT, N);

    expect(Object.keys(scores).sort()).toEqual([...BANDS].sort());
  });

  it('reports a flat photo as quiet everywhere', () => {
    const scores = scoreBands(FLAT, N);

    for (const band of BANDS) {
      expect(scores[band]).toBeLessThan(0.1);
    }
  });

  it('reports the noisy band as busier than the calm ones', () => {
    const scores = scoreBands(BUSY_TOP, N);

    expect(scores.top).toBeGreaterThan(scores.middle);
    expect(scores.top).toBeGreaterThan(scores.bottom);
  });

  it('keeps busyness within 0..1', () => {
    for (const scores of [scoreBands(FLAT, N), scoreBands(BUSY_TOP, N)]) {
      for (const band of BANDS) {
        expect(scores[band]).toBeGreaterThanOrEqual(0);
        expect(scores[band]).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is deterministic', () => {
    expect(scoreBands(BUSY_TOP, N)).toEqual(scoreBands(BUSY_TOP, N));
  });

  it('survives an empty buffer', () => {
    const scores = scoreBands(new Uint8ClampedArray(0), 0);

    for (const band of BANDS) {
      expect(scores[band]).toBe(0);
    }
  });
});

describe('quietestBand', () => {
  it('keeps the preferred band when it is quiet enough', () => {
    // The photo is busy up top, so a bottom-anchored Look should stay put.
    expect(quietestBand(scoreBands(BUSY_TOP, N), ['bottom'])).toBe('bottom');
  });

  it('moves off the preferred band when that band is the busy one', () => {
    expect(quietestBand(scoreBands(BUSY_BOTTOM, N), ['bottom'])).not.toBe('bottom');
  });

  it('honours preference order when bands tie', () => {
    const order: Band[] = ['middle', 'top', 'bottom'];

    expect(quietestBand(scoreBands(FLAT, N), order)).toBe('middle');
  });

  it('falls back to the first preference when given no scores', () => {
    expect(quietestBand({ top: 0, middle: 0, bottom: 0 }, ['top'])).toBe('top');
  });
});

/**
 * Subject awareness (live review: type landed on faces and on plates of food).
 * Texture alone cannot tell a subject from clutter, so these assert *ordering* —
 * a region holding a subject must outscore a plain one — never exact numbers.
 */
describe('scoreBands — subject awareness', () => {
  it('reads a face on a plain wall as unavailable, not as free space', () => {
    const scores = scoreBands(faceOnWall(rgb('#c68642')), N);

    expect(scores.middle).toBeGreaterThan(scores.top);
    expect(scores.middle).toBeGreaterThan(scores.bottom);
    expect(scores.middle).toBeGreaterThan(QUIET_THRESHOLD);
  });

  it('finds the face across the whole tone range, not just light skin', () => {
    for (const tone of SKIN_TONES) {
      const scores = scoreBands(faceOnWall(tone), N);

      expect(scores.middle).toBeGreaterThan(QUIET_THRESHOLD);
      expect(scores.top).toBeLessThan(QUIET_THRESHOLD);
    }
  });

  it('scores every skin tone within a comparable range of the others', () => {
    const middles = SKIN_TONES.map((tone) => scoreBands(faceOnWall(tone), N).middle);

    // No tone may score less than 70% of the strongest — a detector that only
    // fires on light skin is worse than none.
    expect(Math.min(...middles)).toBeGreaterThan(0.7 * Math.max(...middles));
  });

  it('moves a middle-anchored Look off a face', () => {
    expect(quietestBand(scoreBands(faceOnWall(rgb('#8d5524')), N), ['middle'])).not.toBe('middle');
  });

  it('reads a plate of food as busier than the empty table above it', () => {
    const scores = scoreBands(PLATE, N);

    expect(scores.bottom).toBeGreaterThan(scores.top);
    expect(scores.bottom).toBeGreaterThan(QUIET_THRESHOLD);
  });

  it('leaves a flat saturated sky quiet — colour alone is not a subject', () => {
    const scores = scoreBands(FLAT_SKY, N);

    for (const band of BANDS) {
      expect(scores[band]).toBeLessThan(QUIET_THRESHOLD);
    }
  });

  it('leaves a frame-filling warm surface quiet — skin chroma alone is not a subject', () => {
    const scores = scoreBands(WOOD_TABLE, N);

    for (const band of BANDS) {
      expect(scores[band]).toBeLessThan(QUIET_THRESHOLD);
    }
  });

  it('leaves a beach quiet — sand is skin-coloured but it is a surface, not a subject', () => {
    const scores = scoreBands(BEACH, N);

    for (const band of BANDS) {
      expect(scores[band]).toBeLessThan(QUIET_THRESHOLD);
    }
  });

  it('still finds a subject pushed to the frame edge', () => {
    const scores = scoreBands(EDGE_PERSON, N);

    expect(scores.bottom).toBeGreaterThan(QUIET_THRESHOLD);
  });

  it('still reads a busy tree line from its texture alone', () => {
    const scores = scoreBands(TREE_LINE, N);

    expect(scores.bottom).toBeGreaterThan(scores.top);
    expect(scores.top).toBeLessThan(QUIET_THRESHOLD);
  });

  it('keeps colour photos within 0..1', () => {
    for (const rgba of [faceOnWall(rgb('#e0ac69')), PLATE, FLAT_SKY, WOOD_TABLE]) {
      for (const band of BANDS) {
        expect(scoreBands(rgba, N)[band]).toBeGreaterThanOrEqual(0);
        expect(scoreBands(rgba, N)[band]).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is deterministic on colour photos', () => {
    expect(scoreBands(PLATE, N)).toEqual(scoreBands(PLATE, N));
  });
});

describe('scoreGrid — subject awareness', () => {
  it('marks the cells over a plate of food as too busy for a sticker', () => {
    const space = scoreGrid(PLATE, N);
    // The plate is centred at (50%, 79%) — cols 1-2 of row 6.
    const overPlate = space.busy[6 * space.cols + 1];

    expect(overPlate).toBeGreaterThan(CELL_BUSY_LIMIT);
  });

  it('places a sticker away from the plate rather than on it', () => {
    const cell = bestCell(scoreGrid(PLATE, N));

    expect(cell).not.toBeNull();
    expect(cell?.yPct).toBeLessThan(60);
  });

  it('places a sticker away from a face on a plain wall', () => {
    const cell = bestCell(scoreGrid(faceOnWall(rgb('#8d5524')), N));

    expect(cell).not.toBeNull();
    // The face covers roughly y 31-69%; anything outside that is honest.
    expect(cell!.yPct < 31 || cell!.yPct > 69).toBe(true);
  });

  it('still offers a cell on a flat sky', () => {
    expect(bestCell(scoreGrid(FLAT_SKY, N))).not.toBeNull();
  });

  it('weighs a subject at the centre above the same subject at the frame edge', () => {
    expect(maxBusy(patchAt(19, 19))).toBeGreaterThan(maxBusy(patchAt(0, 0)));
  });

  it('keeps every cell within 0..1', () => {
    for (const rgba of [PLATE, faceOnWall(rgb('#ffe0bd')), FLAT_SKY, WOOD_TABLE]) {
      for (const busy of scoreGrid(rgba, N).busy) {
        expect(busy).toBeGreaterThanOrEqual(0);
        expect(busy).toBeLessThanOrEqual(1);
      }
    }
  });

  it('survives an empty buffer', () => {
    const space = scoreGrid(new Uint8ClampedArray(0), 0);

    expect(space.busy.every((busy) => busy === 0)).toBe(true);
  });
});
