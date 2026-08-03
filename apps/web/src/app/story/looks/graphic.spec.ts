import { DEFAULT_ACCENT } from '../accent-color';
import {
  DENSITIES,
  textParts,
  wordBudget,
  type Composition,
  type Density,
  type DensityRamp,
  type FrameContent,
  type Look,
  type PhotoAnalysis,
  type RulePart,
  type TextPart,
  type HasParts,
} from '../look';
import { CAPTION_CARD, CAPTION_CARD_RAMP } from './caption-card';
import { CHAPTER, CHAPTER_RAMP } from './chapter';
import { DATELINE, DATELINE_RAMP } from './dateline';
import { DUOTONE_BAND, DUOTONE_BAND_RAMP } from './duotone-band';
import { LETTERBOX, LETTERBOX_RAMP } from './letterbox';

/**
 * The five graphic Looks — the ones whose character comes from something drawn
 * (a band, a bar, a card, a rule) rather than from type alone.
 *
 * Behaviour only: what a Look composes, what it refuses to compose, and what it
 * survives. Nothing here asserts a size or a spacing — those are the design, and
 * a test that pinned them would break on every visual revision.
 */

const PHOTO: PhotoAnalysis = {
  accent: DEFAULT_ACCENT,
  bands: { top: 0.1, middle: 0.1, bottom: 0.1 },
};

/** No band is quiet — every Look has to place its type somewhere anyway. */
const BUSY_PHOTO: PhotoAnalysis = {
  accent: DEFAULT_ACCENT,
  bands: { top: 0.98, middle: 0.98, bottom: 0.98 },
};

const CONTENT: FrameContent = {
  kicker: 'The Ascent',
  headline: 'Where the mountain meets its mirror',
  emphasis: 'mountain',
  location: 'Chamonix',
};

const LOOKS: readonly Look[] = [DUOTONE_BAND, LETTERBOX, CHAPTER, DATELINE, CAPTION_CARD];

/**
 * The frames that separate a Look which draws the place from one which does not
 * — including the two that trip a Look up: a missing kicker (Dateline promotes
 * the place into the kicker's slot) and a silent frame (nothing is drawn).
 */
const LOCATION_CASES: [string, FrameContent][] = [
  ['a normal frame', CONTENT],
  ['a frame with no kicker', { ...CONTENT, kicker: undefined }],
  ['a frame with no place', { ...CONTENT, location: undefined }],
  ['a silent frame', { ...CONTENT, headline: '' }],
];

