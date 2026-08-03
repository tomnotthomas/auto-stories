import type {
  DensityRamp,
  DrawnComposition,
  FrameContent,
  Look,
  Part,
  PhotoAnalysis,
} from '../look';
import { resolveDensity, splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * **Sticker Sheet** (decision 7.24, built out under 7.27).
 *
 * The Instagram grammar: every line of the headline is its own filled lozenge,
 * stacked and each one knocked a degree off true, the way stickers land when
 * they are dropped onto a story by thumb.
 *
 * The chips *are* the emphasis — a phrase the model marked gets a lozenge to
 * itself — so this Look adds no mark on top (7.23: one device per frame). It is
 * also the only Look with no scrim: every word sits on its own opaque fill, so
 * a gradient over the photo would darken the picture for nothing.
 *
 * Geometry is in the Looks' authoring units: `WPct` is a percentage of the
 * frame's WIDTH, `HPct` of its HEIGHT.
 */

const BRICOLAGE = '"Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const COLUMN_INSET_WPCT = 9;
const EDGE_OFFSET_HPCT = 11;
/** What the chips have to fit inside. */
const COLUMN_WPCT = 100 - COLUMN_INSET_WPCT * 2;

/** More than three lozenges stops reading as a sticker and starts reading as a wall. */
const MAX_CHIPS = 3;
/** Below this a chip holds one or two words and the stack turns into a list. */
const MIN_CHARS_PER_CHIP = 16;

/**
 * Chips are sized to fit, not authored: the renderer never wraps a tag, so the
 * type has to come down when the headline is long. Bricolage 700 averages about
 * 0.52em per character and the renderer pads a tag by 0.62em each side, which is
 * enough to solve for a size that keeps the widest chip inside the column.
 */
const CHAR_EM = 0.52;
const CHIP_PAD_EM = 1.24;
/** Holds the longest headline the density brief allows (~46 characters). */
const MIN_CHIP_WPCT = 3.2;

/**
 * What this Look can set at each density (7.26). `fontSizeWPct` is a *ceiling*
 * rather than a size, because a chip is the one part the renderer never wraps:
 * it has to fit the column or it runs off the frame. So the fit solver below
 * still has the last word, and density decides how big a chip is allowed to get
 * when it fits.
 *
 * That split is what stops a `beat` and a `thought` landing in the same slot on
 * short words: two words at 6.4% is a sticker, the same two words in a frame the
 * creator marked as a thought are part of a passage and are set smaller. The
 * leading opens as the type comes down, so three small chips keep air between
 * them instead of stacking into one bar.
 *
 * The budgets are counted in chips, not lines, because nothing here wraps. Three
 * lozenges is the ceiling ({@link MAX_CHIPS}), and a chip stops reading as a
 * lozenge and starts reading as a bar somewhere around 30 characters — past
 * that the solver is also driving the type under the smallest rung to make it
 * fit. Three chips of about thirty characters is fifteen words, which is why a
 * `thought` here sits at the bottom of 7.26's 15-35 band rather than the top.
 *
 * `silent` never reaches here — the guard in `compose` returns first — and takes
 * the smallest setting so a frame that contradicts itself errs small.
 */
export const STICKER_SHEET_RAMP: DensityRamp = {
  silent: { fontSizeWPct: 4, lineHeight: 1.15, maxWords: 0 },
  beat: { fontSizeWPct: 6.4, lineHeight: 1.1, maxWords: 3 },
  line: { fontSizeWPct: 5.2, lineHeight: 1.15, maxWords: 12 },
  thought: { fontSizeWPct: 4, lineHeight: 1.28, maxWords: 15 },
  // A question is one chip the reader is meant to answer; splitting it over
  // three lozenges breaks the sentence into fragments before it is asked.
  question: { fontSizeWPct: 5.2, lineHeight: 1.15, maxWords: 8 },
};

/** The knock each chip gets, cycled down the stack. */
const CHIP_TILTS = [-2.4, 1.6, -1.1];
const KICKER_TILT_DEG = 2.2;
const LOCATION_TILT_DEG = -1.8;

/** Stickers get dropped low on a story, over the photo's own dead space. */
const PREFERRED_BANDS: readonly Band[] = ['bottom', 'top'];

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'top' ? 'top' : 'bottom';

  const base: Omit<DrawnComposition, 'parts'> = {
    lookId: 'sticker-sheet',
    // Nothing in this Look paints in the sampled ink — every chip reverses out
    // of its own fill — so the polarity is left to the photo.
    ink: 'auto',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    // No scrim: the chips carry their own contrast (see the file comment).
    scrim: null,
    accent: photo.accent,
  };

  // Silent: the photo speaks for itself (7.26). An empty lozenge is furniture
  // with nothing in it.
  if (!content.headline.trim()) return { ...base, parts: [] };

  const rung = STICKER_SHEET_RAMP[resolveDensity(content)];
  const lines = chipLines(content);
  const widest = lines.reduce((most, line) => Math.max(most, line.length), 0);
  const fontSizeWPct = chipSizeWPct(widest, rung.fontSizeWPct);

  const parts: Part[] = [];

  // A small chip above the stack — same grammar, quieter, so the hierarchy
  // still reads when everything is a lozenge.
  const kicker = content.kicker?.trim();
  if (kicker) {
    parts.push(
      chip({
        text: kicker,
        fontSizeWPct: 3.0,
        gapHPct: 0,
        rotationDeg: KICKER_TILT_DEG,
        textTransform: 'uppercase',
        letterSpacingEm: 0.08,
      }),
    );
  }

  lines.forEach((line, index) => {
    parts.push(
      chip({
        text: line,
        fontSizeWPct,
        lineHeight: rung.lineHeight,
        gapHPct: index === 0 && !kicker ? 0 : 1.5,
        rotationDeg: CHIP_TILTS[index % CHIP_TILTS.length],
      }),
    );
  });

  // The place is a sticker too — and the only place this frame names it.
  const location = content.location?.trim();
  if (location) {
    parts.push(
      chip({
        text: location,
        fontSizeWPct: 2.9,
        gapHPct: 2.2,
        rotationDeg: LOCATION_TILT_DEG,
        textTransform: 'uppercase',
        letterSpacingEm: 0.08,
      }),
    );
  }

  // The chip named the place, so the sticker layer must not name it again (7.25).
  return { ...base, parts, consumedLocation: Boolean(location) };
}

