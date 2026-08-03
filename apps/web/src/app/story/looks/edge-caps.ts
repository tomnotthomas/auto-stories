import type { DrawnComposition, FrameContent, Look, PhotoAnalysis, Run } from '../look';
import { splitEmphasis } from '../look';
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
    parts: [
      {
        kind: 'text',
        runs: spineRuns(content),
        fontFamily: BRICOLAGE,
        fontWeight: 600,
        fontSizeWPct: 2.2,
        lineHeight: 1.3,
        letterSpacingEm: 0.44,
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
function spineRuns(content: FrameContent): Run[] {
  const runs = splitEmphasis(content.headline, content.emphasis);
  const location = content.location?.trim();
  return location ? [...runs, { text: ` · ${location}` }] : runs;
}

export const EDGE_CAPS: Look = {
  id: 'edge-caps',
  prefer: PREFERRED_BANDS,
  compose,
};
