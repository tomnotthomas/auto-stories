import { Injectable } from '@angular/core';
import type { Photo } from '@auto-stories/api-types';

import type { PickedPhoto } from './story.service';

/** ~1024px long edge is ~2 of Gemini's tiles — enough detail, small upload (3.4). */
export const MAX_EDGE = 1024;
/** JPEG ~80% keeps faces/text legible while shrinking the payload (3.4). */
export const JPEG_QUALITY = 0.8;
/** Long edge for a photo that is only ever shown on screen. A phone's own
 * screen is ~1200 device px across, and a 12MP original costs ~48MB of decoded
 * bitmap to show in a box that size — memory pressure a cheap phone answers
 * with garbage collection, which is what choppy looks like (decision 7.34). */
export const DISPLAY_MAX_EDGE = 1440;

/** Dimensions to draw at: fit within a max long-edge, keep aspect, never upscale. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge = MAX_EDGE,
): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) return { width, height };
  const scale = maxEdge / longEdge;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Turns picked full-res files into the small proxies sent to the model. The
 * model reads a downscaled copy; captions are placed on the originals (3.4).
 */
@Injectable({ providedIn: 'root' })
export class ImageService {
  /** Downscale each photo one at a time, so peak memory stays flat regardless
   * of how many were picked (4.5). */
  async toProxies(photos: readonly PickedPhoto[]): Promise<Photo[]> {
    const proxies: Photo[] = [];
    for (const photo of photos) {
      proxies.push(await this.toProxy(photo));
    }
    return proxies;
  }

  /**
   * A downscaled copy of the photo to *show*, as an object URL the caller owns
   * and must revoke. Returns null if the photo cannot be decoded — the caller
   * falls back to the original, which is correct, just heavier.
   */
  async toDisplayUrl(file: File, maxEdge = DISPLAY_MAX_EDGE): Promise<string | null> {
    try {
      const bitmap = await createImageBitmap(file);
      try {
        const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(bitmap, 0, 0, width, height);
        const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
        return URL.createObjectURL(blob);
      } finally {
        bitmap.close();
      }
    } catch {
      return null;
    }
  }

  /** Decode → downscale (~1024px long edge, JPEG ~80%) → raw base64 (no prefix). */
  async toProxy(photo: PickedPhoto): Promise<Photo> {
    const bitmap = await createImageBitmap(photo.file);
    try {
      const { width, height } = fitWithin(bitmap.width, bitmap.height);
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('2D canvas context unavailable');
      ctx.drawImage(bitmap, 0, 0, width, height);
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
      return { id: photo.id, b64: await blobToBase64(blob) };
    } finally {
      bitmap.close();
    }
  }
}

/** Base64 without the `data:*;base64,` prefix — the contract wants raw bytes. */
async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
