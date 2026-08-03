import type { Composition, FrameContent, Look, PhotoAnalysis } from '../look';
import { splitEmphasis } from '../look';
import type { Band } from '../quiet-zone';

/**
 * Look — **Subtitle** (decision 7.24, catalogue).
 *
 * The line burnt into the bottom of a film: centred, small, plain system sans,
 * sitting on a short gradient and nothing else. No rule, no tab, no tag, no
 * accent — a subtitle that decorated itself would stop being one.
 *
 * Two rules follow from that and are enforced by the tests:
 * - **One part.** The kicker and the location are dropped, not restyled: a
 *   subtitle carries the line that is being said and nothing around it. The
 *   quiet group has three other Looks that do carry them.
 * - **Always the bottom.** Placement never moves. The scrim answers a busy
 *   photo, and a subtitle at the top of the frame is not a subtitle, so this
 *   Look does not consult the quiet-zone map at all.
 *
 * Units follow the engine's convention — `WPct` is a % of the frame WIDTH,
 * `HPct` a % of its HEIGHT.
 */

/**
 * Burnt-in subtitles are set in whatever the player has; the system UI face is
 * the web's version of that, and it costs no download.
 */
const SYSTEM_SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** Wide margins keep the line to the readable measure a subtitle is set to. */
const COLUMN_INSET_WPCT = 11;
/** Hard down at the foot of the frame, clear of the phone's own UI. */
const EDGE_OFFSET_HPCT = 7;

/** Stated for the engine's benefit; placement is fixed (see the note above). */
const PREFERRED_BANDS: readonly Band[] = ['bottom'];

function compose(content: FrameContent, photo: PhotoAnalysis): Composition {
  // Silent: with no line there is nothing to subtitle, and a gradient across
  // the foot of an otherwise untouched photo is just a smudge (7.26).
  if (!content.headline.trim()) {
    return {
      lookId: 'subtitle',
      ink: 'light',
      leftPct: COLUMN_INSET_WPCT,
      rightPct: COLUMN_INSET_WPCT,
      anchor: 'bottom',
      offsetHPct: EDGE_OFFSET_HPCT,
      scrim: null,
      accent: photo.accent,
      parts: [],
    };
  }

  return {
    lookId: 'subtitle',
    // The scrim is the Look's only device, so the polarity is settled here
    // rather than sampled: white on a darkened foot, always.
    ink: 'light',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor: 'bottom',
    offsetHPct: EDGE_OFFSET_HPCT,
    // Short and soft — it has one or two lines of small type to carry, so it
    // stops well before it starts reading as a bar across the picture.
    scrim: { from: 'bottom', extentHPct: 26, strength: 0.62 },
    accent: photo.accent,
    parts: [
      {
        kind: 'text',
        // The emphasis is carried on the runs but no `mark` is set: subtitles
        // do not highlight. A renderer that ignores an unmarked flag draws the
        // plain line, which is exactly what this Look wants.
        runs: splitEmphasis(content.headline, content.emphasis),
        fontFamily: SYSTEM_SANS,
        fontWeight: 400,
        fontSizeWPct: 3.8,
        lineHeight: 1.35,
        letterSpacingEm: 0,
        textTransform: 'none',
        textAlign: 'center',
        color: 'ink',
        gapHPct: 0,
      },
    ],
  };
}

export const SUBTITLE: Look = {
  id: 'subtitle',
  prefer: PREFERRED_BANDS,
  compose,
};
