import { averageLuminance, pickReadable } from './caption-style';

/** Build an RGBA buffer of `count` pixels all set to grey level `v` (0..255). */
function solid(v: number, count = 4): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count * 4; i += 4) {
    rgba[i] = v;
    rgba[i + 1] = v;
    rgba[i + 2] = v;
    rgba[i + 3] = 255;
  }
  return rgba;
}

describe('averageLuminance', () => {
  it('is 0 for black, 1 for white, ~0.5 for mid grey', () => {
    expect(averageLuminance(solid(0))).toBe(0);
    expect(averageLuminance(solid(255))).toBeCloseTo(1, 5);
    expect(averageLuminance(solid(128))).toBeCloseTo(0.5, 1);
  });

  it('returns 0 for an empty buffer', () => {
    expect(averageLuminance(new Uint8ClampedArray(0))).toBe(0);
  });
});

describe('pickReadable', () => {
  it('uses light text on a dark area, dark text on a light area', () => {
    expect(pickReadable(0.1).light).toBe(true);
    expect(pickReadable(0.9).light).toBe(false);
  });

  it('adds a scrim only when contrast is ambiguous (mid luminance)', () => {
    expect(pickReadable(0.5).scrim).toBe(true);
    expect(pickReadable(0.1).scrim).toBe(false);
    expect(pickReadable(0.9).scrim).toBe(false);
  });
});
