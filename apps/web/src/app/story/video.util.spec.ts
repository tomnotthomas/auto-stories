import { DEFAULT_VIDEO_FRAMES, isVideoFile, sampleTimestamps } from './video.util';

function file(type: string): File {
  return new File(['x'], 'clip', { type });
}

describe('isVideoFile', () => {
  it('is true for any video container, false otherwise', () => {
    expect(isVideoFile(file('video/mp4'))).toBe(true);
    expect(isVideoFile(file('video/quicktime'))).toBe(true); // iPhone .mov
    expect(isVideoFile(file('image/jpeg'))).toBe(false);
    expect(isVideoFile(file(''))).toBe(false);
  });
});

describe('sampleTimestamps', () => {
  it('returns [] for a non-positive duration or count', () => {
    expect(sampleTimestamps(0, 3)).toEqual([]);
    expect(sampleTimestamps(-5, 3)).toEqual([]);
    expect(sampleTimestamps(10, 0)).toEqual([]);
    expect(sampleTimestamps(10, -1)).toEqual([]);
  });

  it('samples the midpoint for a single frame', () => {
    expect(sampleTimestamps(10, 1)).toEqual([5]);
  });

  it('spreads N frames evenly, off the very start and end', () => {
    const ts = sampleTimestamps(10, DEFAULT_VIDEO_FRAMES);
    expect(ts).toHaveLength(3);
    // pad = 0.8 → [0.8, 5, 9.2]
    expect(ts[0]).toBeCloseTo(0.8);
    expect(ts[1]).toBeCloseTo(5);
    expect(ts[2]).toBeCloseTo(9.2);
    // Every timestamp is strictly inside the clip.
    for (const t of ts) {
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThan(10);
    }
  });

  it('returns strictly increasing timestamps', () => {
    const ts = sampleTimestamps(30, 5);
    for (let i = 1; i < ts.length; i++) {
      expect(ts[i]).toBeGreaterThan(ts[i - 1]);
    }
  });

  it('stays within a very short clip without crossing the midpoint', () => {
    const ts = sampleTimestamps(1, 3);
    for (const t of ts) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(1);
    }
  });
});
