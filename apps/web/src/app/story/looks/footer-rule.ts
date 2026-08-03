import type { DrawnComposition, FrameContent, Look, Part, PhotoAnalysis } from '../look';
import { splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * **Footer Rule** — catalogue A.5, the restrained group (decisions 7.24 /
 * 7.27).
 *
 * The caption under a plate in a printed book: one hairline straight across,
 * low down, and small spaced capitals centred beneath it. Symmetry is the
 * whole device — this is the only Look in the restrained group that centres,
 * and the rule is what makes the centring look intended rather than default.
 *
 * Geometry is in the mockups' container-query units — `WPct` is the CSS `cqw`,
 * `HPct` the `cqh`.
 */

const SYSTEM_SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Equal margins: the rule runs the full column and the type sits centred in it. */
const COLUMN_INSET_WPCT = 8;

/** Low, the way a plate caption sits near the foot of the page. */
const EDGE_OFFSET_HPCT = 7;

/** Under the picture; the top is the fallback when the base is busy. */
const PREFERRED_BANDS: readonly Band[] = ['bottom', 'top'];

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'top' ? 'top' : 'bottom';

  const base = {
    lookId: 'footer-rule',
    // The shallow gradient below is unconditional, so the rule and the type are
    // always the light ones.
    ink: 'light',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    accent: photo.accent,
  } as const;

  // Silent: the photo speaks for itself (7.26). The rule is a caption rule — a
  // line ruled under nothing is just a line drawn on someone's photo.
  if (!content.headline.trim()) return { ...base, scrim: null, parts: [] };

  const parts: Part[] = [];

  // The kicker sits above the rule, like the plate number over a caption. It is
  // the only thing this Look puts on that side of the line.
  const kicker = content.kicker?.trim();
  if (kicker) {
    parts.push({
      kind: 'text',
      runs: [{ text: kicker }],
      fontFamily: SYSTEM_SANS,
      fontWeight: 400,
      fontSizeWPct: 2.1,
      lineHeight: 1.3,
      letterSpacingEm: 0.3,
      textTransform: 'uppercase',
      textAlign: 'center',
      color: 'ink',
      gapHPct: 0,
    });
  }

  // The rule: full column width, hairline thin, and never conditional — it is
  // the Look's signature, so it holds whether or not there is a kicker above it
  // or a place below.
  parts.push({
    kind: 'rule',
    gapHPct: kicker ? 1.8 : 0,
    thicknessHPct: 0.07,
    widthPct: 100,
    opacity: 0.55,
    color: 'ink',
  });

  // The caption. Small capitals are approximated the way type is set for print
  // at this size: a small size, generous tracking, uppercase. Runs are split
  // even though nothing marks them, so an emphasis is carried correctly.
  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: SYSTEM_SANS,
    fontWeight: 400,
    fontSizeWPct: 3.6,
    lineHeight: 1.4,
    letterSpacingEm: 0.12,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: 'ink',
    gapHPct: 2.4,
  });

  // The place, set smaller and wider still, as the second caption line.
  const location = content.location?.trim();
  if (location) {
    parts.push({
      kind: 'text',
      runs: [{ text: location }],
      fontFamily: SYSTEM_SANS,
      fontWeight: 400,
      fontSizeWPct: 2.1,
      lineHeight: 1.3,
      letterSpacingEm: 0.3,
      textTransform: 'uppercase',
      textAlign: 'center',
      color: 'ink',
      gapHPct: 1.6,
    });
  }

  return {
    ...base,
    // Shallow on purpose: enough to hold a hairline and small capitals against
    // a bright shoreline, not enough to shade the picture itself.
    scrim: { from: anchor, extentHPct: 30, strength: 0.45 },
    parts,
    // The second caption line named the place (7.25).
    consumedLocation: Boolean(location),
  };
}

export const FOOTER_RULE: Look = {
  id: 'footer-rule',
  prefer: PREFERRED_BANDS,
  compose,
};
