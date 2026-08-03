import { DEFAULT_ACCENT } from '../accent-color';
import {
  DENSITIES,
  DENSITY_WORDS,
  textParts,
  wordBudget,
  type Density,
  type DensityRamp,
  type FrameContent,
  type HasParts,
  type Look,
  type PhotoAnalysis,
  type TextPart,
} from '../look';

import { MARKER, MARKER_RAMP } from './marker';
import { SPLIT_BLOCK, SPLIT_BLOCK_RAMP } from './split-block';
import { STENCIL_CAPS, STENCIL_CAPS_RAMP } from './stencil-caps';
import { TICKER, TICKER_RAMP } from './ticker';

/**
 * The loud, graphic end of the catalogue: Split Block, Ticker, Stencil Caps and
 * Marker. The four share a shape — a panel or a mark carries the accent — so the
 * contract every Look must honour is asserted once over all of them, and each
 * Look then gets the one test that says what makes it that Look.
 *
 * Behaviour only: nothing here asserts a size, a colour or a typeface, because
 * those are design choices that should be free to move without a red test.
 */

const CALM: PhotoAnalysis = {
  accent: DEFAULT_ACCENT,
  bands: { top: 0.1, middle: 0.1, bottom: 0.1 },
};

const BUSY: PhotoAnalysis = {
  accent: 'rgb(1, 2, 3)',
  bands: { top: 0.95, middle: 0.95, bottom: 0.95 },
};

const CONTENT: FrameContent = {
  kicker: 'Night two',
  headline: 'Everyone made it to the roof',
  emphasis: 'made it',
  location: 'Lisbon',
};

/** More words than any of these Looks is designed for. */
const LONG_HEADLINE = 'Everyone made it to the roof before the sun came up over the whole city';

/** Every awkward frame the model can hand a Look. None may throw. */
const EDGE_CASES: readonly FrameContent[] = [
  { headline: 'Just the headline' },
  { headline: 'No emphasis here', kicker: 'Day one' },
  { headline: 'Emphasis nowhere in sight', emphasis: 'absent' },
  { headline: 'A place but nothing else', location: 'Porto' },
  { headline: 'x' },
  { headline: LONG_HEADLINE },
  { headline: '   ' },
  { headline: '', kicker: 'Night two', emphasis: 'made it', location: 'Lisbon' },
];

const LOOKS: readonly Look[] = [SPLIT_BLOCK, TICKER, STENCIL_CAPS, MARKER];

/**
 * Each Look's published ramp (7.26): what it sets, and how much it can carry, at
 * every rung. A Look declaring a budget it does not compose to would be worse
 * than no budget at all — the model would be told a number the design ignores —
 * so the ramp is asserted against what `compose` actually returns.
 */
const RAMPS: Record<string, DensityRamp> = {
  'split-block': SPLIT_BLOCK_RAMP,
  ticker: TICKER_RAMP,
  'stencil-caps': STENCIL_CAPS_RAMP,
  marker: MARKER_RAMP,
};

/** The three rungs that carry words, in the order they take more of them. */
const GROWING: readonly Density[] = ['beat', 'line', 'thought'];

/**
 * The frames that separate a Look which draws the place from one which does not
 * — including the two that trip a Look up: a missing kicker (several Looks put
 * the place in its slot) and a silent frame (nothing is drawn at all).
 */
const LOCATION_CASES: [string, FrameContent][] = [
  ['a normal frame', CONTENT],
  ['a frame with no kicker', { ...CONTENT, kicker: undefined }],
  ['a frame with no place', { ...CONTENT, location: undefined }],
  ['a silent frame', { ...CONTENT, headline: '' }],
];