/** What one lozenge needs to be drawn. */
interface Chip {
  readonly text: string;
  readonly fontSizeWPct: number;
  /** The rung's leading for a headline chip; the label default for the rest. */
  readonly lineHeight?: number;
  readonly gapHPct: number;
  readonly rotationDeg: number;
  readonly textTransform?: 'none' | 'uppercase';
  readonly letterSpacingEm?: number;
}

/** The kicker and place chips are labels, not the passage: their leading is
 * fixed, so only the headline chips move with the density. */
const LABEL_LINE_HEIGHT = 1.15;

/** One lozenge. */
function chip({
  text,
  fontSizeWPct,
  lineHeight = LABEL_LINE_HEIGHT,
  gapHPct,
  rotationDeg,
  textTransform = 'none',
  letterSpacingEm = -0.01,
}: Chip): Part {
  return {
    kind: 'tag',
    text,
    style: 'chip',
    fontFamily: BRICOLAGE,
    fontWeight: 700,
    fontSizeWPct,
    lineHeight,
    letterSpacingEm,
    textTransform,
    textAlign: 'left',
    // A chip reverses its type out of the accent fill; `paper` is that light
    // tone, so the declared colour matches what gets drawn.
    color: 'paper',
    gapHPct,
    rotationDeg,
  };
}

/**
 * Break the headline into the lines that become chips. An emphasised phrase
 * always starts and ends a chip — that is how this Look emphasises — and the
 * rest is packed greedily to a character budget that scales with the headline,
 * so a long one gets three fuller chips rather than six thin ones.
 */
function chipLines(content: FrameContent): string[] {
  const headline = content.headline.trim();
  const budget = Math.max(MIN_CHARS_PER_CHIP, Math.ceil(headline.length / MAX_CHIPS));
  const chunks: string[] = [];

  for (const run of splitEmphasis(content.headline, content.emphasis)) {
    const words = run.text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    if (run.emphasised) {
      chunks.push(words.join(' '));
      continue;
    }

    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && candidate.length > budget) {
        chunks.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) chunks.push(current);
  }

  if (chunks.length <= MAX_CHIPS) return chunks;
  // Never drop words: whatever is left over joins the last chip, and the size
  // solver below shrinks the type to hold it.
  return [...chunks.slice(0, MAX_CHIPS - 1), chunks.slice(MAX_CHIPS - 1).join(' ')];
}

/**
 * The largest size at which a chip of `chars` characters still fits the column,
 * never above the `ceiling` this density allows.
 */
function chipSizeWPct(chars: number, ceiling: number): number {
  if (chars <= 0) return ceiling;
  const fits = COLUMN_WPCT / (CHAR_EM * chars + CHIP_PAD_EM);
  return Math.round(Math.min(ceiling, Math.max(MIN_CHIP_WPCT, fits)) * 100) / 100;
}

export const STICKER_SHEET: Look = {
  ramp: STICKER_SHEET_RAMP,
  id: 'sticker-sheet',
  prefer: PREFERRED_BANDS,
  compose,
};
