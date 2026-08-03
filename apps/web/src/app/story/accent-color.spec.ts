import { DEFAULT_ACCENT, vibrantColor } from './accent-color';

/** Build an RGBA buffer from [r,g,b] triples (alpha forced opaque). */
function rgba(...pixels: [number, number, number][]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach(([r, g, b], i) => {
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = 255;
  });
  return out;
}

describe('vibrantColor', () => {
  it('picks the vivid, mid-toned pixel over grey neighbours', () => {
    const color = vibrantColor(
      rgba([120, 120, 120], [230, 90, 40], [60, 60, 60]), // grey, coral, grey
    );
    expect(color).toBe('rgb(230, 90, 40)');
  });

  it('ignores near-black and near-white pixels', () => {
    // Only very dark and very bright pixels → nothing vivid in the mid band.
    expect(vibrantColor(rgba([8, 8, 8], [250, 250, 250], [4, 2, 2]))).toBe(DEFAULT_ACCENT);
  });

  it('falls back to the default accent for a flat / grey photo', () => {
    expect(vibrantColor(rgba([128, 128, 128], [130, 130, 130]))).toBe(DEFAULT_ACCENT);
  });

  it('returns the default for an empty buffer', () => {
    expect(vibrantColor(new Uint8ClampedArray(0))).toBe(DEFAULT_ACCENT);
  });
});
