import { paletteFor } from './caption-palette';
import { loadCaptionFonts } from './caption-render';
import { drawComposition } from './layout-canvas';
import type { EditableFrame } from './story.service';

/** Instagram Story canvas size. */
export const FRAME_W = 1080;
export const FRAME_H = 1920;

/**
 * Composite one finished card into a 1080×1920 PNG the user can post: the photo
 * cover-fit to fill, then the frame's composition — the same one the preview
 * draws — on top (decision 7.25: one composition owns the frame). Returns a PNG
 * blob.
 */
export async function renderFrame(file: File, frame: EditableFrame): Promise<Blob> {
  const canvas = new OffscreenCanvas(FRAME_W, FRAME_H);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  await loadCaptionFonts();
  const bitmap = await createImageBitmap(file);
  try {
    // The cohesion match applies to the photo only; reset before the text.
    // Two filters compose on the photo: the exposure match the device computed
    // to pull the story together (cohesion), and the Look's own treatment — a
    // warm 35mm wash, Super 8's sepia. Concatenated, so a Look's stock never
    // discards the cohesion match.
    ctx.filter = photoFilter(frame);
    drawCover(ctx, bitmap);
    ctx.filter = 'none';
  } finally {
    bitmap.close();
  }

  // Draw the same composition the DOM preview draws, so the export matches it
  // exactly. Colour comes from the device sampling (7.10).
  const palette = paletteFor();
  // The Look states its own polarity when it lays a scrim; `auto` defers to the
  // luminance sampled from the photo (7.10).
  const declared = frame.composition.ink;
  const light = declared === 'auto' ? frame.light : declared === 'light';
  drawComposition(ctx, frame.composition, FRAME_W, FRAME_H, {
    ink: light ? palette.textLight : palette.textDark,
    accent: frame.composition.accent,
  });

  return canvas.convertToBlob({ type: 'image/png' });
}

/**
 * The photo's filter: the device's exposure-cohesion match plus the Look's own
 * treatment, in that order. Exported so the DOM preview applies exactly the same
 * string to its `<img>` — a treatment that reached only one surface would make
 * the preview and the PNG disagree about what the photograph looks like.
 */
export function photoFilter(frame: EditableFrame): string {
  const parts = [frame.imageFilter, frame.composition.photoFilter].filter(
    (part): part is string => !!part && part !== 'none',
  );
  return parts.length ? parts.join(' ') : 'none';
}

/** Scale the photo to cover the whole frame (crop overflow, centred). */
function drawCover(ctx: OffscreenCanvasRenderingContext2D, bitmap: ImageBitmap): void {
  const scale = Math.max(FRAME_W / bitmap.width, FRAME_H / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (FRAME_W - w) / 2, (FRAME_H - h) / 2, w, h);
}
