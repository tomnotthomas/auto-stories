import { BANDS, quietestBand, scoreBands, type Band } from './quiet-zone';

const N = 48;

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
