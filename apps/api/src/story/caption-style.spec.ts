import {
  DEFAULT_LOOK,
  DENSITIES,
  MAX_SUGGESTIONS_PER_FRAME,
  normalizeDensity,
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

  // Decision 7.25: the client places every add-on from the free space the
  // design leaves, so a zone the model emits is not just unused — it was never
  // informed by the photo. It must not cross the boundary.
  it('keeps a valid suggestion and drops any placement the model sent', () => {
    const out = normalizeSuggestions([
      {
        type: 'location',
        query: 'Blue Bottle Coffee',
        position: 'bottom-left',
        confidence: 0.9,
      },
    ]);
    expect(out).toEqual([
      { type: 'location', query: 'Blue Bottle Coffee', confidence: 0.9 },
    ]);
  });

  it('keeps every suggestion type, none of them placed', () => {
    const out = normalizeSuggestions(
      ['location', 'mention', 'gif', 'poll', 'music'].map((type) => ({
        type,
        query: 'q',
        confidence: 0.7,
      })),
    );
    // Capped per frame, so assert on what survives the cap.
    expect(out).toHaveLength(MAX_SUGGESTIONS_PER_FRAME);
    for (const type of ['location', 'mention', 'gif', 'poll', 'music']) {
      const [only] = normalizeSuggestions([
        { type, query: 'q', confidence: 1 },
      ]);
      expect(only).toEqual({ type, query: 'q', confidence: 1 });
    }
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

  it('drops entries that are not objects at all', () => {
    expect(normalizeSuggestions([null, 'location', 7])).toEqual([]);
  });

  it('clamps confidence to [0,1] and defaults a non-numeric one', () => {
    const out = normalizeSuggestions([
      { type: 'poll', query: 'Cake or pie?', confidence: 5 },
      { type: 'gif', query: 'cake', confidence: 'high' },
    ]);
    expect(out[0].confidence).toBe(1);
    expect(out[1].confidence).toBeGreaterThanOrEqual(0);
    expect(out[1].confidence).toBeLessThanOrEqual(1);
  });

  it('caps the number of suggestions per frame', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      type: 'gif',
      query: `q${i}`,
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

describe('normalizeDensity', () => {
  it('offers the five rungs the client can set', () => {
    expect(DENSITIES).toEqual([
      'silent',
      'beat',
      'line',
      'thought',
      'question',
    ]);
  });

  it('keeps each of the five densities', () => {
    for (const density of DENSITIES) {
      expect(normalizeDensity(density)).toBe(density);
    }
  });

  // Decision 7.26: absent means "read it from the headline". An unrecognised
  // value is dropped to that same fallback rather than crossing the boundary.
  it('drops a value outside the set, so the client infers instead', () => {
    expect(normalizeDensity('paragraph')).toBeUndefined();
    expect(normalizeDensity('')).toBeUndefined();
    expect(normalizeDensity(3)).toBeUndefined();
    expect(normalizeDensity({ density: 'beat' })).toBeUndefined();
  });

  it('drops a missing value', () => {
    expect(normalizeDensity(undefined)).toBeUndefined();
    expect(normalizeDensity(null)).toBeUndefined();
  });
});
