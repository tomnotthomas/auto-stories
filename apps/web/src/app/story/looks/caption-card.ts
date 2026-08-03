import type { Composition, FrameContent, Look, Part, PhotoAnalysis } from '../look';
import { splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * Look — **Caption Card** (decision 7.24).
 *
 * A small rounded card of paper set low and centred on the photo, with the line
 * printed inside it in the interface's own sans — the plainest Look of the set.
 * It claims nothing: no display face, no accent slab, no editorial voice. It is
 * the one to reach for when the picture is the whole point and the words are
 * only there to say where and when.
 *
 * Geometry is in the board's container-query units — `WPct` is a percentage of
 * the frame WIDTH, `HPct` of its HEIGHT.
 */

/** The interface sans — deliberately not one of the bundled display faces. */
const SYSTEM_SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';

/** A narrow card, well in from both edges. */
const COLUMN_INSET_WPCT = 19;
const EDGE_OFFSET_HPCT = 11;

/** The card sits low; the top is the fallback when the bottom is busy. */
const PREFERRED_BANDS: readonly Band[] = ['bottom', 'top'];

function compose(content: FrameContent, photo: PhotoAnalysis): Composition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'top' ? 'top' : 'bottom';

  // Silent: the photo speaks for itself (decision 7.26). An empty card is a blank
  // sticker on a photo, so with no line there is no card.
  if (!content.headline.trim()) {
    return {
      lookId: 'caption-card',
      ink: 'dark',
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

  // A tiny eyebrow at the top of the card, kept much smaller than the line so the
  // card stays a caption and not a poster. Dropped when there is no kicker.
  const kicker = content.kicker?.trim();
  if (kicker) {
    parts.push({
      kind: 'text',
      runs: [{ text: kicker }],
      fontFamily: SYSTEM_SANS,
      fontWeight: 400,
      fontSizeWPct: 2.2,
      lineHeight: 1.2,
      letterSpacingEm: 0.14,
      textTransform: 'uppercase',
      textAlign: 'center',
      color: 'ink',
      gapHPct: 0,
    });
  }

  // The line itself.
  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: SYSTEM_SANS,
    fontWeight: 400,
    fontSizeWPct: 4.2,
    lineHeight: 1.3,
    letterSpacingEm: 0,
    textTransform: 'none',
    textAlign: 'center',
    color: 'ink',
    gapHPct: kicker ? 1.4 : 0,
    // A marker swipe: on paper it reads as a line someone went back and picked
    // out, which suits a card of notes. The other marks want a display face.
    mark: 'highlighter',
  });

  return {
    lookId: 'caption-card',
    // The card is paper and the words are printed on it, so the polarity is
    // fixed dark whatever the photo behind the card is doing.
    ink: 'dark',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    // No gradient: the card carries its own background, and a gradient behind a
    // light card would only dirty the photo around it.
    scrim: null,
    accent: photo.accent,
    parts,
    panel: {
      color: 'paper',
      // Just short of solid, so the card sits in the photo's light rather than
      // punching a hole in it.
      opacity: 0.95,
      padWPct: 5,
      padHPct: 2.4,
      // Rounded like an app's own caption chip — the point of reference here is
      // the interface, not print.
      radiusWPct: 2.6,
      fullWidth: false,
    },
  };
}

export const CAPTION_CARD: Look = {
  id: 'caption-card',
  prefer: PREFERRED_BANDS,
  compose,
};
