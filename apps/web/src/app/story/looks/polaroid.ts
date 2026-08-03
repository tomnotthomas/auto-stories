import type { Density, DrawnComposition, FrameContent, Look, Part, PhotoAnalysis } from '../look';
import { resolveDensity, splitEmphasis } from '../look';
import type { Band } from '../quiet-zone';

/**
 * Look 07 — **Polaroid** (decision 7.24).
 *
 * An instant print: a thick paper margin across the foot of the frame, with the
 * caption written into it by hand. The one Look in the warm group whose words
 * never sit on the photograph — they sit on paper — so its ink is `dark`, it
 * needs no scrim, and its margin is the only place its type can go.
 *
 * Geometry is authored in the same units as the rest of the engine — `WPct` is
 * a percentage of the frame WIDTH, `HPct` of its HEIGHT.
 */

const SHANTELL = '"Shantell Sans", "Segoe Print", "Bradley Hand", cursive';

const COLUMN_INSET_WPCT = 11;
/**
 * How far the writing stops short of the bottom edge. The panel pads further
 * than this ({@link MARGIN_PAD_HPCT}), so the paper bleeds off the frame
 * instead of floating as a bar above it.
 */
const EDGE_OFFSET_HPCT = 6.4;
const MARGIN_PAD_HPCT = 7.2;

/** A hair brighter and cleaner — the lift an instant print gives a scene. */
const INSTANT_LIFT = 'brightness(1.04) saturate(1.06) contrast(0.98)';

/**
 * The margin is at the foot of a print, always. Unlike the other Looks this one
 * does not negotiate with the photo: the paper is opaque, so how busy the band
 * underneath is has no bearing on whether the words can be read. `prefer` still
 * states where it sits, for the engine and for anyone reading the catalogue.
 */
const PREFERRED_BANDS: readonly Band[] = ['bottom'];

/** How the caption is written at one density. */
interface Rung {
  readonly fontSizeWPct: number;
  readonly lineHeight: number;
}

/**
 * What this Look sets at each density (7.26). The margin grows with the words —
 * the panel is drawn around the ink — so the ramp is not about overflow but about
 * how much of the photograph the paper is allowed to take. At the `line` size a
 * `thought` would push the margin up over a third of the print, which is a
 * caption card with a picture attached rather than a Polaroid.
 */
const LINE: Rung = { fontSizeWPct: 4.8, lineHeight: 1.28 };
const CAPTION: Record<Density, Rung> = {
  // A frame that states `silent` and then writes words has words, and words are
  // always drawn; a truly wordless frame returns before this is read.
  silent: LINE,
  beat: { fontSizeWPct: 6.4, lineHeight: 1.2 },
  line: LINE,
  thought: { fontSizeWPct: 3.3, lineHeight: 1.44 },
  question: LINE,
};

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  // Silent: the photo speaks for itself (decision 7.26). With nothing written
  // the margin has no reason to exist — an empty white band across a photo
  // reads as a printing fault — so the paper goes with the words. The lift
  // stays: it treats the photograph, not the caption.
  if (!content.headline.trim()) {
    return {
      lookId: 'polaroid',
      // No paper, so nothing is written on paper: defer to the photo (7.10).
      ink: 'auto',
      leftPct: COLUMN_INSET_WPCT,
      rightPct: COLUMN_INSET_WPCT,
      anchor: 'bottom',
      offsetHPct: EDGE_OFFSET_HPCT,
      scrim: null,
      accent: photo.accent,
      parts: [],
      photoFilter: INSTANT_LIFT,
    };
  }

  // A print margin holds one hand-written thought. The kicker is dropped rather
  // than stacked into it — three lines of handwriting in a white band is a
  // caption block, not a Polaroid.
  const rung = CAPTION[resolveDensity(content)];
  const parts: Part[] = [
    {
      kind: 'text',
      runs: splitEmphasis(content.headline, content.emphasis),
      fontFamily: SHANTELL,
      fontWeight: 400,
      fontSizeWPct: rung.fontSizeWPct,
      lineHeight: rung.lineHeight,
      letterSpacingEm: 0,
      textTransform: 'none',
      textAlign: 'center',
      color: 'ink',
      gapHPct: 0,
      // The only mark in the warm group: a pen stroke belongs in a hand-written
      // margin, and the accent reads as coloured ink on paper.
      mark: 'hand-underline',
    },
  ];

  // The place, written smaller under the caption — what people actually write
  // on the white strip of a print.
  const location = content.location?.trim();
  if (location) {
    parts.push({
      kind: 'text',
      runs: [{ text: location }],
      fontFamily: SHANTELL,
      fontWeight: 400,
      fontSizeWPct: 2.4,
      lineHeight: 1.2,
      letterSpacingEm: 0.06,
      textTransform: 'none',
      textAlign: 'center',
      color: 'ink',
      gapHPct: 1.8,
    });
  }

  return {
    lookId: 'polaroid',
    // The words are on paper, whatever the photo above is doing.
    ink: 'dark',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor: 'bottom',
    offsetHPct: EDGE_OFFSET_HPCT,
    // An opaque margin already guarantees contrast; a gradient on top of it
    // would only dirty the photo above.
    scrim: null,
    accent: photo.accent,
    parts,
    panel: {
      color: 'paper',
      opacity: 1,
      padWPct: 8,
      padHPct: MARGIN_PAD_HPCT,
      radiusWPct: 0,
      // Edge to edge: a print margin runs the full width of the print.
      fullWidth: true,
    },
    photoFilter: INSTANT_LIFT,
    // The margin carried the place under the caption, so no sticker should (7.25).
    consumedLocation: Boolean(location),
  };
}

export const POLAROID: Look = {
  id: 'polaroid',
  prefer: PREFERRED_BANDS,
  compose,
};
