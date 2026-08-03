import type { DrawnComposition, FrameContent, Look, Panel, Part, PhotoAnalysis } from '../look';
import { splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * **Gallery Label** — catalogue A.3, the restrained group (decisions 7.24 /
 * 7.27).
 *
 * A museum wall label: a small off-white card in the bottom-left corner with
 * the title and the place set on it, tiny, in Fraunces. The photo is the work
 * and the label sits beside it — so the panel is the only graphic, and it is
 * deliberately too small to be a caption bar.
 *
 * Geometry is in the mockups' container-query units — `WPct` is the CSS `cqw`,
 * `HPct` the `cqh`.
 */

const FRAUNCES = '"Fraunces", Georgia, "Times New Roman", serif';

const COLUMN_LEFT_WPCT = 9;
/**
 * The card takes a little over half the width. A wall label is narrow — the
 * text wraps after a few words, which is what makes it read as a label rather
 * than as a subtitle.
 */
const COLUMN_RIGHT_WPCT = 38;

const EDGE_OFFSET_HPCT = 10;

/**
 * The card. Off-white paper is a fixed material, not sampled from the photo
 * (see `PartColor` in `look.ts`), so it stays a card whatever the picture does.
 * Slightly short of opaque, so it sits on the photo rather than punching a hole
 * in it, and barely rounded — printed board, not a UI chip.
 */
const CARD: Panel = {
  color: 'paper',
  opacity: 0.94,
  padWPct: 4,
  padHPct: 2.2,
  radiusWPct: 0.4,
  fullWidth: false,
};

/** Bottom-left, the way a label hangs below a hung work; top is the fallback. */
const PREFERRED_BANDS: readonly Band[] = ['bottom', 'top'];

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'top' ? 'top' : 'bottom';

  const base = {
    lookId: 'gallery-label',
    // The type sits on the Look's own paper, so the polarity is known: dark ink
    // on a light card, whatever the photo underneath is doing.
    ink: 'dark',
    leftPct: COLUMN_LEFT_WPCT,
    rightPct: COLUMN_RIGHT_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    // The card already guarantees legibility; a scrim on top of it would shade
    // the photo for no reason.
    scrim: null,
    accent: photo.accent,
  } as const;

  // Silent: the photo speaks for itself (7.26). The card exists to carry the
  // words — an empty label pinned to the corner is worse than no label.
  if (!content.headline.trim()) return { ...base, parts: [] };

  const parts: Part[] = [];

  // A wall label reads: attribution, title, then the particulars. The kicker
  // takes the first line when the model wrote one.
  const kicker = content.kicker?.trim();
  if (kicker) {
    parts.push({
      kind: 'text',
      runs: [{ text: kicker }],
      fontFamily: FRAUNCES,
      fontWeight: 400,
      fontSizeWPct: 2,
      lineHeight: 1.3,
      letterSpacingEm: 0.22,
      textTransform: 'uppercase',
      textAlign: 'left',
      color: 'ink',
      gapHPct: 0,
    });
  }

  // The title. Still tiny — a label is read up close, not across the room — but
  // set in the book weight against the two capitals lines around it.
  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: FRAUNCES,
    fontWeight: 400,
    fontSizeWPct: 3.4,
    lineHeight: 1.28,
    letterSpacingEm: 0,
    textTransform: 'none',
    textAlign: 'left',
    color: 'ink',
    gapHPct: kicker ? 1.2 : 0,
  });

  // The particulars — where the work was made.
  const location = content.location?.trim();
  if (location) {
    parts.push({
      kind: 'text',
      runs: [{ text: location }],
      fontFamily: FRAUNCES,
      fontWeight: 400,
      fontSizeWPct: 2,
      lineHeight: 1.3,
      letterSpacingEm: 0.16,
      textTransform: 'uppercase',
      textAlign: 'left',
      color: 'ink',
      gapHPct: 1.4,
    });
  }

  // The particulars line named the place, so no location sticker should (7.25).
  return { ...base, parts, panel: CARD, consumedLocation: Boolean(location) };
}

export const GALLERY_LABEL: Look = {
  id: 'gallery-label',
  prefer: PREFERRED_BANDS,
  compose,
};
