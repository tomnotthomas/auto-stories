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
import {
  claim,
  emptySpace,
  type Band,
  type BandScores,
  type Box,
  type FreeSpace,
} from './quiet-zone';

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

/**
 * How much this photo needs (decision 7.26). The content creator picks one; the
 * design declares what it can set at each level; the client resolves the two.
 * A judgement about the moment, never about type or placement.
 */
export type Density = 'silent' | 'beat' | 'line' | 'thought' | 'question';

/**
 * `thought` must land in a visibly different slot from `line`, or the model
 * collapses the two into the same thing. `question` is strictly a different axis
 * from the rest — they are about *how much*, it is about *what for* — but it
 * stays one rung so the model cannot emit "silent + question", and so a Look can
 * set a question differently from a statement: it invites a reply.
 */
export const DENSITIES: readonly Density[] = ['silent', 'beat', 'line', 'thought', 'question'];

/** Word counts each rung is written to, so a Look can size type to the rung
 * rather than to whatever the model happened to send. */
export const DENSITY_WORDS: Record<Density, { readonly max: number }> = {
  silent: { max: 0 },
  beat: { max: 3 },
  line: { max: 12 },
  thought: { max: 35 },
  question: { max: 14 },
};

/**
 * The frame's density: what the model said, or read from the words when it said
 * nothing. Inference is a fallback, not the design — a model that states its
 * intent gets that intent honoured, including a deliberate `thought` that
 * happens to be short.
 */
export function resolveDensity(content: FrameContent): Density {
  if (content.density) return content.density;

  const headline = content.headline.trim();
  if (!headline) return 'silent';
  if (headline.endsWith('?')) return 'question';

  const words = headline.split(/\s+/).filter(Boolean).length;
  if (words <= DENSITY_WORDS.beat.max) return 'beat';
  if (words <= DENSITY_WORDS.line.max) return 'line';
  return 'thought';
}

/** The words the model wrote for one frame. */
export interface FrameContent {
  /** How much this photo needs (7.26). Absent → inferred from the headline. */
  readonly density?: Density;
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
  /** How busy each horizontal third is — how the design picks its band. */
  readonly bands: BandScores;
  /** Per-cell busyness, for placing stickers into what the design leaves free
   * (7.25 slice 2). Optional so a caller that only needs the design can omit it. */
  readonly space?: FreeSpace;
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
  /**
   * What the design occupies, so later stages can avoid it (7.25 slice 2).
   * Estimated by the Look from its own parts rather than measured: a sticker
   * needs to *avoid* the design, not butt against it, so an over-estimate is the
   * right error — and estimating keeps composing pure, which is what stops the
   * preview and the export disagreeing about anything.
   */
  readonly claimed: readonly Box[];
  /** What is left after the design claimed its box. Stickers place into this. */
  readonly free: FreeSpace;
  /**
   * The design drew the place name itself (Magazine's byline, Scrapbook's taped
   * tag), so a location sticker must not draw it again — that double-location is
   * the live bug this slice removes.
   */
  readonly consumedLocation: boolean;
}

/**
 * What a Look actually draws. The free-space bookkeeping (`claimed`, `free`) is
 * added by {@link composeFrame} from the parts themselves, so a Look never has
 * to describe its own geometry twice — and cannot describe it wrongly.
 */
export type DrawnComposition = Omit<Composition, 'claimed' | 'free' | 'consumedLocation'> & {
  /** Set by the Looks that draw the place name themselves. */
  readonly consumedLocation?: boolean;
};

