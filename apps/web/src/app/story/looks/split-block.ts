import type { DrawnComposition, FrameContent, Look, Part, PhotoAnalysis } from '../look';
import { splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * **Split Block** — an album cover.
 *
 * The frame is cut in two: the photograph on top, a solid slab of the story's
 * accent bled across the bottom, and the words set into the slab. Nothing is
 * layered over the picture — the type has its own territory, which is what
 * separates a record sleeve from a caption dropped on a photo.
 *
 * Geometry is in the mockups' container-query units: `…WPct` is a percentage of
 * the frame's WIDTH (type sizes), `…HPct` of its HEIGHT (vertical rhythm).
 */

const BRICOLAGE = '"Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** The words' own margin inside the slab. */
const COLUMN_INSET_WPCT = 7;

/**
 * The slab's padding above and below the type. The panel is drawn around the
 * ink, so this is the only number that sets how deep the block is: the block
 * grows with the words rather than the words being trimmed to a fixed band.
 */
const PAD_HPCT = 5;

/**
 * The stack hangs this far off its edge — deliberately the same as the slab's
 * padding, so the slab's outer edge lands exactly on the frame's. A block that
 * stops a few percent short reads as a mistake rather than a design.
 */
const EDGE_OFFSET_HPCT = PAD_HPCT;

/** Split Block wants the bottom third; the top is the same idea, inverted. */
const PREFERRED_BANDS: readonly Band[] = ['bottom', 'top'];

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'top' ? 'top' : 'bottom';

  // Silent: the photo speaks for itself (decision 7.26). The slab exists only to
  // hold words, so with none it is dropped — an accent block with nothing in it
  // is the single worst frame this Look can make.
  if (!content.headline.trim()) {
    return {
      lookId: 'split-block',
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

  // The sleeve's catalogue line: small, tracked, sitting above the title inside
  // the slab. Dropped whole when the model wrote no kicker.
  const kicker = content.kicker?.trim();
  if (kicker) {
    parts.push({
      kind: 'text',
      runs: [{ text: kicker }],
      fontFamily: BRICOLAGE,
      fontWeight: 700,
      fontSizeWPct: 2.4,
      lineHeight: 1.1,
      letterSpacingEm: 0.22,
      textTransform: 'uppercase',
      textAlign: 'left',
      color: 'ink',
      gapHPct: 0,
    });
  }

  // The title. No mark: the slab already IS the accent, so an accent underline
  // or block would be accent on accent — invisible, and a second accent moment
  // in a frame that is allowed one (7.23). The emphasis still splits the runs so
  // the words are identical to every other Look's; it simply goes unmarked here.
  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: BRICOLAGE,
    fontWeight: 700,
    fontSizeWPct: 8.8,
    lineHeight: 1.02,
    letterSpacingEm: -0.025,
    textTransform: 'none',
    textAlign: 'left',
    color: 'ink',
    gapHPct: kicker ? 1.8 : 0,
  });

  // The place, set like a pressing credit under the title.
  const location = content.location?.trim();
  if (location) {
    parts.push({
      kind: 'text',
      runs: [{ text: location }],
      fontFamily: BRICOLAGE,
      fontWeight: 600,
      fontSizeWPct: 2.2,
      lineHeight: 1.2,
      letterSpacingEm: 0.18,
      textTransform: 'uppercase',
      textAlign: 'left',
      color: 'ink',
      gapHPct: 2.2,
    });
  }

  return {
    lookId: 'split-block',
    // The words sit on an opaque accent slab, never on the photograph, so the
    // polarity is a property of this Look and not of the picture. The accent is
    // sampled from a mid-luminance band (`vibrantColor`), which is where white
    // reads and dark does not — hence `light` rather than `auto`.
    ink: 'light',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    // No scrim: a scrim shades the photo so type survives on it, and here the
    // type is not on the photo at all. Darkening the picture under an opaque
    // slab would only mute the half the viewer can see.
    scrim: null,
    accent: photo.accent,
    parts,
    panel: {
      color: 'accent',
      opacity: 1,
      // Edge to edge, so the horizontal padding does no work — the words' own
      // column inset is what holds them off the frame's sides.
      padWPct: 0,
      padHPct: PAD_HPCT,
      radiusWPct: 0,
      fullWidth: true,
    },
    // The pressing credit named the place (7.25).
    consumedLocation: Boolean(location),
  };
}

export const SPLIT_BLOCK: Look = {
  id: 'split-block',
  prefer: PREFERRED_BANDS,
  compose,
};
