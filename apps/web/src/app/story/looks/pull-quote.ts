import type {
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
 * Look 09 — **Pull Quote** (catalogue B. Editorial).
 *
 * The line lifted out of the piece and set large: an oversized opening quote in
 * the accent, the words centred in Fraunces beneath it, the closing quote under
 * that, and the place as an attribution. Narrower column than the other
 * editorial Looks — a pull quote is short measure by definition, and the white
 * space either side is what makes it read as quoted rather than as a caption.
 *
 * Geometry is in the mockups' container-query units: `WPct` is a percentage of
 * the frame WIDTH, `HPct` of its HEIGHT.
 */

const FRAUNCES = '"Fraunces", Georgia, "Times New Roman", serif';

/** Short measure — the quote never runs the full width of the frame. */
const COLUMN_INSET_WPCT = 12;

/** A quote sits in the body of the page, not at an edge. */
const PREFERRED_BANDS: readonly Band[] = ['middle', 'bottom', 'top'];

/** How far in from the anchored edge the stack hangs, per band. */
const EDGE_OFFSET_HPCT = 9;
/** The middle band has no edge of its own, so it is measured from the top. */
const MIDDLE_OFFSET_HPCT = 28;

/**
 * What this Look sets at each density (7.26). A pull quote is short measure by
 * definition, so the column stays narrow at every rung and the type carries the
 * whole ramp. The `thought` rung is the one this Look was missing: a lifted
 * paragraph set at 9.4% ran past the frame between its own quote marks.
 *
 * A `question` is set above a statement of the same length — it is pulled out to
 * be answered, not to be read past — and the quote marks grow with it, so the
 * frame reads as a question put to the viewer rather than a line lifted off a
 * page. It is set larger, so it carries fewer words than a statement does.
 *
 * **Colour is deliberately not used for the question.** This Look lays no scrim
 * and states `ink: 'auto'`, so the accent is the hue sampled off the photograph
 * the words are sitting on — it is chosen for character, not for contrast, and
 * only `ink` is the legible tone the device computed (7.10). The two glyphs can
 * carry it because a glyph that goes quiet against the picture costs a mark; the
 * words cannot, because words that go quiet cost the frame. Setting the question
 * apart is done in size, which is legible on every photograph.
 *
 * The 76% column is the narrowest measure in the editorial group. At the `line`
 * size that is under three words a line, and a quote reads to four lines before
 * it stops being lifted out — eleven words. `thought` holds four words a line
 * and six lines, so twenty-two: well short of 7.26's thirty-five, because a
 * pull quote that runs to a full paragraph is just a paragraph.
 */
const LINE: Rung = { fontSizeWPct: 9.4, lineHeight: 1.08, maxWords: 11 };
export const PULL_QUOTE_RAMP: DensityRamp = {
  // A frame that states `silent` and then writes words has words, and words are
  // always drawn; a truly wordless frame returns before this is read.
  silent: { ...LINE, maxWords: 0 },
  beat: { fontSizeWPct: 12.4, lineHeight: 1, maxWords: 3 },
  line: LINE,
  thought: { fontSizeWPct: 6.2, lineHeight: 1.28, maxWords: 22 },
  question: { fontSizeWPct: 10.6, lineHeight: 1.08, maxWords: 8 },
};

/**
 * The glyphs are set well above the type's own size, and scale with it: a fixed
 * 16% mark against a 6.2% `thought` reads as two stray commas the size of the
 * paragraph they open. Authored as a ratio of the quote, which is the 16/9.4 the
 * Look was drawn at.
 */
const GLYPH_RATIO = 1.7;

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'bottom' ? 'bottom' : 'top';
  const offsetHPct = band === 'middle' ? MIDDLE_OFFSET_HPCT : EDGE_OFFSET_HPCT;

  // Silent: quote marks with nothing between them (7.26).
  if (!content.headline.trim()) {
    return {
      lookId: 'pull-quote',
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

  const rung = PULL_QUOTE_RAMP[resolveDensity(content)];
  const glyphWPct = Math.round(rung.fontSizeWPct * GLYPH_RATIO * 10) / 10;
  const parts: Part[] = [];

  const kicker = content.kicker?.trim();
  if (kicker) {
    parts.push({
      kind: 'text',
      runs: [{ text: kicker }],
      fontFamily: FRAUNCES,
      fontWeight: 400,
      fontSizeWPct: 2.3,
      lineHeight: 1.2,
      letterSpacingEm: 0.28,
      textTransform: 'uppercase',
      textAlign: 'center',
      color: 'ink',
      gapHPct: 0,
    });
  }

  // The glyphs are set well above the type's own size and given a tight line
  // height, so each sits close to the line it opens or closes rather than
  // floating as a part of its own.
  parts.push(quoteGlyph('“', kicker ? 1.6 : 0, glyphWPct));

  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: FRAUNCES,
    fontWeight: 700,
    fontSizeWPct: rung.fontSizeWPct,
    lineHeight: rung.lineHeight,
    letterSpacingEm: -0.01,
    textTransform: 'none',
    textAlign: 'center',
    color: 'ink',
    gapHPct: 1,
    // No mark: a quote is already a mark. Marking a word inside one would be
    // two marks doing the same job (7.23).
  });

  parts.push(quoteGlyph('”', 0.8, glyphWPct));

  const location = content.location?.trim();
  if (location) {
    parts.push({
      kind: 'text',
      runs: [{ text: `— ${location}` }],
      fontFamily: FRAUNCES,
      fontWeight: 400,
      fontSizeWPct: 2.4,
      lineHeight: 1.2,
      letterSpacingEm: 0.18,
      textTransform: 'uppercase',
      textAlign: 'center',
      color: 'ink',
      gapHPct: 2.4,
    });
  }

  return {
    lookId: 'pull-quote',
    // No scrim: the stack can land in the middle of the frame, where a top or
    // bottom gradient would shade the wrong half of the photo. `auto` reads the
    // legible ink off the pixels instead (7.10).
    ink: 'auto',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct,
    scrim: null,
    accent: photo.accent,
    parts,
    // The attribution named the place (7.25).
    consumedLocation: Boolean(location),
  };
}

/** An oversized quote mark in the accent — the Look's colour of address. */
function quoteGlyph(glyph: string, gapHPct: number, fontSizeWPct: number): Part {
  return {
    kind: 'text',
    runs: [{ text: glyph }],
    fontFamily: FRAUNCES,
    fontWeight: 700,
    fontSizeWPct,
    lineHeight: 0.62,
    letterSpacingEm: 0,
    textTransform: 'none',
    textAlign: 'center',
    color: 'accent',
    gapHPct,
  };
}

export const PULL_QUOTE: Look = {
  ramp: PULL_QUOTE_RAMP,
  id: 'pull-quote',
  prefer: PREFERRED_BANDS,
  compose,
};