describe.each(LOOKS.map((look) => [look.id, look] as const))('%s', (id, look) => {
  it('composes the words it was given', () => {
    const composition = look.compose(CONTENT, PHOTO);

    expect(composition.lookId).toBe(id);
    expect(composition.parts.length).toBeGreaterThan(0);
    expect(headlineOf(composition)).toBe(CONTENT.headline);
  });

  it('names at least one band it wants to sit in', () => {
    expect(look.prefer.length).toBeGreaterThan(0);
  });

  it('composes a silent frame to nothing at all', () => {
    // No words is a real choice (7.26): everything a Look draws exists to frame
    // the words, so an empty band, bar or card would read as a broken export.
    for (const headline of ['', '   ']) {
      const composition = look.compose({ ...CONTENT, headline }, PHOTO);

      expect(composition.parts).toEqual([]);
      expect(composition.scrim).toBeNull();
      expect(composition.panel).toBeUndefined();
      expect(composition.border).toBeUndefined();
    }
  });

  it('composes from the headline alone', () => {
    const composition = look.compose({ headline: CONTENT.headline }, PHOTO);

    expect(composition.parts.length).toBeGreaterThan(0);
    expect(headlineOf(composition)).toBe(CONTENT.headline);
  });

  it('never throws on the words the model actually sends', () => {
    const contents: FrameContent[] = [
      CONTENT,
      { headline: CONTENT.headline },
      { headline: CONTENT.headline, kicker: '   ', location: '  ' },
      { headline: CONTENT.headline, emphasis: 'not in this headline' },
      { headline: CONTENT.headline, emphasis: '' },
      { headline: '' },
      { headline: 'x' },
      { kicker: 'The Ascent', headline: CONTENT.headline.repeat(6), emphasis: 'mountain' },
    ];

    for (const content of contents) {
      for (const photo of [PHOTO, BUSY_PHOTO]) {
        expect(() => look.compose(content, photo)).not.toThrow();
      }
    }
  });

  it('drops the kicker part entirely when there is no kicker', () => {
    const composition = look.compose({ ...CONTENT, kicker: undefined }, PHOTO);

    expect(textParts(composition).map(runText).join(' ')).not.toContain(CONTENT.kicker as string);
  });

  it('keeps the type column inside the frame', () => {
    for (const photo of [PHOTO, BUSY_PHOTO]) {
      const { leftPct, rightPct } = look.compose(CONTENT, photo);

      expect(leftPct).toBeGreaterThan(0);
      expect(rightPct).toBeGreaterThan(0);
      expect(leftPct + rightPct).toBeLessThan(50);
    }
  });

  it('marks at most one phrase (7.23)', () => {
    const composition = look.compose(CONTENT, PHOTO);
    const marked = textParts(composition).filter(
      (part) => part.mark && part.runs.some((run) => run.emphasised),
    );

    expect(marked.length).toBeLessThanOrEqual(1);
  });

  it('carries the photo’s accent through', () => {
    expect(look.compose(CONTENT, { ...PHOTO, accent: 'rgb(1, 2, 3)' }).accent).toBe('rgb(1, 2, 3)');
  });

  // 7.25: the place must render once. A Look that sets it in its own design
  // says so, and the sticker layer then suppresses the duplicate — so the flag
  // has to describe THIS call, not what the Look does in general.
  it.each(LOCATION_CASES)(
    'flags the place as consumed for %s only when it set the place itself',
    (_case, content) => {
      const composition = look.compose(content, PHOTO);
      const place = content.location?.trim() ?? '';
      const drawn = place !== '' && everyWord(composition).includes(place);

      expect(composition.consumedLocation ?? false).toBe(drawn);
    },
  );

  it('is deterministic', () => {
    expect(look.compose(CONTENT, PHOTO)).toEqual(look.compose(CONTENT, PHOTO));
  });
});

/**
 * Every Look in this file, each with the ramp it publishes — no subset. The two
 * halves of 7.26 are declared together (what the design can set, and how much it
 * can carry), so they are tested together.
 */
const RAMPED: readonly (readonly [Look, DensityRamp])[] = [
  [DUOTONE_BAND, DUOTONE_BAND_RAMP],
  [LETTERBOX, LETTERBOX_RAMP],
  [CHAPTER, CHAPTER_RAMP],
  [DATELINE, DATELINE_RAMP],
  [CAPTION_CARD, CAPTION_CARD_RAMP],
];

/** The same words at every rung, so only the stated density differs (7.26). */
const PROBE = 'Where the mountain meets its mirror';

it('publishes a ramp for every Look in this file', () => {
  // The pairing above is hand-written, so it is checked rather than trusted: a
  // Look added to the file without its ramp would otherwise skip every density
  // contract below without a single test going red.
  expect(RAMPED.map(([look]) => look)).toEqual(LOOKS);
});

