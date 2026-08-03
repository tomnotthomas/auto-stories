import type {
  DensityRamp,
  DrawnComposition,
  FrameContent,
  Look,
  PhotoAnalysis,
  Rung,
} from '../look';
import { resolveDensity, splitEmphasis } from '../look';
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

/**
 * What this Look sets at each density (7.26). A subtitle stays small — that is
 * the Look — so the whole ramp lives in the bottom half of the catalogue's
 * range; density changes the fit, not the character.
 *
 * `question` is the one rung set *larger* than its neighbours. A subtitle has no
 * furniture to signal with — one text part and nothing else, which is what makes
 * it a subtitle — so the only thing this Look can say with is size, and a line
 * that expects an answer is worth holding the eye a beat longer than one that
 * expects to be read past. Being the larger setting, it is also the shorter one:
 * a question this Look can hold the eye with has to fit the two lines a burnt-in
 * subtitle is allowed.
 *
 * The budgets follow the convention this Look is imitating rather than the
 * column alone. 78 widths of plain sans is nearly seven words to the line, but
 * burnt-in subtitles are cut to two lines so a viewer can take them in at a
 * glance, and this one is a still image with no next card to continue on. The
 * `thought` rung buys a third line by dropping to 2.9 widths — the most that can
 * sit at the foot of a frame and still read as a subtitle rather than a caption.
 */
const LINE: Rung = { fontSizeWPct: 3.8, lineHeight: 1.35, maxWords: 12 };
export const SUBTITLE_RAMP: DensityRamp = {
  // A frame that states `silent` and then writes words has words, and words are
  // always drawn; a truly wordless frame returns before this is read. The rung
  // still carries no budget, because the rung is the absence of words.
  silent: { ...LINE, maxWords: 0 },
  beat: { fontSizeWPct: 5, lineHeight: 1.25, maxWords: 3 },
  line: LINE,
  thought: { fontSizeWPct: 2.9, lineHeight: 1.5, maxWords: 24 },
  question: { fontSizeWPct: 4.6, lineHeight: 1.35, maxWords: 11 },
};

/**
 * A question holds longer on screen, so the wash under it reaches further. The
 * statement rungs keep the short, soft gradient the Look was drawn with.
 */
const QUESTION_SCRIM = { from: 'bottom', extentHPct: 34, strength: 0.7 } as const;
const STATEMENT_SCRIM = { from: 'bottom', extentHPct: 26, strength: 0.62 } as const;

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
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

  const density = resolveDensity(content);

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
    scrim: density === 'question' ? QUESTION_SCRIM : STATEMENT_SCRIM,
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
        fontSizeWPct: SUBTITLE_RAMP[density].fontSizeWPct,
        lineHeight: SUBTITLE_RAMP[density].lineHeight,
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
  ramp: SUBTITLE_RAMP,
  id: 'subtitle',
  prefer: PREFERRED_BANDS,
  compose,
};
