import type { DrawnComposition, FrameContent, Look, Part, PhotoAnalysis } from '../look';
import { splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * Look — **Duotone Band** (decision 7.24).
 *
 * A full-bleed band of the story accent laid across one edge of the photo, the
 * words reversed out of it in heavy Bricolage. The band is translucent and sits
 * on a gradient, so the photo reads *through* the colour rather than being
 * covered by it — the two-tone effect the Look is named for.
 *
 * Geometry is in the board's container-query units — `WPct` is a percentage of
 * the frame WIDTH, `HPct` of its HEIGHT — so the Look scales to any surface.
 */

const BRICOLAGE = '"Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** The type is inset inside the band, which itself runs edge to edge. */
const COLUMN_INSET_WPCT = 9;
/** How far the ink sits off the anchored edge. */
const EDGE_OFFSET_HPCT = 7;
/** Vertical padding inside the band; a hair more than the offset, so it bleeds. */
const BAND_PAD_HPCT = 8;

/** A band belongs on an edge; the bottom first, the top when the bottom is busy. */
const PREFERRED_BANDS: readonly Band[] = ['bottom', 'top'];

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'top' ? 'top' : 'bottom';

  // Silent: the photo speaks for itself (decision 7.26). The band exists only to
  // hold words — an empty slab of colour across a photo is pure damage — so with
  // no headline there is no band, no gradient, nothing.
  if (!content.headline.trim()) {
    return {
      lookId: 'duotone-band',
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

  // An all-caps eyebrow riding the top of the band. Dropped when the model wrote
  // no kicker — the band then holds the headline alone, which is the same shape.
  const kicker = content.kicker?.trim();
  if (kicker) {
    parts.push({
      kind: 'text',
      runs: [{ text: kicker }],
      fontFamily: BRICOLAGE,
      fontWeight: 700,
      fontSizeWPct: 2.6,
      lineHeight: 1.1,
      letterSpacingEm: 0.18,
      textTransform: 'uppercase',
      textAlign: 'left',
      // Reversed out of the accent: paper is the fixed light tone type takes when
      // it sits ON the accent, so it never fights the sampled hue.
      color: 'paper',
      gapHPct: 0,
    });
  }

  // The headline, set heavy and tight so it fills the band edge to edge.
  //
  // No mark: every mark this engine draws is painted in the accent, and the band
  // behind the words is already that accent — an accent bar on an accent slab is
  // invisible. The band IS this Look's emphasis, so emphasis stays unmarked here
  // rather than being drawn in a colour that cannot be seen (7.23: one graphic).
  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: BRICOLAGE,
    fontWeight: 700,
    fontSizeWPct: 8.2,
    lineHeight: 1.04,
    letterSpacingEm: -0.012,
    textTransform: 'none',
    textAlign: 'left',
    color: 'paper',
    gapHPct: kicker ? 2.2 : 0,
  });

  return {
    lookId: 'duotone-band',
    // The Look lays its own band and reverses the type out of it, so the polarity
    // is known: light words, never the photo's own reading.
    ink: 'light',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    // The gradient under a translucent band is what makes it duotone: the photo
    // shows through the colour as shadow rather than as bright detail, which is
    // also what keeps the reversed-out words readable over a pale photo.
    scrim: { from: anchor, extentHPct: 48, strength: 0.55 },
    accent: photo.accent,
    parts,
    panel: {
      color: 'accent',
      opacity: 0.72,
      padWPct: 0,
      padHPct: BAND_PAD_HPCT,
      radiusWPct: 0,
      // Edge to edge: a band that stopped short of the frame would read as a card.
      fullWidth: true,
    },
  };
}

export const DUOTONE_BAND: Look = {
  id: 'duotone-band',
  prefer: PREFERRED_BANDS,
  compose,
};
