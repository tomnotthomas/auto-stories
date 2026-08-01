import type { Style } from '@auto-stories/api-types';

/** The self-hosted display face for captions (bundled woff2, @font-face in
 * styles.css). Loaded before the canvas draws via {@link loadCaptionFonts}. */
export const DISPLAY_FONT = 'Bricolage Grotesque';

/**
 * Maps the AI's caption `style` to a concrete font stack. The story caption is a
 * headline, so the default leads with the self-hosted display face
 * ({@link DISPLAY_FONT}); serif / mono / rounded remain distinct for the model's
 * other choices, each with a system fallback.
 */
export function fontFamily(font: Style['font']): string {
  switch (font) {
    case 'playfair':
      return 'Georgia, "Times New Roman", serif';
    case 'space-mono':
      return 'ui-monospace, "SF Mono", Menlo, monospace';
    case 'caveat':
      return 'ui-rounded, "SF Pro Rounded", "Segoe UI Variable", system-ui, sans-serif';
    case 'inter':
    default:
      return `"${DISPLAY_FONT}", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  }
}

/**
 * Ensure the display face is loaded before a caption is drawn to canvas — a
 * canvas 2D context paints with whatever is loaded *now* and never waits, so the
 * export would fall back to a system font otherwise. Both caption weights are
 * requested. No-op where the Font Loading API is unavailable (e.g. tests).
 */
export async function loadCaptionFonts(): Promise<void> {
  const fonts = (globalThis as { fonts?: FontFaceSet }).fonts;
  if (!fonts) return;
  await Promise.all([
    fonts.load(`400 64px "${DISPLAY_FONT}"`),
    fonts.load(`700 64px "${DISPLAY_FONT}"`),
  ]).catch(() => undefined);
}

export function fontWeightCss(weight: Style['weight']): number {
  return weight === 'bold' ? 700 : 400;
}

export function textTransformCss(textCase: Style['case']): 'none' | 'uppercase' {
  return textCase === 'upper' ? 'uppercase' : 'none';
}

export function textAlignCss(align: Style['align']): 'left' | 'center' | 'right' {
  return align;
}

/** Size bucket → a multiplier applied on top of the base caption size + the
 * user's drag scale. */
export function sizeScale(size: Style['size']): number {
  switch (size) {
    case 's':
      return 0.8;
    case 'l':
      return 1.35;
    case 'm':
    default:
      return 1;
  }
}
