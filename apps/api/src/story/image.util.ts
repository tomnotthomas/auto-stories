/** Image formats the app accepts (spec: JPEG/PNG/WebP/HEIC). */
export type ImageType = 'jpeg' | 'png' | 'webp' | 'heic';

/**
 * Identify an image from the leading bytes of its base64 proxy — the server
 * re-check that a non-image didn't slip past the client (spec 4.2). Returns
 * null when the bytes match no supported format.
 */
export function sniffImageType(b64: string): ImageType | null {
  // 24 base64 chars decode to 18 bytes — enough for every magic below.
  const head = Buffer.from(b64.slice(0, 24), 'base64');
  if (head.length < 3) return null;

  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';

  if (
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47
  ) {
    return 'png';
  }

  if (
    head.toString('ascii', 0, 4) === 'RIFF' &&
    head.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }

  // HEIC/HEIF: an ISO-BMFF box with an 'ftyp' header and a heic-family brand.
  if (head.toString('ascii', 4, 8) === 'ftyp') {
    const brand = head.toString('ascii', 8, 12);
    if (['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) {
      return 'heic';
    }
  }

  return null;
}
