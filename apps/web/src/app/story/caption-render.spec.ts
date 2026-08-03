import {
  fitMultiplier,
  fontFamily,
  fontWeightCss,
  sizeScale,
  textAlignCss,
  textTransformCss,
} from './caption-render';

describe('caption-render style mapping', () => {
  it('maps each font to a distinct generic family', () => {
    expect(fontFamily('inter')).toContain('sans-serif');
    expect(fontFamily('playfair')).toContain('serif');
    expect(fontFamily('space-mono')).toContain('monospace');
    // The handwriting slot renders a real hand (Caveat) for a personal voice —
    // reverses the earlier "rounded sans, no script" call (decision 7.21).
    expect(fontFamily('caveat')).toContain('cursive');
  });

  it('leads the serif and handwriting slots with the bundled faces', () => {
    // playfair → self-hosted Fraunces; caveat → self-hosted Shantell Sans.
    expect(fontFamily('playfair').startsWith('"Fraunces"')).toBe(true);
    expect(fontFamily('caveat').startsWith('"Shantell Sans"')).toBe(true);
  });

  it('leads the default caption font with the bundled display face', () => {
    // The story caption is a headline; it uses the self-hosted display face
    // (Bricolage Grotesque), with the system stack as fallback.
    expect(fontFamily('inter')).toContain('Bricolage Grotesque');
    expect(fontFamily('inter').startsWith('"Bricolage Grotesque"')).toBe(true);
  });

  it('maps weight, case, and align to CSS values', () => {
    expect(fontWeightCss('bold')).toBe(700);
    expect(fontWeightCss('regular')).toBe(400);
    expect(textTransformCss('upper')).toBe('uppercase');
    expect(textTransformCss('normal')).toBe('none');
    expect(textAlignCss('left')).toBe('left');
    expect(textAlignCss('right')).toBe('right');
  });

  it('scales size s < m < l', () => {
    expect(sizeScale('s')).toBeLessThan(sizeScale('m'));
    expect(sizeScale('m')).toBeLessThan(sizeScale('l'));
    expect(sizeScale('m')).toBe(1);
  });

  it('fits type to caption length: short reads big, long shrinks to fit', () => {
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
