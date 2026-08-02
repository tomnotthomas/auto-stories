import type { Frame } from '@auto-stories/api-types';

import {
  normalizeLayout,
  normalizeStyle,
  normalizeSuggestions,
  normalizeTexts,
} from './caption-style';

/**
 * Turns the model's raw `frames` output into clean, ordered frames the
 * contract guarantees. The model is non-deterministic, so this is where we
 * defend against it: drop hallucinated photoIds, drop empty captions, dedupe,
 * order by the model's `order`, then renumber 1..n. Pure and unit-tested.
 *
 * Returns an empty array when nothing is usable; the caller decides that this
 * means empty_result.
 */
export function shapeFrames(raw: unknown, validIds: Set<string>): Frame[] {
  if (!Array.isArray(raw)) return [];

  const valid = raw
    .map(toFrame)
    .filter(
      (frame): frame is Frame =>
        frame !== null &&
        validIds.has(frame.photoId) &&
        frame.caption.trim() !== '',
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

/** Narrow one raw entry to a Frame, or null if it is malformed. */
function toFrame(entry: unknown): Frame | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const { photoId, order, caption, style, texts, suggestions, layout } =
    entry as Record<string, unknown>;
  if (typeof photoId !== 'string') return null;
  if (typeof order !== 'number' || !Number.isFinite(order)) return null;
  if (typeof caption !== 'string') return null;
  const normalizedStyle = normalizeStyle(style);
  // The layout agent (decision 7.21) runs as a separate pass, so `layout` is
  // usually absent here; when a frame does carry one, validate and thread it.
  const normalizedLayout = normalizeLayout(layout);
  return {
    photoId,
    order,
    caption,
    style: normalizedStyle,
    // Editorial layer: 0–2 EXTRA placed lines besides the caption (usually none).
    texts: normalizeTexts(texts, normalizedStyle),
    suggestions: normalizeSuggestions(suggestions),
    ...(normalizedLayout ? { layout: normalizedLayout } : {}),
  };
}