describe.each(RAMPED.map(([look, ramp]) => [look.id, look, ramp] as const))(
  '%s density',
  (_id, look, ramp) => {
    it('sets a thought in a visibly different slot from a beat', () => {
      // 7.26's named failure: `thought` collapsing into `line` (or into `beat`).
      // Same words both times — the size difference is the density, nothing else.
      expect(headlineFor(look, 'thought').fontSizeWPct).toBeLessThan(
        headlineFor(look, 'beat').fontSizeWPct * 0.75,
      );
    });

    it('steps the headline down from beat to line to thought', () => {
      const beat = headlineFor(look, 'beat').fontSizeWPct;
      const line = headlineFor(look, 'line').fontSizeWPct;
      const thought = headlineFor(look, 'thought').fontSizeWPct;

      expect(beat).toBeGreaterThan(line);
      expect(line).toBeGreaterThan(thought);
    });

    it('opens the leading over the same three rungs', () => {
      // The step is taken in the leading as well as the size, in every Look:
      // held constant, a `thought` reads as a shrunken headline instead of as
      // running text, and the words it was given are the ones that suffer.
      const beat = headlineFor(look, 'beat').lineHeight;
      const line = headlineFor(look, 'line').lineHeight;
      const thought = headlineFor(look, 'thought').lineHeight;

      expect(line).toBeGreaterThan(beat);
      expect(thought).toBeGreaterThan(line);
    });

    it('still sets the words at every rung the model can state', () => {
      // Including `silent`: a frame that says silent and then writes words has
      // words, and words are always drawn.
      for (const density of DENSITIES) {
        expect(everyWord(look.compose({ ...CONTENT, density }, PHOTO))).toContain(CONTENT.headline);
      }
    });

    it('asks for no words at all at silent', () => {
      expect(wordBudget(ramp, 'silent')).toBe(0);
    });

    it('sets its whole word budget without dropping below its own smallest type', () => {
      // The half of 7.26 the type ramp cannot state on its own: a Look may only
      // claim the words it can still set as itself. A budget that composes below
      // the Look's smallest rung is a budget it cannot honour.
      for (const density of DENSITIES) {
        const budget = wordBudget(ramp, density);
        if (budget === 0) continue;

        const headline = words(budget);
        const set = headlineFor(look, density, headline);

        expect(set.fontSizeWPct).toBeGreaterThanOrEqual(smallestRung(ramp));
      }
    });

    it('asks for fewer words the larger it sets them', () => {
      // `silent` is excluded: its nought says the rung wants no words, which is
      // not a measurement of what the type could hold.
      const rungs = DENSITIES.filter((density) => density !== 'silent').map(
        (density) => ramp[density],
      );

      for (const bigger of rungs) {
        for (const smaller of rungs) {
          if (bigger.fontSizeWPct > smaller.fontSizeWPct) {
            expect(bigger.maxWords).toBeLessThanOrEqual(smaller.maxWords);
          }
        }
      }
    });
  },
);

/** The smallest type this Look sets anywhere on its ramp. */
function smallestRung(ramp: DensityRamp): number {
  return Math.min(...DENSITIES.map((density) => ramp[density].fontSizeWPct));
}

/**
 * A headline of `count` words. One fixed word, because a budget is a claim about
 * an average measure rather than about a particular sentence — and a fixed one
 * keeps the check deterministic.
 */
function words(count: number): string {
  return Array.from({ length: count }, () => 'river').join(' ');
}

/** The headline part this Look composes at one density. */
function headlineFor(look: Look, density: Density, headline: string = PROBE): TextPart {
  const composition = look.compose({ headline, density }, PHOTO);
  const part = textParts(composition).find((candidate) => runText(candidate) === headline);
  if (!part) throw new Error(`${look.id} sets no headline at density “${density}”`);
  return part;
}

describe('duotone-band', () => {
  it('lays a translucent band of the story accent, edge to edge', () => {
    const { panel } = DUOTONE_BAND.compose(CONTENT, PHOTO);

    expect(panel?.color).toBe('accent');
    expect(panel?.opacity).toBeLessThan(1);
    expect(panel?.fullWidth).toBe(true);
  });

  it('reverses the words out of the band', () => {
    const composition = DUOTONE_BAND.compose(CONTENT, PHOTO);

    expect(textParts(composition).every((part) => part.color === 'paper')).toBe(true);
  });

  it('leaves the emphasis unmarked — the band is already the accent', () => {
    const composition = DUOTONE_BAND.compose(CONTENT, PHOTO);

    expect(textParts(composition).some((part) => part.mark)).toBe(false);
  });
});

describe('letterbox', () => {
  it('lays an opaque dark bar across the bottom', () => {
    const composition = LETTERBOX.compose(CONTENT, PHOTO);

    // The bar is painted in the ink tone, so declaring the ink dark is what makes
    // it dark; the words on it are stated as paper.
    expect(composition.panel?.color).toBe('ink');
    expect(composition.ink).toBe('dark');
    expect(composition.panel?.opacity).toBeGreaterThan(0.85);
    expect(composition.panel?.fullWidth).toBe(true);
    expect(composition.anchor).toBe('bottom');
  });

  it('centres the type inside the bar', () => {
    const composition = LETTERBOX.compose(CONTENT, PHOTO);

    expect(textParts(composition).every((part) => part.textAlign === 'center')).toBe(true);
  });

  it('keeps the bar at the bottom even when the photo is busy there', () => {
    // An opaque bar owns every pixel behind the words, so there is nothing to
    // move away from — the horizon it cuts stays put across the whole story.
    expect(LETTERBOX.compose(CONTENT, BUSY_PHOTO).anchor).toBe('bottom');
  });

  it('leaves a question unmarked — the line asks, no word is picked out', () => {
    expect(headlineFor(LETTERBOX, 'question').mark).toBeUndefined();
    expect(headlineFor(LETTERBOX, 'line').mark).toBe('accent-underline');
  });
});

