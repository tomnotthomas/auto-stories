import { fitMultiplier } from './caption-render';

describe('caption-render type fit', () => {
  it('fits type to text length: short reads big, long shrinks to fit', () => {
    const short = fitMultiplier('One candle.');
    const long = fitMultiplier(
      'Everyone made it out to the lake for Maya first birthday and it was a whole beautiful chaotic day',
    );
    expect(short).toBeGreaterThan(1); // short caption reads as a headline
    expect(long).toBeLessThan(1); // long caption shrinks
    expect(short).toBeGreaterThan(long); // monotonic
  });

  it('clamps the fit multiplier to a safe range', () => {
    for (const text of ['', 'Hi', 'x'.repeat(400)]) {
      const m = fitMultiplier(text);
      expect(m).toBeGreaterThanOrEqual(0.72);
      expect(m).toBeLessThanOrEqual(1.25);
    }
  });
});
