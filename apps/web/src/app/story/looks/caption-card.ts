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
 * Look — **Caption Card** (decision 7.24).
 *
 * A small rounded card of paper set low and centred on the photo, with the line
 * printed inside it in the interface's own sans — the plainest Look of the set.
 * It claims nothing: no display face, no accent slab, no editorial voice. It is
 * the one to reach for when the picture is the whole point and the words are
 * only there to say where and when.
 *
 * Geometry is in the board's container-query units — `WPct` is a percentage of
 * the frame WIDTH, `HPct` of its HEIGHT.
 */

/** The interface sans — deliberately not one of the bundled display faces. */
const SYSTEM_SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';

/** A narrow card, well in from both edges. */
const COLUMN_INSET_WPCT = 19;
const EDGE_OFFSET_HPCT = 11;

/** The card sits low; the top is the fallback when the bottom is busy. */
const PREFERRED_BANDS: readonly Band[] = ['bottom', 'top'];

/**
 * What this Look sets at each density (7.26). The card is small at every rung —
 * it is a caption chip, and a chip that grew into a poster would be a different
 * Look — so the ramp is narrow at the top and drops properly at the bottom: a
 * `thought` is a note written on the card, several lines at reading size.
 *
 * The budget is bounded by the card, not the frame, but the card is set in the
 * plainest type in the catalogue and the smallest: at the `thought` rung the
 * 62%-wide measure takes about 43 characters to the line, so 7.26's full 35
 * words come to five lines and a card roughly a sixth of the frame deep. This
 * is the one Look that can carry the whole band, which is the other half of
 * what `maxWords` is for — it tells the model where a long caption belongs.
 */
const LINE: Rung = { fontSizeWPct: 4.2, lineHeight: 1.3, maxWords: 12 };
export const CAPTION_CARD_RAMP: DensityRamp = {
  // A frame that states `silent` and then writes words has words, and words are
  // always drawn; a truly wordless frame returns before this is read. The budget
  // is still nought: the rung asks for no words at all.
  silent: { ...LINE, maxWords: 0 },
  // Small even when it shouts, so a beat gets a word more than the loud Looks
  // do before it wraps.
  beat: { fontSizeWPct: 6.4, lineHeight: 1.15, maxWords: 3 },
  line: LINE,
  thought: { fontSizeWPct: 2.9, lineHeight: 1.45, maxWords: 35 },
  question: { ...LINE, maxWords: 10 },
};

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'top' ? 'top' : 'bottom';

  // Silent: the photo speaks for itself (decision 7.26). An empty card is a blank
  // sticker on a photo, so with no line there is no card.
  if (!content.headline.trim()) {
    return {
      lookId: 'caption-card',
      ink: 'dark',
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

  // A tiny eyebrow at the top of the card, kept much smaller than the line so the
  // card stays a caption and not a poster. Dropped when there is no kicker.
  const kicker = content.kicker?.trim();
  if (kicker) {
    parts.push({
      kind: 'text',
      runs: [{ text: kicker }],
      fontFamily: SYSTEM_SANS,
      fontWeight: 400,
      fontSizeWPct: 2.2,
      lineHeight: 1.2,
      letterSpacingEm: 0.14,
      textTransform: 'uppercase',
      textAlign: 'center',
      color: 'ink',
      gapHPct: 0,
    });
  }

  // The line itself.
  const density = resolveDensity(content);
  const rung = CAPTION_CARD_RAMP[density];
  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: SYSTEM_SANS,
    fontWeight: 400,
    fontSizeWPct: rung.fontSizeWPct,
    lineHeight: rung.lineHeight,
    letterSpacingEm: 0,
    textTransform: 'none',
    textAlign: 'center',
    color: 'ink',
    gapHPct: kicker ? 1.4 : 0,
    // A marker swipe: on paper it reads as a line someone went back and picked
    // out, which suits a card of notes. The other marks want a display face.
    //
    // Never on a question (7.26): a swipe through a word of a question reads as
    // somebody marking the answer, which is the one thing the card is not
    // saying.
    ...(density === 'question' ? {} : { mark: 'highlighter' as const }),
  });

  return {
    lookId: 'caption-card',
    // The card is paper and the words are printed on it, so the polarity is
    // fixed dark whatever the photo behind the card is doing.
    ink: 'dark',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    // No gradient: the card carries its own background, and a gradient behind a
    // light card would only dirty the photo around it.
    scrim: null,
    accent: photo.accent,
    parts,
    panel: {
      color: 'paper',
      // Just short of solid, so the card sits in the photo's light rather than
      // punching a hole in it.
      opacity: 0.95,
      padWPct: 5,
      padHPct: 2.4,
      // Rounded like an app's own caption chip — the point of reference here is
      // the interface, not print.
      radiusWPct: 2.6,
      fullWidth: false,
    },
  };
}

export const CAPTION_CARD: Look = {
  ramp: CAPTION_CARD_RAMP,
  id: 'caption-card',
  prefer: PREFERRED_BANDS,
  compose,
};
