import type { Composition, FrameContent, Look, Part, PhotoAnalysis } from '../look';
import { splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * Look — **Dateline** (decision 7.24).
 *
 * Wire copy. The kicker is set as a small all-caps monospaced dateline closed by
 * an em dash — `KM 214 —` — with the Fraunces headline running on beneath it, the
 * way an agency story opens. Nothing else: no rule, no panel, no tab. The whole
 * effect is the tension between the typewriter dateline and the serif that
 * follows it.
 *
 * Geometry is in the board's container-query units — `WPct` is a percentage of
 * the frame WIDTH, `HPct` of its HEIGHT.
 */

const FRAUNCES = '"Fraunces", Georgia, "Times New Roman", serif';
/** System monospace: the bundled faces have no mono, and every platform has one. */
const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';

/** The em dash that closes a dateline. */
const EM_DASH = '—';

const COLUMN_INSET_WPCT = 8;
const EDGE_OFFSET_HPCT = 9;

/** Copy sits at the foot of the page; the top is the fallback. */
const PREFERRED_BANDS: readonly Band[] = ['bottom', 'top'];

function compose(content: FrameContent, photo: PhotoAnalysis): Composition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'top' ? 'top' : 'bottom';

  // Silent: the photo speaks for itself (decision 7.26). A dateline with no story
  // after it is a stray label, so a wordless frame gets nothing at all.
  if (!content.headline.trim()) {
    return {
      lookId: 'dateline',
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

  const parts: Part[] = [];

  // The dateline. The kicker leads it; failing that the place name does, which is
  // what a real wire dateline carries anyway — so this Look keeps its signature
  // on frames where the model wrote no kicker. With neither, the headline simply
  // runs alone and nothing looks broken.
  const label = content.kicker?.trim() || content.location?.trim();
  if (label) {
    parts.push({
      kind: 'text',
      runs: [{ text: `${label} ${EM_DASH}` }],
      fontFamily: MONO,
      fontWeight: 400,
      fontSizeWPct: 2.8,
      lineHeight: 1.2,
      letterSpacingEm: 0.14,
      textTransform: 'uppercase',
      textAlign: 'left',
      color: 'ink',
      gapHPct: 0,
    });
  }

  // The story, running on directly under the dateline — the gap is deliberately
  // tight, so the two read as one paragraph broken over a line.
  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: FRAUNCES,
    fontWeight: 400,
    fontSizeWPct: 7,
    lineHeight: 1.18,
    letterSpacingEm: -0.005,
    textTransform: 'none',
    textAlign: 'left',
    color: 'ink',
    gapHPct: label ? 1.6 : 0,
    mark: 'accent-underline',
  });

  return {
    lookId: 'dateline',
    // The gradient below is unconditional, so the polarity is known: light type.
    ink: 'light',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    // Shallow but firm: the dateline is small type, and small type is the first
    // thing a photo swallows.
    scrim: { from: anchor, extentHPct: 44, strength: 0.62 },
    accent: photo.accent,
    parts,
  };
}

export const DATELINE: Look = {
  id: 'dateline',
  prefer: PREFERRED_BANDS,
  compose,
};
