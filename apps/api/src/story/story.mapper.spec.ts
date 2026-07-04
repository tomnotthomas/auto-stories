import { shapeFrames } from './story.mapper';

const ids = new Set(['a', 'b', 'c']);

describe('shapeFrames', () => {
  it('keeps valid frames, sorts by order, and renumbers 1..n', () => {
    const raw = [
      { photoId: 'c', order: 5, caption: 'last' },
      { photoId: 'a', order: 2, caption: 'first' },
    ];
    expect(shapeFrames(raw, ids)).toEqual([
      { photoId: 'a', order: 1, caption: 'first' },
      { photoId: 'c', order: 2, caption: 'last' },
    ]);
  });

  it('drops frames whose photoId was not in the request', () => {
    const raw = [
      { photoId: 'a', order: 1, caption: 'keep' },
      { photoId: 'zzz', order: 2, caption: 'hallucinated' },
    ];
    expect(shapeFrames(raw, ids).map((f) => f.photoId)).toEqual(['a']);
  });

  it('drops frames with an empty or whitespace caption', () => {
    const raw = [
      { photoId: 'a', order: 1, caption: '   ' },
      { photoId: 'b', order: 2, caption: 'real' },
    ];
    expect(shapeFrames(raw, ids).map((f) => f.photoId)).toEqual(['b']);
  });

  it('dedupes a repeated photoId, keeping the earliest order', () => {
    const raw = [
      { photoId: 'a', order: 3, caption: 'later' },
      { photoId: 'a', order: 1, caption: 'earlier' },
    ];
    expect(shapeFrames(raw, ids)).toEqual([
      { photoId: 'a', order: 1, caption: 'earlier' },
    ]);
  });

  it('ignores malformed entries (missing/mistyped fields)', () => {
    const raw = [
      { photoId: 'a', caption: 'no order' },
      { photoId: 'b', order: 'nan', caption: 'bad order' },
      { order: 1, caption: 'no id' },
      'not an object',
      { photoId: 'c', order: 1, caption: 'good' },
    ];
    expect(shapeFrames(raw, ids).map((f) => f.photoId)).toEqual(['c']);
  });

  it('returns an empty array when nothing is usable', () => {
    expect(shapeFrames('not an array', ids)).toEqual([]);
    expect(shapeFrames([], ids)).toEqual([]);
  });
});
