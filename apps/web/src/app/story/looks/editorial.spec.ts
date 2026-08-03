import { DEFAULT_ACCENT } from '../accent-color';
import type {
  Composition,
  FrameContent,
  Look,
  PhotoAnalysis,
  TagPart,
  TextPart,
  HasParts,
} from '../look';
import { textParts } from '../look';
import { BOLD_POSTER } from './bold-poster';
import { BROADSHEET } from './broadsheet';
import { CONTENTS_PAGE } from './contents-page';
import { PULL_QUOTE } from './pull-quote';

/**
 * The four editorial Looks (catalogue B, plus Bold Poster from C). Each one has
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

const LOOKS = [BROADSHEET, CONTENTS_PAGE, PULL_QUOTE, BOLD_POSTER];

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

  it('names the bands it wants', () => {
    expect(look.prefer.length).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    expect(look.compose(CONTENT, PHOTO)).toEqual(look.compose(CONTENT, PHOTO));
  });
});

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

/** Where the headline sits in the part stack, so rules can be read either side. */
function indexOfHeadline(composition: HasParts, headline: string): number {
  return composition.parts.findIndex(
    (part) => part.kind === 'text' && part.runs.map((run) => run.text).join('') === headline,
  );
}