describe.each(LOOKS.map((look) => [look.id, look] as const))('%s', (id, look) => {
  it('carries the id the contract names it by', () => {
    expect(look.id).toBe(id);
  });

  it('wants at least one band, best first', () => {
    expect(look.prefer.length).toBeGreaterThan(0);
  });

  it('composes the headline into the frame', () => {
    const composition = look.compose(CONTENT, CALM);

    expect(composition.lookId).toBe(id);
    expect(composition.parts.length).toBeGreaterThan(0);
    expect(headlineOf(composition.parts)).toBe(CONTENT.headline);
  });

  it('keeps the type column inside the frame', () => {
    for (const photo of [CALM, BUSY]) {
      const { leftPct, rightPct } = look.compose(CONTENT, photo);

      expect(leftPct).toBeGreaterThan(0);
      expect(rightPct).toBeGreaterThan(0);
      expect(leftPct + rightPct).toBeLessThan(50);
    }
  });

  it('hangs the stack off an edge the frame has', () => {
    const { anchor, offsetHPct } = look.compose(CONTENT, CALM);

    expect(['top', 'bottom']).toContain(anchor);
    expect(offsetHPct).toBeGreaterThanOrEqual(0);
    expect(offsetHPct).toBeLessThan(100);
  });

  it('passes the photo’s accent through untouched', () => {
    expect(look.compose(CONTENT, BUSY).accent).toBe('rgb(1, 2, 3)');
  });

  it('composes a silent frame to nothing at all', () => {
    // No words is a real editorial choice (7.26), and an accent slab with
    // nothing in it is the worst frame this end of the catalogue can produce.
    for (const headline of ['', '   ', '\n']) {
      const composition = look.compose({ ...CONTENT, headline }, CALM);

      expect(composition.parts).toEqual([]);
      expect(composition.scrim).toBeNull();
      expect(composition.panel).toBeUndefined();
      expect(composition.border).toBeUndefined();
    }
  });

  it('never throws, whatever the model wrote', () => {
    for (const content of EDGE_CASES) {
      for (const photo of [CALM, BUSY]) {
        expect(() => look.compose(content, photo)).not.toThrow();
      }
    }
  });

  it('marks at most one run, and only a phrase that is in the headline', () => {
    // One mark per frame (7.23).
    const marked = textParts(look.compose(CONTENT, CALM))
      .flatMap((part) => part.runs)
      .filter((run) => run.emphasised);

    expect(marked.length).toBeLessThanOrEqual(1);
    for (const run of marked) expect(CONTENT.headline).toContain(run.text);
  });

  // 7.25: the place must render once. A Look that sets it in its own design
  // says so, and the sticker layer then suppresses the duplicate — so the flag
  // has to describe THIS call, not what the Look does in general.
  it.each(LOCATION_CASES)(
    'flags the place as consumed for %s only when it set the place itself',
    (_case, content) => {
      const composition = look.compose(content, CALM);
      const place = content.location?.trim() ?? '';
      const drawn = place !== '' && everyWord(composition).includes(place);

      expect(composition.consumedLocation ?? false).toBe(drawn);
    },
  );

  it('is deterministic', () => {
    expect(look.compose(CONTENT, CALM)).toEqual(look.compose(CONTENT, CALM));
  });

  // 7.26: `thought` has to land in a visibly different slot from the rungs above
  // it, or the model collapses the two. Same words either side, so the only
  // thing that can move the type is the density the creator stated.
  it('sets a thought visibly smaller than a beat', () => {
    const beat = displayWPct(look.compose({ ...CONTENT, density: 'beat' }, CALM));
    const thought = displayWPct(look.compose({ ...CONTENT, density: 'thought' }, CALM));

    expect(thought).toBeLessThan(beat * 0.8);
  });

  // Every Look in this file, not just the two that grew a ramp first: a Look
  // whose type does not move with the rung has made the rung decorative, and the
  // model's `density` then buys the frame nothing.
  it('steps its type down rung by rung, as the words take more room', () => {
    const sizes = GROWING.map(
      (density) => headlinePart(look.compose({ ...CONTENT, density }, CALM).parts)?.fontSizeWPct,
    );

    expect(sizes[0]).toBeGreaterThan(sizes[1]!);
    expect(sizes[1]).toBeGreaterThan(sizes[2]!);
  });

  // The other half of stepping down. Type that shrinks on locked-up display
  // leading reads as a shrunken headline, not as something written to be read —
  // so the leading has to open on the way down as well.
  it('opens its leading as the rung grows', () => {
    const leading = GROWING.map(
      (density) => headlinePart(look.compose({ ...CONTENT, density }, CALM).parts)?.lineHeight,
    );

    expect(leading[1]).toBeGreaterThan(leading[0]!);
    expect(leading[2]).toBeGreaterThan(leading[1]!);
  });

  it('sizes to the stated density rather than to the headline’s length', () => {
    // A deliberately short `thought` is still set as a thought, and a long
    // headline the creator called a `beat` is still set as a beat (7.26).
    const stated = look.compose({ headline: LONG_HEADLINE, density: 'beat' }, CALM);
    const inferred = look.compose({ headline: LONG_HEADLINE }, CALM);

    expect(headlinePart(stated.parts)?.fontSizeWPct).toBeGreaterThan(
      headlinePart(inferred.parts)!.fontSizeWPct,
    );
  });

  // 7.26's missing half: the rung says how much the creator wants to say, and
  // this says how much THIS design can hold before it stops being itself.
  it('publishes a word budget for every rung', () => {
    const ramp = RAMPS[id];

    for (const density of DENSITIES) {
      const budget = wordBudget(ramp, density);

      expect(budget).toBeGreaterThanOrEqual(0);
      // A Look may hold less than the rung allows; it may never claim more,
      // because the words are written to the rung and not to the design.
      expect(budget).toBeLessThanOrEqual(DENSITY_WORDS[density].max);
    }
    expect(wordBudget(ramp, 'silent')).toBe(0);
  });

  it('carries more words as its type comes down', () => {
    const ramp = RAMPS[id];
    const budgets = GROWING.map((density) => wordBudget(ramp, density));

    expect(budgets[1]).toBeGreaterThan(budgets[0]);
    expect(budgets[2]).toBeGreaterThan(budgets[1]);
  });

  it('claims a thought budget it can honestly set', () => {
    // The whole point of the number: 15–35 words is what the creator may write,
    // and no Look in this group can set the top of that and still look like
    // itself. A budget equal to the ceiling would be a Look that never says no.
    const budget = wordBudget(RAMPS[id], 'thought');

    expect(budget).toBeGreaterThan(0);
    expect(budget).toBeLessThan(DENSITY_WORDS.thought.max);
  });

  it('composes each rung at the size its own ramp publishes', () => {
    // Keeps the published budget honest: the ramp the model is briefed from has
    // to be the ramp the design draws with.
    for (const density of DENSITIES) {
      const headline = headlinePart(look.compose({ ...CONTENT, density }, CALM).parts);

      expect(headline?.fontSizeWPct).toBe(RAMPS[id][density].fontSizeWPct);
      expect(headline?.lineHeight).toBe(RAMPS[id][density].lineHeight);
    }
  });
});

