import type { Look as LookId } from '@auto-stories/api-types';

import { QUIET_EDITORIAL } from './looks/quiet-editorial';
import { MINIMAL } from './looks/minimal';
import { GALLERY_LABEL } from './looks/gallery-label';
import { CORNER_NOTE } from './looks/corner-note';
import { FOOTER_RULE } from './looks/footer-rule';
import { CAPTION_CARD } from './looks/caption-card';
import { MAGAZINE } from './looks/magazine';
import { BROADSHEET } from './looks/broadsheet';
import { CONTENTS_PAGE } from './looks/contents-page';
import { PULL_QUOTE } from './looks/pull-quote';
import { CHAPTER } from './looks/chapter';
import { DATELINE } from './looks/dateline';
import { BOLD_POSTER } from './looks/bold-poster';
import { SPLIT_BLOCK } from './looks/split-block';
import { TICKER } from './looks/ticker';
import { STENCIL_CAPS } from './looks/stencil-caps';
import { ZINE } from './looks/zine';
import { DUOTONE_BAND } from './looks/duotone-band';
import { FILM_POSTCARD } from './looks/film-postcard';
import { POLAROID } from './looks/polaroid';
import { SUPER_8 } from './looks/super-8';
import { FADED_ALBUM } from './looks/faded-album';
import { POSTCARD_BACK } from './looks/postcard-back';
import { SCRAPBOOK } from './looks/scrapbook';
import { MARKER } from './looks/marker';
import { STICKER_SHEET } from './looks/sticker-sheet';
import { INDEX_CARD } from './looks/index-card';
import { TYPEWRITER } from './looks/typewriter';
import { TITLE_CARD } from './looks/title-card';
import { SUBTITLE } from './looks/subtitle';
import { EDGE_CAPS } from './looks/edge-caps';
import { LETTERBOX } from './looks/letterbox';
import type { Band, BandScores } from './quiet-zone';

/**
 * The Looks engine (decision 7.24).
 *
 * The model no longer emits geometry. It names one **Look** for the story and
 * writes the words; this module turns those words into a {@link Composition} —
 * a fully resolved stack of type, rules and marks — which the DOM preview and
 * the canvas export both draw. Same producer, two surfaces, so what you see is
 * what you export.
 *
 *   Frame words ──composeFrame──▶ Composition ──┬─▶ DOM preview (LayoutView)
 *   + photo analysis                            └─▶ canvas export (drawComposition)
 *
 * A Look is a full grammar, not a template: type pairing, placement, accent
 * usage, marks and scrim. Geometry is authored in the mockups' container-query
 * units and kept that way — `…WPct` is a percentage of the frame's WIDTH, and
 * `…HPct` a percentage of its HEIGHT — so a Look scales to any surface and the
 * ported CSS stays legible next to its source.
 *
 * Colour is NOT resolved here: parts declare `ink` or `accent` and the renderer
 * turns `ink` into the legible white/dark it computed from the pixels (7.10).
 */

export type { LookId };

/**
 * Used when the model omits the Look or names one we do not have. Deliberately
 * the most restrained of the set, not the most designed: a fallback is a case
 * where nobody chose, and the least presumptuous thing to do to somebody's photo
 * is to stay quiet. Magazine held this role while it was the only Look built,
 * which is how every story ended up wearing it (7.27).
 */
export const DEFAULT_LOOK_ID: LookId = 'quiet-editorial';

/** The words the model wrote for one frame. */
export interface FrameContent {
  readonly kicker?: string;
  readonly headline: string;
  /** A phrase inside `headline` to mark. Ignored when it isn't found there. */
  readonly emphasis?: string;
  /** A place name, when the frame carries a location suggestion. */
  readonly location?: string;
}

/** What the device measured from the photo (7.10 / 7.24). */
export interface PhotoAnalysis {
  /** Accent hue sampled from the image. */
  readonly accent: string;
  /** How busy each horizontal third is. */
  readonly bands: BandScores;
}

