import { sniffImageType } from './image.util';

const b64 = (bytes: number[]): string => Buffer.from(bytes).toString('base64');

const JPEG = b64([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = b64([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const HEIC = b64([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);

describe('sniffImageType', () => {
  it('recognises JPEG, PNG, WebP, and HEIC by magic bytes', () => {
    expect(sniffImageType(JPEG)).toBe('jpeg');
    expect(sniffImageType(PNG)).toBe('png');
    expect(sniffImageType(WEBP)).toBe('webp');
    expect(sniffImageType(HEIC)).toBe('heic');
  });

  it('returns null for non-image bytes', () => {
    expect(sniffImageType(b64([0x00, 0x01, 0x02, 0x03]))).toBeNull();
  });

  it('returns null for empty or garbage input', () => {
    expect(sniffImageType('')).toBeNull();
    expect(sniffImageType('not base64 !!!')).toBeNull();
  });
});
