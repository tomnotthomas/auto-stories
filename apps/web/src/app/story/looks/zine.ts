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
 * **Zine** (decision 7.24, built out under 7.27).
 *
 * Photocopied punk: heavy caps set as tight as they will go, a thick bar of ink
 * across the column, the whole thing slapped down off-square, and one word
 * blocked out in the accent with the letters reversed out of it.
 *
 * The loud end of the catalogue — the Look for a night out, not a landscape.
 * Its energy comes from weight and tilt, not from more elements: it is Magazine
 * with the grid kicked over, and it carries exactly one mark.
 *
 * Geometry is in the Looks' authoring units: `WPct` is a percentage of the
 * frame's WIDTH, `HPct` of its HEIGHT.
 */

const BRICOLAGE = '"Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const COLUMN_INSET_WPCT = 8;
const EDGE_OFFSET_HPCT = 9;

/**
 * Tilted the other way from Scrapbook's page: the two hand-made Looks sit side
 * by side in one story set, and a shared lean would read as a rendering fault
 * rather than as two different hands.
 */
const PAGE_TILT_DEG = 1.8;

/** A cover shouts from the top; the bottom is the fallback. */
const PREFERRED_BANDS: readonly Band[] = ['top', 'bottom'];

/**
 * What this Look sets at each density (7.26). A zine cover shouts, so the `beat`
 * rung carries the biggest type in the catalogue. It still shouts at a `thought`
 * — the weight, the tilt and the bar do that, not the point size — but caps set
 * at 10.6% and run to three lines cover the photocopied photo entirely, which is
 * the one thing a cover cannot do. The locked-up leading opens with it: a block
 * of caps at 0.92 is a graphic, and several lines of them are unreadable.
 *
 * The budgets are the tightest in the catalogue, and this Look is the reason
 * `maxWords` exists. Caps set at the `thought` rung take about 22 characters to
 * the 84%-wide column, so 7.26's 35 words run past seven lines of solid toner:
 * the frame does not overflow, it simply stops being a zine. Sixteen words is
 * four to five lines under the bar, which still reads as a cover.
 */
const LINE: Rung = { fontSizeWPct: 10.6, lineHeight: 0.92, maxWords: 7 };
export const ZINE_RAMP: DensityRamp = {
  // A frame that states `silent` and then writes words has words, and words are
  // always drawn; a truly wordless frame returns before this is read. The budget
  // is still nought: the rung asks for no words at all.
  silent: { ...LINE, maxWords: 0 },
  beat: { fontSizeWPct: 13.6, lineHeight: 0.88, maxWords: 3 },
  line: LINE,
  thought: { fontSizeWPct: 6.4, lineHeight: 1.06, maxWords: 16 },
  // Shorter than a statement at the same size: a question set in cover caps has
  // to be readable in one look, and two lines of it is the whole of one.
  question: { ...LINE, maxWords: 6 },
};

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'top' ? 'top' : 'bottom';

  // Silent: the photo speaks for itself (7.26). The bar exists to sit under the
  // words; with no words it is a black stripe across someone's picture.
  if (!content.headline.trim()) {
    return {
      lookId: 'zine',
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

  const density = resolveDensity(content);
  const parts: Part[] = [];

  // Wide-tracked caps in the accent — the strip of type across the top of a
  // photocopied cover.
  const kicker = content.kicker?.trim();
  if (kicker) {
    parts.push({
      kind: 'text',
      runs: [{ text: kicker }],
      fontFamily: BRICOLAGE,
      fontWeight: 800,
      fontSizeWPct: 3.2,
      lineHeight: 1.1,
      letterSpacingEm: 0.24,
      textTransform: 'uppercase',
      textAlign: 'left',
      color: 'accent',
      gapHPct: 0,
    });
  }

  // The bar. Thick where Magazine's is a hairline — this is toner, not
  // typography — and unconditional, because it is the Look's spine.
  parts.push({
    kind: 'rule',
    gapHPct: kicker ? 1.8 : 0,
    thicknessHPct: 0.62,
    widthPct: 100,
    opacity: 1,
    color: 'ink',
  });

  // The shout. Biggest type in the catalogue, negative tracking and leading
  // under 1 so the lines lock into a block; one phrase blocked out in accent.
  const rung = ZINE_RAMP[density];
  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: BRICOLAGE,
    fontWeight: 800,
    fontSizeWPct: rung.fontSizeWPct,
    lineHeight: rung.lineHeight,
    letterSpacingEm: -0.025,
    textTransform: 'uppercase',
    textAlign: 'left',
    color: 'ink',
    gapHPct: 2.4,
    mark: 'accent-block',
  });

  // The place, set like a venue line at the foot of a flyer. Plain type, not a
  // tag: the tags in this set belong to the Looks that make a graphic of them.
  const location = content.location?.trim();
  if (location) {
    parts.push({
      kind: 'text',
      runs: [{ text: location }],
      fontFamily: BRICOLAGE,
      fontWeight: 700,
      fontSizeWPct: 2.8,
      lineHeight: 1.2,
      letterSpacingEm: 0.18,
      textTransform: 'uppercase',
      textAlign: 'left',
      color: 'ink',
      gapHPct: 2.6,
    });
  }

  return {
    lookId: 'zine',
    // Unconditional scrim: this Look sets the largest type in the set over an
    // unknown photo, and reversed-out caps need something behind them.
    ink: 'light',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    scrim: { from: anchor, extentHPct: 66, strength: 0.8 },
    accent: photo.accent,
    parts,
    rotationDeg: PAGE_TILT_DEG,
    // The venue line at the foot of the flyer named the place (7.25).
    consumedLocation: Boolean(location),
  };
}

export const ZINE: Look = {
  ramp: ZINE_RAMP,
  id: 'zine',
  prefer: PREFERRED_BANDS,
  compose,
};
