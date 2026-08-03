import type {
  Look,
  Suggestion,
  SuggestionPositionEnum,
  SuggestionTypeEnum,
} from '@auto-stories/api-types';

/** Keep `value` only if it is one of `allowed`; otherwise use `fallback`. */
function pick<T extends string>(
  allowed: readonly T[],
  value: unknown,
  fallback: T,
): T {
  return typeof value === 'string' &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

const LOOKS: readonly Look[] = [
  'quiet-editorial',
  'film-postcard',
  'bold-poster',
  'scrapbook',
  'minimal',
  'magazine-masthead',
];

/**
 * The Look a story falls back to when the model omits it or names one that does
 * not exist. Magazine Masthead is the most structured of the six and the one
 * that reads as deliberately designed on any photo, so an unchosen story still
 * lands somewhere composed rather than plain.
 */
export const DEFAULT_LOOK: Look = 'magazine-masthead';

/**
 * Turn the model's story-level `look` into one of the six {@link Look} ids
 * (decision 7.24). The client renders a Look deterministically and has no
 * renderer for anything else, so an unknown value becomes {@link DEFAULT_LOOK}
 * rather than crossing the boundary. Pure and unit-tested.
 */
export function normalizeLook(raw: unknown): Look {
  return pick(LOOKS, raw, DEFAULT_LOOK);
}

const SUGGESTION_TYPES: readonly SuggestionTypeEnum[] = [
  'location',
  'mention',
  'gif',
  'poll',
  'music',
];
const SUGGESTION_POSITIONS: readonly SuggestionPositionEnum[] = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];
/** Anchor zone for a placed suggestion the model left blank or mangled. */
export const DEFAULT_SUGGESTION_POSITION: SuggestionPositionEnum =
  'bottom-center';
/** Kept restrained: the AI proposes at most a couple of add-ons per frame. */
export const MAX_SUGGESTIONS_PER_FRAME = 2;
/** Confidence when the model omits/mangles it — neutral, so the UI can still show it. */
const DEFAULT_CONFIDENCE = 0.5;

/**
 * Turn the model's raw `suggestions` into a valid, capped {@link Suggestion}
 * list. The model is non-deterministic, so this is defensive: drop items with an
 * invalid `type` or empty `query`, clamp `confidence` to [0,1], validate the
 * anchor `position` for placed types (music is story-level, so it carries none),
 * and cap the count. Missing/junk input → `[]`. Pure and unit-tested.
 */
export function normalizeSuggestions(raw: unknown): Suggestion[] {
  if (!Array.isArray(raw)) return [];
  const out: Suggestion[] = [];
  for (const entry of raw) {
    if (out.length >= MAX_SUGGESTIONS_PER_FRAME) break;
    if (typeof entry !== 'object' || entry === null) continue;
    const r = entry as Record<string, unknown>;
    const type =
      typeof r['type'] === 'string' &&
      (SUGGESTION_TYPES as readonly string[]).includes(r['type'])
        ? (r['type'] as SuggestionTypeEnum)
        : null;
    const query = typeof r['query'] === 'string' ? r['query'].trim() : '';
    if (!type || query === '') continue;
    const confidence =
      typeof r['confidence'] === 'number' && Number.isFinite(r['confidence'])
        ? Math.min(1, Math.max(0, r['confidence']))
        : DEFAULT_CONFIDENCE;
    const suggestion: Suggestion = { type, query, confidence };
    // Placed types get an anchor zone; music is story-level (no position).
    if (type !== 'music') {
      suggestion.position = pick(
        SUGGESTION_POSITIONS,
        r['position'],
        DEFAULT_SUGGESTION_POSITION,
      );
    }
    out.push(suggestion);
  }
  return out;
}
