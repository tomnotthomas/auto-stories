import {
  DEFAULT_LOOK,
  DEFAULT_SUGGESTION_POSITION,
  MAX_SUGGESTIONS_PER_FRAME,
  normalizeLook,
  normalizeSuggestions,
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
    expect(s.position).toBe(DEFAULT_SUGGESTION_POSITION);
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
    // `polaroid` used to stand in for an unknown Look; it is a real one now.
    expect(normalizeLook('watercolour')).toBe(DEFAULT_LOOK);
    expect(normalizeLook(7)).toBe(DEFAULT_LOOK);
    expect(normalizeLook({ look: 'minimal' })).toBe(DEFAULT_LOOK);
  });
});
