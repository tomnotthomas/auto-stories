import type {
  Density,
  DensityRamp,
  DrawnComposition,
  FrameContent,
  Look,
  Part,
  PhotoAnalysis,
  Rung,
} from '../look';
import { resolveDensity, splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * Look 08 — **Contents Page** (catalogue B. Editorial).
 *
 * A magazine index: one oversized accent character, a rule under it, a modest
 * Fraunces line, and an index row pairing the section with the place. The
 * marker is the whole design — it is set five times the size of the line it
 * introduces, so the frame reads as an entry in a contents list rather than a
 * caption on a photo.
 *
 * **On the marker.** The catalogue asks for the frame's number. `FrameContent`
 * carries only words — no `order` — and inventing one would print "01" on every
 * frame of the story, which is worse than no number at all. So the marker is the
 * initial of the section instead: the kicker's first character, falling back to
 * the headline's. It is always available, it changes frame to frame, and it is
 * never wrong. If `order` is ever added to the contract, {@link marker} is the
 * one line to change.
 *
 * Geometry is in the mockups' container-query units: `WPct` is a percentage of
 * the frame WIDTH, `HPct` of its HEIGHT.
 */

const FRAUNCES = '"Fraunces", Georgia, "Times New Roman", serif';
const BRICOLAGE = '"Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const COLUMN_INSET_WPCT = 8;
const EDGE_OFFSET_HPCT = 10;

/** An index opens a page, so this Look hangs off the top. */
const PREFERRED_BANDS: readonly Band[] = ['top', 'bottom'];

/**
 * What this Look sets at each density (7.26). The marker keeps its size at every
 * rung — it is the design, and an index that shrank its own numeral would stop
 * being one — so the ramp is entirely in the entry beside it, from a title-sized
 * `beat` down to a `thought` set as the blurb a contents page runs under a
 * title.
 *
 * This is one of the two Looks that can carry the whole of 7.26's `thought`
 * budget. The blurb is set at 4% of the frame width across an 84% column, which
 * is roughly seven words a line: thirty-five words is five lines under the
 * marker, which is exactly the shape a contents page already has. The marker is
 * the design here, so a long entry beside it does not stop the frame reading as
 * an index — where a poster set in capitals stops being a poster.
 */
const LINE: Rung = { fontSizeWPct: 6.2, lineHeight: 1.14, maxWords: 12 };
export const CONTENTS_PAGE_RAMP: DensityRamp = {
  // A frame that states `silent` and then writes words has words, and words are
  // always drawn; a truly wordless frame returns before this is read.
  silent: { ...LINE, maxWords: 0 },
  beat: { fontSizeWPct: 8.2, lineHeight: 1.04, maxWords: 3 },
  line: LINE,
  thought: { fontSizeWPct: 4, lineHeight: 1.34, maxWords: 35 },
  question: LINE,
};

/** The sign an entry that asks is filed under (7.26). */
const QUESTION_MARKER = '?';

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'top' ? 'top' : 'bottom';

  // Silent: the marker exists to number an entry, and there is no entry (7.26).
  if (!content.headline.trim()) {
    return {
      lookId: 'contents-page',
      ink: 'auto',
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
  const density = resolveDensity(content);

  // The marker: the one thing painted in the accent, and the only part set big.
  parts.push({
    kind: 'text',
    runs: [{ text: marker(content, density) }],
    fontFamily: BRICOLAGE,
    fontWeight: 800,
    fontSizeWPct: 26,
    lineHeight: 0.8,
    letterSpacingEm: -0.05,
    textTransform: 'uppercase',
    textAlign: 'left',
    color: 'accent',
    gapHPct: 0,
  });

  parts.push({
    kind: 'rule',
    gapHPct: 1.6,
    thicknessHPct: 0.1,
    widthPct: 100,
    opacity: 0.55,
    color: 'ink',
  });

  // The entry itself, set small against the marker — a contents line is read
  // after the number, not before it.
  const rung = CONTENTS_PAGE_RAMP[density];
  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: FRAUNCES,
    fontWeight: 400,
    fontSizeWPct: rung.fontSizeWPct,
    lineHeight: rung.lineHeight,
    letterSpacingEm: -0.005,
    textTransform: 'none',
    textAlign: 'left',
    color: 'ink',
    gapHPct: 2.2,
  });

  // The index row: section on the left, place on the right, the way a contents
  // page pairs a title with its page number. It appears only when there is
  // something to pair — an empty rule and an empty row is chrome (7.23).
  const kicker = content.kicker?.trim() ?? '';
  const location = content.location?.trim() ?? '';
  if (kicker || location) {
    parts.push({
      kind: 'rule',
      gapHPct: 2.4,
      thicknessHPct: 0.06,
      widthPct: 100,
      opacity: 0.35,
      color: 'ink',
    });
    parts.push({
      kind: 'row',
      left: kicker,
      right: location,
      fontFamily: BRICOLAGE,
      fontWeight: 600,
      fontSizeWPct: 2.3,
      lineHeight: 1.2,
      letterSpacingEm: 0.14,
      textTransform: 'uppercase',
      textAlign: 'left',
      color: 'ink',
      gapHPct: 1.8,
    });
  }

  return {
    lookId: 'contents-page',
    // No scrim: this Look sets one small line and one glyph, and the band
    // chosen above is already the calmest. `auto` lets the device pick the
    // legible ink from the pixels it sampled (7.10).
    ink: 'auto',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    scrim: null,
    accent: photo.accent,
    parts,
    // The index row carried the place on its right (7.25). A kicker alone still
    // draws the row, so this tracks the place itself, not the row.
    consumedLocation: location !== '',
  };
}

/**
 * The oversized character. The kicker names the section, so its initial is the
 * marker; a frame with no kicker falls back to the headline's. Split by code
 * point, not by index, so an emoji or an accented letter survives intact.
 *
 * An entry that asks is signed `?` instead (7.26). A contents page files each
 * entry under a mark, and the mark for a question is the one every reader
 * already knows — so the density is visible before a word of the entry is read.
 */
function marker(content: FrameContent, density: Density): string {
  if (density === 'question') return QUESTION_MARKER;

  const source = content.kicker?.trim() || content.headline.trim();
  return [...source][0]?.toUpperCase() ?? '';
}

export const CONTENTS_PAGE: Look = {
  ramp: CONTENTS_PAGE_RAMP,
  id: 'contents-page',
  prefer: PREFERRED_BANDS,
  compose,
};
