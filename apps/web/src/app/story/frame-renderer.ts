import { DEFAULT_STYLE } from './caption-style';
import {
  fontFamily,
  fontWeightCss,
  loadCaptionFonts,
  sizeScale,
  textTransformCss,
} from './caption-render';
import type { EditableFrame } from './story.service';

/** Instagram Story canvas size. */
export const FRAME_W = 1080;
export const FRAME_H = 1920;

/**
 * Composite one finished card into a 1080×1920 PNG the user can post: the photo
 * cover-fit to fill, then the caption drawn with its AI style (font/weight/case/
 * size at the placed position) and the device-computed colour + scrim. Returns a
 * PNG blob.
 */
export async function renderFrame(file: File, frame: EditableFrame): Promise<Blob> {
  const canvas = new OffscreenCanvas(FRAME_W, FRAME_H);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  await loadCaptionFonts();
  const bitmap = await createImageBitmap(file);
  try {
    // The cohesion match applies to the photo only; reset before the caption.
    ctx.filter = frame.imageFilter || 'none';
    drawCover(ctx, bitmap);
    ctx.filter = 'none';
  } finally {
    bitmap.close();
  }
  drawCaption(ctx, frame);
  return canvas.convertToBlob({ type: 'image/png' });
}

/** Scale the photo to cover the whole frame (crop overflow, centred). */
function drawCover(ctx: OffscreenCanvasRenderingContext2D, bitmap: ImageBitmap): void {
  const scale = Math.max(FRAME_W / bitmap.width, FRAME_H / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (FRAME_W - w) / 2, (FRAME_H - h) / 2, w, h);
}

function drawCaption(ctx: OffscreenCanvasRenderingContext2D, frame: EditableFrame): void {
  const style = frame.style ?? DEFAULT_STYLE;
  const fontPx = Math.round(64 * frame.placement.scale * sizeScale(style.size));
  ctx.font = `${fontWeightCss(style.weight)} ${fontPx}px ${fontFamily(style.font)}`;
  ctx.textAlign = style.align;
  ctx.textBaseline = 'middle';

  const text =
    textTransformCss(style.case) === 'uppercase' ? frame.caption.toUpperCase() : frame.caption;
  const maxWidth = FRAME_W * 0.82;
  const lines = wrap(ctx, text, maxWidth);
  const lineH = fontPx * 1.22;
  const blockH = lines.length * lineH;

  const cx = (FRAME_W * frame.placement.xPct) / 100;
  const cy = (FRAME_H * frame.placement.yPct) / 100;
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));

  if (frame.legibility) {
    const padX = fontPx * 0.6;
    const padY = fontPx * 0.4;
    ctx.fillStyle = frame.light ? 'rgba(0,0,0,0.42)' : 'rgba(255,255,255,0.62)';
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
  const anchorX =
    style.align === 'left' ? cx - widest / 2 : style.align === 'right' ? cx + widest / 2 : cx;
  ctx.fillStyle = frame.light ? '#ffffff' : '#141414';
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
