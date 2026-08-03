import { DEFAULT_ACCENT } from '../accent-color';
import {
  DENSITIES,
  DENSITY_WORDS,
  textParts,
  wordBudget,
  type Composition,
  type Density,
  type DensityRamp,
  type FrameContent,
  type Look,
  type PhotoAnalysis,
  type TagPart,
  type TextPart,
  type HasParts,
} from '../look';
import { FADED_ALBUM, FADED_ALBUM_RAMP } from './faded-album';
import { FILM_POSTCARD, FILM_POSTCARD_RAMP } from './film-postcard';
import { POLAROID, POLAROID_RAMP } from './polaroid';
import { SUPER_8, SUPER_8_RAMP } from './super-8';

/**
 * The warm group — Film Postcard, Polaroid, Super 8, Faded Album. Four Looks
 * that share one silent-frame rule: with no words a Look drops everything it
 * draws (type, scrim, panel, border) and keeps only its `photoFilter`, because
 * the filter treats the photograph while the rest is furniture around words.
 *
 * Behaviour only — nothing here asserts a size, a colour or a font.
 */

const CALM: PhotoAnalysis = {
  accent: DEFAULT_ACCENT,
  bands: { top: 0.1, middle: 0.1, bottom: 0.1 },
};

const BUSY: PhotoAnalysis = {
  accent: DEFAULT_ACCENT,
  bands: { top: 0.98, middle: 0.99, bottom: 0.97 },
};

const CONTENT: FrameContent = {
  kicker: 'Day two',
  headline: 'The road out of the valley',
  emphasis: 'valley',
  location: 'Val Bregaglia',
};

/** Every content shape a Look has to survive, including the empty one. */
const SPARSE: readonly FrameContent[] = [
  { headline: 'Just the words' },
  { headline: 'No place', kicker: 'A kicker' },
  { headline: 'No kicker', location: 'Somewhere' },
  { headline: 'Emphasis that is absent', emphasis: 'nowhere' },
  { headline: '', kicker: 'A kicker', location: 'Somewhere' },
  { headline: '   ' },
];

const WARM_LOOKS: readonly Look[] = [FILM_POSTCARD, POLAROID, SUPER_8, FADED_ALBUM];

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

