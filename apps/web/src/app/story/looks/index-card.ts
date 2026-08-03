import type { DrawnComposition, FrameContent, Look, Part, PhotoAnalysis } from '../look';
import { splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * **Index Card** (decision 7.24, built out under 7.27).
 *
 * A recipe card laid on the photo: an off-white panel, one hairline ruled
 * across it, and a small hand writing dark on the paper. The quietest of the
 * hand-made Looks — the one for a photo that would be spoiled by type all over
 * it, because everything this Look draws is contained inside its own card.
 *
 * Because it writes on paper it owns rather than on the picture, it states its
 * polarity outright (`ink: 'dark'`) instead of deferring to the sampled
 * luminance, and it needs no scrim: the card already covers what is behind it.
 *
 * Geometry is in the Looks' authoring units: `WPct` is a percentage of the
 * frame's WIDTH, `HPct` of its HEIGHT.
 */

const SHANTELL = '"Shantell Sans", "Segoe Print", "Bradley Hand", cursive';

/**
 * The type column sits well inside the frame; the panel then pads back out from
 * it, so the card's own edge lands at 5% of the frame — inset, like something
 * put down on the photo rather than printed into it.
 */
const COLUMN_INSET_WPCT = 11;
const EDGE_OFFSET_HPCT = 13;
const PANEL_PAD_WPCT = 6;
const PANEL_PAD_HPCT = 3.2;

/** A card gets put down low on the picture. */
const PREFERRED_BANDS: readonly Band[] = ['bottom', 'top'];

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'top' ? 'top' : 'bottom';

  const base = {
    lookId: 'index-card',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    scrim: null,
    accent: photo.accent,
  } as const;

  // Silent: the photo speaks for itself (7.26). The card exists to be written
  // on — a blank one is a rectangle covering the picture for no reason — so the
  // panel goes with the words. Ink reverts to `auto` because with no panel
  // there is nothing left declaring what is behind the type.
  if (!content.headline.trim()) return { ...base, ink: 'auto', parts: [] };

  const parts: Part[] = [];

  // The card's heading, in the accent. Caps at this size read as a label rather
  // than as shouting, which is what the top line of a recipe card is.
  const kicker = content.kicker?.trim();
  if (kicker) {
    parts.push({
      kind: 'text',
      runs: [{ text: kicker }],
      fontFamily: SHANTELL,
      fontWeight: 400,
      fontSizeWPct: 2.7,
      lineHeight: 1.2,
      letterSpacingEm: 0.16,
      textTransform: 'uppercase',
      textAlign: 'left',
      color: 'accent',
      gapHPct: 0,
    });
  }

  // The ruled line. Unconditional — it is what makes the panel a *card* rather
  // than a box — and pale, because it is printing on paper, not ink on a photo.
  parts.push({
    kind: 'rule',
    gapHPct: kicker ? 1.4 : 0,
    thicknessHPct: 0.08,
    widthPct: 100,
    opacity: 0.32,
    color: 'ink',
  });

  // The entry. No mark: on a card this size a highlight would be the loudest
  // thing on the frame, and this is the Look chosen when the photo should win.
  // The emphasis is still split into its own run so the renderer sees the same
  // shape here as everywhere else.
  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: SHANTELL,
    fontWeight: 400,
    fontSizeWPct: 6.2,
    lineHeight: 1.32,
    letterSpacingEm: 0,
    textTransform: 'none',
    textAlign: 'left',
    color: 'ink',
    gapHPct: 2,
  });

  // The place, filed at the foot of the card — the only time this frame names
  // it, so nothing else should draw it again.
  const location = content.location?.trim();
  if (location) {
    parts.push({
      kind: 'text',
      runs: [{ text: location }],
      fontFamily: SHANTELL,
      fontWeight: 400,
      fontSizeWPct: 2.5,
      lineHeight: 1.2,
      letterSpacingEm: 0.14,
      textTransform: 'uppercase',
      textAlign: 'left',
      color: 'ink',
      gapHPct: 2.4,
    });
  }

  return {
    ...base,
    // Dark on its own paper — the one polarity the photo underneath cannot
    // change (7.10 only decides for type that sits on the picture).
    ink: 'dark',
    parts,
    panel: {
      color: 'paper',
      // A shade under opaque: enough of the photo shows through the card for it
      // to belong to the picture, not enough to disturb the writing.
      opacity: 0.94,
      padWPct: PANEL_PAD_WPCT,
      padHPct: PANEL_PAD_HPCT,
      radiusWPct: 1.2,
      fullWidth: false,
    },
  };
}

export const INDEX_CARD: Look = {
  id: 'index-card',
  prefer: PREFERRED_BANDS,
  compose,
};
