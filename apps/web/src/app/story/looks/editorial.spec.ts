import { DEFAULT_ACCENT } from '../accent-color';
import type {
  Composition,
  Density,
  DensityRamp,
  FrameContent,
  Look,
  PhotoAnalysis,
  TagPart,
  TextPart,
  HasParts,
} from '../look';
import { DENSITIES, DENSITY_WORDS, textParts, wordBudget } from '../look';
import { BOLD_POSTER, BOLD_POSTER_RAMP } from './bold-poster';
import { BROADSHEET, BROADSHEET_RAMP } from './broadsheet';
import { CONTENTS_PAGE, CONTENTS_PAGE_RAMP } from './contents-page';
import { MAGAZINE, MAGAZINE_RAMP } from './magazine';
import { PULL_QUOTE, PULL_QUOTE_RAMP } from './pull-quote';

/**
 * The editorial Looks (catalogue B, plus Bold Poster from C). Each one has
 * the same contract — compose something drawable for any words, compose nothing
 * for none — and then one behaviour that is the reason it exists.
 */

const PHOTO: PhotoAnalysis = {
  accent: DEFAULT_ACCENT,
  bands: { top: 0.1, middle: 0.1, bottom: 0.1 },
};

/** Nowhere is calm — every Look still has to place its type somewhere. */
const BUSY_PHOTO: PhotoAnalysis = {
  accent: DEFAULT_ACCENT,
  bands: { top: 0.97, middle: 0.95, bottom: 0.99 },
};

const CONTENT: FrameContent = {
  kicker: 'The Ascent',
  headline: 'Where the mountain meets its mirror',
  emphasis: 'mountain',
  location: 'Lake Braies',
};

const LOOKS = [BROADSHEET, CONTENTS_PAGE, PULL_QUOTE, BOLD_POSTER, MAGAZINE];

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

