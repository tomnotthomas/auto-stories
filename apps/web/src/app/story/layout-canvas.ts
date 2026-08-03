import {
  PAPER,
  PAPER_INK,
  handStroke,
  wrapRuns,
  type Composition,
  type Line,
  type PartColor,
  type RowPart,
  type Run,
  type TagPart,
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
 *
 * Layers, bottom to top: photo (drawn by the caller) → scrim → panel → parts →
 * border. `rotationDeg` tilts the panel and the parts together, as one card; the
 * border is a property of the frame, so it stays square to it.
 *
 * Nothing here throws. A composition that fails to draw is a blank export, so
 * every primitive degrades to "paint nothing" on nonsense input rather than
 * raising.
 */

export interface CompositionColors {
  /** The legible text colour computed from the pixels behind the type (7.10). */
  readonly ink: string;
  /** The story accent sampled from the photo. */
  readonly accent: string;
}

/**
 * The off-white a Look lays down for its own panels, tape and labels. Fixed, not
 * sampled: paper is a material, not a reaction to the photo. It doubles as the
 * light tone type reverses to when it sits on accent (a block mark, a chip).
 */
// Re-exported: the paper tone is shared with the DOM half, and callers of the
// canvas renderer read it from here.
export { PAPER };

/** The dark the paper tone is legible against — the ink that goes ON paper. */

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
  lineJoin: CanvasLineJoin;
  /** Optional, like `letterSpacing` — guarded before use so a fake can omit it. */
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  fillText(text: string, x: number, y: number): void;
  strokeText(text: string, x: number, y: number): void;
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
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient;
}

/** One part, measured and ready to paint at a known y. */
interface Placed {
  readonly draw: (top: number) => void;
  readonly height: number;
  readonly gap: number;
}

/** Everything that carries a {@link TypeStyle}. */
type TypedPart = TextPart | RowPart | TagPart;

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
  const resolve = (color: PartColor): string =>
    color === 'accent' ? colors.accent : color === 'paper' ? PAPER : colors.ink;

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
      case 'tag':
        return placeTag(ctx, part, left, columnWidth, width, height, resolve, colors.accent);
      default:
        return placeText(ctx, part, left, columnWidth, width, height, resolve, colors.accent);
    }
  });

  const total = placed.reduce((sum, part) => sum + part.gap + part.height, 0);
  const stackTop =
    composition.anchor === 'bottom'
      ? height - (height * composition.offsetHPct) / 100 - total
      : (height * composition.offsetHPct) / 100;

  // The panel wraps the ink, not the layout box: the first part's gap is the
  // space that pushes the stack off the anchor edge, so padding is measured from
  // where the type actually starts.
  const inkTop = stackTop + (placed[0]?.gap ?? 0);
  const inkBottom = stackTop + total;
  const panel = panelBox(composition, left, columnWidth, width, height, inkTop, inkBottom);

  // Rotation tilts panel and type as one card. With no panel there is nothing
  // but the type to pivot around, so the column's own box is the centre.
  const pivotX = panel ? panel.x + panel.w / 2 : left + columnWidth / 2;
  const pivotY = panel ? panel.y + panel.h / 2 : (inkTop + inkBottom) / 2;

  withRotation(ctx, composition.rotationDeg, pivotX, pivotY, () => {
    if (panel && composition.panel) {
      ctx.globalAlpha = clamp01(composition.panel.opacity);
      ctx.fillStyle = resolve(composition.panel.color);
      if (roundRectPath(ctx, panel.x, panel.y, panel.w, panel.h, panel.r)) ctx.fill();
      ctx.globalAlpha = 1;
    }

    let top = stackTop;
    for (const part of placed) {
      top += part.gap;
      part.draw(top);
      top += part.height;
    }
  });

  drawBorder(ctx, composition, width, height, resolve);
}

/** The panel's pixel rect, or null when there is no panel or nothing to back. */
function panelBox(
  composition: Composition,
  left: number,
  columnWidth: number,
  width: number,
  height: number,
  inkTop: number,
  inkBottom: number,
): { x: number; y: number; w: number; h: number; r: number } | null {
  const panel = composition.panel;
  // A panel exists to sit behind the words. With no words it would draw as a
  // bar floating on the photo, which reads as a bug, so it is dropped.
  if (!panel || composition.parts.length === 0) return null;

  const padW = (width * panel.padWPct) / 100;
  const padH = (height * panel.padHPct) / 100;
  return {
    x: panel.fullWidth ? 0 : left - padW,
    y: inkTop - padH,
    w: panel.fullWidth ? width : columnWidth + padW * 2,
    h: inkBottom - inkTop + padH * 2,
    r: (width * panel.radiusWPct) / 100,
  };
}

