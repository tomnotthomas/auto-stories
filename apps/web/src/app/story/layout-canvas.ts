import {
  wrapRuns,
  type Composition,
  type Line,
  type PartColor,
  type RowPart,
  type Run,
  type TextPart,
} from './look';

/**
 * The canvas half of the Looks renderer (decision 7.24). Draws a
 * {@link Composition} — the same object the DOM preview draws — so the export
 * and the preview never drift.
 *
 * Colour is NOT decided here: the caller passes `colorFor`, which resolves `ink`
 * from the device's pixel sampling (7.10) and `accent` from the photo. This keeps
 * the module deterministic and the export clean.
 *
 * Geometry arrives in the Looks' authoring units — a percentage of the frame's
 * width for type sizes, of its height for vertical rhythm — and is multiplied up
 * to pixels here, so one Look renders identically at preview size and at 1080px.
 */

export interface CompositionColors {
  /** The legible text colour computed from the pixels behind the type (7.10). */
  readonly ink: string;
  /** The story accent sampled from the photo. */
  readonly accent: string;
}

/** The slice of a 2D context the renderer needs — structural, so tests can pass
 * a lightweight fake instead of a real canvas. */
export interface Ctx2D {
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  fillStyle: string | CanvasGradient | CanvasPattern;
  globalAlpha: number;
  letterSpacing?: string;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient;
}

/** One part, measured and ready to paint at a known y. */
interface Placed {
  readonly draw: (top: number) => void;
  readonly height: number;
  readonly gap: number;
}

/**
 * Draw a composition onto `ctx` for a `width`×`height` frame. Parts flow down a
 * single column; the whole stack then hangs from the composition's anchor edge,
 * which is what lets a Look sit low on one photo and high on the next without
 * any part knowing where it ended up.
 */
export function drawComposition(
  ctx: Ctx2D,
  composition: Composition,
  width: number,
  height: number,
  colors: CompositionColors,
): void {
  drawScrim(ctx, composition, width, height);

  const left = (width * composition.leftPct) / 100;
  const columnWidth = width * (1 - (composition.leftPct + composition.rightPct) / 100);
  const resolve = (color: PartColor): string => (color === 'accent' ? colors.accent : colors.ink);

  const placed: Placed[] = composition.parts.map((part) => {
    const gap = (height * part.gapHPct) / 100;
    switch (part.kind) {
      case 'rule': {
        const thickness = Math.max(1, (height * part.thicknessHPct) / 100);
        return {
          gap,
          height: thickness,
          draw: (top) => {
            ctx.globalAlpha = part.opacity;
            ctx.fillStyle = resolve(part.color);
            ctx.fillRect(left, top, (columnWidth * part.widthPct) / 100, thickness);
            ctx.globalAlpha = 1;
          },
        };
      }
      case 'row':
        return placeRow(ctx, part, left, columnWidth, width, height, resolve);
      default:
        return placeText(ctx, part, left, columnWidth, width, height, resolve, colors.accent);
    }
  });

  const total = placed.reduce((sum, part) => sum + part.gap + part.height, 0);
  let top =
    composition.anchor === 'bottom'
      ? height - (height * composition.offsetHPct) / 100 - total
      : (height * composition.offsetHPct) / 100;

  for (const part of placed) {
    top += part.gap;
    part.draw(top);
    top += part.height;
  }
}

