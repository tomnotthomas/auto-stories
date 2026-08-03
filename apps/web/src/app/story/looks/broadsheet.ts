import type { Composition, FrameContent, Look, Part, PhotoAnalysis } from '../look';
import { splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * Look 07 — **Broadsheet** (catalogue B. Editorial).
 *
 * A newspaper front page: a small-caps kicker, then the headline held between
 * two double rules — a heavy rule and a hairline above, mirrored below — set in
 * Fraunces and centred over the column. One family, one weight, no accent: the
 * rules carry the whole design, which is what separates it from Magazine
 * Masthead's accent tab and underline.
 *
 * Geometry is in the mockups' container-query units: `WPct` is a percentage of
 * the frame WIDTH, `HPct` of its HEIGHT.
 */

const FRAUNCES = '"Fraunces", Georgia, "Times New Roman", serif';

/** A front page is set narrow — the margins are as much the design as the type. */
const COLUMN_INSET_WPCT = 9;
const EDGE_OFFSET_HPCT = 9;

/** The heavy half of each double rule, and the hairline that shadows it. */
const HEAVY_HPCT = 0.3;
const HAIRLINE_HPCT = 0.07;
/** The gap inside a pair. Wider and it reads as two separate rules. */
const PAIR_GAP_HPCT = 0.24;

/** A masthead sits at the top of the page; the foot is its fallback. */
const PREFERRED_BANDS: readonly Band[] = ['top', 'bottom'];

function compose(content: FrameContent, photo: PhotoAnalysis): Composition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'top' ? 'top' : 'bottom';

  // Silent: no words, so nothing to rule off (7.26). A pair of rules around an
  // empty column is furniture with nothing to hold.
  if (!content.headline.trim()) {
    return {
      lookId: 'broadsheet',
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

  // The dateline: widely letter-spaced caps, small, centred. Fraunces rather
  // than a sans, because a front page is set in one family throughout.
  const kicker = content.kicker?.trim();
  if (kicker) {
    parts.push({
      kind: 'text',
      runs: [{ text: kicker }],
      fontFamily: FRAUNCES,
      fontWeight: 700,
      fontSizeWPct: 2.6,
      lineHeight: 1.1,
      letterSpacingEm: 0.3,
      textTransform: 'uppercase',
      textAlign: 'center',
      color: 'ink',
      gapHPct: 0,
    });
  }

  // The double rule above — heavy, then a hairline just under it. Both halves
  // are unconditional: the pair is the Look, so it survives a missing kicker.
  parts.push(rule(HEAVY_HPCT, kicker ? 2.4 : 0, 0.9));
  parts.push(rule(HAIRLINE_HPCT, PAIR_GAP_HPCT, 0.7));

  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: FRAUNCES,
    fontWeight: 700,
    fontSizeWPct: 8.8,
    lineHeight: 1.02,
    letterSpacingEm: -0.012,
    textTransform: 'none',
    textAlign: 'center',
    color: 'ink',
    gapHPct: 2.6,
    // No mark: the emphasis is carried by the runs so a later Look change can
    // use it, but a front page marks nothing — the rules already do the work.
  });

  // …and mirrored below: hairline first, then the heavy rule closing the block.
  parts.push(rule(HAIRLINE_HPCT, 2.8, 0.7));
  parts.push(rule(HEAVY_HPCT, PAIR_GAP_HPCT, 0.9));

  const location = content.location?.trim();
  if (location) {
    parts.push({
      kind: 'text',
      runs: [{ text: location }],
      fontFamily: FRAUNCES,
      fontWeight: 400,
      fontSizeWPct: 2.3,
      lineHeight: 1.2,
      letterSpacingEm: 0.24,
      textTransform: 'uppercase',
      textAlign: 'center',
      color: 'ink',
      gapHPct: 2.2,
    });
  }

  return {
    lookId: 'broadsheet',
    // The scrim below is unconditional, so the rules and the type always read
    // white — a hairline is the first thing a busy photo swallows.
    ink: 'light',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    scrim: { from: anchor, extentHPct: 58, strength: 0.7 },
    accent: photo.accent,
    parts,
  };
}

/** One rule of a pair, full column width. */
function rule(thicknessHPct: number, gapHPct: number, opacity: number): Part {
  return { kind: 'rule', gapHPct, thicknessHPct, widthPct: 100, opacity, color: 'ink' };
}

export const BROADSHEET: Look = {
  id: 'broadsheet',
  prefer: PREFERRED_BANDS,
  compose,
};
