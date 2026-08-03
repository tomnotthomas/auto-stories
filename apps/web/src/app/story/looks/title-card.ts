import type { DrawnComposition, FrameContent, Look, Part, PhotoAnalysis } from '../look';
import { splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * Look — **Title Card** (decision 7.24, catalogue).
 *
 * The card a film opens on: a single line of widely-letterspaced caps standing
 * in the middle of the frame, a hairline above it and a hairline below. Nothing
 * hangs off an edge and nothing is coloured — the composition is the whole idea,
 * so the type stays light, small for a headline, and very open.
 *
 * The engine anchors from `top` or `bottom` only, so "middle" is expressed as a
 * large offset from the top edge; see {@link MIDDLE_OFFSET_HPCT}.
 *
 * Units follow the engine's convention — `WPct` is a % of the frame WIDTH,
 * `HPct` a % of its HEIGHT.
 */

const BRICOLAGE = '"Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** A title card is a narrow column: the tracking does the spanning, not the box. */
const COLUMN_INSET_WPCT = 13;
/**
 * The stack hangs from the top by this much. The bracketed line is roughly 8%
 * of the frame tall, so 44 puts its centre a touch above the true middle —
 * where the eye reads centre — without a `middle` anchor existing.
 */
const MIDDLE_OFFSET_HPCT = 44;
/** Where it goes instead when the middle of the photo is busy. */
const EDGE_OFFSET_HPCT = 14;

/** Built for the middle; the edges are the fallback when the subject is there. */
const PREFERRED_BANDS: readonly Band[] = ['middle', 'bottom', 'top'];

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  // Middle and top both hang from the top edge; only the distance differs.
  const anchor = band === 'bottom' ? 'bottom' : 'top';
  const offsetHPct = band === 'middle' ? MIDDLE_OFFSET_HPCT : EDGE_OFFSET_HPCT;

  // Silent: the rules exist to bracket a line of type. With no line they are
  // two stray hairlines across the middle of a photograph (7.26).
  if (!content.headline.trim()) {
    return {
      lookId: 'title-card',
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

  // The "presents" line: the same face, half the size, sitting above the top
  // rule so the bracket stays around the title alone.
  const kicker = content.kicker?.trim();
  if (kicker) {
    parts.push({
      kind: 'text',
      runs: [{ text: kicker }],
      fontFamily: BRICOLAGE,
      fontWeight: 400,
      fontSizeWPct: 2.4,
      lineHeight: 1.2,
      letterSpacingEm: 0.42,
      textTransform: 'uppercase',
      textAlign: 'center',
      color: 'ink',
      gapHPct: 0,
    });
  }

  // The bracket above.
  parts.push({
    kind: 'rule',
    gapHPct: kicker ? 2.6 : 0,
    thicknessHPct: 0.05,
    widthPct: 100,
    opacity: 0.55,
    color: 'ink',
  });

  // The title. Weight 400 at wide tracking so it reads as a card, not a poster;
  // no mark at all, because a bar or a block under one word would turn a title
  // card into an advert.
  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: BRICOLAGE,
    fontWeight: 400,
    fontSizeWPct: 5,
    lineHeight: 1.45,
    letterSpacingEm: 0.26,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: 'ink',
    gapHPct: 2.6,
  });

  // The bracket below — the pair is what makes it a card.
  parts.push({
    kind: 'rule',
    gapHPct: 2.6,
    thicknessHPct: 0.05,
    widthPct: 100,
    opacity: 0.55,
    color: 'ink',
  });

  // The place, set below the card like a location caption.
  const location = content.location?.trim();
  if (location) {
    parts.push({
      kind: 'text',
      runs: [{ text: location }],
      fontFamily: BRICOLAGE,
      fontWeight: 400,
      fontSizeWPct: 2.4,
      lineHeight: 1.2,
      letterSpacingEm: 0.42,
      textTransform: 'uppercase',
      textAlign: 'center',
      color: 'ink',
      gapHPct: 2.6,
    });
  }

  return {
    lookId: 'title-card',
    // No scrim, so nothing has been decided about what is behind the words:
    // the device's luminance reading picks the legible polarity (7.10). A card
    // in the middle of the frame cannot be backed by an edge gradient without
    // shading half the photograph, which is the opposite of this Look.
    ink: 'auto',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct,
    scrim: null,
    accent: photo.accent,
    parts,
    // The caption under the card named the place (7.25).
    consumedLocation: Boolean(location),
  };
}

export const TITLE_CARD: Look = {
  id: 'title-card',
  prefer: PREFERRED_BANDS,
  compose,
};