/** Measure and prepare a text part: wrap it, then paint runs left to right. */
function placeText(
  ctx: Ctx2D,
  part: TextPart,
  left: number,
  columnWidth: number,
  width: number,
  height: number,
  resolve: (color: PartColor) => string,
  accent: string,
): Placed {
  const fontPx = (width * part.fontSizeWPct) / 100;
  const tabWidth = part.tab ? (width * part.tab.widthWPct) / 100 + (width * part.tab.gapWPct) / 100 : 0;
  const textLeft = left + tabWidth;

  applyType(ctx, part, fontPx);
  const cased = (text: string): string =>
    part.textTransform === 'uppercase' ? text.toUpperCase() : text;
  const lines = wrapRuns(
    part.runs,
    (text) => ctx.measureText(cased(text)).width,
    columnWidth - tabWidth,
  );

  const lineHeight = fontPx * part.lineHeight;
  return {
    gap: (height * part.gapHPct) / 100,
    height: Math.max(lines.length, 1) * lineHeight,
    draw: (top) => {
      if (part.tab) {
        const tabHeight = (height * part.tab.heightHPct) / 100;
        ctx.fillStyle = accent;
        // Sit the tab on the text's optical centre rather than its box top.
        ctx.fillRect(left, top + (lineHeight - tabHeight) / 2, (width * part.tab.widthWPct) / 100, tabHeight);
      }
      applyType(ctx, part, fontPx);
      lines.forEach((line, index) => {
        drawRuns(ctx, line, textLeft, top + index * lineHeight, {
          fontPx,
          lineHeight,
          cased,
          ink: resolve(part.color),
          accent,
          mark: part.mark,
        });
      });
    },
  };
}

interface RunPaint {
  readonly fontPx: number;
  readonly lineHeight: number;
  readonly cased: (text: string) => string;
  readonly ink: string;
  readonly accent: string;
  readonly mark: TextPart['mark'];
}

/** Paint one line's runs in sequence, marking the emphasised ones. */
function drawRuns(ctx: Ctx2D, line: Line, left: number, top: number, paint: RunPaint): void {
  let x = left;
  for (const run of line.runs) {
    const text = paint.cased(run.text);
    const runWidth = ctx.measureText(text).width;

    if (run.emphasised && paint.mark === 'accent-underline') {
      // `.head u { box-shadow: inset 0 -0.5cqh 0 var(--accent) }` — a solid bar
      // riding the baseline, drawn first so the letters sit on top of it.
      const bar = paint.fontPx * 0.1;
      ctx.fillStyle = paint.accent;
      ctx.fillRect(x, top + paint.lineHeight - bar * 1.6, runWidth, bar);
    }
    ctx.fillStyle = paint.ink;
    ctx.fillText(text, x, top);
    x += runWidth;
  }
}

/** A byline row: one label left, one right, on a shared baseline. */
function placeRow(
  ctx: Ctx2D,
  part: RowPart,
  left: number,
  columnWidth: number,
  width: number,
  height: number,
  resolve: (color: PartColor) => string,
): Placed {
  const fontPx = (width * part.fontSizeWPct) / 100;
  const lineHeight = fontPx * part.lineHeight;
  const cased = (text: string): string =>
    part.textTransform === 'uppercase' ? text.toUpperCase() : text;

  return {
    gap: (height * part.gapHPct) / 100,
    height: lineHeight,
    draw: (top) => {
      applyType(ctx, part, fontPx);
      ctx.fillStyle = resolve(part.color);
      if (part.left) ctx.fillText(cased(part.left), left, top);
      if (part.right) {
        const right = cased(part.right);
        ctx.fillText(right, left + columnWidth - ctx.measureText(right).width, top);
      }
    },
  };
}

/** Set the context's type state from a part. */
function applyType(
  ctx: Ctx2D,
  part: TextPart | RowPart,
  fontPx: number,
): void {
  ctx.font = `${part.fontWeight} ${Math.round(fontPx)}px ${part.fontFamily}`;
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${(part.letterSpacingEm * fontPx).toFixed(2)}px`;
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
}

/** The gradient that keeps type readable over an unknown photo. */
function drawScrim(ctx: Ctx2D, composition: Composition, width: number, height: number): void {
  const scrim = composition.scrim;
  if (!scrim) return;

  const extent = (height * scrim.extentHPct) / 100;
  const from = scrim.from === 'bottom' ? height : 0;
  const to = scrim.from === 'bottom' ? height - extent : extent;
  const gradient = ctx.createLinearGradient(0, from, 0, to);
  if (!gradient) return;

  gradient.addColorStop(0, `rgba(0, 0, 0, ${scrim.strength})`);
  gradient.addColorStop(0.45, `rgba(0, 0, 0, ${scrim.strength * 0.38})`);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, Math.min(from, to), width, extent);
}

/** Runs joined — handy for tests and for measuring a whole line. */
export function lineText(line: { runs: readonly Run[] }): string {
  return line.runs.map((run) => run.text).join('');
}