describe('word budgets across the loud group', () => {
  // Each Look is judged from its own measure, so the numbers must differ: a
  // ticker bar, an album slab and a screen print do not hold the same passage,
  // and one number copied across four would mean nobody measured.
  it('gives each Look a thought budget read off its own measure', () => {
    const budgets = LOOKS.map((look) => wordBudget(RAMPS[look.id], 'thought'));

    expect(new Set(budgets).size).toBe(LOOKS.length);
  });

  it('lets the screen print carry the least of the graphic Looks', () => {
    // Outlined, centred, tracked capitals are the most expensive setting here.
    const stencil = wordBudget(STENCIL_CAPS_RAMP, 'thought');

    expect(stencil).toBeLessThan(wordBudget(TICKER_RAMP, 'thought'));
    expect(stencil).toBeLessThan(wordBudget(SPLIT_BLOCK_RAMP, 'thought'));
    expect(stencil).toBeLessThan(wordBudget(MARKER_RAMP, 'thought'));
  });

  it('keeps the ticker to the shallow bar its budget is set by', () => {
    // A lower third is one line of type, two at the most; a rung that could run
    // to three has stopped being a ticker.
    expect(wordBudget(TICKER_RAMP, 'thought')).toBeLessThan(
      wordBudget(SPLIT_BLOCK_RAMP, 'thought'),
    );
    expect(wordBudget(TICKER_RAMP, 'line')).toBeLessThan(DENSITY_WORDS.line.max);
  });
});

describe('split-block', () => {
  it('lays an accent panel for the words to reverse out of', () => {
    const composition = SPLIT_BLOCK.compose(CONTENT, CALM);

    expect(composition.panel?.color).toBe('accent');
    expect(composition.panel?.fullWidth).toBe(true);
  });

  it('states its own ink polarity rather than reading the photo', () => {
    // The panel is opaque, so what is behind the words is the panel, not the
    // photo — `auto` would answer the wrong question.
    expect(SPLIT_BLOCK.compose(CONTENT, CALM).ink).not.toBe('auto');
  });
});

describe('ticker', () => {
  it('lays a full-width accent bar the words sit inside', () => {
    const composition = TICKER.compose(CONTENT, CALM);

    expect(composition.panel?.color).toBe('accent');
    expect(composition.panel?.fullWidth).toBe(true);
  });

  it('states its own ink polarity rather than reading the photo', () => {
    expect(TICKER.compose(CONTENT, CALM).ink).not.toBe('auto');
  });

  it('drops the strip when there is neither kicker nor location', () => {
    const bare = TICKER.compose({ headline: CONTENT.headline }, CALM);

    expect(bare.parts.filter((part) => part.kind === 'row')).toHaveLength(0);
    expect(bare.parts.length).toBeGreaterThan(0);
  });
});

