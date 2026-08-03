import { shapeFrames } from './story.mapper';
import { DEFAULT_STYLE } from './caption-style';

const ids = new Set(['a', 'b', 'c']);

describe('shapeFrames', () => {
  it('keeps valid frames, sorts by order, and renumbers 1..n', () => {
    const raw = [
      { photoId: 'c', order: 5, caption: 'last' },
      { photoId: 'a', order: 2, caption: 'first' },
    ];
    expect(shapeFrames(raw, ids)).toEqual([
      {
        photoId: 'a',
        order: 1,
        caption: 'first',
        headline: 'first',
        style: DEFAULT_STYLE,
        texts: [],
        suggestions: [],
      },
      {
        photoId: 'c',
        order: 2,
        caption: 'last',
        headline: 'last',
        style: DEFAULT_STYLE,
        texts: [],
        suggestions: [],
      },
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
      {
        photoId: 'a',
        order: 1,
        caption: 'earlier',
        headline: 'earlier',
        style: DEFAULT_STYLE,
        texts: [],
        suggestions: [],
      },
    ]);
  });

  it("threads the model's placed text blocks when present", () => {
    const raw = [
      {
        photoId: 'a',
        order: 1,
        caption: 'we ate everything',
        texts: [
          {
            text: 'we ate',
            font: 'playfair',
            weight: 'bold',
            case: 'normal',
            align: 'right',
            size: 'l',
            position: 'top-right',
          },
          {
            text: 'brunch · Tartine',
            font: 'inter',
            weight: 'regular',
            case: 'normal',
            align: 'left',
            size: 's',
            position: 'bottom-left',
          },
          { text: '', font: 'inter' }, // empty text dropped, capping at the two valid
        ],
      },
    ];
    expect(shapeFrames(raw, ids)[0].texts).toEqual([
      {
        text: 'we ate',
        font: 'playfair',
        weight: 'bold',
        case: 'normal',
        align: 'right',
        size: 'l',
        position: 'top-right',
      },
      {
        text: 'brunch · Tartine',
        font: 'inter',
        weight: 'regular',
        case: 'normal',
        align: 'left',
        size: 's',
        position: 'bottom-left',
      },
    ]);
  });

  it('has no extra texts when the model gives none', () => {
    const raw = [{ photoId: 'a', order: 1, caption: 'golden hour' }];
    expect(shapeFrames(raw, ids)[0].texts).toEqual([]);
  });

  it('threads and normalizes per-frame suggestions', () => {
    const raw = [
      {
        photoId: 'a',
        order: 1,
        caption: 'brunch',
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

  it("threads the model's kicker, headline and emphasis, trimmed", () => {
    const raw = [
      {
        photoId: 'a',
        order: 1,
        caption: 'the light went gold just before we left',
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

  it('falls back to the caption when the headline is missing or blank', () => {
    const raw = [
      { photoId: 'a', order: 1, caption: 'golden hour' },
      { photoId: 'b', order: 2, caption: 'we swam', headline: '   ' },
      { photoId: 'c', order: 3, caption: 'and ate', headline: 42 },
    ];
    expect(shapeFrames(raw, ids).map((f) => f.headline)).toEqual([
      'golden hour',
      'we swam',
      'and ate',
    ]);
  });

  it('omits kicker and emphasis when the model gives none', () => {
    const frame = shapeFrames(
      [{ photoId: 'a', order: 1, caption: 'golden hour' }],
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
        caption: 'sunset',
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
        caption: 'sunset',
        headline: 'Golden hour',
        emphasis: 'GOLDEN',
      },
    ];
    expect(shapeFrames(raw, ids)[0].emphasis).toBe('GOLDEN');
  });

  it('checks the emphasis against the caption when the headline falls back', () => {
    const raw = [
      { photoId: 'a', order: 1, caption: 'we ate everything', emphasis: 'ate' },
      { photoId: 'b', order: 2, caption: 'we swam', emphasis: 'ate' },
    ];
    const frames = shapeFrames(raw, ids);
    expect(frames[0].emphasis).toBe('ate');
    expect(frames[1].emphasis).toBeUndefined();
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