describe.each(LOOKS.map((look) => [look.id, look] as [string, Look]))('%s', (_id, look) => {
  it('composes the headline for a normal frame', () => {
    const composition = look.compose(CONTENT, PHOTO);

    expect(composition.lookId).toBe(look.id);
    expect(textParts(composition).map(runText)).toContain(CONTENT.headline);
  });

  it('composes a silent frame to nothing at all', () => {
    // No words is a real choice (7.26): everything a Look draws exists to frame
    // the words, so with no words there is no furniture and no scrim.
    for (const headline of ['', '   ']) {
      const composition = look.compose({ ...CONTENT, headline }, PHOTO);

      expect(composition.parts).toEqual([]);
      expect(composition.scrim).toBeNull();
      expect(composition.panel).toBeUndefined();
      expect(composition.border).toBeUndefined();
    }
  });

  it('still composes when the words or the photo are missing pieces', () => {
    const degraded: FrameContent[] = [
      { headline: CONTENT.headline },
      { ...CONTENT, kicker: undefined },
      { ...CONTENT, location: undefined },
      { ...CONTENT, emphasis: 'nowhere in this headline' },
      { ...CONTENT, kicker: '  ', location: '  ', emphasis: '  ' },
      { headline: 'Go' },
    ];

    for (const content of degraded) {
      for (const photo of [PHOTO, BUSY_PHOTO]) {
        expect(() => look.compose(content, photo)).not.toThrow();
        expect(look.compose(content, photo).parts.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the type column inside the frame', () => {
    const { leftPct, rightPct } = look.compose(CONTENT, PHOTO);

    expect(leftPct).toBeGreaterThan(0);
    expect(rightPct).toBeGreaterThan(0);
    expect(leftPct + rightPct).toBeLessThan(50);
  });

  it('carries the photo’s accent and never a colour literal', () => {
    const composition = look.compose(CONTENT, { ...PHOTO, accent: 'rgb(1, 2, 3)' });

    expect(composition.accent).toBe('rgb(1, 2, 3)');
    for (const part of composition.parts) {
      expect(['ink', 'accent', 'paper']).toContain(part.color);
    }
  });

  it('marks at most one run in the frame', () => {
    // Three marks on one frame was too much (7.23).
    const composition = look.compose(CONTENT, PHOTO);

    expect(textParts(composition).filter((part) => part.mark !== undefined).length).toBeLessThan(2);
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

  it('names the bands it wants', () => {
    expect(look.prefer.length).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    expect(look.compose(CONTENT, PHOTO)).toEqual(look.compose(CONTENT, PHOTO));
  });
});

/**
 * Every Look in this file, with the ramp it declares. The ramp is a contract,
 * not a per-Look flourish, so there is no subset here — a Look added to the file
 * is a Look held to it.
 */
const RAMPED: readonly (readonly [Look, DensityRamp])[] = [
  [BROADSHEET, BROADSHEET_RAMP],
  [CONTENTS_PAGE, CONTENTS_PAGE_RAMP],
  [PULL_QUOTE, PULL_QUOTE_RAMP],
  [BOLD_POSTER, BOLD_POSTER_RAMP],
  [MAGAZINE, MAGAZINE_RAMP],
];

/** The same words at every rung, so only the stated density differs (7.26). */
const PROBE = 'Where the mountain meets its mirror';

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
        expect(everyWord(look.compose({ ...CONTENT, density }, PHOTO))).toContain(CONTENT.headline);
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
      // take. It may take less — Bold Poster does — but never more.
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
  const composition = look.compose({ headline, density }, PHOTO);
  const part = textParts(composition).find((candidate) => runText(candidate) === headline);
  if (!part) throw new Error(`${look.id} sets no headline at density “${density}”`);
  return part;
}

/** Plain words to fill a budget with — content nobody has to read, of a length
 * that is the point. Never ends in a question mark, so a stated density is the
 * only thing under test. */
function wordsOf(count: number): string {
  const pool = [
    'where',
    'the',
    'mountain',
    'meets',
    'its',
    'mirror',
    'and',
    'the',
    'light',
    'goes',
  ];
  return Array.from({ length: count }, (_unused, index) => pool[index % pool.length]).join(' ');
}

describe('broadsheet', () => {
  it('sets a double rule above and below the headline', () => {
    const composition = BROADSHEET.compose(CONTENT, PHOTO);
    const headlineAt = indexOfHeadline(composition, CONTENT.headline);
    const rules = composition.parts
      .map((part, index) => ({ part, index }))
      .filter(({ part }) => part.kind === 'rule');

    expect(rules.filter(({ index }) => index < headlineAt)).toHaveLength(2);
    expect(rules.filter(({ index }) => index > headlineAt)).toHaveLength(2);
  });

  it('keeps both rules of a pair when there is no kicker', () => {
    const composition = BROADSHEET.compose({ headline: CONTENT.headline }, PHOTO);

    expect(composition.parts.filter((part) => part.kind === 'rule')).toHaveLength(4);
  });

  it('asks a question in the book weight, not the front-page weight', () => {
    // 7.26: a question invites a reply, so the page asks rather than declares.
    expect(headlineFor(BROADSHEET, 'question').fontWeight).toBeLessThan(
      headlineFor(BROADSHEET, 'line').fontWeight,
    );
  });
});

describe('contents-page', () => {
  it('sets an oversized accent marker against the headline', () => {
    const composition = CONTENTS_PAGE.compose(CONTENT, PHOTO);
    const [marker] = textParts(composition);
    const headline = textParts(composition).find((part) => runText(part) === CONTENT.headline);

    expect(marker.color).toBe('accent');
    expect(marker.fontSizeWPct).toBeGreaterThan(headline!.fontSizeWPct);
  });

  it('always has a marker to set, kicker or not', () => {
    const withKicker = textParts(CONTENTS_PAGE.compose(CONTENT, PHOTO))[0];
    const without = textParts(CONTENTS_PAGE.compose({ headline: 'Rain all week' }, PHOTO))[0];

    expect(runText(withKicker)).toBe('T');
    expect(runText(without)).toBe('R');
  });

  it('marks a question with a question mark instead of an initial', () => {
    // 7.26: the marker is the entry's sign. An entry that asks is signed “?”.
    const asked = textParts(CONTENTS_PAGE.compose({ ...CONTENT, density: 'question' }, PHOTO))[0];

    expect(runText(asked)).toBe('?');
  });
});

describe('pull-quote', () => {
  it('centres every part and quotes the line above and below', () => {
    const composition = PULL_QUOTE.compose(CONTENT, PHOTO);
    const texts = textParts(composition);
    const headlineAt = indexOfHeadline(composition, CONTENT.headline);
    const glyphs = texts.filter((part) => part.color === 'accent');

    for (const part of texts) expect(part.textAlign).toBe('center');
    expect(glyphs).toHaveLength(2);
    expect(composition.parts.indexOf(glyphs[0])).toBeLessThan(headlineAt);
    expect(composition.parts.indexOf(glyphs[1])).toBeGreaterThan(headlineAt);
  });

  // The accent count was a two-glyph rule read off one frame. Setting a question
  // in the accent as well was considered here and rejected on a concrete ground:
  // this Look lays no scrim and states `ink: 'auto'`, so `accent` is the hue
  // sampled off the photograph the words sit on, while `ink` is the tone the
  // device computed to be legible against it (7.10). A glyph that goes quiet
  // against the picture costs a mark; the words going quiet costs the frame. So
  // the rule is kept and widened instead of relaxed: the accent is the quoting,
  // at every density, and the words are always in the legible ink.
  it('keeps the accent on the quoting and the words in the legible ink, at every density', () => {
    for (const density of DENSITIES) {
      const composition = PULL_QUOTE.compose({ ...CONTENT, density }, PHOTO);
      const accented = textParts(composition).filter((part) => part.color === 'accent');
      const headline = textParts(composition).find((part) => runText(part) === CONTENT.headline);

      expect(accented.map(runText)).toEqual(['“', '”']);
      expect(headline?.color).toBe('ink');
    }
  });

  it('asks a question larger than it states a line, and carries fewer words for it', () => {
    // 7.26: a question is pulled out to be answered, not read past. The size is
    // what sets it apart — see above for why the colour is not.
    expect(headlineFor(PULL_QUOTE, 'question').fontSizeWPct).toBeGreaterThan(
      headlineFor(PULL_QUOTE, 'line').fontSizeWPct,
    );
    expect(wordBudget(PULL_QUOTE_RAMP, 'question')).toBeLessThan(
      wordBudget(PULL_QUOTE_RAMP, 'line'),
    );
  });
});

describe('bold-poster', () => {
  it('blocks the emphasised word in the accent', () => {
    const composition = BOLD_POSTER.compose(CONTENT, PHOTO);
    const headline = textParts(composition).find((part) => runText(part) === CONTENT.headline);

    expect(headline!.mark).toBe('accent-block');
    expect(headline!.runs.filter((run) => run.emphasised).map((run) => run.text)).toEqual([
      'mountain',
    ]);
  });

  it('drops the mark when the emphasis is not in the headline', () => {
    const composition = BOLD_POSTER.compose({ ...CONTENT, emphasis: 'elsewhere' }, PHOTO);

    expect(textParts(composition).every((part) => part.mark === undefined)).toBe(true);
  });

  it('tags the place as a pill, and drops the tag when there is no place', () => {
    const tagged = BOLD_POSTER.compose(CONTENT, PHOTO).parts.filter(
      (part): part is TagPart => part.kind === 'tag',
    );
    const untagged = BOLD_POSTER.compose({ ...CONTENT, location: undefined }, PHOTO).parts;

    expect(tagged).toHaveLength(1);
    expect(tagged[0].style).toBe('pill');
    expect(tagged[0].text).toBe('Lake Braies');
    expect(untagged.filter((part) => part.kind === 'tag')).toHaveLength(0);
  });
});

/** The visible text of a text part, runs joined. */
function runText(part: TextPart): string {
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

/** Where the headline sits in the part stack, so rules can be read either side. */
function indexOfHeadline(composition: HasParts, headline: string): number {
  return composition.parts.findIndex(
    (part) => part.kind === 'text' && part.runs.map((run) => run.text).join('') === headline,
  );
}
