import { shapeFrames } from './story.mapper';

const ids = new Set(['a', 'b', 'c']);

describe('shapeFrames', () => {
  it('keeps valid frames, sorts by order, and renumbers 1..n', () => {
    const raw = [
      { photoId: 'c', order: 5, headline: 'last' },
      { photoId: 'a', order: 2, headline: 'first' },
    ];
    expect(shapeFrames(raw, ids)).toEqual([
      { photoId: 'a', order: 1, headline: 'first', suggestions: [] },
      { photoId: 'c', order: 2, headline: 'last', suggestions: [] },
    ]);
  });

  it('drops frames whose photoId was not in the request', () => {
    const raw = [
      { photoId: 'a', order: 1, headline: 'keep' },
      { photoId: 'zzz', order: 2, headline: 'hallucinated' },
    ];
    expect(shapeFrames(raw, ids).map((f) => f.photoId)).toEqual(['a']);
  });

  // The headline is the frame's only text (7.25), so there is nothing to fall
  // back to — a frame without one cannot be composed and is dropped.
  it('drops a frame whose headline is missing, blank or not a string', () => {
    const raw = [
      { photoId: 'a', order: 1 },
      { photoId: 'b', order: 2, headline: '   ' },
      { photoId: 'c', order: 3, headline: 'real' },
    ];
    expect(shapeFrames(raw, ids).map((f) => f.photoId)).toEqual(['c']);
    expect(
      shapeFrames([{ photoId: 'a', order: 1, headline: 42 }], ids),
    ).toEqual([]);
  });

  it('trims the headline', () => {
    const raw = [{ photoId: 'a', order: 1, headline: '  Golden hour  ' }];
    expect(shapeFrames(raw, ids)[0].headline).toBe('Golden hour');
  });

  it('dedupes a repeated photoId, keeping the earliest order', () => {
    const raw = [
      { photoId: 'a', order: 3, headline: 'later' },
      { photoId: 'a', order: 1, headline: 'earlier' },
    ];
    expect(shapeFrames(raw, ids)).toEqual([
      { photoId: 'a', order: 1, headline: 'earlier', suggestions: [] },
    ]);
  });

  it('threads and normalizes per-frame suggestions', () => {
    const raw = [
      {
        photoId: 'a',
        order: 1,
        headline: 'brunch',
        suggestions: [
          {
            type: 'location',
            query: 'Tartine',
            position: 'bottom-left',
            confidence: 0.9,
          },
          { type: 'sticker', query: 'invalid type', confidence: 0.5 },
        ],
      },
    ];
    expect(shapeFrames(raw, ids)[0].suggestions).toEqual([
      {
        type: 'location',
        query: 'Tartine',
        position: 'bottom-left',
        confidence: 0.9,
      },
    ]);
  });

  it("threads the model's kicker and emphasis, trimmed", () => {
    const raw = [
      {
        photoId: 'a',
        order: 1,
        kicker: '  Day two  ',
        headline: '  Golden hour  ',
        emphasis: ' Golden ',
      },
    ];
    expect(shapeFrames(raw, ids)[0]).toMatchObject({
      kicker: 'Day two',
      headline: 'Golden hour',
      emphasis: 'Golden',
    });
  });

  it('omits kicker and emphasis when the model gives none', () => {
    const frame = shapeFrames(
      [{ photoId: 'a', order: 1, headline: 'golden hour' }],
      ids,
    )[0];
    expect(frame.kicker).toBeUndefined();
    expect(frame.emphasis).toBeUndefined();
  });

  it('drops an emphasis that does not occur in the headline', () => {
    const raw = [
      {
        photoId: 'a',
        order: 1,
        headline: 'Golden hour',
        emphasis: 'sunset',
      },
    ];
    expect(shapeFrames(raw, ids)[0].emphasis).toBeUndefined();
  });

  it('keeps an emphasis that occurs in the headline, ignoring case', () => {
    const raw = [
      {
        photoId: 'a',
        order: 1,
        headline: 'Golden hour',
        emphasis: 'GOLDEN',
      },
    ];
    expect(shapeFrames(raw, ids)[0].emphasis).toBe('GOLDEN');
  });

  it('ignores malformed entries (missing/mistyped fields)', () => {
    const raw = [
      { photoId: 'a', headline: 'no order' },
      { photoId: 'b', order: 'nan', headline: 'bad order' },
      { order: 1, headline: 'no id' },
      'not an object',
      { photoId: 'c', order: 1, headline: 'good' },
    ];
    expect(shapeFrames(raw, ids).map((f) => f.photoId)).toEqual(['c']);
  });

  it('returns an empty array when nothing is usable', () => {
    expect(shapeFrames('not an array', ids)).toEqual([]);
    expect(shapeFrames([], ids)).toEqual([]);
  });
});
