import {
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
    // The casual/handwriting slot renders as a modern rounded sans, never a
    // dated script/cursive face.
    expect(fontFamily('caveat')).toContain('sans-serif');
    expect(fontFamily('caveat')).not.toContain('cursive');
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
});
