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
 * **Stencil Caps** — screen-printed.
 *
 * Enormous centred capitals, outlined and unfilled, so the photograph shows
 * through the letterforms the way ink pulled through a screen leaves the shirt
 * visible inside the counters. The outline is the whole graphic: there is no
 * panel, no rule and no mark, because a second device would be competing with
 * type set at nearly a seventh of the frame's width.
 *
 * `…WPct` is a percentage of the frame's WIDTH, `…HPct` of its HEIGHT.
 */

const BRICOLAGE = '"Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Wide margins: the type is huge, so the air around it has to be too. */
const COLUMN_INSET_WPCT = 8;

/**
 * The stack sits well off the frame's edge when the middle of the photo is the
 * calm part — a print centred on the shirt, not hung off the hem.
 */
const CENTRED_OFFSET_HPCT = 30;

/** …and pulls back to a normal margin when it has to take an edge instead. */
const EDGE_OFFSET_HPCT = 9;

/** Centred is the point, so the middle band is what this Look actually wants. */
const PREFERRED_BANDS: readonly Band[] = ['middle', 'bottom', 'top'];

/**
 * What this Look sets at each density (7.26). At 13.5% of the frame's width
 * roughly seven capitals fit on a line, which is what makes a `beat` look
 * printed — and what would push a `thought` off the top of the frame. So each
 * rung gets its own setting: still the largest type in the catalogue at every
 * one, but always inside the frame. Leading opens as the size comes down,
 * because locked-up caps at 0.94 are a graphic and three lines of them are text.
 *
 * This replaces a ramp that guessed from the headline's character count. Density
 * is the model saying what it meant, which is a better thing to size to than how
 * long the sentence happened to run.
 *
 * **With Bold Poster, this is the tightest budget in the catalogue**, and for a
 * reason the type ramp cannot fix: the letters are outlined, centred and tracked
 * open, which is the most expensive way there is to set a word. At the `line`
 * size a capital costs about 6.3% of the frame's width, so the 84% column holds
 * thirteen characters — two words to a line — and three lines is already the
 * whole calm middle of the photograph. `thought` is where the honest number
 * matters: 7.26 allows 15–35 words, and thirty-five of them here is eleven lines
 * of outlined capitals. That fits inside the frame; it is simply no longer a
 * screen print, it is a page of text with a photograph behind it. Thirteen words
 * — four lines — is the last rung where the outline still reads as the graphic,
 * so a model with more to say than that should be picking another design.
 */
const LINE: Rung = { fontSizeWPct: 9.6, lineHeight: 0.94, maxWords: 6 };
export const STENCIL_CAPS_RAMP: DensityRamp = {
  // A frame that states `silent` and then writes words has words, and words are
  // always drawn; a truly wordless frame returns before this is read. The size
  // is `line`'s because that is what those stray words get set at; the budget is
  // zero because a silent frame is not written to.
  silent: { ...LINE, maxWords: 0 },
  // Three words across two lines of screen-printed caps — what the Look is for.
  beat: { fontSizeWPct: 13.5, lineHeight: 0.9, maxWords: 3 },
  line: LINE,
  thought: { fontSizeWPct: 6.4, lineHeight: 1.06, maxWords: 13 },
  // A question is a statement's length and is printed just as large, so it gets
  // the same measure and the same two words to the line.
  question: LINE,
};

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  // A composition hangs off one of two edges, so the middle is reached by
  // hanging off the bottom and standing well clear of it.
  const anchor = band === 'top' ? 'top' : 'bottom';
  const offsetHPct = band === 'middle' ? CENTRED_OFFSET_HPCT : EDGE_OFFSET_HPCT;

  // Silent: the photo speaks for itself (decision 7.26). Everything here exists
  // to set the words, and the scrim exists only to keep them readable, so with
  // no words the frame is the photograph and nothing else.
  if (!content.headline.trim()) {
    return {
      lookId: 'stencil-caps',
      ink: 'light',
      leftPct: COLUMN_INSET_WPCT,
      rightPct: COLUMN_INSET_WPCT,
      anchor,
      offsetHPct,
      scrim: null,
      accent: photo.accent,
      parts: [],
    };
  }

  const rung = STENCIL_CAPS_RAMP[resolveDensity(content)];
  const parts: Part[] = [];

  // The print run line — small, wide-tracked, in the accent. This is the Look's
  // one spot of colour; the headline itself stays in ink so the outline reads as
  // a stencil rather than as a coloured word.
  const kicker = content.kicker?.trim();
  if (kicker) {
    parts.push({
      kind: 'text',
      runs: [{ text: kicker }],
      fontFamily: BRICOLAGE,
      fontWeight: 700,
      fontSizeWPct: 2.6,
      lineHeight: 1.1,
      letterSpacingEm: 0.32,
      textTransform: 'uppercase',
      textAlign: 'center',
      color: 'accent',
      gapHPct: 0,
    });
  }

  // The stencil. Unfilled letters carry roughly a tenth of the ink a filled one
  // does, so the weight goes up (800) and the tracking opens slightly to keep
  // the outlines from touching at this size. No mark: the outline is the device.
  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: BRICOLAGE,
    fontWeight: 800,
    fontSizeWPct: rung.fontSizeWPct,
    lineHeight: rung.lineHeight,
    letterSpacingEm: 0.02,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: 'ink',
    gapHPct: kicker ? 2.2 : 0,
    stroke: true,
  });

  // The place, set as the bottom line of the print.
  const location = content.location?.trim();
  if (location) {
    parts.push({
      kind: 'text',
      runs: [{ text: location }],
      fontFamily: BRICOLAGE,
      fontWeight: 600,
      fontSizeWPct: 2.4,
      lineHeight: 1.2,
      letterSpacingEm: 0.24,
      textTransform: 'uppercase',
      textAlign: 'center',
      color: 'ink',
      gapHPct: 2.6,
    });
  }

  return {
    lookId: 'stencil-caps',
    // The scrim below is unconditional, so this Look always knows what is behind
    // its letters and says so outright rather than deferring to `auto`.
    ink: 'light',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct,
    // A wide, soft wash rather than the usual band at one edge: the type can sit
    // anywhere from the middle of the frame to either edge, and an outline needs
    // more help than a filled letter, not less. Unconditional, because a scrim
    // decided per photo makes a story flicker between framed and unframed.
    scrim: { from: anchor, extentHPct: 92, strength: 0.52 },
    accent: photo.accent,
    parts,
    // The bottom line of the print named the place (7.25).
    consumedLocation: Boolean(location),
  };
}

export const STENCIL_CAPS: Look = {
  ramp: STENCIL_CAPS_RAMP,
  id: 'stencil-caps',
  prefer: PREFERRED_BANDS,
  compose,
};
