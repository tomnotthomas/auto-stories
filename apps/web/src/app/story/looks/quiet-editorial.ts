import type { Density, DrawnComposition, FrameContent, Look, Part, PhotoAnalysis } from '../look';
import { resolveDensity, splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * **Quiet Editorial** — catalogue A.1, the restrained group (decisions 7.24 /
 * 7.27).
 *
 * The photo does the talking. One letter-spaced line over one modest line of
 * Fraunces, lower-left: the whole Look is two pieces of type and the space
 * around them. No accent, no mark, no rule — the only thing designed here is
 * where the words stop.
 *
 * Geometry is in the mockups' container-query units — `WPct` is the CSS `cqw`,
 * `HPct` the `cqh` — so a Look scales to any surface (see `look.ts`).
 */

const FRAUNCES = '"Fraunces", Georgia, "Times New Roman", serif';

/** The column hangs off the left margin… */
const COLUMN_LEFT_WPCT = 8;
/**
 * …and stops well short of the right one. The asymmetry is the composition: a
 * line that reaches both edges reads as a banner, and this Look is not a banner.
 * Wrapping happens early and on purpose.
 */
const COLUMN_RIGHT_WPCT = 12;

/** How far the stack sits in from the edge it hangs off. */
const EDGE_OFFSET_HPCT = 9;

/** Lower-left by default; the top is the fallback when the base is busy. */
const PREFERRED_BANDS: readonly Band[] = ['bottom', 'top'];

/** How the line is set at one density. */
interface Rung {
  readonly fontSizeWPct: number;
  readonly lineHeight: number;
}

/**
 * What this Look sets at each density (7.26). The restraint is the point, so even
 * the `beat` rung stays under the display sizes the loud group opens at — this
 * Look is never a masthead. What density buys here is the `thought` rung:
 * Fraunces at book weight, small and openly leaded, is exactly how a reflective
 * passage wants to be set, and it is the same voice, not a shrunken headline.
 */
const LINE: Rung = { fontSizeWPct: 6, lineHeight: 1.18 };
const HEADLINE: Record<Density, Rung> = {
  // A frame that states `silent` and then writes words has words, and words are
  // always drawn; a truly wordless frame returns before this is read.
  silent: LINE,
  beat: { fontSizeWPct: 8.4, lineHeight: 1.08 },
  line: LINE,
  thought: { fontSizeWPct: 4.1, lineHeight: 1.38 },
  question: LINE,
};

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'top' ? 'top' : 'bottom';

  const base = {
    lookId: 'quiet-editorial',
    // The gradient below is unconditional, so the type is always white.
    ink: 'light',
    leftPct: COLUMN_LEFT_WPCT,
    rightPct: COLUMN_RIGHT_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    accent: photo.accent,
  } as const;

  // Silent: the photo speaks for itself (7.26). Both the eyebrow and the
  // gradient exist to serve the headline, so with no headline there is nothing
  // left to draw — a lone kicker floating over a shaded corner reads as a bug.
  if (!content.headline.trim()) {
    return { ...base, scrim: null, parts: [] };
  }

  const density = resolveDensity(content);
  const parts: Part[] = [];

  // The eyebrow: one small, widely tracked line. The model's kicker is the first
  // choice; a place name is the same kind of word — short, contextual, read
  // before the sentence — so it stands in when no kicker was written. The Look
  // keeps its two-line shape either way rather than collapsing to a bare line.
  const eyebrow = content.kicker?.trim() || content.location?.trim();
  if (eyebrow) {
    parts.push({
      kind: 'text',
      runs: [{ text: eyebrow }],
      fontFamily: FRAUNCES,
      fontWeight: 400,
      fontSizeWPct: 2.6,
      lineHeight: 1.2,
      // Wide tracking is what makes a small line read as deliberate rather than
      // as leftover type.
      letterSpacingEm: 0.32,
      textTransform: 'uppercase',
      textAlign: 'left',
      color: 'ink',
      gapHPct: 0,
    });
  }

  // The line itself. Fraunces at its book weight, barely larger than body copy
  // — the restraint is the point, so the size stays under the wrap width rather
  // than filling it. Runs are split even though nothing marks them, so an
  // emphasis the model wrote is carried correctly if this Look ever grows one.
  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: FRAUNCES,
    fontWeight: 400,
    fontSizeWPct: HEADLINE[density].fontSizeWPct,
    lineHeight: HEADLINE[density].lineHeight,
    letterSpacingEm: -0.005,
    textTransform: 'none',
    textAlign: 'left',
    color: 'ink',
    gapHPct: eyebrow ? 2 : 0,
  });

  return {
    ...base,
    // A soft, deep gradient rather than a box: the board draws this Look with a
    // text shadow, which the composition model has no term for, and small type
    // is exactly what a busy photo destroys. It is unconditional so a story
    // doesn't flicker between shaded and bare from frame to frame.
    scrim: { from: anchor, extentHPct: 52, strength: 0.5 },
    parts,
    // Only when the place actually stood in as the eyebrow (7.25). With a
    // kicker written the place went undrawn and its sticker should still show.
    consumedLocation: eyebrow !== undefined && eyebrow === content.location?.trim(),
  };
}

export const QUIET_EDITORIAL: Look = {
  id: 'quiet-editorial',
  prefer: PREFERRED_BANDS,
  compose,
};
