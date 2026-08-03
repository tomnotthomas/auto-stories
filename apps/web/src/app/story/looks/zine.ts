import type { DrawnComposition, FrameContent, Look, Part, PhotoAnalysis } from '../look';
import { splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * **Zine** (decision 7.24, built out under 7.27).
 *
 * Photocopied punk: heavy caps set as tight as they will go, a thick bar of ink
 * across the column, the whole thing slapped down off-square, and one word
 * blocked out in the accent with the letters reversed out of it.
 *
 * The loud end of the catalogue — the Look for a night out, not a landscape.
 * Its energy comes from weight and tilt, not from more elements: it is Magazine
 * with the grid kicked over, and it carries exactly one mark.
 *
 * Geometry is in the Looks' authoring units: `WPct` is a percentage of the
 * frame's WIDTH, `HPct` of its HEIGHT.
 */

const BRICOLAGE = '"Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const COLUMN_INSET_WPCT = 8;
const EDGE_OFFSET_HPCT = 9;

/**
 * Tilted the other way from Scrapbook's page: the two hand-made Looks sit side
 * by side in one story set, and a shared lean would read as a rendering fault
 * rather than as two different hands.
 */
const PAGE_TILT_DEG = 1.8;

/** A cover shouts from the top; the bottom is the fallback. */
const PREFERRED_BANDS: readonly Band[] = ['top', 'bottom'];

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'top' ? 'top' : 'bottom';

  // Silent: the photo speaks for itself (7.26). The bar exists to sit under the
  // words; with no words it is a black stripe across someone's picture.
  if (!content.headline.trim()) {
    return {
      lookId: 'zine',
      ink: 'light',
      leftPct: COLUMN_INSET_WPCT,
      rightPct: COLUMN_INSET_WPCT,
      anchor,
      offsetHPct: EDGE_OFFSET_HPCT,
      scrim: null,
      accent: photo.accent,
      parts: [],
    };
  }

  const parts: Part[] = [];

  // Wide-tracked caps in the accent — the strip of type across the top of a
  // photocopied cover.
  const kicker = content.kicker?.trim();
  if (kicker) {
    parts.push({
      kind: 'text',
      runs: [{ text: kicker }],
      fontFamily: BRICOLAGE,
      fontWeight: 800,
      fontSizeWPct: 3.2,
      lineHeight: 1.1,
      letterSpacingEm: 0.24,
      textTransform: 'uppercase',
      textAlign: 'left',
      color: 'accent',
      gapHPct: 0,
    });
  }

  // The bar. Thick where Magazine's is a hairline — this is toner, not
  // typography — and unconditional, because it is the Look's spine.
  parts.push({
    kind: 'rule',
    gapHPct: kicker ? 1.8 : 0,
    thicknessHPct: 0.62,
    widthPct: 100,
    opacity: 1,
    color: 'ink',
  });

  // The shout. Biggest type in the catalogue, negative tracking and leading
  // under 1 so the lines lock into a block; one phrase blocked out in accent.
  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: BRICOLAGE,
    fontWeight: 800,
    fontSizeWPct: 10.6,
    lineHeight: 0.92,
    letterSpacingEm: -0.025,
    textTransform: 'uppercase',
    textAlign: 'left',
    color: 'ink',
    gapHPct: 2.4,
    mark: 'accent-block',
  });

  // The place, set like a venue line at the foot of a flyer. Plain type, not a
  // tag: the tags in this set belong to the Looks that make a graphic of them.
  const location = content.location?.trim();
  if (location) {
    parts.push({
      kind: 'text',
      runs: [{ text: location }],
      fontFamily: BRICOLAGE,
      fontWeight: 700,
      fontSizeWPct: 2.8,
      lineHeight: 1.2,
      letterSpacingEm: 0.18,
      textTransform: 'uppercase',
      textAlign: 'left',
      color: 'ink',
      gapHPct: 2.6,
    });
  }

  return {
    lookId: 'zine',
    // Unconditional scrim: this Look sets the largest type in the set over an
    // unknown photo, and reversed-out caps need something behind them.
    ink: 'light',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    scrim: { from: anchor, extentHPct: 66, strength: 0.8 },
    accent: photo.accent,
    parts,
    rotationDeg: PAGE_TILT_DEG,
    // The venue line at the foot of the flyer named the place (7.25).
    consumedLocation: Boolean(location),
  };
}

export const ZINE: Look = {
  id: 'zine',
  prefer: PREFERRED_BANDS,
  compose,
};
