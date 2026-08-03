import type { Density, DrawnComposition, FrameContent, Look, Part, PhotoAnalysis } from '../look';
import { resolveDensity, splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * **Ticker** — breaking news.
 *
 * One accent bar runs the full width of the frame and the words sit inside it,
 * tracked caps with the padding pulled tight so the bar reads as a strip laid
 * over the broadcast rather than a box floating on a photo. The kicker and the
 * place share a strip above the headline, one at each end, the way a lower third
 * carries its flag and its dateline.
 *
 * `…WPct` is a percentage of the frame's WIDTH, `…HPct` of its HEIGHT.
 */

const BRICOLAGE = '"Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** The words' inset inside the bar; the bar itself runs edge to edge. */
const COLUMN_INSET_WPCT = 6;

/**
 * The bar floats clear of the frame's edge — a lower third sits *above* the
 * bottom, not on it, which is what stops it reading as a caption bar.
 */
const EDGE_OFFSET_HPCT = 13;

/** Tight: the bar's whole character is that it clears the type by very little. */
const PAD_HPCT = 2;

/** Ticker belongs low in the frame; the top is its fallback. */
const PREFERRED_BANDS: readonly Band[] = ['bottom', 'top'];

/** How the headline is set at one density. */
interface Rung {
  readonly fontSizeWPct: number;
  readonly lineHeight: number;
}

/**
 * What this Look sets at each density (7.26). A ticker is a *thin* bar, and that
 * is the whole Look, so the ramp is steep: a `beat` fills the strip, while a
 * `thought` has to come right down or the bar swells to a fifth of the frame and
 * reads as a caption block instead.
 *
 * A `thought` is the rung a ticker likes least — a lower third is not written to
 * hold thirty-five words — so it takes the smallest setting in the Look, which
 * is what keeps the bar as shallow as the words allow.
 *
 * This replaces a ramp that guessed from the headline's character count: the
 * model now states what it meant, so the bar is sized to the intent rather than
 * to the accident of how long the sentence came out.
 */
const LINE: Rung = { fontSizeWPct: 4.6, lineHeight: 1.14 };
const HEADLINE: Record<Density, Rung> = {
  // A frame that states `silent` and then writes words has words, and words are
  // always drawn; a truly wordless frame returns before this is read.
  silent: LINE,
  beat: { fontSizeWPct: 6, lineHeight: 1.08 },
  line: LINE,
  thought: { fontSizeWPct: 2.8, lineHeight: 1.28 },
  question: LINE,
};

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'top' ? 'top' : 'bottom';

  // Silent: the photo speaks for itself (decision 7.26). A news bar with no news
  // in it is a coloured stripe across someone's photograph, so it goes too.
  if (!content.headline.trim()) {
    return {
      lookId: 'ticker',
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

  const density = resolveDensity(content);
  const parts: Part[] = [];

  // The dateline strip: flag left, place right, on one baseline. It appears only
  // when there is something to put in it — an empty strip would just add height
  // to a bar whose whole point is being tight.
  const kicker = content.kicker?.trim() ?? '';
  const location = content.location?.trim() ?? '';
  if (kicker || location) {
    parts.push({
      kind: 'row',
      left: kicker,
      right: location,
      fontFamily: BRICOLAGE,
      fontWeight: 700,
      fontSizeWPct: 2.2,
      lineHeight: 1.2,
      letterSpacingEm: 0.26,
      textTransform: 'uppercase',
      textAlign: 'left',
      color: 'ink',
      gapHPct: 0,
    });
  }

  // The headline. No mark, for the same reason as Split Block: the bar is the
  // accent, so an accent mark inside it would be accent on accent.
  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: BRICOLAGE,
    fontWeight: 700,
    fontSizeWPct: HEADLINE[density].fontSizeWPct,
    lineHeight: HEADLINE[density].lineHeight,
    letterSpacingEm: 0.06,
    textTransform: 'uppercase',
    textAlign: 'left',
    color: 'ink',
    gapHPct: kicker || location ? 1.1 : 0,
  });

  return {
    lookId: 'ticker',
    // The bar is opaque, so what is behind the words is the bar. See Split Block
    // for why an accent from `vibrantColor` takes white type.
    ink: 'light',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    // No scrim: the type never touches the photograph, so there is nothing to
    // keep legible, and shading the picture behind a solid bar buys nothing.
    scrim: null,
    accent: photo.accent,
    parts,
    panel: {
      color: 'accent',
      opacity: 1,
      // Full width, so only the vertical padding is doing any work.
      padWPct: 0,
      padHPct: PAD_HPCT,
      radiusWPct: 0,
      fullWidth: true,
    },
    // The dateline strip carried the place at its right end (7.25). A kicker
    // alone still draws the strip, so this tracks the place, not the strip.
    consumedLocation: location !== '',
  };
}

export const TICKER: Look = {
  id: 'ticker',
  prefer: PREFERRED_BANDS,
  compose,
};