describe.each(WARM_LOOKS.map((look) => [look.id, look] as const))('%s', (id, look) => {
  it('has the id the contract names it by', () => {
    expect(look.id).toBe(id);
  });

  it('asks for at least one band', () => {
    expect(look.prefer.length).toBeGreaterThan(0);
  });

  it('sets the headline', () => {
    const parts = textParts(look.compose(CONTENT, CALM));

    expect(parts.map(runText).join(' ')).toContain(CONTENT.headline);
  });

  it('labels the composition with its own id', () => {
    expect(look.compose(CONTENT, CALM).lookId).toBe(id);
  });

  it('keeps the type column inside the frame', () => {
    const { leftPct, rightPct } = look.compose(CONTENT, CALM);

    expect(leftPct).toBeGreaterThan(0);
    expect(rightPct).toBeGreaterThan(0);
    expect(leftPct + rightPct).toBeLessThan(50);
  });

  it('hangs the stack off an edge of the frame', () => {
    const { anchor, offsetHPct } = look.compose(CONTENT, CALM);

    expect(['top', 'bottom']).toContain(anchor);
    expect(offsetHPct).toBeGreaterThan(0);
    expect(offsetHPct).toBeLessThan(50);
  });

  it('carries the photo’s accent through', () => {
    expect(look.compose(CONTENT, { ...CALM, accent: 'rgb(1, 2, 3)' }).accent).toBe('rgb(1, 2, 3)');
  });

  it('marks at most one run (7.23)', () => {
    const marked = textParts(look.compose(CONTENT, CALM))
      .flatMap((part) => part.runs)
      .filter((run) => run.emphasised);

    expect(marked.length).toBeLessThanOrEqual(1);
  });

  it('drops the mark when the emphasis is not in the headline', () => {
    const marked = textParts(look.compose({ ...CONTENT, emphasis: 'elsewhere' }, CALM))
      .flatMap((part) => part.runs)
      .filter((run) => run.emphasised);

    expect(marked).toHaveLength(0);
  });

  it('composes whatever the model leaves out, on any photo', () => {
    for (const content of SPARSE) {
      for (const photo of [CALM, BUSY]) {
        expect(() => look.compose(content, photo)).not.toThrow();
      }
    }
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

  describe('silent frame (7.26)', () => {
    it('draws no words and no furniture', () => {
      for (const headline of ['', '   ']) {
        const silent = look.compose({ ...CONTENT, headline }, CALM);

        expect(silent.parts).toEqual([]);
        expect(silent.scrim).toBeNull();
        expect(silent.panel).toBeUndefined();
        expect(silent.border).toBeUndefined();
      }
    });

    it('keeps the photo treatment, which belongs to the photograph', () => {
      const spoken = look.compose(CONTENT, CALM);
      const silent = look.compose({ ...CONTENT, headline: '' }, CALM);

      expect(silent.photoFilter).toBe(spoken.photoFilter);
    });
  });
});

/**
 * Every Look in this file, with the ramp it declares. The ramp is a contract,
 * not a per-Look flourish, so there is no subset here — a Look added to the file
 * is a Look held to it.
 */
const RAMPED: readonly (readonly [Look, DensityRamp])[] = [
  [FILM_POSTCARD, FILM_POSTCARD_RAMP],
  [POLAROID, POLAROID_RAMP],
  [SUPER_8, SUPER_8_RAMP],
  [FADED_ALBUM, FADED_ALBUM_RAMP],
];

/** The same words at every rung, so only the stated density differs (7.26). */
const PROBE = 'The road out of the valley and back again';

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

    it('opens the leading as the rung grows', () => {
      // The other half of the same step: a thought set smaller but leaded like a
      // headline reads as a shrunken headline. Every Look opens it — a design
      // that put the whole step into the size was the subset this used to allow.
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
        expect(everyWord(look.compose({ ...CONTENT, density }, CALM))).toContain(CONTENT.headline);
      }
    });

    it('carries fewer words the larger it sets them', () => {
      // The budget is the design's own statement of what it can hold, so it has
      // to move against the size — a rung set bigger that claimed to hold more
      // would be describing a different Look.
      expect(ramp.beat.fontSizeWPct).toBeGreaterThan(ramp.line.fontSizeWPct);
      expect(ramp.line.fontSizeWPct).toBeGreaterThan(ramp.thought.fontSizeWPct);
      expect(wordBudget(ramp, 'beat')).toBeLessThan(wordBudget(ramp, 'line'));
      expect(wordBudget(ramp, 'line')).toBeLessThan(wordBudget(ramp, 'thought'));
    });

    it('never claims to hold more than the rung is written to', () => {
      // 7.26 says how long the words are; the Look says how much of that it can
      // take. It may take less — Polaroid does, because its paper grows with the
      // words — but never more.
      for (const density of DENSITIES) {
        expect(wordBudget(ramp, density)).toBeLessThanOrEqual(DENSITY_WORDS[density].max);
      }
      expect(wordBudget(ramp, 'silent')).toBe(0);
    });

    it('sets a headline of its own budget without dropping below its smallest rung', () => {
      // The budget has to be one this Look can actually set: written to the word
      // it published, the frame still composes, and the type is still one of the
      // sizes the design declared rather than something shrunk to fit.
      const smallest = Math.min(...DENSITIES.map((density) => ramp[density].fontSizeWPct));

      for (const density of DENSITIES) {
        const budget = wordBudget(ramp, density);
        if (budget === 0) continue;
        const headline = wordsOf(budget);
        const part = headlineOf(look, headline, density);

        expect(part.fontSizeWPct).toBeGreaterThanOrEqual(smallest);
      }
    });
  },
);

/** The headline part this Look composes at one density. */
function headlineFor(look: Look, density: Density): TextPart {
  return headlineOf(look, PROBE, density);
}

/** The part carrying these exact words, so a test can probe any headline. */
function headlineOf(look: Look, headline: string, density: Density): TextPart {
  const composition = look.compose({ headline, density }, CALM);
  const part = textParts(composition).find((candidate) => runText(candidate) === headline);
  if (!part) throw new Error(`${look.id} sets no headline at density “${density}”`);
  return part;
}

/** Plain words to fill a budget with — content nobody has to read, of a length
 * that is the point. Never ends in a question mark, so a stated density is the
 * only thing under test. */
function wordsOf(count: number): string {
  const pool = ['the', 'road', 'out', 'of', 'the', 'valley', 'and', 'back', 'again', 'before'];
  return Array.from({ length: count }, (_unused, index) => pool[index % pool.length]).join(' ');
}

describe('film-postcard', () => {
  it('prints a border on the photo', () => {
    const border = FILM_POSTCARD.compose(CONTENT, CALM).border;

    expect(border).toBeDefined();
    expect(border?.widthWPct).toBeGreaterThan(0);
    expect(border?.insetWPct).toBeGreaterThan(0);
  });

  it('stamps the place in the corner', () => {
    const tag = tagParts(FILM_POSTCARD.compose(CONTENT, CALM))[0];

    expect(tag?.style).toBe('stamp');
    expect(tag?.text).toBe('Val Bregaglia');
  });

  it('has no stamp when the frame names no place', () => {
    expect(tagParts(FILM_POSTCARD.compose({ headline: 'No place named' }, CALM))).toHaveLength(0);
  });

  it('gives the photo a warm treatment', () => {
    expect(FILM_POSTCARD.compose(CONTENT, CALM).photoFilter).toBeTruthy();
  });

  it('moves off its preferred band when the photo is busy there', () => {
    const calm = FILM_POSTCARD.compose(CONTENT, CALM);
    const busyBottom = FILM_POSTCARD.compose(CONTENT, {
      ...CALM,
      bands: { top: 0.05, middle: 0.05, bottom: 0.95 },
    });

    expect(calm.anchor).toBe('bottom');
    expect(busyBottom.anchor).toBe('top');
  });
});

