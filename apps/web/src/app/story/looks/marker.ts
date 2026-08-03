import type {
  DensityRamp,
  DrawnComposition,
  FrameContent,
  Look,
  Part,
  PhotoAnalysis,
  Run,
  Rung,
} from '../look';
import { resolveDensity, splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * **Marker** — highlighted by hand.
 *
 * Shantell Sans, set as if written on the photo, with one phrase struck through
 * by a thick translucent swipe of the accent. The whole stack is tipped a degree
 * and a half off square: a page put down by hand, not typeset. One swipe is the
 * entire decoration — the restraint is what keeps it from becoming a scrapbook.
 *
 * `…WPct` is a percentage of the frame's WIDTH, `…HPct` of its HEIGHT.
 */

const SHANTELL = '"Shantell Sans", "Comic Sans MS", cursive';

/** Generous margins — handwriting needs room around it to read as handwriting. */
const COLUMN_INSET_WPCT = 9;

const EDGE_OFFSET_HPCT = 10;

/** Just enough tilt to read as placed rather than aligned. */
const TILT_DEG = -1.4;

/** Marker writes low on the picture; the top is its fallback. */
const PREFERRED_BANDS: readonly Band[] = ['bottom', 'top'];

/**
 * What this Look sets at each density (7.26). Handwriting has a natural size:
 * too big and it stops reading as a hand, too small and the swipe of highlighter
 * loses the word underneath. A `beat` gets the full-page scrawl; a `thought` is
 * written at note size and leaded further apart, the way a longer passage
 * actually gets written by hand.
 *
 * The budgets are the most generous of this group, and deliberately so: the
 * others are display type, and this is writing. A note on a photograph is
 * allowed to run to four or five lines the way a caption never is — nobody looks
 * at a handwritten note and counts the words. Shantell at the `line` size takes
 * about twenty-one characters across the 82% column, so three lines is the
 * rung's full twelve; the `thought` size takes half as much again per line and
 * five lines of writing is still a note, which is twenty-four words. What sets
 * the ceiling here is not the frame — that would hold more — it is that a sixth
 * line turns the photograph into stationery. The swipe is unaffected either way:
 * it marks one phrase, never the passage.
 */
const LINE: Rung = { fontSizeWPct: 7.2, lineHeight: 1.32, maxWords: 12 };
export const MARKER_RAMP: DensityRamp = {
  // A frame that states `silent` and then writes words has words, and words are
  // always drawn; a truly wordless frame returns before this is read. The size
  // is `line`'s because that is what those stray words get set at; the budget is
  // zero because a silent frame is not written to.
  silent: { ...LINE, maxWords: 0 },
  // Three words scrawled across the picture, which is what a beat looks like in
  // a hand.
  beat: { fontSizeWPct: 9.6, lineHeight: 1.24, maxWords: 3 },
  line: LINE,
  thought: { fontSizeWPct: 4.6, lineHeight: 1.46, maxWords: 24 },
  // A question is written in the same hand at the same size, so it gets the same
  // three lines.
  question: LINE,
};

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'top' ? 'top' : 'bottom';

  // Silent: the photo speaks for itself (decision 7.26). Nothing to write on
  // means nothing to highlight, so the scrim and the tilt go with the words.
  if (!content.headline.trim()) {
    return {
      lookId: 'marker',
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

  const rung = MARKER_RAMP[resolveDensity(content)];
  const parts: Part[] = [];

  const kicker = content.kicker?.trim();
  if (kicker) {
    parts.push({
      kind: 'text',
      runs: [{ text: kicker }],
      fontFamily: SHANTELL,
      fontWeight: 700,
      fontSizeWPct: 2.9,
      lineHeight: 1.2,
      letterSpacingEm: 0.02,
      textTransform: 'none',
      textAlign: 'left',
      color: 'ink',
      gapHPct: 0,
    });
  }

  // The swipe is attached to the emphasised run, so it is only asked for when
  // there IS one: a `highlighter` on a headline with nothing marked would draw
  // as a stray bar of colour lying across the photo.
  const runs = splitEmphasis(content.headline, content.emphasis);
  parts.push({
    kind: 'text',
    runs,
    fontFamily: SHANTELL,
    fontWeight: 700,
    fontSizeWPct: rung.fontSizeWPct,
    // Shantell's ascenders and descenders are long, and the swipe sits inside
    // the line box, so the leading is looser than a grotesque would need.
    lineHeight: rung.lineHeight,
    letterSpacingEm: 0,
    textTransform: 'none',
    textAlign: 'left',
    color: 'ink',
    gapHPct: kicker ? 1.4 : 0,
    ...(hasMark(runs) ? { mark: 'highlighter' as const } : {}),
  });

  // The place, written under the line in the same hand at a smaller size.
  const location = content.location?.trim();
  if (location) {
    parts.push({
      kind: 'text',
      runs: [{ text: location }],
      fontFamily: SHANTELL,
      fontWeight: 400,
      fontSizeWPct: 2.7,
      lineHeight: 1.2,
      letterSpacingEm: 0.01,
      textTransform: 'none',
      textAlign: 'left',
      color: 'ink',
      gapHPct: 2,
    });
  }

  return {
    lookId: 'marker',
    // The scrim below is unconditional, so this Look states its polarity rather
    // than deferring to `auto`: white hand type over a shaded photo, with the
    // accent swipe reading through it.
    ink: 'light',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    // A shallow, soft gradient. The words sit directly on the picture here —
    // there is no panel to hide behind — but a heavy wash would flatten the
    // photograph the writing is supposed to be annotating.
    scrim: { from: anchor, extentHPct: 58, strength: 0.62 },
    accent: photo.accent,
    parts,
    rotationDeg: TILT_DEG,
    // The hand wrote the place under the line, so no sticker should (7.25).
    consumedLocation: Boolean(location),
  };
}

/** Did the emphasis actually land in the headline? */
function hasMark(runs: readonly Run[]): boolean {
  return runs.some((run) => run.emphasised === true);
}

export const MARKER: Look = {
  ramp: MARKER_RAMP,
  id: 'marker',
  prefer: PREFERRED_BANDS,
  compose,
};
