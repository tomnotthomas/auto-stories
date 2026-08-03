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
 * Look 02 — **Film Postcard** (decision 7.24).
 *
 * A 35mm keepsake: the photo printed inside a thin paper margin, one line of
 * Fraunces set centred and low, and the place stamped askew in the corner the
 * way a print shop inks a date on the back. Quiet — the treatment carries the
 * mood, so the type never raises its voice and never marks a word.
 *
 * Geometry is authored in the same units as the rest of the engine — `WPct` is
 * a percentage of the frame WIDTH, `HPct` of its HEIGHT.
 */

const FRAUNCES = '"Fraunces", Georgia, "Times New Roman", serif';
const BRICOLAGE = '"Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** A narrow measure: centred type reads badly across a full-width column. */
const COLUMN_INSET_WPCT = 14;
/** The stack sits low, clear of the print margin below it. */
const EDGE_OFFSET_HPCT = 11;

/** The print margin: thin, square-cornered, just inside the frame. */
const BORDER_INSET_WPCT = 3.6;
const BORDER_WIDTH_WPCT = 0.36;

/** Warm and slightly faded — the wash a colour print picks up with age. */
const WARM_PRINT = 'saturate(1.08) sepia(0.18) contrast(1.04)';

/** A postcard is written along the bottom; the top is its fallback. */
const PREFERRED_BANDS: readonly Band[] = ['bottom', 'top'];

/**
 * What this Look sets at each density (7.26). A postcard is written on the back
 * in whatever space is left: a greeting takes the whole card, a message is
 * written smaller and closer so it fits. The `thought` rung is that message —
 * still centred Fraunces inside the print margin, just no longer a greeting.
 *
 * The budget is what the card leaves. The message sits inside a printed margin
 * and above a stamped place, and at 4.1% across a 72% column it runs to about
 * six words a line — so thirty words is five lines and still clear of the
 * border. The greeting at 6.4% is under four words a line, and a greeting that
 * runs past three lines has stopped being one, so `line` takes 7.26's twelve
 * and no more.
 */
const LINE: Rung = { fontSizeWPct: 6.4, lineHeight: 1.16, maxWords: 12 };
export const FILM_POSTCARD_RAMP: DensityRamp = {
  // A frame that states `silent` and then writes words has words, and words are
  // always drawn; a truly wordless frame returns before this is read.
  silent: { ...LINE, maxWords: 0 },
  beat: { fontSizeWPct: 8.4, lineHeight: 1.08, maxWords: 3 },
  line: LINE,
  thought: { fontSizeWPct: 4.1, lineHeight: 1.42, maxWords: 30 },
  // A line written to somebody on the back of a card, asked rather than told —
  // same size as a greeting, a word shorter so it lands as one question.
  question: { ...LINE, maxWords: 11 },
};

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'top' ? 'top' : 'bottom';

  // Silent: the photo speaks for itself (decision 7.26). Type, scrim, stamp and
  // the print margin all exist to frame the words, so with no words they go —
  // a margin ruled around an empty frame reads as a bug. The warm wash stays:
  // it treats the photograph, and a story that dropped its colour on one frame
  // would flicker between two films.
  if (!content.headline.trim()) {
    return {
      lookId: 'film-postcard',
      ink: 'auto',
      leftPct: COLUMN_INSET_WPCT,
      rightPct: COLUMN_INSET_WPCT,
      anchor,
      offsetHPct: EDGE_OFFSET_HPCT,
      scrim: null,
      accent: photo.accent,
      parts: [],
      photoFilter: WARM_PRINT,
    };
  }

  const parts: Part[] = [];

  // A caption line above the headline, tracked out small — the hand that wrote
  // on the back of the print, not a masthead eyebrow.
  const kicker = content.kicker?.trim();
  if (kicker) {
    parts.push({
      kind: 'text',
      runs: [{ text: kicker }],
      fontFamily: FRAUNCES,
      fontWeight: 400,
      fontSizeWPct: 2.3,
      lineHeight: 1.2,
      letterSpacingEm: 0.3,
      textTransform: 'uppercase',
      textAlign: 'center',
      color: 'ink',
      gapHPct: 0,
    });
  }

  // The line itself. Regular weight, generous leading, no mark — a keepsake is
  // read, not sold.
  const rung = FILM_POSTCARD_RAMP[resolveDensity(content)];
  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: FRAUNCES,
    fontWeight: 400,
    fontSizeWPct: rung.fontSizeWPct,
    lineHeight: rung.lineHeight,
    letterSpacingEm: 0.005,
    textTransform: 'none',
    textAlign: 'center',
    color: 'ink',
    gapHPct: kicker ? 2.2 : 0,
  });

  // The stamp: the place, inked in the accent and set askew at the end of the
  // column, so it lands in a corner rather than in the reading line. Only ever
  // the place the model named — a postcard stamp with nothing to say is chrome.
  const location = content.location?.trim();
  if (location) {
    parts.push({
      kind: 'tag',
      text: location,
      style: 'stamp',
      fontFamily: BRICOLAGE,
      fontWeight: 700,
      fontSizeWPct: 2,
      lineHeight: 1.2,
      letterSpacingEm: 0.16,
      textTransform: 'uppercase',
      textAlign: 'right',
      color: 'accent',
      gapHPct: 3.4,
      rotationDeg: -4,
    });
  }

  return {
    lookId: 'film-postcard',
    // The scrim below is unconditional, so the type is always read light.
    ink: 'light',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    // Shallower and softer than Magazine's: this Look sets small type, and a
    // heavy gradient would fight the warm print it sits on.
    scrim: { from: anchor, extentHPct: 48, strength: 0.52 },
    accent: photo.accent,
    parts,
    border: {
      insetWPct: BORDER_INSET_WPCT,
      widthWPct: BORDER_WIDTH_WPCT,
      color: 'paper',
      radiusWPct: 0,
    },
    photoFilter: WARM_PRINT,
    // The stamp named the place, so no location sticker should (7.25).
    consumedLocation: Boolean(location),
  };
}

export const FILM_POSTCARD: Look = {
  ramp: FILM_POSTCARD_RAMP,
  id: 'film-postcard',
  prefer: PREFERRED_BANDS,
  compose,
};
