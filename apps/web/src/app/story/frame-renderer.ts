import type { Style } from '@auto-stories/api-types';

import { DEFAULT_STYLE } from './caption-style';
import { paletteFor } from './caption-palette';
import {
  fitMultiplier,
  fontFamily,
  fontWeightCss,
  loadCaptionFonts,
  sizeScale,
  textTransformCss,
} from './caption-render';
import { drawComposition } from './layout-canvas';
import type { EditableFrame } from './story.service';

/** Instagram Story canvas size. */
export const FRAME_W = 1080;
export const FRAME_H = 1920;

/** Everything needed to draw one caption/text block onto the canvas. */
interface TextDraw {
  readonly text: string;
  readonly font: Style['font'];
  readonly weight: Style['weight'];
  readonly case: Style['case'];
  readonly align: Style['align'];
  readonly size: Style['size'];
  /** Centre, in % of the frame. */
  readonly xPct: number;
  readonly yPct: number;
  /** Extra size multiplier from the user's drag (1 for AI-placed extra blocks). */
  readonly scale: number;
  /** true → white text, false → dark. */
  readonly light: boolean;
  /** true → draw a scrim behind the text. */
  readonly legibility: boolean;
}

/**
 * Composite one finished card into a 1080×1920 PNG the user can post: the photo
 * cover-fit to fill, then the caption and any extra placed text blocks drawn with
 * their AI style at their spots, with the device-computed colour + scrim. Returns
 * a PNG blob.
 */
export async function renderFrame(file: File, frame: EditableFrame): Promise<Blob> {
  const canvas = new OffscreenCanvas(FRAME_W, FRAME_H);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  await loadCaptionFonts();
  const bitmap = await createImageBitmap(file);
  try {
    // The cohesion match applies to the photo only; reset before the text.
    ctx.filter = frame.imageFilter || 'none';
    drawCover(ctx, bitmap);
    ctx.filter = 'none';
  } finally {
    bitmap.close();
  }

  // The frame's Look (decision 7.24) supersedes the caption/style/texts — draw
  // the same composition the DOM preview draws, so the export matches it
  // exactly. Colour comes from the device sampling (7.10).
  if (frame.composition) {
    const palette = paletteFor();
    drawComposition(ctx, frame.composition, FRAME_W, FRAME_H, {
      ink: frame.light ? palette.textLight : palette.textDark,
      accent: frame.accent ?? frame.composition.accent,
    });
    return canvas.convertToBlob({ type: 'image/png' });
  }

  const style = frame.style ?? DEFAULT_STYLE;
  drawText(ctx, {
    text: frame.caption,
    font: style.font,
    weight: style.weight,
    case: style.case,
    align: style.align,
    size: style.size,
    xPct: frame.placement.xPct,
    yPct: frame.placement.yPct,
    scale: frame.placement.scale,
    light: frame.light,
    legibility: frame.legibility,
  });

  // Extra editorial blocks besides the caption, each at its own placed spot with
  // its own size, background, and device-computed colour.
  for (const block of frame.extraTexts) {
    if (block.text.trim() === '') continue;
    drawText(ctx, {
      text: block.text,
      font: block.font,
      weight: block.weight,
      case: block.case,
      align: block.align,
      size: block.size,
      xPct: block.placement.xPct,
      yPct: block.placement.yPct,
      scale: block.placement.scale,
      light: block.light,
      legibility: block.legibility,
    });
  }

  return canvas.convertToBlob({ type: 'image/png' });
}

/** Scale the photo to cover the whole frame (crop overflow, centred). */
function drawCover(ctx: OffscreenCanvasRenderingContext2D, bitmap: ImageBitmap): void {
  const scale = Math.max(FRAME_W / bitmap.width, FRAME_H / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (FRAME_W - w) / 2, (FRAME_H - h) / 2, w, h);
}

/** Draw one text block (wrapped, optionally scrimmed) at its placed centre. */
function drawText(ctx: OffscreenCanvasRenderingContext2D, o: TextDraw): void {
  const fontPx = Math.round(64 * o.scale * sizeScale(o.size) * fitMultiplier(o.text));
  ctx.font = `${fontWeightCss(o.weight)} ${fontPx}px ${fontFamily(o.font)}`;
  ctx.textAlign = o.align;
  ctx.textBaseline = 'middle';

  const text = textTransformCss(o.case) === 'uppercase' ? o.text.toUpperCase() : o.text;
  const maxWidth = FRAME_W * 0.82;
  const lines = wrap(ctx, text, maxWidth);
  const lineH = fontPx * 1.22;
  const blockH = lines.length * lineH;

  const cx = (FRAME_W * o.xPct) / 100;
  const cy = (FRAME_H * o.yPct) / 100;
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));

  if (o.legibility) {
    const padX = fontPx * 0.6;
    const padY = fontPx * 0.4;
    ctx.fillStyle = o.light ? 'rgba(0,0,0,0.42)' : 'rgba(255,255,255,0.62)';
    roundRect(
      ctx,
      cx - widest / 2 - padX,
      cy - blockH / 2 - padY,
      widest + padX * 2,
      blockH + padY * 2,
      fontPx * 0.35,
    );
    ctx.fill();
  }

  // x anchor by alignment: left edge, centre, or right edge of the text block.
  const anchorX = o.align === 'left' ? cx - widest / 2 : o.align === 'right' ? cx + widest / 2 : cx;
  const palette = paletteFor();
  ctx.fillStyle = o.light ? palette.textLight : palette.textDark;
  lines.forEach((line, i) => {
    const y = cy - blockH / 2 + lineH / 2 + i * lineH;
    ctx.fillText(line, anchorX, y);
  });
}

/** Greedy word wrap to fit `maxWidth`. */
function wrap(ctx: OffscreenCanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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

function roundRect(
  ctx: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
