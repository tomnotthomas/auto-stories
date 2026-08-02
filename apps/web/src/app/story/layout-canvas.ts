import { resolveLayout, type LayoutSpec, type ResolvedElement } from './layout-spec';

/**
 * The canvas half of the shared spec renderer (decision 7.21, slice 3). Draws a
 * {@link LayoutSpec} onto a 2D context by resolving it once with `resolveLayout`
 * (the same resolution the DOM preview uses, so the two never drift) and painting
 * each element at its anchor.
 *
 * Colour is NOT decided here: the caller passes `colorFor`, which resolves the
 * fill (and optional scrim) per element from the sampled pixels (7.10). This keeps
 * the export clean and the module deterministic.
 */

/** Base caption size in px at the export width; multiplied by an element's ramp. */
export const LAYOUT_BASE_PX = 64;

export interface ElementColor {
  readonly fill: string;
  /** Optional scrim behind the text, for legibility on a busy photo. */
  readonly scrim?: string;
}

/** Resolve an element's colour from the device's pixel sampling (7.10). */
export type ColorFor = (element: ResolvedElement, index: number) => ElementColor;

/** The slice of a 2D context {@link drawLayout} needs — structural, so tests can
 * pass a lightweight fake instead of a real canvas. */
export interface Ctx2D {
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  fillStyle: string | CanvasGradient | CanvasPattern;
  letterSpacing?: string;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  beginPath(): void;
  moveTo(x: number, y: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void;
  closePath(): void;
  fill(): void;
}

/**
 * Draw every element of `spec` onto `ctx` for a `width`×`height` frame. Wraps long
 * single lines to the element's max width; stacked elements draw one word per line.
 * The anchor + alignment come straight from `resolveLayout`, so a corner-anchored
 * block extends inward and stays on-screen.
 */
export function drawLayout(
  ctx: Ctx2D,
  spec: LayoutSpec,
  width: number,
  height: number,
  colorFor: ColorFor,
): void {
  resolveLayout(spec).forEach((el, index) => {
    const fontPx = Math.round(LAYOUT_BASE_PX * el.sizeScale);
    ctx.font = `${el.fontWeight} ${fontPx}px ${el.fontFamily}`;
    if ('letterSpacing' in ctx) {
      ctx.letterSpacing = `${Math.round(el.letterSpacingEm * fontPx)}px`;
    }
    ctx.textAlign = el.hAlign;
    ctx.textBaseline = 'top';

    const cased = (s: string): string => (el.textTransform === 'uppercase' ? s.toUpperCase() : s);
    const maxWidthPx = (width * el.maxWidthPct) / 100;
    const source = el.lines.length > 1 ? el.lines : wrap(ctx, el.lines[0] ?? '', maxWidthPx);
    const lines = source.map(cased);

    const lineH = fontPx * el.lineHeight;
    const blockH = lines.length * lineH;
    const ax = (width * el.xPct) / 100;
    const ay = (height * el.yPct) / 100;
    const blockTop =
      el.vAlign === 'top' ? ay : el.vAlign === 'bottom' ? ay - blockH : ay - blockH / 2;

    const color = colorFor(el, index);
    if (color.scrim) {
      const widest = Math.max(0, ...lines.map((l) => ctx.measureText(l).width));
      const left = el.hAlign === 'left' ? ax : el.hAlign === 'right' ? ax - widest : ax - widest / 2;
      const padX = fontPx * 0.5;
      const padY = fontPx * 0.35;
      ctx.fillStyle = color.scrim;
      roundRect(ctx, left - padX, blockTop - padY, widest + padX * 2, blockH + padY * 2, fontPx * 0.35);
      ctx.fill();
    }

    ctx.fillStyle = color.fill;
    lines.forEach((line, i) => ctx.fillText(line, ax, blockTop + i * lineH));
  });
}

/** Greedy word wrap to fit `maxWidth`. */
function wrap(ctx: Ctx2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function roundRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