describe('ticker', () => {
  it('steps its type down rung by rung, so the bar stays thin', () => {
    // The bar IS the Look, and it grows with the words: at one size a thought
    // wraps to four lines and the ticker becomes a caption block. This used to
    // be guessed from the headline's character count; the density is the
    // creator saying how much the frame carries, which is the better thing to
    // size to — a deliberately short thought is still set as a thought (7.26).
    const sizes = (['beat', 'line', 'thought'] as const).map(
      (density) => headlinePart(TICKER.compose({ ...CONTENT, density }, CALM).parts)?.fontSizeWPct,
    );

    expect(sizes[0]).toBeGreaterThan(sizes[1]!);
    expect(sizes[1]).toBeGreaterThan(sizes[2]!);
  });

  it('sizes to the stated density rather than to the headline’s length', () => {
    const stated = TICKER.compose({ headline: LONG_HEADLINE, density: 'beat' }, CALM);
    const inferred = TICKER.compose({ headline: LONG_HEADLINE }, CALM);

    expect(headlinePart(stated.parts)?.fontSizeWPct).toBeGreaterThan(
      headlinePart(inferred.parts)!.fontSizeWPct,
    );
  });
});

describe('stencil-caps', () => {
  it('outlines the headline instead of filling it', () => {
    const headline = headlinePart(STENCIL_CAPS.compose(CONTENT, CALM).parts);

    expect(headline?.stroke).toBe(true);
  });

  it('sets no panel — the outline is the whole graphic', () => {
    expect(STENCIL_CAPS.compose(CONTENT, CALM).panel).toBeUndefined();
  });

  it('steps the type down rung by rung', () => {
    // Type this big fits about seven capitals to a line, so a thought set at the
    // beat size runs off the top of the frame. This used to be guessed from the
    // headline's character count; it now follows the density the creator stated,
    // so the same words are set differently when they are meant differently
    // (7.26).
    const sizes = (['beat', 'line', 'thought'] as const).map(
      (density) =>
        headlinePart(STENCIL_CAPS.compose({ ...CONTENT, density }, CALM).parts)?.fontSizeWPct ?? 0,
    );

    expect(sizes[0]).toBeGreaterThan(sizes[1]);
    expect(sizes[1]).toBeGreaterThan(sizes[2]);
  });

  it('keeps the headline the largest type in the frame, even stepped down', () => {
    const composition = STENCIL_CAPS.compose(
      { ...CONTENT, headline: LONG_HEADLINE, density: 'thought' },
      CALM,
    );
    const headline = headlinePart(composition.parts);

    for (const part of textParts(composition)) {
      if (part === headline) continue;
      expect(headline?.fontSizeWPct).toBeGreaterThan(part.fontSizeWPct);
    }
  });
});

describe('marker', () => {
  it('swipes the emphasised phrase with a highlighter', () => {
    const marked = textParts(MARKER.compose(CONTENT, CALM)).filter((part) => part.mark);

    expect(marked.map((part) => part.mark)).toEqual(['highlighter']);
  });

  it('drops the swipe when the emphasis is not in the headline', () => {
    // A swipe with nothing under it draws as a stray bar on the photo.
    for (const content of [
      { headline: CONTENT.headline },
      { headline: CONTENT.headline, emphasis: 'nowhere near it' },
      { headline: CONTENT.headline, emphasis: '   ' },
    ]) {
      const marked = textParts(MARKER.compose(content, CALM)).filter((part) => part.mark);

      expect(marked).toHaveLength(0);
    }
  });
});

/** Every word a composition draws — text runs, tags and rows alike. */
function everyWord(composition: HasParts): string {
  return composition.parts
    .map((part) => {
      if (part.kind === 'text') return part.runs.map((run) => run.text).join('');
      if (part.kind === 'tag') return part.text;
      if (part.kind === 'row') return `${part.left} ${part.right}`;
      return '';
    })
    .join(' ');
}

/**
 * The largest type in the frame, whatever kind of part carries it. Every Look
 * here sets its headline largest, so this is the headline's size without a test
 * having to know which part a given Look reaches for.
 */
function displayWPct(composition: HasParts): number {
  return Math.max(
    ...composition.parts.map((part) => (part.kind === 'rule' ? 0 : part.fontSizeWPct)),
  );
}

/** The composed headline, runs rejoined — what the reader actually sees. */
function headlineOf(parts: readonly { kind: string }[]): string | undefined {
  const headline = headlinePart(parts);
  return headline?.runs.map((run) => run.text).join('');
}

/** The widest text part: every Look in this set sets the headline largest. */
function headlinePart(parts: readonly { kind: string }[]): TextPart | undefined {
  const texts = parts.filter((part): part is TextPart => part.kind === 'text');
  return texts.reduce<TextPart | undefined>(
    (widest, part) => (!widest || part.fontSizeWPct > widest.fontSizeWPct ? part : widest),
    undefined,
  );
}
