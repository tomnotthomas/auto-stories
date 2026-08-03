import type {
  Density,
  DrawnComposition,
  FrameContent,
  Look,
  Part,
  PhotoAnalysis,
  TextPart,
} from '../look';
import { resolveDensity, splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * Look 03 — **Bold Poster** (catalogue C. Loud).
 *
 * Album-cover hype: Bricolage 800 caps set at 15% of the frame width, running
 * nearly edge to edge and sitting low, with one word reversed out of a solid
 * accent block and the place in an outlined pill underneath. The type is set
 * large enough to be cropped by the column on purpose — the words are the
 * graphic here, not a label on a photo.
 *
 * Geometry is in the mockups' container-query units: `WPct` is a percentage of
 * the frame WIDTH, `HPct` of its HEIGHT.
 */

const BRICOLAGE = '"Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Edge to edge: just enough inset to keep the caps clear of the frame. */
const COLUMN_INSET_WPCT = 5;
/** Low — a poster hangs its type off the bottom edge. */
const EDGE_OFFSET_HPCT = 7;

const PREFERRED_BANDS: readonly Band[] = ['bottom', 'top'];

/** How the headline is set at one density. */
interface Rung {
  readonly fontSizeWPct: number;
  readonly lineHeight: number;
}

/**
 * What this Look sets at each density (7.26). A poster is loud at every rung —
 * even the smallest step here is caps at 800 weight, larger than most Looks'
 * headline — but a `thought` set at poster size would be ten lines of shouting
 * that runs off the frame, so it comes down to a size that can hold a paragraph
 * and still read as a poster.
 */
const LINE: Rung = { fontSizeWPct: 11.5, lineHeight: 0.94 };
const HEADLINE: Record<Density, Rung> = {
  // A frame that states `silent` and then writes words has words, and words are
  // always drawn; a truly wordless frame returns before this is read.
  silent: LINE,
  // Three words at album-cover scale — the size this Look was drawn for.
  beat: { fontSizeWPct: 16.5, lineHeight: 0.88 },
  line: LINE,
  thought: { fontSizeWPct: 6.2, lineHeight: 1.08 },
  // A question is a statement's length, and a poster asks it just as loudly.
  question: LINE,
};

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'top' ? 'top' : 'bottom';

  // Silent: no words, so no scrim and no pill (7.26). A poster with no words is
  // just a photo, which is the right answer.
  if (!content.headline.trim()) {
    return {
      lookId: 'bold-poster',
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

  const kicker = content.kicker?.trim();
  if (kicker) {
    parts.push({
      kind: 'text',
      runs: [{ text: kicker }],
      fontFamily: BRICOLAGE,
      fontWeight: 700,
      fontSizeWPct: 2.6,
      lineHeight: 1.1,
      letterSpacingEm: 0.3,
      textTransform: 'uppercase',
      textAlign: 'left',
      color: 'ink',
      gapHPct: 0,
    });
  }

  // The block only goes on when a word actually carries it. `splitEmphasis`
  // returns one plain run when the emphasis is missing or not in the headline,
  // and a mark with nothing to mark would be a property the renderer has to
  // second-guess — so the Look decides here.
  const runs = splitEmphasis(content.headline, content.emphasis);
  const marked = runs.some((run) => run.emphasised);
  const rung = HEADLINE[resolveDensity(content)];
  const headline: TextPart = {
    kind: 'text',
    runs,
    fontFamily: BRICOLAGE,
    fontWeight: 800,
    fontSizeWPct: rung.fontSizeWPct,
    lineHeight: rung.lineHeight,
    letterSpacingEm: -0.03,
    textTransform: 'uppercase',
    textAlign: 'left',
    color: 'ink',
    gapHPct: kicker ? 2.2 : 0,
    ...(marked ? { mark: 'accent-block' as const } : {}),
  };
  parts.push(headline);

  // The place as an outlined pill — set apart from the caps rather than
  // continuing them, so the frame has one loud voice and one quiet one.
  const location = content.location?.trim();
  if (location) {
    parts.push({
      kind: 'tag',
      text: location,
      style: 'pill',
      fontFamily: BRICOLAGE,
      fontWeight: 700,
      fontSizeWPct: 2.4,
      lineHeight: 1.2,
      letterSpacingEm: 0.14,
      textTransform: 'uppercase',
      textAlign: 'left',
      color: 'ink',
      gapHPct: 2.8,
    });
  }

  return {
    lookId: 'bold-poster',
    // Unconditional scrim: caps this size cross the whole photo, so there is no
    // per-photo answer to whether they need help — they always do.
    ink: 'light',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    scrim: { from: anchor, extentHPct: 66, strength: 0.75 },
    accent: photo.accent,
    parts,
    // The pill named the place, so no location sticker should (7.25).
    consumedLocation: Boolean(location),
  };
}

export const BOLD_POSTER: Look = {
  id: 'bold-poster',
  prefer: PREFERRED_BANDS,
  compose,
};
