import type {
  Style,
  StyleFontEnum,
  StyleWeightEnum,
  StyleCaseEnum,
  StyleAlignEnum,
  StyleSizeEnum,
  StylePositionEnum,
  StyleLetterboxEnum,
  Suggestion,
  SuggestionTypeEnum,
  TextBlock,
} from '@auto-stories/api-types';

const FONTS: readonly StyleFontEnum[] = [
  'inter',
  'playfair',
  'space-mono',
  'caveat',
];
const WEIGHTS: readonly StyleWeightEnum[] = ['regular', 'bold'];
const CASES: readonly StyleCaseEnum[] = ['normal', 'upper'];
const ALIGNS: readonly StyleAlignEnum[] = ['left', 'center', 'right'];
const SIZES: readonly StyleSizeEnum[] = ['s', 'm', 'l'];
const POSITIONS: readonly StylePositionEnum[] = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];
const LETTERBOXES: readonly StyleLetterboxEnum[] = ['solid', 'blur'];

/** What every field falls back to when the model omits it or returns junk. */
export const DEFAULT_STYLE: Style = {
  font: 'inter',
  weight: 'regular',
  case: 'normal',
  align: 'center',
  size: 'm',
  position: 'bottom-center',
  letterbox: 'blur',
};

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

/**
 * Turn the model's raw style object into a valid {@link Style}, field by field.
 * The model is non-deterministic, so every field falls back to its default when
 * missing or not one of the allowed values — the client always gets a complete,
 * valid style. Pure and unit-tested. (The `readable` parts — text colour and
 * scrim — are computed client-side, not here.)
 */
export function normalizeStyle(raw: unknown): Style {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    font: pick(FONTS, r['font'], DEFAULT_STYLE.font),
    weight: pick(WEIGHTS, r['weight'], DEFAULT_STYLE.weight),
    case: pick(CASES, r['case'], DEFAULT_STYLE.case),
    align: pick(ALIGNS, r['align'], DEFAULT_STYLE.align),
    size: pick(SIZES, r['size'], DEFAULT_STYLE.size),
    position: pick(POSITIONS, r['position'], DEFAULT_STYLE.position),
    letterbox: pick(LETTERBOXES, r['letterbox'], DEFAULT_STYLE.letterbox),
  };
}

/** A frame carries at most this many EXTRA text blocks besides the caption. */
export const MAX_TEXT_BLOCKS = 2;

/**
 * Turn the model's raw `texts` into 0–2 clean {@link TextBlock}s — the EXTRA
 * placed lines a frame carries *besides* its `caption` (an editorial layout: a
 * small line and a bigger line). Each needs a non-empty text and a valid style;
 * junk and empty-text blocks are dropped, the count capped, and `[]` returned
 * when the model gives none (the common case — the caption alone). Per-field
 * defaults come from the frame's `style`. Pure and unit-tested.
 */
export function normalizeTexts(
  raw: unknown,
  fallbackStyle: Style,
): TextBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: TextBlock[] = [];
  for (const entry of raw) {
    if (out.length >= MAX_TEXT_BLOCKS) break;
    if (typeof entry !== 'object' || entry === null) continue;
    const r = entry as Record<string, unknown>;
    const text = typeof r['text'] === 'string' ? r['text'].trim() : '';
    if (text === '') continue;
    out.push({
      text,
      font: pick(FONTS, r['font'], fallbackStyle.font),
      weight: pick(WEIGHTS, r['weight'], fallbackStyle.weight),
      case: pick(CASES, r['case'], fallbackStyle.case),
      align: pick(ALIGNS, r['align'], fallbackStyle.align),
      size: pick(SIZES, r['size'], fallbackStyle.size),
      position: pick(POSITIONS, r['position'], fallbackStyle.position),
    });
  }
  return out;
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
 * list. Same defensive posture as {@link normalizeStyle}: drop items with an
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
        POSITIONS,
        r['position'],
        DEFAULT_STYLE.position,
      );
    }
    out.push(suggestion);
  }
  return out;
}
