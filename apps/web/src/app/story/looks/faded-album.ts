import type { Composition, FrameContent, Look, Part, PhotoAnalysis } from '../look';
import { splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * Look 09 — **Faded Album** (decision 7.24).
 *
 * A page from an old album: the picture washed out under a long, soft overlay,
 * one centred line of Fraunces, and a hairline ruled beneath it — the printed
 * line a caption was once written on. The quietest Look in the group; it draws
 * three things and none of them is loud.
 *
 * Geometry is authored in the same units as the rest of the engine — `WPct` is
 * a percentage of the frame WIDTH, `HPct` of its HEIGHT.
 */

const FRAUNCES = '"Fraunces", Georgia, "Times New Roman", serif';

/** The narrowest measure of the four: a centred album caption is a short line. */
const COLUMN_INSET_WPCT = 15;
const EDGE_OFFSET_HPCT = 13;

/** Washed and lifted, colour drained — dye that has been in the light too long. */
const FADED = 'saturate(0.72) contrast(0.9) brightness(1.06) sepia(0.12)';

/** An album caption sits under the picture; the top is its fallback. */
const PREFERRED_BANDS: readonly Band[] = ['bottom', 'top'];

function compose(content: FrameContent, photo: PhotoAnalysis): Composition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'top' ? 'top' : 'bottom';

  // Silent: the photo speaks for itself (decision 7.26). The rule is the line a
  // caption is written on, so with no caption it rules nothing; the overlay only
  // exists to keep that caption legible. Both go. The wash stays — it is how
  // this album's pages have aged, and every page ages the same.
  if (!content.headline.trim()) {
    return {
      lookId: 'faded-album',
      ink: 'auto',
      leftPct: COLUMN_INSET_WPCT,
      rightPct: COLUMN_INSET_WPCT,
      anchor,
      offsetHPct: EDGE_OFFSET_HPCT,
      scrim: null,
      accent: photo.accent,
      parts: [],
      photoFilter: FADED,
    };
  }

  const parts: Part[] = [];

  // A tracked-out label above the line — the year pencilled at the top of a page.
  const kicker = content.kicker?.trim();
  if (kicker) {
    parts.push({
      kind: 'text',
      runs: [{ text: kicker }],
      fontFamily: FRAUNCES,
      fontWeight: 400,
      fontSizeWPct: 2.2,
      lineHeight: 1.2,
      letterSpacingEm: 0.32,
      textTransform: 'uppercase',
      textAlign: 'center',
      color: 'ink',
      gapHPct: 0,
    });
  }

  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: FRAUNCES,
    fontWeight: 400,
    fontSizeWPct: 5.8,
    lineHeight: 1.3,
    letterSpacingEm: 0.008,
    textTransform: 'none',
    textAlign: 'center',
    color: 'ink',
    gapHPct: kicker ? 2.4 : 0,
  });

  // The ruled line. Barely there — thin enough that at frame size it reads as a
  // pressed line on paper rather than a drawn rule, which is the whole effect.
  parts.push({
    kind: 'rule',
    gapHPct: 2.8,
    thicknessHPct: 0.05,
    widthPct: 100,
    opacity: 0.34,
    color: 'ink',
  });

  // The place, under the rule, the size a caption is actually written.
  const location = content.location?.trim();
  if (location) {
    parts.push({
      kind: 'text',
      runs: [{ text: location }],
      fontFamily: FRAUNCES,
      fontWeight: 400,
      fontSizeWPct: 2,
      lineHeight: 1.2,
      letterSpacingEm: 0.24,
      textTransform: 'uppercase',
      textAlign: 'center',
      color: 'ink',
      gapHPct: 2.2,
    });
  }

  return {
    lookId: 'faded-album',
    ink: 'light',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    // Long and weak, where the others are short and firm: the point is a wash
    // over most of the page, not a bar behind the words.
    scrim: { from: anchor, extentHPct: 78, strength: 0.44 },
    accent: photo.accent,
    parts,
    photoFilter: FADED,
  };
}

export const FADED_ALBUM: Look = {
  id: 'faded-album',
  prefer: PREFERRED_BANDS,
  compose,
};
