import type { Style, StylePositionEnum } from '@auto-stories/api-types';

import { type FramePlacement } from './story.service';

/** The style a hand-added frame gets until the model restyles it — a calm,
 * centred default. Mirrors the backend's `normalizeStyle` default. */
export const DEFAULT_STYLE: Style = {
  font: 'inter',
  weight: 'regular',
  case: 'normal',
  align: 'center',
  size: 'm',
  position: 'bottom-center',
  letterbox: 'blur',
};

/**
 * The AI picks a caption `position` (one of six anchor zones, kept off the
 * subject in the middle); we turn that into the starting {@link FramePlacement}
 * the user can then drag. Percentages of the frame, matching DEFAULT_PLACEMENT's
 * convention (box centre + scale). Top/bottom sit inside the always-visible band.
 */
const ZONE_TO_PLACEMENT: Record<StylePositionEnum, FramePlacement> = {
  'top-left': { xPct: 28, yPct: 16, scale: 1 },
  'top-center': { xPct: 50, yPct: 16, scale: 1 },
  'top-right': { xPct: 72, yPct: 16, scale: 1 },
  'bottom-left': { xPct: 28, yPct: 84, scale: 1 },
  'bottom-center': { xPct: 50, yPct: 84, scale: 1 },
  'bottom-right': { xPct: 72, yPct: 84, scale: 1 },
};

export function zoneToPlacement(position: StylePositionEnum): FramePlacement {
  return ZONE_TO_PLACEMENT[position];
}

/** What the device computes for readability (never the model): text colour and
 * whether a scrim is drawn behind the caption. */
export interface Readable {
  /** true → light (white) text on a dark area; false → dark text on a light area. */
  readonly light: boolean;
  /** true → draw a scrim behind the caption (contrast is ambiguous). */
  readonly scrim: boolean;
}

/** Midpoint of relative luminance (0..1). Below it the area is dark → white text. */
const CONTRAST_MID = 0.5;
/** Within this band of the midpoint, neither colour is safe → add a scrim. */
const SCRIM_BAND = 0.18;

/**
 * Average relative luminance (0..1, Rec. 709) of RGBA pixels — the brightness of
 * the photo under the caption box. Pure; the impure "decode + sample the region"
 * step lives in the renderer.
 */
export function averageLuminance(rgba: Uint8ClampedArray): number {
  const pixels = Math.floor(rgba.length / 4);
  if (pixels === 0) return 0;
  let sum = 0;
  for (let i = 0; i < pixels * 4; i += 4) {
    sum += (0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]) / 255;
  }
  return sum / pixels;
}

/**
 * Given the average luminance under the caption, pick white-vs-dark text and
 * whether a scrim is needed. Deterministic and pure — this is the readability
 * the model does NOT decide (decisions 7.10).
 */
export function pickReadable(luminance: number): Readable {
  return {
    light: luminance < CONTRAST_MID,
    scrim: Math.abs(luminance - CONTRAST_MID) < SCRIM_BAND,
  };
}
