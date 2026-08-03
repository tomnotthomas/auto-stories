import {
  DEFAULT_LOOK,
  DEFAULT_STYLE,
  MAX_SUGGESTIONS_PER_FRAME,
  MAX_TEXT_BLOCKS,
  normalizeLook,
  normalizeStyle,
  normalizeSuggestions,
  normalizeTexts,
} from './caption-style';

describe('normalizeSuggestions', () => {
  it('returns [] for a missing or non-array value', () => {
    expect(normalizeSuggestions(undefined)).toEqual([]);
    expect(normalizeSuggestions(null)).toEqual([]);
    expect(normalizeSuggestions('nope')).toEqual([]);
    expect(normalizeSuggestions({})).toEqual([]);
  });

  it('keeps a valid placed suggestion with its position', () => {
    const out = normalizeSuggestions([
      {
        type: 'location',
        query: 'Blue Bottle Coffee',
        position: 'bottom-left',
        confidence: 0.9,
      },
    ]);
    expect(out).toEqual([
      {
        type: 'location',
        query: 'Blue Bottle Coffee',
        position: 'bottom-left',
        confidence: 0.9,
      },
    ]);
  });

  it('drops the position for music (story-level, not placed)', () => {
    const [music] = normalizeSuggestions([
      {
        type: 'music',
        query: 'warm indie folk',
        position: 'top-right',
        confidence: 0.7,
      },
    ]);
    expect(music.type).toBe('music');
    expect(music.position).toBeUndefined();
  });

  it('drops items with an invalid type or empty query', () => {
    expect(
      normalizeSuggestions([
        { type: 'sticker', query: 'x', confidence: 0.5 }, // invalid type
        { type: 'location', query: '   ', confidence: 0.5 }, // empty query
        { type: 'gif', confidence: 0.5 }, // missing query
      ]),
    ).toEqual([]);
  });

  it('clamps confidence to [0,1] and defaults a non-numeric one', () => {
    const out = normalizeSuggestions([
      {
        type: 'poll',
        query: 'Cake or pie?',
        position: 'top-center',
        confidence: 5,
      },
      { type: 'gif', query: 'cake', position: 'top-left', confidence: 'high' },
    ]);
    expect(out[0].confidence).toBe(1);
    expect(out[1].confidence).toBeGreaterThanOrEqual(0);
    expect(out[1].confidence).toBeLessThanOrEqual(1);
  });

  it('falls back to a default position for a placed type with an invalid one', () => {
    const [s] = normalizeSuggestions([
      {
        type: 'location',
        query: 'Dolores Park',
        position: 'middle',
        confidence: 0.8,
      },
    ]);
    expect(s.position).toBe('bottom-center');
  });

  it('caps the number of suggestions per frame', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      type: 'gif',
      query: `q${i}`,
      position: 'top-left',
      confidence: 0.5,
    }));
    expect(normalizeSuggestions(many)).toHaveLength(MAX_SUGGESTIONS_PER_FRAME);
  });
});

describe('normalizeStyle', () => {
  it('passes a fully valid style through unchanged', () => {
    const style = {
      font: 'playfair',
      weight: 'bold',
      case: 'upper',
      align: 'left',
      size: 'l',
      position: 'top-right',
      letterbox: 'solid',
    };
    expect(normalizeStyle(style)).toEqual(style);
  });

  it('fills every field with a default when the model returns nothing', () => {
    expect(normalizeStyle(undefined)).toEqual(DEFAULT_STYLE);
    expect(normalizeStyle(null)).toEqual(DEFAULT_STYLE);
    expect(normalizeStyle({})).toEqual(DEFAULT_STYLE);
    expect(normalizeStyle('not an object')).toEqual(DEFAULT_STYLE);
  });

  it('replaces individual invalid values with their default, keeps valid ones', () => {
    const raw = {
      font: 'comic-sans', // invalid → default
      weight: 'bold', // valid → kept
      case: 'SHOUT', // invalid → default
      align: 'right', // valid → kept
      size: 'xl', // invalid → default
      position: 'middle', // invalid → default
      letterbox: 'blur', // valid → kept
    };
    expect(normalizeStyle(raw)).toEqual({
      font: DEFAULT_STYLE.font,
      weight: 'bold',
      case: DEFAULT_STYLE.case,
      align: 'right',
      size: DEFAULT_STYLE.size,
      position: DEFAULT_STYLE.position,
      letterbox: 'blur',
    });
  });

  it('ignores a wrongly-typed value (number/object) and uses the default', () => {
    expect(normalizeStyle({ font: 3, size: { s: true } })).toMatchObject({
      font: DEFAULT_STYLE.font,
      size: DEFAULT_STYLE.size,
    });
  });
});

describe('normalizeTexts', () => {
  it('returns [] when the model gives no texts (the caption alone)', () => {
    expect(normalizeTexts(undefined, DEFAULT_STYLE)).toEqual([]);
    expect(normalizeTexts(null, DEFAULT_STYLE)).toEqual([]);
    expect(normalizeTexts('nope', DEFAULT_STYLE)).toEqual([]);
    expect(normalizeTexts([], DEFAULT_STYLE)).toEqual([]);
  });

  it("keeps the model's blocks, per-field defaulted, trimming the text", () => {
    const blocks = normalizeTexts(
      [
        {
          text: '  we ate  ',
          font: 'playfair',
          size: 'l',
          position: 'top-right',
        },
      ],
      DEFAULT_STYLE,
    );
    expect(blocks).toEqual([
      {
        text: 'we ate',
        font: 'playfair',
        weight: DEFAULT_STYLE.weight,
        case: DEFAULT_STYLE.case,
        align: DEFAULT_STYLE.align,
        size: 'l',
        position: 'top-right',
      },
    ]);
  });

  it('drops empty-text blocks and caps the count', () => {
    const blocks = normalizeTexts(
      [
        { text: 'one', font: 'inter' },
        { text: '   ' }, // dropped
        { text: 'two' },
        { text: 'three' }, // beyond the cap
      ],
      DEFAULT_STYLE,
    );
    expect(blocks.map((b) => b.text)).toEqual(['one', 'two']);
    expect(blocks.length).toBeLessThanOrEqual(MAX_TEXT_BLOCKS);
  });

  it('invalid style values on a block fall back to the frame style', () => {
    const [block] = normalizeTexts(
      [{ text: 'x', font: 'comic-sans', size: 'xxl' }],
      DEFAULT_STYLE,
    );
    expect(block.font).toBe(DEFAULT_STYLE.font);
    expect(block.size).toBe(DEFAULT_STYLE.size);
  });
});

describe('normalizeLook', () => {
  it('keeps each of the six Look ids', () => {
    for (const look of [
      'quiet-editorial',
      'film-postcard',
      'bold-poster',
      'scrapbook',
      'minimal',
      'magazine-masthead',
    ]) {
      expect(normalizeLook(look)).toBe(look);
    }
  });

  it('falls back to the default Look when the model omits it', () => {
    expect(normalizeLook(undefined)).toBe(DEFAULT_LOOK);
    expect(normalizeLook(null)).toBe(DEFAULT_LOOK);
  });

  it('falls back to the default Look for a value outside the set', () => {
    expect(normalizeLook('polaroid')).toBe(DEFAULT_LOOK);
    expect(normalizeLook(7)).toBe(DEFAULT_LOOK);
    expect(normalizeLook({ look: 'minimal' })).toBe(DEFAULT_LOOK);
  });
});
