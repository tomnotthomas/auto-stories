import type { Style } from '@auto-stories/api-types';

/**
 * Maps the AI's caption `style` to concrete CSS/canvas values. The four font
 * choices map to generic families for now (real self-hosted fonts are a later
 * polish) so the model's choice is still visible: sans / serif / mono / script.
 */
export function fontFamily(font: Style['font']): string {
  switch (font) {
    case 'playfair':
      return 'Georgia, "Times New Roman", serif';
    case 'space-mono':
      return 'ui-monospace, "SF Mono", Menlo, monospace';
    case 'caveat':
      return '"Segoe Script", "Bradley Hand", "Comic Sans MS", cursive';
    case 'inter':
    default:
      return 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  }
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
