import type { Density, DrawnComposition, FrameContent, Look, Part, PhotoAnalysis } from '../look';
import { resolveDensity, splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * **Minimal** — catalogue A.2, the restrained group (decisions 7.24 / 7.27).
 *
 * Apple-Memories calm: thin system type high on the left, a short hairline, and
 * the place in spaced capitals. Everything else is negative space. Nothing is
 * shaded — the polarity is read off the pixels (7.10), so a bright photo takes
 * dark type and a dark one takes white, the way the Photos app does it.
 *
 * Geometry is in the mockups' container-query units — `WPct` is the CSS `cqw`,
 * `HPct` the `cqh`.
 */

/** No display face: the calm comes from the reader's own interface font. */
const SYSTEM_SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const COLUMN_LEFT_WPCT = 9;
/** A quarter of the frame held empty on the right — the negative space is the Look. */
const COLUMN_RIGHT_WPCT = 26;

/** Set high, but not crowding the status bar. */
const EDGE_OFFSET_HPCT = 12;

/**
 * The hairline is ~9cqw long. `widthPct` is a percentage of the type column,
 * not of the frame, so it is converted here and stays correct if the column
 * ever moves.
 */
const RULE_WPCT = 9;
const COLUMN_WPCT = 100 - COLUMN_LEFT_WPCT - COLUMN_RIGHT_WPCT;
const RULE_WIDTH_PCT = Math.round((RULE_WPCT / COLUMN_WPCT) * 100);

/** Top-left is the whole idea; the bottom is the fallback on a busy sky. */
const PREFERRED_BANDS: readonly Band[] = ['top', 'bottom'];

/** How the title is set at one density. */
interface Rung {
  readonly fontSizeWPct: number;
  readonly lineHeight: number;
}

/**
 * What this Look sets at each density (7.26). The column is narrow by design — a
 * quarter of the frame is held empty — so words wrap early here and the ramp has
 * to be real: at the `line` size a `thought` would fill the space the Look exists
 * to protect. Thin weight at every rung; the size and the leading are what move.
 */
const LINE: Rung = { fontSizeWPct: 5.6, lineHeight: 1.25 };
const HEADLINE: Record<Density, Rung> = {
  // A frame that states `silent` and then writes words has words, and words are
  // always drawn; a truly wordless frame returns before this is read.
  silent: LINE,
  beat: { fontSizeWPct: 7.4, lineHeight: 1.15 },
  line: LINE,
  thought: { fontSizeWPct: 3.8, lineHeight: 1.42 },
  question: LINE,
};

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'bottom' ? 'bottom' : 'top';

  const base = {
    lookId: 'minimal',
    // No scrim, so the device's luminance reading decides light or dark (7.10).
    ink: 'auto',
    leftPct: COLUMN_LEFT_WPCT,
    rightPct: COLUMN_RIGHT_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    scrim: null,
    accent: photo.accent,
  } as const;

  // Silent: the photo speaks for itself (7.26). The rule and the place exist to
  // sit under a title; with no title there is nothing to underline.
  if (!content.headline.trim()) return { ...base, parts: [] };

  const density = resolveDensity(content);
  const parts: Part[] = [];

  // The title. Thin and small — this Look never sets type that competes with
  // the picture. Runs are split even though nothing marks them, so an emphasis
  // is carried correctly.
  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: SYSTEM_SANS,
    fontWeight: 300,
    fontSizeWPct: HEADLINE[density].fontSizeWPct,
    lineHeight: HEADLINE[density].lineHeight,
    letterSpacingEm: -0.01,
    textTransform: 'none',
    textAlign: 'left',
    color: 'ink',
    gapHPct: 0,
  });

  // The kicker is dropped on purpose: three stacked lines is not this Look, and
  // the place is the more useful of the two. This is the contract the frame
  // schema already documents ("Minimal drops it entirely").
  const location = content.location?.trim();
  if (location) {
    // A short hairline, then the place. The rule is the join between them, so
    // it appears only when there is something to join.
    parts.push({
      kind: 'rule',
      gapHPct: 2.6,
      thicknessHPct: 0.08,
      widthPct: RULE_WIDTH_PCT,
      opacity: 0.7,
      color: 'ink',
    });
    parts.push({
      kind: 'text',
      runs: [{ text: location }],
      fontFamily: SYSTEM_SANS,
      fontWeight: 400,
      fontSizeWPct: 2.2,
      lineHeight: 1.3,
      letterSpacingEm: 0.28,
      textTransform: 'uppercase',
      textAlign: 'left',
      color: 'ink',
      gapHPct: 2.4,
    });
  }

  // The spaced capitals under the hairline named the place (7.25). With no
  // place this Look draws the title alone, and its sticker should still appear.
  return { ...base, parts, consumedLocation: Boolean(location) };
}

export const MINIMAL: Look = {
  id: 'minimal',
  prefer: PREFERRED_BANDS,
  compose,
};
