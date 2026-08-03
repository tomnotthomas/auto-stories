import type { DrawnComposition, FrameContent, Look, Part, PhotoAnalysis } from '../look';
import { splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * **Postcard Back** (decision 7.24, built out under 7.27).
 *
 * The written side of a postcard: a postmark stamped in the corner, the printed
 * divider under it, and a short message in a hand. Two voices, and the contrast
 * between them is the whole Look — machine type for anything the post office
 * would have added, handwriting for anything the sender wrote.
 *
 * The mono slot is a system face, not one of the bundled three: a postmark is
 * meant to look like a machine got there first, and whichever monospace the
 * device has is more convincing at it than a webfont would be.
 *
 * Geometry is in the Looks' authoring units: `WPct` is a percentage of the
 * frame's WIDTH, `HPct` of its HEIGHT.
 */

const SHANTELL = '"Shantell Sans", "Segoe Print", "Bradley Hand", cursive';
const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, "Courier New", monospace';

const COLUMN_INSET_WPCT = 9;
const EDGE_OFFSET_HPCT = 10;

/** Stamped by hand at the sorting office, so it lands crooked. */
const POSTMARK_TILT_DEG = -6.5;

/** A message is written under the stamp, so the stack hangs off the bottom. */
const PREFERRED_BANDS: readonly Band[] = ['bottom', 'top'];

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'top' ? 'top' : 'bottom';

  const base = {
    lookId: 'postcard-back',
    ink: 'light',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    accent: photo.accent,
  } as const;

  // Silent: the photo speaks for itself (7.26). A postmark with no card behind
  // it is a sticker on someone's picture.
  if (!content.headline.trim()) return { ...base, scrim: null, parts: [] };

  const parts: Part[] = [];

  // The postmark carries the place — a postmark names where it was franked. If
  // the frame has no place, the kicker is franked instead, so the card almost
  // always keeps its stamp; with neither, the message stands alone.
  const location = content.location?.trim();
  const kicker = content.kicker?.trim();
  const postmark = location || kicker;
  if (postmark) {
    parts.push({
      kind: 'tag',
      text: postmark,
      style: 'stamp',
      fontFamily: MONO,
      fontWeight: 700,
      fontSizeWPct: 2.6,
      lineHeight: 1.2,
      letterSpacingEm: 0.14,
      textTransform: 'uppercase',
      // Stamped in the corner the way a real one is — the only right-aligned
      // element in the set.
      textAlign: 'right',
      // A stamp prints in the accent; declared so the value is never a literal.
      color: 'accent',
      gapHPct: 0,
      rotationDeg: POSTMARK_TILT_DEG,
    });
  }

  // The card's printed divider, under the franking.
  parts.push({
    kind: 'rule',
    gapHPct: postmark ? 2.4 : 0,
    thicknessHPct: 0.07,
    widthPct: 100,
    opacity: 0.45,
    color: 'ink',
  });

  // The typed line the post office would have set. Only when the place already
  // took the stamp — the kicker never appears twice on one card.
  if (kicker && postmark !== kicker) {
    parts.push({
      kind: 'text',
      runs: [{ text: kicker }],
      fontFamily: MONO,
      fontWeight: 400,
      fontSizeWPct: 2.4,
      lineHeight: 1.3,
      letterSpacingEm: 0.2,
      textTransform: 'uppercase',
      textAlign: 'left',
      color: 'ink',
      gapHPct: 2.2,
    });
  }

  // The message. Unmarked: the postmark is already the one graphic on this
  // card (7.23), and a highlight through handwriting reads as a correction.
  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: SHANTELL,
    fontWeight: 400,
    fontSizeWPct: 6,
    lineHeight: 1.34,
    letterSpacingEm: 0,
    textTransform: 'none',
    textAlign: 'left',
    color: 'ink',
    gapHPct: 2.2,
  });

  return {
    ...base,
    // Unconditional scrim: a 400-weight hand is the thinnest type in the set
    // and it sits straight on the photo.
    scrim: { from: anchor, extentHPct: 56, strength: 0.62 },
    parts,
  };
}

export const POSTCARD_BACK: Look = {
  id: 'postcard-back',
  prefer: PREFERRED_BANDS,
  compose,
};
