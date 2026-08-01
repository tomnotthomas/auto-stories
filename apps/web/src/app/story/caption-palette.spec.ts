import { DEFAULT_PALETTE, paletteFor } from './caption-palette';

const HEX = /^#[0-9A-Fa-f]{6}$/;

describe('paletteFor', () => {
  it('returns the neutral default palette when no id is given', () => {
    expect(paletteFor()).toEqual(paletteFor(DEFAULT_PALETTE));
  });

  it('falls back to the default for an unknown id', () => {
    expect(paletteFor('not-a-palette')).toEqual(paletteFor(DEFAULT_PALETTE));
  });

  it('gives every curated palette a valid light/dark text colour and one accent', () => {
    for (const id of ['warm', 'cool', 'mono']) {
      const p = paletteFor(id);
      expect(p.textLight).toMatch(HEX);
      expect(p.textDark).toMatch(HEX);
      expect(p.accent).toMatch(HEX);
    }
  });

  it('returns a distinct palette per curated id', () => {
    expect(paletteFor('cool')).not.toEqual(paletteFor('warm'));
  });
});
