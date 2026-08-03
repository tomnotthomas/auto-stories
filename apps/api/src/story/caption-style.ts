import type {
  Look,
  Suggestion,
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

/** Every Look the client can render. Exported so a test can prove the prompt
 * offers all of them — the two drifting apart is how every story ended up
 * wearing the same one (7.27). */
export const LOOKS: readonly Look[] = [
  'quiet-editorial',
  'minimal',
  'gallery-label',
  'corner-note',
  'footer-rule',
  'caption-card',
  'magazine-masthead',
  'broadsheet',
  'contents-page',
  'pull-quote',
  'chapter',
  'dateline',
  'bold-poster',
  'split-block',
  'ticker',
  'stencil-caps',
  'zine',
  'duotone-band',
  'film-postcard',
  'polaroid',
  'super-8',
  'faded-album',
  'postcard-back',
  'scrapbook',
  'marker',
  'sticker-sheet',
  'index-card',
  'typewriter',
  'title-card',
  'subtitle',
  'edge-caps',
  'letterbox',
];

/**
 * The Look a story falls back to when the model omits it or names one that does
 * not exist. Deliberately the most restrained of the set: a fallback is a case
 * where nobody chose, and the least presumptuous thing to do to somebody's photo
 * is to stay quiet. Kept in step with the client's own default (7.27).
 */
export const DEFAULT_LOOK: Look = 'quiet-editorial';

/**
 * Turn the model's story-level `look` into one of the {@link Look} ids
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
/** Kept restrained: the AI proposes at most a couple of add-ons per frame. */
export const MAX_SUGGESTIONS_PER_FRAME = 2;
/** Confidence when the model omits/mangles it — neutral, so the UI can still show it. */
const DEFAULT_CONFIDENCE = 0.5;

/**
 * Turn the model's raw `suggestions` into a valid, capped {@link Suggestion}
 * list. The model is non-deterministic, so this is defensive: drop items with an
 * invalid `type` or empty `query`, clamp `confidence` to [0,1], and cap the
 * count. Nothing about placement crosses: the client puts each add-on in the
 * free space the design leaves and drops one with no room (decision 7.25), so a
 * zone the model volunteers is discarded here. Missing/junk input → `[]`. Pure
 * and unit-tested.
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
    out.push({ type, query, confidence });
  }
  return out;
}
