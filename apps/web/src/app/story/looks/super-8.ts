import type { Density, DrawnComposition, FrameContent, Look, Part, PhotoAnalysis } from '../look';
import { resolveDensity, splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * Look 08 — **Super 8** (decision 7.24).
 *
 * A home movie paused: a rounded viewfinder inset on the picture, a level
 * stamp reading like a camera's timecode, and small monospaced type under it.
 * Everything is small and square to the frame — this Look is a readout, not a
 * headline, and the sepia does the remembering.
 *
 * Geometry is authored in the same units as the rest of the engine — `WPct` is
 * a percentage of the frame WIDTH, `HPct` of its HEIGHT.
 */

/**
 * The one slot with no bundled face: a timecode has to be monospaced, and every
 * platform ships a good one. `ui-monospace` picks the system's own (SF Mono,
 * Cascadia), so this costs no font payload and never falls back to a proportional
 * face — which would break the readout.
 */
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

const COLUMN_INSET_WPCT = 10.5;
const EDGE_OFFSET_HPCT = 10;

/** The viewfinder: inset well clear of the type, corners rounded like a gate. */
const VIEWFINDER_INSET_WPCT = 4.6;
const VIEWFINDER_WIDTH_WPCT = 0.42;
const VIEWFINDER_RADIUS_WPCT = 3.4;

/** Sepia, slightly flattened — reversal stock that has sat in a drawer. */
const HOME_MOVIE = 'sepia(0.42) saturate(0.9) contrast(1.06) brightness(0.98)';

/** A readout belongs at the head of the picture; the foot is its fallback. */
const PREFERRED_BANDS: readonly Band[] = ['top', 'bottom'];

/** How the card is typed at one density. */
interface Rung {
  readonly fontSizeWPct: number;
  readonly lineHeight: number;
}

/**
 * What this Look sets at each density (7.26). This Look is a readout, not a
 * headline, so the whole ramp sits low — a `beat` here is still smaller than a
 * `thought` in the loud group. Mono caps are wide, so the drop at `thought` is
 * what keeps a passage from filling the viewfinder it is supposed to sit inside.
 */
const LINE: Rung = { fontSizeWPct: 3.6, lineHeight: 1.4 };
const HEADLINE: Record<Density, Rung> = {
  // A frame that states `silent` and then writes words has words, and words are
  // always drawn; a truly wordless frame returns before this is read.
  silent: LINE,
  beat: { fontSizeWPct: 5, lineHeight: 1.3 },
  line: LINE,
  thought: { fontSizeWPct: 2.6, lineHeight: 1.54 },
  question: LINE,
};

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  const anchor = band === 'top' ? 'top' : 'bottom';

  // Silent: the photo speaks for itself (decision 7.26). The viewfinder and the
  // timecode are furniture around the words, not part of the picture, so they
  // go with them. The sepia stays — it is the stock the whole story is shot on,
  // and one frame in colour would read as a different film.
  if (!content.headline.trim()) {
    return {
      lookId: 'super-8',
      ink: 'auto',
      leftPct: COLUMN_INSET_WPCT,
      rightPct: COLUMN_INSET_WPCT,
      anchor,
      offsetHPct: EDGE_OFFSET_HPCT,
      scrim: null,
      accent: photo.accent,
      parts: [],
      photoFilter: HOME_MOVIE,
    };
  }

  const density = resolveDensity(content);
  const parts: Part[] = [];

  // The timecode. Nothing is invented: it sets whatever short label the frame
  // already carries — the kicker if the model wrote one, otherwise the place —
  // in a camera's idiom. `rotationDeg: 0` overrides the stamp's default tilt: a
  // postcard stamp is pressed by hand, a readout is burned in by the camera.
  const stamp = content.kicker?.trim() || content.location?.trim();
  if (stamp) {
    parts.push({
      kind: 'tag',
      text: stamp,
      style: 'stamp',
      fontFamily: MONO,
      fontWeight: 400,
      fontSizeWPct: 1.9,
      lineHeight: 1.2,
      letterSpacingEm: 0.22,
      textTransform: 'uppercase',
      textAlign: 'left',
      color: 'accent',
      gapHPct: 0,
      rotationDeg: 0,
    });
  }

  // Small, tracked, upper case: a title card typed on the camera, not set by a
  // typographer. No mark — a coloured stroke has no place in a viewfinder.
  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: MONO,
    fontWeight: 400,
    fontSizeWPct: HEADLINE[density].fontSizeWPct,
    lineHeight: HEADLINE[density].lineHeight,
    letterSpacingEm: 0.02,
    textTransform: 'uppercase',
    textAlign: 'left',
    color: 'ink',
    gapHPct: stamp ? 2.6 : 0,
  });

  // The place, when the timecode above is already spoken for by the kicker.
  const location = content.location?.trim();
  if (location && location !== stamp) {
    parts.push({
      kind: 'text',
      runs: [{ text: location }],
      fontFamily: MONO,
      fontWeight: 400,
      fontSizeWPct: 1.9,
      lineHeight: 1.2,
      letterSpacingEm: 0.22,
      textTransform: 'uppercase',
      textAlign: 'left',
      color: 'ink',
      gapHPct: 2.2,
    });
  }

  return {
    lookId: 'super-8',
    ink: 'light',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    // Shallow: the type is small and clustered at one edge, so the gradient only
    // has to cover the readout, not half the picture.
    scrim: { from: anchor, extentHPct: 42, strength: 0.5 },
    accent: photo.accent,
    parts,
    border: {
      insetWPct: VIEWFINDER_INSET_WPCT,
      widthWPct: VIEWFINDER_WIDTH_WPCT,
      // Follows the polarity of the type, so the gate reads on any photo.
      color: 'ink',
      radiusWPct: VIEWFINDER_RADIUS_WPCT,
    },
    photoFilter: HOME_MOVIE,
    // Either the timecode or the line under it named the place — the readout
    // takes it when there is no kicker, and it gets its own line when there is
    // — so a frame with a place has always drawn it here (7.25).
    consumedLocation: Boolean(location),
  };
}

export const SUPER_8: Look = {
  id: 'super-8',
  prefer: PREFERRED_BANDS,
  compose,
};
