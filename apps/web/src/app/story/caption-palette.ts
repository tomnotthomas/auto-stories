/**
 * A curated caption palette, shared across every frame of a story so the set
 * reads as one piece (not per-frame extracted colour). Two text colours — the
 * device picks light vs dark from the pixels under the caption ({@link pickReadable})
 * — plus one restrained accent for the keyline / authored band. Colours are
 * curated constants, not free values, so the look stays coherent.
 */
export interface Palette {
  /** Caption text over a dark area. Slightly off pure white to read warmer. */
  readonly textLight: string;
  /** Caption text over a light area. Near-black, never harsh #000. */
  readonly textDark: string;
  /** One restrained accent (keyline / authored band). */
  readonly accent: string;
}

export type PaletteId = 'warm' | 'cool' | 'mono';

const PALETTES: Record<PaletteId, Palette> = {
  warm: { textLight: '#FBF8F3', textDark: '#17140F', accent: '#E0894A' },
  cool: { textLight: '#F4F7FB', textDark: '#12151A', accent: '#5B8DEF' },
  mono: { textLight: '#FFFFFF', textDark: '#111111', accent: '#8A8A8A' },
};

/** The neutral default: warm, so a set of raw phone photos feels pulled together
 * without imposing a strong colour. The whole story uses one palette. */
export const DEFAULT_PALETTE: PaletteId = 'warm';

/** Resolve a palette id (later chosen by the model) to its colours; unknown or
 * missing ids fall back to the neutral default. */
export function paletteFor(id?: string): Palette {
  return PALETTES[id as PaletteId] ?? PALETTES[DEFAULT_PALETTE];
}
