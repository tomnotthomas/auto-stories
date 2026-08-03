import type {
  Density,
  DrawnComposition,
  FrameContent,
  Look,
  PhotoAnalysis,
  Run,
  Rung,
} from '../look';
import { resolveDensity, splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * Look — **Edge Caps** (decision 7.24, catalogue).
 *
 * The lettering on the spine of a book, or the footer of a printed page: one
 * line of tiny, heavily letterspaced caps running the whole width of the frame,
 * hard against the bottom edge. There is no second part — no rule, no kicker,
 * no scrim, no panel. The photograph is untouched apart from one band of type.
 *
 * The tracking is what makes it: at this size the line only reads as deliberate
 * because it spans edge to edge, so the column inset is almost nothing and the
 * words are spaced until they fill it.
 *
 * Units follow the engine's convention — `WPct` is a % of the frame WIDTH,
 * `HPct` a % of its HEIGHT.
 */

const BRICOLAGE = '"Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Almost no margin: the line is meant to run the width of the frame. */
const COLUMN_INSET_WPCT = 4;
/** Hard against the edge — a spine, not a caption. */
const EDGE_OFFSET_HPCT = 3.5;

/** The foot of the frame; the head is the fallback when the foot is busy. */
const PREFERRED_BANDS: readonly Band[] = ['bottom', 'top'];

/**
 * The shared rung plus the tracking, which is most of what makes this Look read
 * as a spine — so here it steps with the density rather than being fixed.
 */
type SpineRung = Rung & {
  readonly letterSpacingEm: number;
};

/**
 * What this Look sets at each density (7.26). Tracking is the Look, and tracking
 * is exactly what a long line cannot afford: spaced this wide, a `thought` would
 * wrap into a grey field of letters with no words left in it. So the ramp pulls
 * the tracking in as the words lengthen — wide and airy for a `beat` that spans
 * the frame on one line, close and small for a `thought` set as a block of caps
 * along the edge.
 *
 * The budgets are the tightest of the nine, and the tracking is why. At 0.44em
 * every capital costs half again what it would set solid, so the 92 widths this
 * line runs across hold about six words — and the place name is set on the same
 * baseline, out of the same allowance. The `thought` rung halves the tracking
 * and gains most of a line back, but the type is hard against the edge with
 * nowhere to grow: two lines is a band, three is a paragraph someone has pushed
 * off the bottom of the picture.
 */
const LINE: SpineRung = { fontSizeWPct: 2.2, lineHeight: 1.3, letterSpacingEm: 0.44, maxWords: 6 };
export const EDGE_CAPS_RAMP: Record<Density, SpineRung> = {
  // A frame that states `silent` and then writes words has words, and words are
  // always drawn; a truly wordless frame returns before this is read. The rung
  // still carries no budget, because the rung is the absence of words.
  silent: { ...LINE, maxWords: 0 },
  // The leading opens with every step up the ramp, here as everywhere: a beat is
  // one line and wants none of it, a thought is a stack of caps and needs it.
  beat: { fontSizeWPct: 2.6, lineHeight: 1.2, letterSpacingEm: 0.5, maxWords: 3 },
  line: LINE,
  thought: { fontSizeWPct: 1.7, lineHeight: 1.55, letterSpacingEm: 0.18, maxWords: 16 },
  question: LINE,
};

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'top' ? 'top' : 'bottom';

  // Silent: this Look *is* the line. With no words there is nothing left of it
  // (7.26) — which is the cleanest silent frame of the four.
  if (!content.headline.trim()) {
    return {
      lookId: 'edge-caps',
      ink: 'auto',
      leftPct: COLUMN_INSET_WPCT,
      rightPct: COLUMN_INSET_WPCT,
      anchor,
      offsetHPct: EDGE_OFFSET_HPCT,
      scrim: null,
      accent: photo.accent,
      parts: [],
    };
  }

  const location = content.location?.trim();
  const rung = EDGE_CAPS_RAMP[resolveDensity(content)];

  return {
    lookId: 'edge-caps',
    // Nothing is laid down behind the type, so the polarity comes from the
    // device's luminance reading of the photo itself (7.10). A scrim here would
    // be a bar along the edge — more visible than the line it was protecting.
    ink: 'auto',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    scrim: null,
    accent: photo.accent,
    // The place is set on the spine itself, so no location sticker should draw
    // it again (7.25).
    consumedLocation: Boolean(location),
    parts: [
      {
        kind: 'text',
        runs: spineRuns(content, location),
        fontFamily: BRICOLAGE,
        fontWeight: 600,
        fontSizeWPct: rung.fontSizeWPct,
        lineHeight: rung.lineHeight,
        letterSpacingEm: rung.letterSpacingEm,
        textTransform: 'uppercase',
        textAlign: 'center',
        color: 'ink',
        gapHPct: 0,
        // No mark: at 2.2% of the frame width a bar or a block under one word
        // would be a smear, not an emphasis.
      },
    ],
  };
}

/**
 * The line, and the place set off from it by a middot. A spine names the thing
 * and where it is on one baseline; giving the location its own part would make
 * this Look two lines, which it is not. The kicker has no such slot and is
 * dropped — three other Looks in the quiet group carry it.
 */
function spineRuns(content: FrameContent, location: string | undefined): Run[] {
  const runs = splitEmphasis(content.headline, content.emphasis);
  return location ? [...runs, { text: ` · ${location}` }] : runs;
}

export const EDGE_CAPS: Look = {
  ramp: EDGE_CAPS_RAMP,
  id: 'edge-caps',
  prefer: PREFERRED_BANDS,
  compose,
};
