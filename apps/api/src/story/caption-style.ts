import type {
  Style,
  StyleFontEnum,
  StyleWeightEnum,
  StyleCaseEnum,
  StyleAlignEnum,
  StyleSizeEnum,
  StylePositionEnum,
  StyleLetterboxEnum,
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