describe('polaroid', () => {
  it('lays a full-width paper margin under the words', () => {
    const panel = POLAROID.compose(CONTENT, CALM).panel;

    expect(panel?.color).toBe('paper');
    expect(panel?.fullWidth).toBe(true);
    expect(panel?.opacity).toBe(1);
  });

  it('writes in dark ink, because the words sit on paper', () => {
    expect(POLAROID.compose(CONTENT, CALM).ink).toBe('dark');
  });

  it('needs no scrim: the margin is opaque', () => {
    expect(POLAROID.compose(CONTENT, CALM).scrim).toBeNull();
  });

  it('keeps the margin at the bottom however busy the photo is', () => {
    expect(POLAROID.compose(CONTENT, BUSY).anchor).toBe('bottom');
  });

  it('underlines the emphasised word by hand', () => {
    const marked = textParts(POLAROID.compose(CONTENT, CALM)).find((part) => part.mark);

    expect(marked?.mark).toBe('hand-underline');
    expect(marked?.runs.filter((run) => run.emphasised).map((run) => run.text)).toEqual(['valley']);
  });

  it('writes the place under the caption when there is one', () => {
    const withPlace = textParts(POLAROID.compose(CONTENT, CALM)).map(runText);
    const without = textParts(POLAROID.compose({ headline: CONTENT.headline }, CALM)).map(runText);

    expect(withPlace).toContain('Val Bregaglia');
    expect(without).toEqual([CONTENT.headline]);
  });
});

describe('super-8', () => {
  it('frames the photo with a rounded viewfinder', () => {
    const border = SUPER_8.compose(CONTENT, CALM).border;

    expect(border).toBeDefined();
    expect(border?.radiusWPct).toBeGreaterThan(0);
  });

  it('sets a timecode stamp from the words the model wrote', () => {
    const tag = tagParts(SUPER_8.compose(CONTENT, CALM))[0];

    expect(tag?.style).toBe('stamp');
    expect(tag?.text).toBe('Day two');
  });

  it('falls back to the place when there is no kicker', () => {
    const tag = tagParts(SUPER_8.compose({ headline: 'Rolling', location: 'Zermatt' }, CALM))[0];

    expect(tag?.text).toBe('Zermatt');
  });

  it('sets no stamp when the frame carries neither', () => {
    expect(tagParts(SUPER_8.compose({ headline: 'Rolling' }, CALM))).toHaveLength(0);
  });

  it('runs the stamp before the headline, so it reads as a readout', () => {
    const parts = SUPER_8.compose(CONTENT, CALM).parts;

    expect(parts[0]?.kind).toBe('tag');
  });

  it('gives the photo a sepia treatment', () => {
    expect(SUPER_8.compose(CONTENT, CALM).photoFilter).toContain('sepia');
  });
});

describe('faded-album', () => {
  it('rules a hairline under the words', () => {
    const parts = FADED_ALBUM.compose(CONTENT, CALM).parts;
    const ruleAt = parts.findIndex((part) => part.kind === 'rule');
    const headlineAt = parts.findIndex(
      (part) => part.kind === 'text' && runText(part) === CONTENT.headline,
    );

    expect(headlineAt).toBeGreaterThanOrEqual(0);
    expect(ruleAt).toBeGreaterThan(headlineAt);
  });

  it('keeps the hairline even when the frame has only a headline', () => {
    const parts = FADED_ALBUM.compose({ headline: 'Only this' }, CALM).parts;

    expect(parts.some((part) => part.kind === 'rule')).toBe(true);
  });

  it('lays a soft overlay behind the words', () => {
    const scrim = FADED_ALBUM.compose(CONTENT, CALM).scrim;

    expect(scrim).not.toBeNull();
    expect(scrim?.extentHPct).toBeGreaterThan(0);
  });

  it('gives the photo a faded treatment', () => {
    expect(FADED_ALBUM.compose(CONTENT, CALM).photoFilter).toBeTruthy();
  });
});

/** The visible text of a text part, runs joined. */
function runText(part: { runs: readonly { text: string }[] }): string {
  return part.runs.map((run) => run.text).join('');
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

/** Every tag of a composition — the group's stamps. */
function tagParts(composition: HasParts): TagPart[] {
  return composition.parts.filter((part): part is TagPart => part.kind === 'tag');
}
