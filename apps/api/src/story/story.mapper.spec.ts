import { shapeFrames } from './story.mapper';
import { DEFAULT_STYLE } from './caption-style';

const ids = new Set(['a', 'b', 'c']);

/** The single text block the mapper synthesizes from a caption when the model
 * gives no `texts` — the caption mirrored with the default (letterbox-less) style. */
function textFallback(text: string) {
  return {
    text,
    font: DEFAULT_STYLE.font,
    weight: DEFAULT_STYLE.weight,
    case: DEFAULT_STYLE.case,
    align: DEFAULT_STYLE.align,
    size: DEFAULT_STYLE.size,
    position: DEFAULT_STYLE.position,
  };
}

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
        style: DEFAULT_STYLE,
        texts: [textFallback('first')],
        suggestions: [],
      },
      {
        photoId: 'c',
        order: 2,
        caption: 'last',
        style: DEFAULT_STYLE,
        texts: [textFallback('last')],
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
        style: DEFAULT_STYLE,
        texts: [textFallback('earlier')],
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

  it('falls back to a single caption block when the model gives no texts', () => {
    const raw = [{ photoId: 'a', order: 1, caption: 'golden hour' }];
    expect(shapeFrames(raw, ids)[0].texts).toEqual([
      textFallback('golden hour'),
    ]);
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
