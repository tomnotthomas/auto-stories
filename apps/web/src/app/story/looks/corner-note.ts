import type { Density, DrawnComposition, FrameContent, Look, PhotoAnalysis } from '../look';
import { resolveDensity, splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * **Corner Note** — catalogue A.4, the restrained group (decisions 7.24 /
 * 7.27).
 *
 * Almost nothing: one very small mono line, tucked into the top-right corner,
 * ranged right. No kicker, no place, no rule, no shading. This is the quietest
 * Look in the set and it earns that by refusing to add a second element — the
 * moment it has two lines it is a caption, not a note.
 *
 * Geometry is in the mockups' container-query units — `WPct` is the CSS `cqw`,
 * `HPct` the `cqh`.
 */

/**
 * The reader's own monospace. Nothing is bundled for it: a note is machine
 * type, and every platform's default mono already is that.
 */
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/**
 * The column starts a third of the way in. The text is ranged right, so this is
 * purely a wrap width — it keeps a long headline stacked in the corner instead
 * of running across the frame as a header.
 */
const COLUMN_LEFT_WPCT = 24;
const COLUMN_RIGHT_WPCT = 8;

const EDGE_OFFSET_HPCT = 7;

/** The top corner is the Look; the bottom is the fallback on a busy sky. */
const PREFERRED_BANDS: readonly Band[] = ['top', 'bottom'];

/** How the note is set at one density. */
interface Rung {
  readonly fontSizeWPct: number;
  readonly lineHeight: number;
}

/**
 * What this Look sets at each density (7.26). Every rung is small — the whole
 * Look is that the words stay out of the picture's way, so a `beat` is a note
 * written a little firmer, not a headline. The `thought` rung is where the ramp
 * does its work: several lines of mono stacked in the corner, set smaller and
 * leaded further apart so the block reads as a paragraph and not as a caption
 * that outgrew its corner.
 */
const LINE: Rung = { fontSizeWPct: 2.9, lineHeight: 1.5 };
const HEADLINE: Record<Density, Rung> = {
  // A frame that states `silent` and then writes words has words, and words are
  // always drawn; a truly wordless frame returns before this is read.
  silent: LINE,
  beat: { fontSizeWPct: 3.3, lineHeight: 1.4 },
  line: LINE,
  thought: { fontSizeWPct: 2.1, lineHeight: 1.65 },
  question: LINE,
};

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'bottom' ? 'bottom' : 'top';

  const base = {
    lookId: 'corner-note',
    // Nothing is laid down behind the note, so the polarity comes from the
    // device's reading of the corner it sits in (7.10).
    ink: 'auto',
    leftPct: COLUMN_LEFT_WPCT,
    rightPct: COLUMN_RIGHT_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    scrim: null,
    accent: photo.accent,
  } as const;

  // Silent: the photo speaks for itself (7.26). This Look is a single line —
  // with no line, it is nothing.
  if (!content.headline.trim()) return { ...base, parts: [] };

  // Exactly one part, always. A kicker or a place the model wrote is dropped
  // rather than promoted to a second line: what makes this Look work is that
  // there is only ever one thing on the photo. Runs are still split so an
  // emphasis is carried correctly, even though nothing marks it.
  const rung = HEADLINE[resolveDensity(content)];
  return {
    ...base,
    parts: [
      {
        kind: 'text',
        runs: splitEmphasis(content.headline, content.emphasis),
        fontFamily: MONO,
        fontWeight: 400,
        fontSizeWPct: rung.fontSizeWPct,
        lineHeight: rung.lineHeight,
        letterSpacingEm: 0.02,
        textTransform: 'none',
        textAlign: 'right',
        color: 'ink',
        gapHPct: 0,
      },
    ],
  };
}

export const CORNER_NOTE: Look = {
  id: 'corner-note',
  prefer: PREFERRED_BANDS,
  compose,
};