/** A stretch of headline, flagged when the Look should mark it. */
export interface Run {
  readonly text: string;
  readonly emphasised?: boolean;
}

/** One wrapped line of runs. */
export interface Line {
  readonly runs: readonly Run[];
}

/** How a marked run is drawn — each Look picks the one that fits its grammar. */
export type Mark =
  /** A solid bar riding the baseline (Magazine). */
  | 'accent-underline'
  /** A filled block behind the word, the word reversed out (Bold Poster). */
  | 'accent-block'
  /** A loose, uneven stroke — drawn, not typeset (Scrapbook). */
  | 'hand-underline'
  /** A thick translucent swipe through the word (Marker). */
  | 'highlighter';

/**
 * Whether a part paints in the legible ink colour, the story accent, or the
 * off-white "paper" a Look lays down for its own panels (Gallery Label,
 * Polaroid). Paper is a fixed tone, not sampled: it is a material, not a
 * reaction to the photo.
 */
export type PartColor = 'ink' | 'accent' | 'paper';

interface TypeStyle {
  readonly fontFamily: string;
  readonly fontWeight: number;
  /** Type size as a % of the frame WIDTH, exactly as the mockups author it. */
  readonly fontSizeWPct: number;
  readonly lineHeight: number;
  readonly letterSpacingEm: number;
  readonly textTransform: 'none' | 'uppercase';
  readonly textAlign: 'left' | 'center' | 'right';
  readonly color: PartColor;
}

/** A run of type. Space above it is a % of the frame HEIGHT. */
export interface TextPart extends TypeStyle {
  readonly kind: 'text';
  readonly runs: readonly Run[];
  readonly gapHPct: number;
  readonly mark?: Mark;
  /** A small filled block before the text — Magazine's kicker tab. */
  readonly tab?: {
    readonly widthWPct: number;
    readonly heightHPct: number;
    readonly gapWPct: number;
  };
  /** Draw the letters as outlines instead of filling them (Stencil Caps). */
  readonly stroke?: boolean;
}

/** A small label set apart from the running text. */
export type TagStyle =
  /** Outlined, rounded — a location tag (Bold Poster). */
  | 'pill'
  /** Filled paper with a shadow, slightly askew — a taped note (Scrapbook). */
  | 'tape'
  /** Outlined and rotated, print-shop ink (Film Postcard, Super 8). */
  | 'stamp'
  /** Filled accent, rounded — an Instagram sticker (Sticker Sheet). */
  | 'chip';

/** A tag. Its own type, so a Look can set it apart from the headline. */
export interface TagPart extends TypeStyle {
  readonly kind: 'tag';
  readonly text: string;
  readonly style: TagStyle;
  readonly gapHPct: number;
  readonly rotationDeg?: number;
}

/** A hairline. Width is a % of the type column, thickness a % of frame HEIGHT. */
export interface RulePart {
  readonly kind: 'rule';
  readonly gapHPct: number;
  readonly thicknessHPct: number;
  readonly widthPct: number;
  readonly opacity: number;
  readonly color: PartColor;
}

/** Two short labels on one baseline — Magazine's footer byline row. */
export interface RowPart extends TypeStyle {
  readonly kind: 'row';
  readonly left: string;
  readonly right: string;
  readonly gapHPct: number;
}

export type Part = TextPart | RulePart | RowPart | TagPart;

/** A gradient behind the type, so a headline survives a busy photo. */
export interface Scrim {
  readonly from: 'top' | 'bottom';
  /** How far the gradient reaches, as a % of the frame height. */
  readonly extentHPct: number;
  readonly strength: number;
}

/**
 * A solid block drawn behind the whole stack, padded around it — the graphic
 * that Split Block, Ticker, Gallery Label and Polaroid are built on. Unlike a
 * scrim it is opaque and deliberate: it covers the photo rather than shading it.
 */
export interface Panel {
  readonly color: PartColor;
  readonly opacity: number;
  /** Padding around the stack, in % of frame width / height. */
  readonly padWPct: number;
  readonly padHPct: number;
  readonly radiusWPct: number;
  /** Run the panel edge to edge, ignoring the type column's insets. */
  readonly fullWidth: boolean;
}

