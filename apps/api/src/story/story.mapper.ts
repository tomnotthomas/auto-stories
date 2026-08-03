import type { Frame } from '@auto-stories/api-types';

import { normalizeSuggestions } from './caption-style';

/**
 * Turns the model's raw `frames` output into clean, ordered frames the
 * contract guarantees. The model is non-deterministic, so this is where we
 * defend against it: drop hallucinated photoIds, drop frames with no words,
 * dedupe, order by the model's `order`, then renumber 1..n. Pure and
 * unit-tested.
 *
 * Returns an empty array when nothing is usable; the caller decides that this
 * means empty_result.
 */
export function shapeFrames(raw: unknown, validIds: Set<string>): Frame[] {
  if (!Array.isArray(raw)) return [];

  const valid = raw
    .map(toFrame)
    .filter(
      (frame): frame is Frame => frame !== null && validIds.has(frame.photoId),
    )
    .sort((a, b) => a.order - b.order);

  // Dedupe after sorting, so a repeated photoId keeps its earliest order.
  const seen = new Set<string>();
  const deduped = valid.filter((frame) => {
    if (seen.has(frame.photoId)) return false;
    seen.add(frame.photoId);
    return true;
  });

  return deduped.map((frame, index) => ({ ...frame, order: index + 1 }));
}

/** The model's value when it is a usable, trimmed string; otherwise ''. */
function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Narrow one raw entry to a Frame, or null if it is malformed. */
function toFrame(entry: unknown): Frame | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const { photoId, order, kicker, headline, emphasis, suggestions } =
    entry as Record<string, unknown>;
  if (typeof photoId !== 'string') return null;
  if (typeof order !== 'number' || !Number.isFinite(order)) return null;
  // The headline is the frame's only text (decision 7.25). Empty is a real
  // choice, not a broken frame: some photos speak for themselves, so the frame
  // is kept and the Look composes it silently (decision 7.26, `silent`).
  const finalHeadline = trimmed(headline);
  const finalKicker = trimmed(kicker);
  const finalEmphasis = trimmed(emphasis);
  // A mark the renderer cannot place is worse than no mark, so `emphasis` only
  // survives when it really occurs in the headline it is meant to mark.
  const markable =
    finalEmphasis !== '' &&
    finalHeadline.toLowerCase().includes(finalEmphasis.toLowerCase());
  return {
    photoId,
    order,
    headline: finalHeadline,
    suggestions: normalizeSuggestions(suggestions),
    ...(finalKicker ? { kicker: finalKicker } : {}),
    ...(markable ? { emphasis: finalEmphasis } : {}),
  };
}
