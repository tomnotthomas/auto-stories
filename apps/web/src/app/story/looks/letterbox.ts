import type { Composition, FrameContent, Look, Part, PhotoAnalysis } from '../look';
import { splitEmphasis } from '../look';
import type { Band } from '../quiet-zone';

/**
 * Look — **Letterbox** (decision 7.24).
 *
 * Cinema. An opaque dark bar runs the full width of the bottom of the frame and
 * the words sit centred inside it, set in Fraunces at reading weight — a subtitle
 * card, not a headline. The photo above it is left completely alone; the bar is
 * the only thing this Look adds, which is why it can carry the longest lines of
 * any of them without crowding the picture.
 *
 * Geometry is in the board's container-query units — `WPct` is a percentage of
 * the frame WIDTH, `HPct` of its HEIGHT.
 */

const FRAUNCES = '"Fraunces", Georgia, "Times New Roman", serif';

/** A narrow centred measure, the way a subtitle is set. */
const COLUMN_INSET_WPCT = 13;
/** How far the ink sits off the bottom edge. */
const EDGE_OFFSET_HPCT = 7;
/** Padding inside the bar; more than the offset, so the bar bleeds off the edge. */
const BAR_PAD_HPCT = 8;

/**
 * The bar is opaque, so what the photo is doing underneath it does not matter —
 * this is the one Look that never moves. Stated anyway, because the engine asks
 * every Look where it would like to sit.
 */
const PREFERRED_BANDS: readonly Band[] = ['bottom'];

function compose(content: FrameContent, photo: PhotoAnalysis): Composition {
  // Silent: the photo speaks for itself (decision 7.26). A letterbox bar with no
  // subtitle in it is a black stripe across someone's photo — the worst thing
  // this Look could draw — so with no headline it draws nothing.
  if (!content.headline.trim()) {
    return {
      lookId: 'letterbox',
      ink: 'dark',
      leftPct: COLUMN_INSET_WPCT,
      rightPct: COLUMN_INSET_WPCT,
      anchor: 'bottom',
      offsetHPct: EDGE_OFFSET_HPCT,
      scrim: null,
      accent: photo.accent,
      parts: [],
    };
  }

  const parts: Part[] = [];

  // A small centred eyebrow above the line — the film's title card, letterspaced
  // wide. Dropped when the model wrote no kicker.
  const kicker = content.kicker?.trim();
  if (kicker) {
    parts.push({
      kind: 'text',
      runs: [{ text: kicker }],
      fontFamily: FRAUNCES,
      fontWeight: 400,
      fontSizeWPct: 2.4,
      lineHeight: 1.2,
      letterSpacingEm: 0.3,
      textTransform: 'uppercase',
      textAlign: 'center',
      // Reversed out of the bar. The bar itself is painted in the `ink` tone,
      // which this Look declares dark, so the words take the fixed paper tone.
      color: 'paper',
      gapHPct: 0,
    });
  }

  // The subtitle. Set at reading size with open leading: a letterbox line is read
  // across, not scanned, so it stays modest even when the headline is short.
  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: FRAUNCES,
    fontWeight: 400,
    fontSizeWPct: 5.4,
    lineHeight: 1.28,
    letterSpacingEm: 0,
    textTransform: 'none',
    textAlign: 'center',
    color: 'paper',
    gapHPct: kicker ? 2 : 0,
    // The only ornament the bar allows: a thin accent rule under one phrase.
    mark: 'accent-underline',
  });

  return {
    lookId: 'letterbox',
    // The bar is painted in the `ink` colour and the type in `paper`, so this
    // Look declares its ink DARK to get a dark bar — the words on top are stated
    // as paper part by part. Nothing here is left to the photo's own reading,
    // because nothing here sits on the photo.
    ink: 'dark',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor: 'bottom',
    offsetHPct: EDGE_OFFSET_HPCT,
    // No gradient: an opaque bar already owns every pixel behind the words, and a
    // scrim above it would smudge the clean horizon the letterbox edge cuts.
    scrim: null,
    accent: photo.accent,
    parts,
    panel: {
      color: 'ink',
      // Not quite solid — a trace of the photo in the bar keeps it part of the
      // picture rather than a sticker laid on top.
      opacity: 0.92,
      padWPct: 0,
      padHPct: BAR_PAD_HPCT,
      radiusWPct: 0,
      fullWidth: true,
    },
  };
}

export const LETTERBOX: Look = {
  id: 'letterbox',
  prefer: PREFERRED_BANDS,
  compose,
};