describe('chapter', () => {
  it('emits the short accent rule that opens the chapter', () => {
    const rule = rulesOf(CHAPTER.compose(CONTENT, PHOTO))[0];

    expect(rule).toBeDefined();
    expect(rule.color).toBe('accent');
    expect(rule.widthPct).toBeLessThan(100);
  });

  it('keeps the rule when there is no kicker to mark', () => {
    const composition = CHAPTER.compose({ headline: CONTENT.headline }, PHOTO);

    expect(rulesOf(composition)).toHaveLength(1);
    expect(headlineOf(composition)).toBe(CONTENT.headline);
  });

  it('sets the chapter marker above the headline', () => {
    const texts = textParts(CHAPTER.compose(CONTENT, PHOTO)).map(runText);

    expect(texts[0]).toBe(CONTENT.kicker);
  });
});

describe('dateline', () => {
  it('sets the kicker as an all-caps dateline closed by an em dash', () => {
    const dateline = textParts(DATELINE.compose(CONTENT, PHOTO))[0];

    expect(runText(dateline)).toBe('The Ascent —');
    expect(dateline.textTransform).toBe('uppercase');
  });

  it('falls back to the place name when there is no kicker', () => {
    const composition = DATELINE.compose(
      { headline: CONTENT.headline, location: 'Chamonix' },
      PHOTO,
    );

    expect(runText(textParts(composition)[0])).toBe('Chamonix —');
    expect(headlineOf(composition)).toBe(CONTENT.headline);
  });

  it('runs the headline alone when there is neither', () => {
    const composition = DATELINE.compose({ headline: CONTENT.headline }, PHOTO);

    expect(textParts(composition)).toHaveLength(1);
    expect(headlineOf(composition)).toBe(CONTENT.headline);
  });
});

describe('caption-card', () => {
  it('lays a small card of paper that does not run the full width', () => {
    const composition = CAPTION_CARD.compose(CONTENT, PHOTO);

    expect(composition.panel?.color).toBe('paper');
    expect(composition.panel?.fullWidth).toBe(false);
    expect(composition.panel?.radiusWPct).toBeGreaterThan(0);
  });

  it('prints in dark ink, because it knows the card is behind the words', () => {
    const composition = CAPTION_CARD.compose(CONTENT, PHOTO);

    expect(composition.ink).toBe('dark');
    expect(composition.scrim).toBeNull();
    expect(textParts(composition).every((part) => part.color === 'ink')).toBe(true);
  });

  it('does not highlight a question — a swipe would mark an answer', () => {
    expect(headlineFor(CAPTION_CARD, 'question').mark).toBeUndefined();
    expect(headlineFor(CAPTION_CARD, 'line').mark).toBe('highlighter');
  });
});

/** The headline a composition ended up carrying — the last text part's words. */
function headlineOf(composition: HasParts): string {
  const texts = textParts(composition);
  return texts.length === 0 ? '' : runText(texts[texts.length - 1]);
}

/** Every word a composition draws — text runs, tags and rows alike. */
function everyWord(composition: HasParts): string {
  return composition.parts
    .map((part) => {
      if (part.kind === 'text') return runText(part);
      if (part.kind === 'tag') return part.text;
      if (part.kind === 'row') return `${part.left} ${part.right}`;
      return '';
    })
    .join(' ');
}

function rulesOf(composition: HasParts): RulePart[] {
  return composition.parts.filter((part): part is RulePart => part.kind === 'rule');
}

/** The visible text of a part, runs joined. */
function runText(part: TextPart): string {
  return part.runs.map((run) => run.text).join('');
}