/** An inset frame drawn on the photo — a print border, a viewfinder. */
export interface Border {
  readonly insetWPct: number;
  readonly widthWPct: number;
  readonly color: PartColor;
  readonly radiusWPct: number;
}

/**
 * Which way a Look's type reads. A Look that lays its own scrim has already
 * decided what is behind the words, so it states the polarity outright;
 * `auto` defers to the luminance the device sampled from the photo (7.10),
 * which is what a Look with no scrim needs.
 */
export type Ink = 'light' | 'dark' | 'auto';

/** One frame, fully composed and ready to draw. */
export interface Composition {
  readonly lookId: LookId;
  readonly ink: Ink;
  /** The type column, as % of the frame width. */
  readonly leftPct: number;
  readonly rightPct: number;
  /** Which edge the stack hangs from, and how far in (% of frame height). */
  readonly anchor: 'top' | 'bottom';
  readonly offsetHPct: number;
  readonly scrim: Scrim | null;
  /** The resolved accent for this frame, so renderers don't re-sample. */
  readonly accent: string;
  readonly parts: readonly Part[];
  /** Tilt the whole stack — a page laid down by hand rather than typeset. */
  readonly rotationDeg?: number;
  /** A solid block behind the stack (Split Block, Ticker, Gallery Label). */
  readonly panel?: Panel;
  /** An inset frame on the photo (Film Postcard, Super 8). */
  readonly border?: Border;
  /**
   * A CSS/canvas `filter` applied to the PHOTO for this Look — the warm wash of
   * Film Postcard, Super 8's sepia. It composes with the exposure-cohesion
   * filter the device computes per frame; the renderer concatenates the two, so
   * a Look's treatment never discards the cohesion match.
   */
  readonly photoFilter?: string;
}

/** A Look: the grammar that turns words + a photo reading into a composition. */
export interface Look {
  readonly id: LookId;
  /** Bands this Look would like to sit in, best first. */
  readonly prefer: readonly Band[];
  compose(content: FrameContent, photo: PhotoAnalysis): Composition;
}

/**
 * Split a headline around its emphasised phrase. Matching is case-insensitive
 * (the model rarely echoes casing exactly) but the headline's own casing is what
 * gets rendered. Only the first occurrence is marked — one mark per frame.
 * Returns a single plain run when there is nothing to mark.
 */
export function splitEmphasis(headline: string, emphasis: string | undefined): Run[] {
  const needle = emphasis?.trim();
  if (!needle) return [{ text: headline }];

  const at = headline.toLowerCase().indexOf(needle.toLowerCase());
  if (at < 0) return [{ text: headline }];

  const before = headline.slice(0, at);
  const hit = headline.slice(at, at + needle.length);
  const after = headline.slice(at + needle.length);

  return [
    ...(before ? [{ text: before }] : []),
    { text: hit, emphasised: true },
    ...(after ? [{ text: after }] : []),
  ];
}

/**
 * Greedy word-wrap a run list to `maxWidth`, keeping each word's emphasis. The
 * width comes from an injected `measure` so this stays pure and testable without
 * a canvas; the canvas renderer passes `ctx.measureText`.
 *
 * Words are wrapped, then adjacent words sharing an emphasis state are coalesced
 * back into runs — so a mark that spans several words draws as one stroke per
 * line, and a mark that wraps splits cleanly across two.
 */
export function wrapRuns(
  runs: readonly Run[],
  measure: (text: string) => number,
  maxWidth: number,
): Line[] {
  const words = runs.flatMap((run) =>
    run.text
      .split(/(\s+)/)
      .filter((piece) => piece !== '')
      .map((piece) => ({ text: piece, emphasised: run.emphasised === true })),
  );
  if (words.length === 0) return [];

  const lines: { text: string; emphasised: boolean }[][] = [];
  let current: { text: string; emphasised: boolean }[] = [];

  for (const word of words) {
    if (/^\s+$/.test(word.text)) {
      // Never start a line with the space that caused the break.
      if (current.length > 0) current.push(word);
      continue;
    }
    const candidate = [...current, word].map((w) => w.text).join('');
    if (current.length > 0 && measure(candidate) > maxWidth) {
      lines.push(trimTrailingSpace(current));
      current = [word];
    } else {
      current.push(word);
    }
  }
  if (current.length > 0) lines.push(trimTrailingSpace(current));

  return lines.map((line) => ({ runs: coalesce(line) }));
}

