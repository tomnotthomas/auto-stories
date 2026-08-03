import type { DrawnComposition, FrameContent, Look, Part, PhotoAnalysis } from '../look';
import { splitEmphasis } from '../look';
import { quietestBand, type Band } from '../quiet-zone';

/**
 * Look 06 — **Magazine Masthead** (decision 7.24).
 *
 * An editorial spread: a Bricolage kicker behind an accent tab, a hairline rule,
 * a big Fraunces headline with one word underlined in the accent, and a footer
 * byline row. The most overtly *designed* of the six — structured hierarchy,
 * National-Geographic energy.
 *
 * This is a straight port of the approved board
 * (`designs/story-looks-20260803/board.template.html`, `.f-mag`). The mockup is
 * authored in container-query units against a 1080×1920 frame, and the numbers
 * below are those same units — `WPct` is the CSS `cqw`, `HPct` is `cqh` — so the
 * two can be diffed by eye. Anything that reads as a magic number here has a
 * matching line in that stylesheet.
 */

const FRAUNCES = '"Fraunces", Georgia, "Times New Roman", serif';
const BRICOLAGE = '"Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** `.f-mag .txt { left: 7cqw; right: 7cqw }` */
const COLUMN_INSET_WPCT = 7;
/** `.f-mag .txt { bottom: 8cqh }` — and the same inset when it flips to the top. */
const EDGE_OFFSET_HPCT = 8;

/** Magazine hangs its masthead off the bottom; the top is its fallback. */
const PREFERRED_BANDS: readonly Band[] = ['bottom', 'top'];

function compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition {
  const band = quietestBand(photo.bands, PREFERRED_BANDS);
  // The stack reads top-down, so a bottom-anchored masthead is the same list of
  // parts — only the edge it hangs from changes.
  const anchor = band === 'top' ? 'top' : 'bottom';

  // Silent: the photo speaks for itself (decision 7.26). Everything the Look
  // draws exists to frame the words, so with no words there is nothing to
  // frame — no rule, no tab, no byline, and no scrim, since a scrim only exists
  // to keep type readable. A masthead around an empty column reads as broken.
  if (!content.headline.trim()) {
    return {
      lookId: 'magazine-masthead',
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

  // `.kick` — an all-caps eyebrow behind a small accent tab. Dropped entirely
  // when the model wrote no kicker; the rule below is the masthead's signature
  // and stays either way.
  const kicker = content.kicker?.trim();
  if (kicker) {
    parts.push({
      kind: 'text',
      runs: [{ text: kicker }],
      fontFamily: BRICOLAGE,
      fontWeight: 700,
      fontSizeWPct: 2.5,
      lineHeight: 1.1,
      letterSpacingEm: 0.2,
      textTransform: 'uppercase',
      textAlign: 'left',
      color: 'ink',
      gapHPct: 0,
      tab: { widthWPct: 3.2, heightHPct: 1.2, gapWPct: 2 },
    });
  }

  // `.rule-top` — the hairline under the kicker.
  parts.push({
    kind: 'rule',
    gapHPct: kicker ? 2.4 : 0,
    thicknessHPct: 0.34,
    widthPct: 100,
    opacity: 0.85,
    color: 'ink',
  });

  // `.head` — the headline, with `<u>` on the emphasised phrase drawn as an
  // accent bar sitting behind the baseline.
  parts.push({
    kind: 'text',
    runs: splitEmphasis(content.headline, content.emphasis),
    fontFamily: FRAUNCES,
    fontWeight: 700,
    fontSizeWPct: 9.4,
    lineHeight: 1.0,
    letterSpacingEm: -0.015,
    textTransform: 'none',
    textAlign: 'left',
    color: 'ink',
    gapHPct: 3,
    mark: 'accent-underline',
  });

  // `.foot` — the byline row. The mockup pairs a place with "Day 01"; the frame
  // index is brand chrome we dropped in 7.23, so the row appears only when the
  // frame actually has a place to name, and carries just that.
  const location = content.location?.trim();
  if (location) {
    parts.push({
      kind: 'rule',
      gapHPct: 3.2,
      thicknessHPct: 0.06,
      widthPct: 100,
      opacity: 0.4,
      color: 'ink',
    });
    parts.push({
      kind: 'row',
      left: location,
      right: '',
      fontFamily: BRICOLAGE,
      fontWeight: 600,
      fontSizeWPct: 2.4,
      lineHeight: 1.2,
      letterSpacingEm: 0.06,
      textTransform: 'uppercase',
      textAlign: 'left',
      color: 'ink',
      gapHPct: 2,
    });
  }

  return {
    lookId: 'magazine-masthead',
    // The scrim below is unconditional, so the words always sit on a dark
    // gradient — white type, whatever the photo underneath is doing.
    ink: 'light',
    leftPct: COLUMN_INSET_WPCT,
    rightPct: COLUMN_INSET_WPCT,
    anchor,
    offsetHPct: EDGE_OFFSET_HPCT,
    // `.g-bottom` / `.g-top` — the gradient that keeps white type readable. It is
    // unconditional: this Look sets type large over an unknown photo, and a
    // per-photo decision would make the story flicker between framed and not.
    scrim: { from: anchor, extentHPct: 62, strength: 0.72 },
    accent: photo.accent,
    parts,
  };
}

export const MAGAZINE: Look = {
  id: 'magazine-masthead',
  prefer: PREFERRED_BANDS,
  compose,
};
