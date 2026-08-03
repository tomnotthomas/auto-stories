import type { DrawnComposition, FrameContent, Look, Part, PhotoAnalysis } from '../look';
import { splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * **Scrapbook** (decision 7.24, built out under 7.27).
 *
 * A journal page: the whole stack laid down by hand and slightly off-square, a
 * handwritten note over a bigger handwritten line, one phrase underlined with a
 * loose drawn stroke, and the place taped on as a paper label.
 *
 * Everything here is *one* gesture away from typeset — the page tilt, the drawn
 * underline, the tape. That is the whole Look; it deliberately carries no other
 * doodles (7.23 cut three marks a frame back to one).
 *
 * Geometry is in the Looks' authoring units: `WPct` is a percentage of the
 * frame's WIDTH, `HPct` of its HEIGHT.
 */

const SHANTELL = '"Shantell Sans", "Segoe Print", "Bradley Hand", cursive';

/** Wider than Magazine's column: a tilted stack needs room to swing. */
const COLUMN_INSET_WPCT = 9;
const EDGE_OFFSET_HPCT = 10;

/** The page tilt. Small enough to read as hand-placed, not as a broken layout. */
const PAGE_TILT_DEG = -2;

/**
 * The tape is stuck on *after* the page is laid down, so it tilts the other way.
 * Left to the renderer's default a tape tag runs parallel to the page and the
 * whole thing reads as one rotated image instead of two laid objects.
 */
const TAPE_TILT_DEG = 2.6;

/** A journal page is written from the bottom of the photo up. */
const PREFERRED_BANDS: readonly Band[] = ['bottom', 'top'];

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'top' ? 'top' : 'bottom';

  // Silent: the photo speaks for itself (7.26). No words, so no page to tilt,
  // no tape and no scrim — a strip of tape floating on a bare photo reads as a
  // bug, not as restraint.
  if (!content.headline.trim()) {
    return {
      lookId: 'scrapbook',
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

  // The margin note above the entry. Set in the accent so the page has one
  // coloured thing besides the underline, and small so it never competes.
  const kicker = content.kicker?.trim();
  if (kicker) {
    parts.push({
      kind: 'text',
      runs: [{ text: kicker }],
      fontFamily: SHANTELL,
      fontWeight: 400,
      fontSizeWPct: 3.1,
      lineHeight: 1.25,
      letterSpacingEm: 0.01,
      textTransform: 'none',
      textAlign: 'left',
      color: 'accent',
      gapHPct: 0,
    });
  }

  // The entry itself. Shantell needs more leading than a text face — its
  // ascenders and descenders overlap at Magazine's 1.0 — and a size below
  // Magazine's, because a hand at display size stops reading as handwriting.
  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: SHANTELL,
    fontWeight: 700,
    fontSizeWPct: 8.2,
    lineHeight: 1.14,
    letterSpacingEm: -0.005,
    textTransform: 'none',
    textAlign: 'left',
    color: 'ink',
    gapHPct: kicker ? 1.6 : 0,
    mark: 'hand-underline',
  });

  // The place, taped on. The Look draws the location itself, so nothing else
  // should also draw it — one place name per frame.
  const location = content.location?.trim();
  if (location) {
    parts.push({
      kind: 'tag',
      text: location,
      style: 'tape',
      fontFamily: SHANTELL,
      fontWeight: 400,
      fontSizeWPct: 2.9,
      lineHeight: 1.2,
      letterSpacingEm: 0.03,
      textTransform: 'none',
      textAlign: 'left',
      // Tape prints its own dark on its own paper; this is the fallback the
      // renderer would use if it ever drew the label flat.
      color: 'ink',
      gapHPct: 3.4,
      rotationDeg: TAPE_TILT_DEG,
    });
  }

  return {
    lookId: 'scrapbook',
    // Unconditional scrim, so the hand stays white over any photo: a per-photo
    // decision would make the story flicker between framed and not.
    ink: 'light',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    scrim: { from: anchor, extentHPct: 58, strength: 0.66 },
    accent: photo.accent,
    parts,
    rotationDeg: PAGE_TILT_DEG,
    // The tape carried the place, so no location sticker should (7.25).
    consumedLocation: Boolean(location),
  };
}

export const SCRAPBOOK: Look = {
  id: 'scrapbook',
  prefer: PREFERRED_BANDS,
  compose,
};
