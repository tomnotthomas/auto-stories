import type { Composition, FrameContent, Look, Part, PhotoAnalysis } from '../look';
import { splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * Look — **Chapter** (decision 7.24).
 *
 * A chapter opener from a printed book: a big letterspaced Bricolage kicker
 * marking the chapter, a short accent rule under it, then a long drop of empty
 * space before the Fraunces headline. The space is the design — this Look says
 * "something begins here" by giving the words room rather than by decorating
 * them, which is what separates it from Magazine's dense masthead.
 *
 * Geometry is in the board's container-query units — `WPct` is a percentage of
 * the frame WIDTH, `HPct` of its HEIGHT.
 */

const FRAUNCES = '"Fraunces", Georgia, "Times New Roman", serif';
const BRICOLAGE = '"Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const COLUMN_INSET_WPCT = 10;
/** Deep, so the opener hangs well clear of the edge. */
const EDGE_OFFSET_HPCT = 13;
/** The drop between the chapter marker and the headline — the Look's signature. */
const CHAPTER_DROP_HPCT = 5.5;

/** A chapter opens at the top of the page; the bottom is the fallback. */
const PREFERRED_BANDS: readonly Band[] = ['top', 'bottom'];

function compose(content: FrameContent, photo: PhotoAnalysis): Composition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'bottom' ? 'bottom' : 'top';

  // Silent: the photo speaks for itself (decision 7.26). A chapter marker with no
  // chapter under it is a label pointing at nothing, so nothing is drawn — not
  // the rule, not the gradient.
  if (!content.headline.trim()) {
    return {
      lookId: 'chapter',
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

  // The chapter marker itself, set large for a kicker — it is a peer of the
  // headline here, not an eyebrow above it.
  const kicker = content.kicker?.trim();
  if (kicker) {
    parts.push({
      kind: 'text',
      runs: [{ text: kicker }],
      fontFamily: BRICOLAGE,
      fontWeight: 700,
      fontSizeWPct: 4.4,
      lineHeight: 1.1,
      letterSpacingEm: 0.12,
      textTransform: 'uppercase',
      textAlign: 'left',
      color: 'ink',
      gapHPct: 0,
    });
  }

  // The short accent rule. It is the fixed part of the opener: with a kicker it
  // underlines the chapter marker, without one it stands alone as the mark that
  // something starts here, so the Look reads the same either way.
  parts.push({
    kind: 'rule',
    gapHPct: kicker ? 2.2 : 0,
    thicknessHPct: 0.42,
    // Short on purpose — a rule that ran the column would read as a divider.
    widthPct: 18,
    opacity: 1,
    color: 'accent',
  });

  // The headline, after the drop. Fraunces at book weight rather than Magazine's
  // display weight: this is the first line of a chapter, not a cover line.
  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: FRAUNCES,
    fontWeight: 400,
    fontSizeWPct: 8.4,
    lineHeight: 1.12,
    letterSpacingEm: -0.01,
    textTransform: 'none',
    textAlign: 'left',
    color: 'ink',
    gapHPct: CHAPTER_DROP_HPCT,
    mark: 'accent-underline',
  });

  return {
    lookId: 'chapter',
    // The gradient below is unconditional, so the polarity is known: light type.
    ink: 'light',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    // Softer and shallower than Magazine's: this Look sets less type over more
    // photo, so the gradient only has to hold the opener, not half the frame.
    scrim: { from: anchor, extentHPct: 52, strength: 0.58 },
    accent: photo.accent,
    parts,
  };
}

export const CHAPTER: Look = {
  id: 'chapter',
  prefer: PREFERRED_BANDS,
  compose,
};