/** An inset stroked frame on the whole frame — a print border, a viewfinder. */
function drawBorder(
  ctx: Ctx2D,
  composition: Composition,
  width: number,
  height: number,
  resolve: (color: PartColor) => string,
): void {
  const border = composition.border;
  if (!border) return;

  const inset = (width * border.insetWPct) / 100;
  const thickness = Math.max(1, (width * border.widthWPct) / 100);
  const box = {
    x: inset,
    y: inset,
    w: width - inset * 2,
    h: height - inset * 2,
  };
  ctx.strokeStyle = resolve(border.color);
  ctx.lineWidth = thickness;
  ctx.lineJoin = 'round';
  if (roundRectPath(ctx, box.x, box.y, box.w, box.h, (width * border.radiusWPct) / 100)) {
    ctx.stroke();
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
  const tabWidth = part.tab
    ? (width * part.tab.widthWPct) / 100 + (width * part.tab.gapWPct) / 100
    : 0;
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
        ctx.fillRect(
          left,
          top + (lineHeight - tabHeight) / 2,
          (width * part.tab.widthWPct) / 100,
          tabHeight,
        );
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
          stroke: part.stroke === true,
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
  readonly stroke: boolean;
}

/** Paint one line's runs in sequence, marking the emphasised ones. */
function drawRuns(ctx: Ctx2D, line: Line, left: number, top: number, paint: RunPaint): void {
  let x = left;
  for (const run of line.runs) {
    const text = paint.cased(run.text);
    const runWidth = ctx.measureText(text).width;
    const marked = run.emphasised === true;

    // Every mark is laid down first, so the letters sit on top of it.
    if (marked) drawMark(ctx, paint, x, top, runWidth, text);

    // A block mark covers the run, so the type reverses out of it.
    const fill = marked && paint.mark === 'accent-block' ? PAPER : paint.ink;
    if (paint.stroke) {
      ctx.strokeStyle = fill;
      ctx.lineWidth = Math.max(1, paint.fontPx * 0.028);
      ctx.lineJoin = 'round';
      ctx.strokeText(text, x, top);
    } else {
      ctx.fillStyle = fill;
      ctx.fillText(text, x, top);
    }
    x += runWidth;
  }
}

/** The four ways a Look can mark an emphasised run. */
function drawMark(
  ctx: Ctx2D,
  paint: RunPaint,
  x: number,
  top: number,
  runWidth: number,
  text: string,
): void {
  if (!(runWidth > 0)) return;

  switch (paint.mark) {
    case 'accent-underline': {
      // `.head u { box-shadow: inset 0 -0.5cqh 0 var(--accent) }` — a solid bar
      // riding the baseline.
      const bar = paint.fontPx * 0.1;
      ctx.fillStyle = paint.accent;
      ctx.fillRect(x, top + paint.lineHeight - bar * 1.6, runWidth, bar);
      return;
    }
    case 'accent-block': {
      // A filled block a shade larger than the word, so the reversed letters
      // have air on every side.
      const padX = paint.fontPx * 0.14;
      const padY = paint.fontPx * 0.06;
      ctx.fillStyle = paint.accent;
      ctx.fillRect(x - padX, top - padY, runWidth + padX * 2, paint.lineHeight * 0.94 + padY * 2);
      return;
    }
    case 'highlighter': {
      // A marker swipe: thick, translucent, struck through the middle of the
      // word and overshooting both ends the way a real pen does.
      const swipe = paint.fontPx * 0.52;
      const over = paint.fontPx * 0.08;
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = paint.accent;
      ctx.fillRect(x - over, top + paint.fontPx * 0.3, runWidth + over * 2, swipe);
      ctx.globalAlpha = 1;
      return;
    }
    case 'hand-underline':
      drawHandUnderline(ctx, paint, x, top, runWidth, text);
      return;
    default:
      return;
  }
}

/**
 * A stroke that reads as drawn, not typeset: one loose bezier that sags, lifts
 * and overshoots, with each end at its own height. The wobble is a hash of the
 * run's own text, so it is stable — the same word wobbles identically in the
 * preview and in the export, and redrawing never makes it twitch.
 */
function drawHandUnderline(
  ctx: Ctx2D,
  paint: RunPaint,
  x: number,
  top: number,
  runWidth: number,
  seed: string,
): void {
  // The shape is shared with the DOM half so the same word bends identically in
  // the preview and in the export; only the scale is ours.
  const stroke = handStroke(seed);
  const baseline = top + paint.lineHeight - paint.fontPx * 0.08;
  const startY = baseline + stroke.startY * paint.fontPx;
  const endY = baseline + stroke.endY * paint.fontPx;
  const sag = paint.fontPx * stroke.sag;
  const lift = paint.fontPx * stroke.lift;
  const overshoot = paint.fontPx * stroke.overshoot;

  ctx.strokeStyle = paint.accent;
  ctx.lineWidth = Math.max(1, paint.fontPx * 0.075);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - overshoot, startY);
  ctx.bezierCurveTo(
    x + runWidth * 0.3,
    startY + sag,
    x + runWidth * 0.66,
    endY - lift,
    x + runWidth + overshoot,
    endY,
  );
  ctx.stroke();
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

/** How far each style tilts when the Look doesn't say — part of its character. */
const TAG_TILT: Record<TagPart['style'], number> = {
  pill: 0,
  chip: 0,
  tape: -2.2,
  stamp: -5,
};

/**
 * A tag: a short label in its own box, set apart from the running type. The box
 * is sized off the type rather than authored, so a tag never crops its own text
 * and every Look's tags share one optical padding.
 */
function placeTag(
  ctx: Ctx2D,
  part: TagPart,
  left: number,
  columnWidth: number,
  width: number,
  height: number,
  resolve: (color: PartColor) => string,
  accent: string,
): Placed {
  const raw = typeof part.text === 'string' ? part.text : '';
  const text = part.textTransform === 'uppercase' ? raw.toUpperCase() : raw;
  if (!text.trim()) return { gap: 0, height: 0, draw: () => {} };

  const fontPx = (width * part.fontSizeWPct) / 100;
  applyType(ctx, part, fontPx);
  const textWidth = ctx.measureText(text).width;
  const lineHeight = fontPx * part.lineHeight;
  const padX = fontPx * 0.62;
  const padY = fontPx * 0.34;
  const boxW = textWidth + padX * 2;
  const boxH = lineHeight + padY * 2;

  const x =
    part.textAlign === 'center'
      ? left + (columnWidth - boxW) / 2
      : part.textAlign === 'right'
        ? left + columnWidth - boxW
        : left;

  return {
    gap: (height * part.gapHPct) / 100,
    height: boxH,
    draw: (top) => {
      const tilt = part.rotationDeg ?? TAG_TILT[part.style] ?? 0;
      withRotation(ctx, tilt, x + boxW / 2, top + boxH / 2, () => {
        applyType(ctx, part, fontPx);
        const textX = x + padX;
        const textY = top + padY;

        switch (part.style) {
          case 'pill': {
            // A hairline capsule — the outline is the whole graphic.
            ctx.strokeStyle = resolve(part.color);
            ctx.lineWidth = Math.max(1, fontPx * 0.075);
            ctx.lineJoin = 'round';
            if (roundRectPath(ctx, x, top, boxW, boxH, boxH / 2)) ctx.stroke();
            ctx.fillStyle = resolve(part.color);
            ctx.fillText(text, textX, textY);
            return;
          }
          case 'tape': {
            // A strip of paper laid on the photo: it needs a shadow to sit
            // above the image rather than be printed into it.
            withShadow(ctx, fontPx, () => {
              ctx.fillStyle = PAPER;
              if (roundRectPath(ctx, x, top, boxW, boxH, fontPx * 0.12)) ctx.fill();
            });
            ctx.fillStyle = PAPER_INK;
            ctx.fillText(text, textX, textY);
            return;
          }
          case 'chip': {
            // A solid accent lozenge with the type reversed out of it.
            ctx.fillStyle = accent;
            if (roundRectPath(ctx, x, top, boxW, boxH, boxH * 0.38)) ctx.fill();
            ctx.fillStyle = PAPER;
            ctx.fillText(text, textX, textY);
            return;
          }
          default: {
            // stamp — print-shop ink: outline and type in the same accent.
            ctx.strokeStyle = accent;
            ctx.lineWidth = Math.max(1, fontPx * 0.1);
            ctx.lineJoin = 'round';
            if (roundRectPath(ctx, x, top, boxW, boxH, fontPx * 0.18)) ctx.stroke();
            ctx.fillStyle = accent;
            ctx.fillText(text, textX, textY);
          }
        }
      });
    },
  };
}

/** Set the context's type state from a part. */
function applyType(ctx: Ctx2D, part: TypedPart, fontPx: number): void {
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

/** Run `draw` rotated about (cx, cy), leaving the context as it found it. */
function withRotation(
  ctx: Ctx2D,
  degrees: number | undefined,
  cx: number,
  cy: number,
  draw: () => void,
): void {
  const deg = degrees ?? 0;
  if (!Number.isFinite(deg) || deg === 0 || !Number.isFinite(cx) || !Number.isFinite(cy)) {
    draw();
    return;
  }
  ctx.save();
  try {
    ctx.translate(cx, cy);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.translate(-cx, -cy);
    draw();
  } finally {
    ctx.restore();
  }
}

/** Run `draw` with a soft drop shadow, then clear it. */
function withShadow(ctx: Ctx2D, fontPx: number, draw: () => void): void {
  const has = 'shadowColor' in ctx;
  if (has) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
    ctx.shadowBlur = fontPx * 0.5;
    ctx.shadowOffsetY = fontPx * 0.12;
  }
  try {
    draw();
  } finally {
    if (has) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0)';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
  }
}

/**
 * Trace a rounded rectangle. Returns false — having drawn nothing — for a box
 * that can't exist, because a degenerate radius makes a real canvas throw.
 */
function roundRectPath(
  ctx: Ctx2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): boolean {
  if (![x, y, w, h, radius].every((n) => Number.isFinite(n))) return false;
  if (w <= 0 || h <= 0) return false;

  const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  return true;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

/** A stable 0…1 from a string — the hand-drawn wobble must not move on redraw. */

/** Runs joined — handy for tests and for measuring a whole line. */
export function lineText(line: { runs: readonly Run[] }): string {
  return line.runs.map((run) => run.text).join('');
}
