import { DEFAULT_ACCENT } from './accent-color';
import {
  DEFAULT_LOOK_ID,
  composeFrame,
  lookFor,
  splitEmphasis,
  textParts,
  wrapRuns,
  type FrameContent,
  type PhotoAnalysis,
} from './look';

const PHOTO: PhotoAnalysis = {
  accent: DEFAULT_ACCENT,
  bands: { top: 0.1, middle: 0.1, bottom: 0.1 },
};

const CONTENT: FrameContent = {
  kicker: 'The Ascent',
  headline: 'Where the mountain meets its mirror',
  emphasis: 'mountain',
};

describe('splitEmphasis', () => {
  it('splits the headline around the emphasised phrase', () => {
    expect(splitEmphasis('Where the mountain meets', 'mountain')).toEqual([
      { text: 'Where the ' },
      { text: 'mountain', emphasised: true },
      { text: ' meets' },
    ]);
  });

  it('matches case-insensitively but keeps the headline’s own casing', () => {
    expect(splitEmphasis('Everyone Made It', 'made it')).toEqual([
      { text: 'Everyone ' },
      { text: 'Made It', emphasised: true },
    ]);
  });

  it('returns one plain run when the emphasis is absent', () => {
    expect(splitEmphasis('Everyone made it', 'nowhere')).toEqual([{ text: 'Everyone made it' }]);
  });

  it('returns one plain run when there is no emphasis', () => {
    expect(splitEmphasis('Everyone made it', undefined)).toEqual([{ text: 'Everyone made it' }]);
  });

  it('marks only the first occurrence', () => {
    const runs = splitEmphasis('go go go', 'go');

    expect(runs.filter((run) => run.emphasised)).toHaveLength(1);
  });
});

describe('wrapRuns', () => {
  // One "character" is one unit wide, so widths are easy to reason about.
  const measure = (text: string): number => text.length;

  it('keeps a short line as one line', () => {
    expect(wrapRuns([{ text: 'short line' }], measure, 100)).toHaveLength(1);
  });

  it('wraps on words to fit the width', () => {
    const lines = wrapRuns([{ text: 'aaa bbb ccc ddd' }], measure, 7);

    expect(lines).toHaveLength(2);
    expect(lines[0].runs.map((run) => run.text).join('')).toBe('aaa bbb');
  });

  it('carries the emphasis onto whichever line the word lands on', () => {
    const runs = splitEmphasis('one two three four', 'three');
    const lines = wrapRuns(runs, measure, 8);
    const emphasised = lines.flatMap((line) => line.runs).filter((run) => run.emphasised);

    expect(emphasised.map((run) => run.text.trim())).toEqual(['three']);
  });

  it('never drops a word', () => {
    const lines = wrapRuns(splitEmphasis(CONTENT.headline, CONTENT.emphasis), measure, 9);
    const text = lines
      .map((line) => line.runs.map((run) => run.text).join(''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    expect(text).toBe(CONTENT.headline);
  });

  it('survives an empty run list', () => {
    expect(wrapRuns([], measure, 10)).toEqual([]);
  });
});

describe('lookFor', () => {
  it('returns the requested Look', () => {
    expect(lookFor('magazine-masthead').id).toBe('magazine-masthead');
  });

  it('falls back to the default Look for one that is not built yet', () => {
    expect(lookFor('scrapbook').id).toBe(DEFAULT_LOOK_ID);
  });

  it('falls back to the default Look for a missing or unknown id', () => {
    expect(lookFor(undefined).id).toBe(DEFAULT_LOOK_ID);
    expect(lookFor('not-a-look').id).toBe(DEFAULT_LOOK_ID);
  });
});

describe('composeFrame', () => {
  it('always composes something, whatever the Look id', () => {
    for (const id of ['magazine-masthead', 'scrapbook', undefined, 'nonsense']) {
      expect(composeFrame(id, CONTENT, PHOTO).parts.length).toBeGreaterThan(0);
    }
  });

  it('composes from the headline alone', () => {
    const composition = composeFrame(DEFAULT_LOOK_ID, { headline: 'Just this' }, PHOTO);

    expect(textParts(composition).some((part) => runText(part) === 'Just this')).toBe(true);
  });

  it('renders the kicker when there is one', () => {
    const composition = composeFrame(DEFAULT_LOOK_ID, CONTENT, PHOTO);

    expect(textParts(composition).some((part) => runText(part) === 'The Ascent')).toBe(true);
  });

  it('drops the kicker part entirely when there is no kicker', () => {
    const composition = composeFrame(DEFAULT_LOOK_ID, { headline: CONTENT.headline }, PHOTO);

    expect(textParts(composition).map(runText)).not.toContain('The Ascent');
  });

  it('marks the emphasised phrase', () => {
    const composition = composeFrame(DEFAULT_LOOK_ID, CONTENT, PHOTO);
    const marked = textParts(composition)
      .flatMap((part) => part.runs)
      .filter((run) => run.emphasised);

    expect(marked.map((run) => run.text)).toEqual(['mountain']);
  });

  it('skips the mark when the emphasis is not in the headline', () => {
    const composition = composeFrame(DEFAULT_LOOK_ID, { ...CONTENT, emphasis: 'elsewhere' }, PHOTO);
    const marked = textParts(composition)
      .flatMap((part) => part.runs)
      .filter((run) => run.emphasised);

    expect(marked).toHaveLength(0);
  });

  it('keeps the type column inside the frame', () => {
    const { leftPct, rightPct } = composeFrame(DEFAULT_LOOK_ID, CONTENT, PHOTO);

    expect(leftPct).toBeGreaterThan(0);
    expect(rightPct).toBeGreaterThan(0);
    expect(leftPct + rightPct).toBeLessThan(50);
  });

  it('moves off its preferred band when the photo is busy there', () => {
    const calm = composeFrame(DEFAULT_LOOK_ID, CONTENT, PHOTO);
    const busyBottom = composeFrame(DEFAULT_LOOK_ID, CONTENT, {
      ...PHOTO,
      bands: { top: 0.05, middle: 0.05, bottom: 0.95 },
    });

    expect(calm.anchor).toBe('bottom');
    expect(busyBottom.anchor).not.toBe('bottom');
  });

  it('asks for a scrim so type stays legible on a busy photo', () => {
    const composition = composeFrame(DEFAULT_LOOK_ID, CONTENT, PHOTO);

    expect(composition.scrim).not.toBeNull();
  });

  it('uses the photo’s accent for accent-coloured parts', () => {
    const composition = composeFrame(DEFAULT_LOOK_ID, CONTENT, {
      ...PHOTO,
      accent: 'rgb(1, 2, 3)',
    });

    expect(composition.accent).toBe('rgb(1, 2, 3)');
  });

  it('composes a silent frame to nothing at all', () => {
    // No words is a real choice (7.26). Everything the Look draws exists to
    // frame the words, so a masthead around an empty column would read broken.
    for (const headline of ['', '   ']) {
      const composition = composeFrame(DEFAULT_LOOK_ID, { kicker: 'The Ascent', headline }, PHOTO);

      expect(composition.parts).toEqual([]);
      expect(composition.scrim).toBeNull();
    }
  });

  it('is deterministic', () => {
    expect(composeFrame(DEFAULT_LOOK_ID, CONTENT, PHOTO)).toEqual(
      composeFrame(DEFAULT_LOOK_ID, CONTENT, PHOTO),
    );
  });
});

/** The visible text of a text part, runs joined. */
function runText(part: { runs: readonly { text: string }[] }): string {
  return part.runs.map((run) => run.text).join('');
}
