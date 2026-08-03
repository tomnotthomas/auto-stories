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

/**
 * What this Look sets at each density (7.26). Wire copy has one shape and two
 * sizes: the flash and the story. A `beat` is the flash — a few words at the
 * size an agency puts on the wire first — and a `thought` is the story that
 * follows it, set at the size copy is actually read at, with the leading opened
 * so several lines under a dateline still read as one paragraph.
 *
 * Copy is what this Look is for, so it carries 7.26's whole `thought` band:
 * the 84%-wide measure takes about 40 characters to the line at the `thought`
 * rung, and 35 words is five lines of serif under a one-line dateline — which
 * is what a wire story looks like.
 */
const LINE: Rung = { fontSizeWPct: 7, lineHeight: 1.18, maxWords: 12 };
export const DATELINE_RAMP: DensityRamp = {
  // A frame that states `silent` and then writes words has words, and words are
  // always drawn; a truly wordless frame returns before this is read. The budget
  // is still nought: the rung asks for no words at all.
  silent: { ...LINE, maxWords: 0 },
  beat: { fontSizeWPct: 9.2, lineHeight: 1.06, maxWords: 3 },
  line: LINE,
  thought: { fontSizeWPct: 4.4, lineHeight: 1.38, maxWords: 35 },
  // A wire question is a headline with a hook, not a paragraph with one.
  question: { ...LINE, maxWords: 9 },
};

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
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
  const rung = DATELINE_RAMP[resolveDensity(content)];
  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: FRAUNCES,
    fontWeight: 400,
    fontSizeWPct: rung.fontSizeWPct,
    lineHeight: rung.lineHeight,
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
    // Only when the place actually took the dateline (7.25). With a kicker
    // written the place went undrawn, and its sticker should still appear.
    consumedLocation: label !== undefined && label === content.location?.trim(),
  };
}

export const DATELINE: Look = {
  ramp: DATELINE_RAMP,
  id: 'dateline',
  prefer: PREFERRED_BANDS,
  compose,
};
