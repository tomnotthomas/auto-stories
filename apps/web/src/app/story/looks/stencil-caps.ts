import type { DrawnComposition, FrameContent, Look, Part, PhotoAnalysis } from '../look';
import { splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * **Stencil Caps** — screen-printed.
 *
 * Enormous centred capitals, outlined and unfilled, so the photograph shows
 * through the letterforms the way ink pulled through a screen leaves the shirt
 * visible inside the counters. The outline is the whole graphic: there is no
 * panel, no rule and no mark, because a second device would be competing with
 * type set at nearly a seventh of the frame's width.
 *
 * `…WPct` is a percentage of the frame's WIDTH, `…HPct` of its HEIGHT.
 */

const BRICOLAGE = '"Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Wide margins: the type is huge, so the air around it has to be too. */
const COLUMN_INSET_WPCT = 8;

/**
 * The stack sits well off the frame's edge when the middle of the photo is the
 * calm part — a print centred on the shirt, not hung off the hem.
 */
const CENTRED_OFFSET_HPCT = 30;

/** …and pulls back to a normal margin when it has to take an edge instead. */
const EDGE_OFFSET_HPCT = 9;

/** Centred is the point, so the middle band is what this Look actually wants. */
const PREFERRED_BANDS: readonly Band[] = ['middle', 'bottom', 'top'];

/**
 * How big the stencil is set, by how much there is to set. At 13.5% of the
 * frame's width roughly seven capitals fit on a line, which is what makes a
 * three-word headline look printed — and what would push a twelve-word one off
 * the top of the frame. So the size steps down with the word count instead:
 * still the largest type in the catalogue at every step, but always inside the
 * frame. The steps are coarse on purpose — a continuous fit would give every
 * frame in a story a different headline size and lose the set.
 */
const SIZE_STEPS: readonly { readonly upTo: number; readonly fontSizeWPct: number }[] = [
  { upTo: 22, fontSizeWPct: 13.5 },
  { upTo: 40, fontSizeWPct: 10.5 },
  { upTo: 70, fontSizeWPct: 8 },
  { upTo: Infinity, fontSizeWPct: 6.4 },
];

/** The step a headline of this length is set at. */
function sizeFor(headline: string): number {
  const step = SIZE_STEPS.find((candidate) => headline.trim().length <= candidate.upTo);
  return (step ?? SIZE_STEPS[SIZE_STEPS.length - 1]).fontSizeWPct;
}

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  // A composition hangs off one of two edges, so the middle is reached by
  // hanging off the bottom and standing well clear of it.
  const anchor = band === 'top' ? 'top' : 'bottom';
  const offsetHPct = band === 'middle' ? CENTRED_OFFSET_HPCT : EDGE_OFFSET_HPCT;

  // Silent: the photo speaks for itself (decision 7.26). Everything here exists
  // to set the words, and the scrim exists only to keep them readable, so with
  // no words the frame is the photograph and nothing else.
  if (!content.headline.trim()) {
    return {
      lookId: 'stencil-caps',
      ink: 'light',
      leftPct: COLUMN_INSET_WPCT,
      rightPct: COLUMN_INSET_WPCT,
      anchor,
      offsetHPct,
      scrim: null,
      accent: photo.accent,
      parts: [],
    };
  }

  const parts: Part[] = [];

  // The print run line — small, wide-tracked, in the accent. This is the Look's
  // one spot of colour; the headline itself stays in ink so the outline reads as
  // a stencil rather than as a coloured word.
  const kicker = content.kicker?.trim();
  if (kicker) {
    parts.push({
      kind: 'text',
      runs: [{ text: kicker }],
      fontFamily: BRICOLAGE,
      fontWeight: 700,
      fontSizeWPct: 2.6,
      lineHeight: 1.1,
      letterSpacingEm: 0.32,
      textTransform: 'uppercase',
      textAlign: 'center',
      color: 'accent',
      gapHPct: 0,
    });
  }

  // The stencil. Unfilled letters carry roughly a tenth of the ink a filled one
  // does, so the weight goes up (800) and the tracking opens slightly to keep
  // the outlines from touching at this size. No mark: the outline is the device.
  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: BRICOLAGE,
    fontWeight: 800,
    fontSizeWPct: sizeFor(content.headline),
    lineHeight: 0.94,
    letterSpacingEm: 0.02,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: 'ink',
    gapHPct: kicker ? 2.2 : 0,
    stroke: true,
  });

  // The place, set as the bottom line of the print.
  const location = content.location?.trim();
  if (location) {
    parts.push({
      kind: 'text',
      runs: [{ text: location }],
      fontFamily: BRICOLAGE,
      fontWeight: 600,
      fontSizeWPct: 2.4,
      lineHeight: 1.2,
      letterSpacingEm: 0.24,
      textTransform: 'uppercase',
      textAlign: 'center',
      color: 'ink',
      gapHPct: 2.6,
    });
  }

  return {
    lookId: 'stencil-caps',
    // The scrim below is unconditional, so this Look always knows what is behind
    // its letters and says so outright rather than deferring to `auto`.
    ink: 'light',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct,
    // A wide, soft wash rather than the usual band at one edge: the type can sit
    // anywhere from the middle of the frame to either edge, and an outline needs
    // more help than a filled letter, not less. Unconditional, because a scrim
    // decided per photo makes a story flicker between framed and unframed.
    scrim: { from: anchor, extentHPct: 92, strength: 0.52 },
    accent: photo.accent,
    parts,
  };
}

export const STENCIL_CAPS: Look = {
  id: 'stencil-caps',
  prefer: PREFERRED_BANDS,
  compose,
};
