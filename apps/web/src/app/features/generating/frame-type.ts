import type { Frame } from '@auto-stories/api-types';

import { DEFAULT_ACCENT } from '../../story/accent-color';
import { composeFrame, type PhotoAnalysis } from '../../story/look';

/**
 * The words as they are *set* on a print while the model's choice is revealed:
 * which end of the frame they sit at, the small-caps kicker above them, and the
 * headline broken into lines and words so each word can land on its own.
 */
export interface TypeLine {
  readonly words: readonly string[];
  /** Index of this line's first word within the whole headline. */
  readonly startIndex: number;
}

export interface PrintType {
  readonly position: 'top' | 'bottom';
  readonly kicker: string;
  /** The model chose a photo the user had already pulled down. */
  readonly agreed: boolean;
  readonly lines: readonly TypeLine[];
  readonly wordCount: number;
  /** The frame carries no words (density `silent`) — nothing is written on it. */
  readonly silent: boolean;
}

/** Each beat of the reveal, in ms. Four separated beats — paper, rule, kicker,
 * words — none overlapping. */
export interface TypeBeats {
  /** Complete stillness after the print settles, before any type. */
  readonly stillness: number;
  /** The scrim: the paper the words are written on. */
  readonly scrim: number;
  /** The hairline rule drawing itself from the left. */
  readonly rule: number;
  /** The small-caps kicker tracking in. */
  readonly kicker: number;
  /** Longer when the kicker is the agreement line — it is worth reading. */
  readonly kickerAgreed: number;
  /** Between one word landing and the next. */
  readonly word: number;
  /** Between the last word of a line and the first of the next. */
  readonly lineGap: number;
  /** How long the finished frame is left to be read. */
  readonly dwell: number;
}

export const TYPE_BEATS: TypeBeats = {
  stillness: 240,
  scrim: 380,
  rule: 240,
  kicker: 420,
  kickerAgreed: 560,
  word: 78,
  lineGap: 300,
  dwell: 1150,
};

/** Reduced motion keeps every beat — the movement is dropped, not the reveal. */
export const REDUCED_BEATS: TypeBeats = {
  stillness: 80,
  scrim: 160,
  rule: 120,
  kicker: 160,
  kickerAgreed: 160,
  word: 60,
  lineGap: 120,
  dwell: 320,
};

/**
 * The beats, optionally run faster. `pace` divides every one of them, so the
 * choreography is identical and only the time it takes changes — which is what
 * lets a queue of choices be shown one at a time without the screen outliving
 * the story it is announcing (decision 7.30).
 */
export function beatsFor(reduced: boolean, pace = 1): TypeBeats {
  const beats = reduced ? REDUCED_BEATS : TYPE_BEATS;
  if (pace <= 1) return beats;
  const quicker = (ms: number): number => Math.max(1, Math.round(ms / pace));
  return {
    stillness: quicker(beats.stillness),
    scrim: quicker(beats.scrim),
    rule: quicker(beats.rule),
    kicker: quicker(beats.kicker),
    kickerAgreed: quicker(beats.kickerAgreed),
    word: quicker(beats.word),
    lineGap: quicker(beats.lineGap),
    dwell: quicker(beats.dwell),
  };
}

/**
 * How much faster a run of `remaining` choices has to go to fit the time the
 * screen is willing to spend on them. 1 means the full beats; the cap keeps a
 * quick reveal legible rather than a flicker.
 */
export function paceFor(remaining: number, budgetMs: number, oneCatchMs: number): number {
  if (remaining <= 0) return 1;
  return Math.min(MAX_PACE, Math.max(1, (remaining * oneCatchMs) / budgetMs));
}

/** Past this the beats stop reading as beats, so the run simply takes longer. */
const MAX_PACE = 4;

/** The reading a frame gets before its photo has been decoded — enough to ask
 * the Look which end of the frame its type hangs at. */
const NEUTRAL_ANALYSIS: PhotoAnalysis = {
  accent: DEFAULT_ACCENT,
  bands: { top: 0, middle: 0, bottom: 0 },
};

/**
 * Break a headline into at most two lines, split where the two halves come out
 * closest in length. Two short lines read as set type; one long line wraps
 * wherever the box happens to end.
 */
export function splitHeadlineLines(headline: string): string[][] {
  const words = headline.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  if (words.length <= 3) return [words];

  const width = (from: number, to: number): number => words.slice(from, to).join(' ').length;
  let best = 1;
  let bestGap = Infinity;
  for (let at = 1; at < words.length; at++) {
    const gap = Math.abs(width(0, at) - width(at, words.length));
    if (gap < bestGap) {
      bestGap = gap;
      best = at;
    }
  }
  return [words.slice(0, best), words.slice(best)];
}

/**
 * The line above the headline. The model's own `kicker` when it wrote one;
 * otherwise where the frame sits in the story — something we know. It never
 * invents a reason: nothing in the response says *why* a photo was chosen, so
 * nothing here claims one.
 *
 * `total` is null while the model is still writing: the story's length is not
 * known yet, so nothing may claim to close it.
 */
export function kickerFor(frame: Frame, total: number | null, agreed: boolean): string {
  if (agreed) return 'you called it';
  if (frame.kicker) return frame.kicker;
  if (frame.order <= 1) return 'opens the story';
  if (total !== null && frame.order >= total) return 'closes it';
  return 'next beat';
}

/** Resolve a generated frame into the type that gets set on its print. The end
 * it hangs at is the story's own Look talking, so the reveal puts the words
 * where the finished frame will carry them. */
export function typeFor(
  frame: Frame,
  total: number | null,
  agreed: boolean,
  look?: string,
): PrintType {
  const composition = composeFrame(
    look,
    {
      density: frame.density,
      kicker: frame.kicker,
      headline: frame.headline,
      emphasis: frame.emphasis,
    },
    NEUTRAL_ANALYSIS,
  );
  const split = splitHeadlineLines(frame.headline);
  let index = 0;
  const lines = split.map((words) => {
    const line: TypeLine = { words, startIndex: index };
    index += words.length;
    return line;
  });
  return {
    position: composition.anchor === 'bottom' ? 'bottom' : 'top',
    kicker: kickerFor(frame, total, agreed),
    agreed,
    lines,
    wordCount: index,
    silent: index === 0,
  };
}

/** How long the whole reveal takes, from the stillness to the last word. A
 * silent frame is only the stillness — there is nothing to write. */
export function revealDuration(type: PrintType, reduced: boolean, pace = 1): number {
  const beats = beatsFor(reduced, pace);
  if (type.silent) return beats.stillness;
  const kicker = type.agreed ? beats.kickerAgreed : beats.kicker;
  const gaps = Math.max(0, type.lines.length - 1) * beats.lineGap;
  return beats.stillness + beats.scrim + beats.rule + kicker + type.wordCount * beats.word + gaps;
}