/** Every text part of a composition — the convenience most callers want. */
export function textParts(composition: Composition): TextPart[] {
  return composition.parts.filter((part): part is TextPart => part.kind === 'text');
}

/** The Look for an id, falling back to {@link DEFAULT_LOOK_ID}. */
export function lookFor(id: string | undefined): Look {
  const looks = registry();
  return (id && looks[id]) || looks[DEFAULT_LOOK_ID];
}

/**
 * Compose one frame. Never throws and never returns an empty composition: an
 * unknown Look, a missing kicker, an emphasis that isn't in the headline and a
 * photo with no quiet band all degrade to something drawable, because once Looks
 * are the only renderer a frame that fails to compose is a blank export.
 */
export function composeFrame(
  id: string | undefined,
  content: FrameContent,
  photo: PhotoAnalysis,
): Composition {
  return lookFor(id).compose(content, photo);
}

function trimTrailingSpace(
  line: { text: string; emphasised: boolean }[],
): { text: string; emphasised: boolean }[] {
  const out = [...line];
  while (out.length > 0 && /^\s+$/.test(out[out.length - 1].text)) out.pop();
  return out;
}

/** Merge neighbouring words that share an emphasis state into one run. */
function coalesce(words: readonly { text: string; emphasised: boolean }[]): Run[] {
  const runs: Run[] = [];
  for (const word of words) {
    const last = runs[runs.length - 1];
    if (last && (last.emphasised === true) === word.emphasised) {
      runs[runs.length - 1] = {
        text: last.text + word.text,
        ...(word.emphasised ? { emphasised: true } : {}),
      };
    } else {
      runs.push(word.emphasised ? { text: word.text, emphasised: true } : { text: word.text });
    }
  }
  return runs;
}

// Every Look, keyed by its contract id. Listing them here (rather than having
// each self-register) keeps the import one-way — a Look imports the engine,
// never the reverse — and makes the set reviewable in one place.
//
// Built LAZILY. A Look imports `splitEmphasis` from this module, so
// look.ts <-> looks/* is a cycle: when a spec imports a Look first, this module
// evaluates while that Look is still initialising and its export is briefly
// `undefined`. A function body runs after every module has settled; an array
// literal at module scope does not.
function allLooks(): readonly Look[] {
  return [
    QUIET_EDITORIAL,
    MINIMAL,
    GALLERY_LABEL,
    CORNER_NOTE,
    FOOTER_RULE,
    CAPTION_CARD,
    MAGAZINE,
    BROADSHEET,
    CONTENTS_PAGE,
    PULL_QUOTE,
    CHAPTER,
    DATELINE,
    BOLD_POSTER,
    SPLIT_BLOCK,
    TICKER,
    STENCIL_CAPS,
    ZINE,
    DUOTONE_BAND,
    FILM_POSTCARD,
    POLAROID,
    SUPER_8,
    FADED_ALBUM,
    POSTCARD_BACK,
    SCRAPBOOK,
    MARKER,
    STICKER_SHEET,
    INDEX_CARD,
    TYPEWRITER,
    TITLE_CARD,
    SUBTITLE,
    EDGE_CAPS,
    LETTERBOX,
  ];
}

let registryCache: Record<string, Look> | undefined;

function registry(): Record<string, Look> {
  registryCache ??= Object.fromEntries(allLooks().map((look) => [look.id, look]));
  return registryCache;
}

/** Every built Look id, derived from the registry so the two cannot drift. */
export function lookIds(): readonly LookId[] {
  return allLooks().map((look) => look.id);
}