/** A Look: the grammar that turns words + a photo reading into a composition. */
export interface Look {
  readonly id: LookId;
  /** Bands this Look would like to sit in, best first. */
  readonly prefer: readonly Band[];
  compose(content: FrameContent, photo: PhotoAnalysis): DrawnComposition;
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

/**
 * The off-white a Look lays down for its own panels and tape, and the near-black
 * that reads on it. Fixed materials, not sampled — a sheet of paper does not
 * react to the photograph under it. Shared so both renderers paint the same
 * tone; they diverged while they were written in parallel.
 */
export const PAPER = '#f7f4ec';
export const PAPER_INK = '#1f1b16';

/**
 * The shape of a hand-drawn underline, in units of the type's own size: each end
 * at its own height, a sag on the way out and a lift on the way back, plus a
 * little overshoot past the word.
 *
 * Shared, and this matters. Both surfaces draw this stroke, and each derived its
 * wobble from its own constants while they were built in parallel — so the same
 * word bent one way in the preview and another in the export. A composition is
 * supposed to look identical on both. One source, scaled by each renderer.
 */
export interface HandStroke {
  readonly startY: number;
  readonly endY: number;
  readonly sag: number;
  readonly lift: number;
  readonly overshoot: number;
}

/**
 * Derive a stroke from the word itself, so it is stable: the same word always
 * bends the same way, and redrawing never makes it twitch.
 */
export function handStroke(word: string): HandStroke {
  return {
    startY: (jitter(word, 1) - 0.5) * 0.14,
    endY: (jitter(word, 2) - 0.5) * 0.14,
    sag: 0.05 + jitter(word, 3) * 0.07,
    lift: 0.02 + jitter(word, 4) * 0.06,
    overshoot: 0.05,
  };
}

/** FNV-1a over the word, so the wobble is a pure function of the input. */
function jitter(seed: string, salt: number): number {
  let hash = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

/** Anything with parts — a drawn composition or a finished one. Helpers only
 * ever read the parts, so they should not demand the pipeline's bookkeeping. */
export interface HasParts {
  readonly parts: readonly Part[];
}

/** Every text part of a composition — the convenience most callers want. */
export function textParts(composition: HasParts): TextPart[] {
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
  const drawn = lookFor(id).compose(content, photo);
  const claimed = claimedBoxes(drawn);
  const free = claimed.reduce(claim, photo.space ?? emptySpace());
  return { ...drawn, claimed, free, consumedLocation: drawn.consumedLocation ?? false };
}

/**
 * The area a composition covers, estimated from its own parts (7.25 slice 2).
 *
 * A composition cannot know its rendered height — that depends on text
 * measurement inside each renderer — so this estimates instead, and deliberately
 * over-estimates. A sticker only has to avoid the design, so being generous is
 * the safe direction to be wrong in, and estimating keeps composing pure.
 *
 * A silent frame claims nothing: there is no design to avoid.
 */
export function claimedBoxes(drawn: DrawnComposition): readonly Box[] {
  if (drawn.parts.length === 0) return [];

  const heightHPct = drawn.parts.reduce((total, part) => total + partHeightHPct(part), 0);
  const panelPad = drawn.panel ? drawn.panel.padHPct * 2 : 0;
  const full = drawn.panel?.fullWidth === true;
  const left = full ? 0 : Math.max(0, drawn.leftPct - (drawn.panel?.padWPct ?? 0));
  const right = full ? 0 : Math.max(0, drawn.rightPct - (drawn.panel?.padWPct ?? 0));
  const height = Math.min(100, heightHPct + panelPad);
  const top =
    drawn.anchor === 'bottom'
      ? Math.max(0, 100 - drawn.offsetHPct - height)
      : Math.min(100 - height, drawn.offsetHPct);

  return [{ xPct: left, yPct: top, wPct: Math.max(0, 100 - left - right), hPct: height }];
}

/** One part's height, in % of frame height. Type is authored as a % of frame
 * WIDTH, and the frame is 9:16, so a point of width is 0.5625 of a point of
 * height. Multi-line text is allowed for generously. */
function partHeightHPct(part: Part): number {
  const gap = part.gapHPct;
  if (part.kind === 'rule') return gap + part.thicknessHPct;

  const widthToHeight = 9 / 16;
  if (part.kind === 'tag' || part.kind === 'row') {
    return gap + part.fontSizeWPct * widthToHeight * part.lineHeight * 1.8;
  }

  // Estimate the wrap: how many characters fit one line at this size, against a
  // column of this width. Round up, and never claim less than one line.
  const chars = part.runs.reduce((total, run) => total + run.text.length, 0);
  const columnWPct = 100 - part.gapHPct * 0;
  const perLine = Math.max(6, (columnWPct / part.fontSizeWPct) * 0.52);
  const lines = Math.max(1, Math.ceil(chars / perLine));
  return gap + lines * part.fontSizeWPct * widthToHeight * part.lineHeight;
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
