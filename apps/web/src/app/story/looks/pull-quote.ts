import type { DrawnComposition, FrameContent, Look, Part, PhotoAnalysis } from '../look';
import { splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * Look 09 — **Pull Quote** (catalogue B. Editorial).
 *
 * The line lifted out of the piece and set large: an oversized opening quote in
 * the accent, the words centred in Fraunces beneath it, the closing quote under
 * that, and the place as an attribution. Narrower column than the other
 * editorial Looks — a pull quote is short measure by definition, and the white
 * space either side is what makes it read as quoted rather than as a caption.
 *
 * Geometry is in the mockups' container-query units: `WPct` is a percentage of
 * the frame WIDTH, `HPct` of its HEIGHT.
 */

const FRAUNCES = '"Fraunces", Georgia, "Times New Roman", serif';

/** Short measure — the quote never runs the full width of the frame. */
const COLUMN_INSET_WPCT = 12;

/** A quote sits in the body of the page, not at an edge. */
const PREFERRED_BANDS: readonly Band[] = ['middle', 'bottom', 'top'];

/** How far in from the anchored edge the stack hangs, per band. */
const EDGE_OFFSET_HPCT = 9;
/** The middle band has no edge of its own, so it is measured from the top. */
const MIDDLE_OFFSET_HPCT = 28;

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'bottom' ? 'bottom' : 'top';
  const offsetHPct = band === 'middle' ? MIDDLE_OFFSET_HPCT : EDGE_OFFSET_HPCT;

  // Silent: quote marks with nothing between them (7.26).
  if (!content.headline.trim()) {
    return {
      lookId: 'pull-quote',
      ink: 'auto',
      leftPct: COLUMN_INSET_WPCT,
      rightPct: COLUMN_INSET_WPCT,
      anchor,
      offsetHPct,
      scrim: null,
      accent: photo.accent,
      parts: [],
    };
  }

  const parts: Part[] = [];

  const kicker = content.kicker?.trim();
  if (kicker) {
    parts.push({
      kind: 'text',
      runs: [{ text: kicker }],
      fontFamily: FRAUNCES,
      fontWeight: 400,
      fontSizeWPct: 2.3,
      lineHeight: 1.2,
      letterSpacingEm: 0.28,
      textTransform: 'uppercase',
      textAlign: 'center',
      color: 'ink',
      gapHPct: 0,
    });
  }

  // The glyphs are set well above the type's own size and given a tight line
  // height, so each sits close to the line it opens or closes rather than
  // floating as a part of its own.
  parts.push(quoteGlyph('“', kicker ? 1.6 : 0));

  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: FRAUNCES,
    fontWeight: 700,
    fontSizeWPct: 9.4,
    lineHeight: 1.08,
    letterSpacingEm: -0.01,
    textTransform: 'none',
    textAlign: 'center',
    color: 'ink',
    gapHPct: 1,
    // No mark: a quote is already a mark. Marking a word inside one would be
    // two marks doing the same job (7.23).
  });

  parts.push(quoteGlyph('”', 0.8));

  const location = content.location?.trim();
  if (location) {
    parts.push({
      kind: 'text',
      runs: [{ text: `— ${location}` }],
      fontFamily: FRAUNCES,
      fontWeight: 400,
      fontSizeWPct: 2.4,
      lineHeight: 1.2,
      letterSpacingEm: 0.18,
      textTransform: 'uppercase',
      textAlign: 'center',
      color: 'ink',
      gapHPct: 2.4,
    });
  }

  return {
    lookId: 'pull-quote',
    // No scrim: the stack can land in the middle of the frame, where a top or
    // bottom gradient would shade the wrong half of the photo. `auto` reads the
    // legible ink off the pixels instead (7.10).
    ink: 'auto',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct,
    scrim: null,
    accent: photo.accent,
    parts,
    // The attribution named the place (7.25).
    consumedLocation: Boolean(location),
  };
}

/** An oversized quote mark in the accent — the only colour in the Look. */
function quoteGlyph(glyph: string, gapHPct: number): Part {
  return {
    kind: 'text',
    runs: [{ text: glyph }],
    fontFamily: FRAUNCES,
    fontWeight: 700,
    fontSizeWPct: 16,
    lineHeight: 0.62,
    letterSpacingEm: 0,
    textTransform: 'none',
    textAlign: 'center',
    color: 'accent',
    gapHPct,
  };
}

export const PULL_QUOTE: Look = {
  id: 'pull-quote',
  prefer: PREFERRED_BANDS,
  compose,
};
