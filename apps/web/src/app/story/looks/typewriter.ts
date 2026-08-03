import type { DrawnComposition, FrameContent, Look, Part, PhotoAnalysis } from '../look';
import { splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * Look — **Typewriter** (decision 7.24, catalogue).
 *
 * A document rather than a design: monospaced, small, set low and hard left,
 * with a short hairline above the line the way a typed note carries a rule of
 * underscores. Nothing is centred, nothing is enlarged, nothing is coloured —
 * the accent never appears, so the frame reads as a field note someone kept.
 *
 * Its neighbours in the quiet group differ only in placement: Title Card is
 * mid-frame and bracketed, Subtitle is bottom-centred and bare, Edge Caps is a
 * band at the very edge. Typewriter is the left-aligned, ruled one.
 *
 * Units follow the engine's convention — `WPct` is a % of the frame WIDTH,
 * `HPct` a % of its HEIGHT.
 */

/**
 * No monospace is bundled (three webfonts ship: Bricolage, Fraunces, Shantell),
 * so this is the platform's own typewriter face. That is the right call for this
 * Look anyway: the character comes from the fixed advance, not from a specific
 * cut, and a system stack costs no download.
 */
const MONO =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

/** A typed page keeps a generous left margin. */
const COLUMN_INSET_WPCT = 9;
/** Low, but off the very edge — a page has a foot margin. */
const EDGE_OFFSET_HPCT = 10;

/** Set low; the top is the fallback when the bottom of the photo is busy. */
const PREFERRED_BANDS: readonly Band[] = ['bottom', 'top'];

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'top' ? 'top' : 'bottom';

  // Silent: no words, so nothing to type and nothing to rule off (7.26). The
  // rule exists to head the line; on its own it is a stray mark on a photo.
  if (!content.headline.trim()) {
    return {
      lookId: 'typewriter',
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

  // The kicker heads the page like a dateline: same face, smaller, spaced out
  // so it reads as a label rather than as the first line of the note.
  const kicker = content.kicker?.trim();
  if (kicker) {
    parts.push({
      kind: 'text',
      runs: [{ text: kicker }],
      fontFamily: MONO,
      fontWeight: 400,
      fontSizeWPct: 2.4,
      lineHeight: 1.2,
      letterSpacingEm: 0.14,
      textTransform: 'uppercase',
      textAlign: 'left',
      color: 'ink',
      gapHPct: 0,
    });
  }

  // The rule above the line — short, not full width, so it reads as a typed
  // row of underscores rather than as an editorial hairline.
  parts.push({
    kind: 'rule',
    gapHPct: kicker ? 1.6 : 0,
    thicknessHPct: 0.12,
    widthPct: 22,
    opacity: 0.7,
    color: 'ink',
  });

  // The line itself. Tight tracking pulls the fixed advance back in, and the
  // open line-height keeps a wrapped headline reading as typed lines. No mark:
  // a highlight or an accent bar would break the document conceit, so the
  // emphasis is carried (the runs keep it) but never drawn.
  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: MONO,
    fontWeight: 400,
    fontSizeWPct: 4.6,
    lineHeight: 1.5,
    letterSpacingEm: -0.02,
    textTransform: 'none',
    textAlign: 'left',
    color: 'ink',
    gapHPct: 2.2,
  });

  // The place, footed under the note like a filing line.
  const location = content.location?.trim();
  if (location) {
    parts.push({
      kind: 'text',
      runs: [{ text: location }],
      fontFamily: MONO,
      fontWeight: 400,
      fontSizeWPct: 2.4,
      lineHeight: 1.2,
      letterSpacingEm: 0.14,
      textTransform: 'uppercase',
      textAlign: 'left',
      color: 'ink',
      gapHPct: 2.4,
    });
  }

  return {
    lookId: 'typewriter',
    // The scrim below is unconditional, so small mono type always has a wash
    // under it and reads white whatever the photo does.
    ink: 'light',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    // Shallow and soft: the type is small and low, so the wash only has to
    // cover the foot of the frame, not a third of the picture.
    scrim: { from: anchor, extentHPct: 38, strength: 0.6 },
    accent: photo.accent,
    parts,
    // The filing line under the note named the place (7.25).
    consumedLocation: Boolean(location),
  };
}

export const TYPEWRITER: Look = {
  id: 'typewriter',
  prefer: PREFERRED_BANDS,
  compose,
};
