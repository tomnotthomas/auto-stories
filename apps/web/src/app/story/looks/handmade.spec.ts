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
import { INDEX_CARD } from './index-card';
import { POSTCARD_BACK } from './postcard-back';
import { SCRAPBOOK } from './scrapbook';
import { STICKER_SHEET } from './sticker-sheet';
import { ZINE } from './zine';

/**
 * The five handmade Looks — the warm end of the catalogue (decision 7.24,
 * built out under 7.27). Behaviour only: that each one composes, degrades
 * without throwing, stays inside the frame, and keeps the one device that makes
 * it recognisable. Sizes, gaps and weights are design and are deliberately not
 * asserted — a Look must be free to be retuned without a test rewrite.
 */

const CALM: PhotoAnalysis = {
  accent: DEFAULT_ACCENT,
  bands: { top: 0.1, middle: 0.1, bottom: 0.1 },
};

const BUSY: PhotoAnalysis = {
  accent: DEFAULT_ACCENT,
  bands: { top: 0.95, middle: 0.95, bottom: 0.95 },
};

const CONTENT: FrameContent = {
  kicker: 'Day two',
  headline: 'Where the mountain meets its mirror',
  emphasis: 'mountain',
  location: 'Lofoten, Norway',
};

const HANDMADE: readonly Look[] = [SCRAPBOOK, STICKER_SHEET, ZINE, INDEX_CARD, POSTCARD_BACK];

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

describe.each(HANDMADE.map((look) => [look.id, look] as const))('%s', (id, look) => {
  it('composes the frame it is given', () => {
    const composition = look.compose(CONTENT, CALM);

    expect(composition.lookId).toBe(id);
    expect(composition.parts.length).toBeGreaterThan(0);
    expect(composition.accent).toBe(DEFAULT_ACCENT);
  });

  it('composes a silent frame to nothing at all', () => {
    // No words is a real choice (7.26): with nothing to frame, the Look draws
    // none of its own furniture either.
    for (const headline of ['', '   ']) {
      const composition = look.compose({ ...CONTENT, headline }, CALM);

      expect(composition.parts).toEqual([]);
      expect(composition.scrim).toBeNull();
      expect(composition.panel).toBeUndefined();
      expect(composition.border).toBeUndefined();
    }
  });

  it('composes whatever the model leaves out', () => {
    const partial: FrameContent[] = [
      { headline: CONTENT.headline },
      { headline: CONTENT.headline, kicker: CONTENT.kicker },
      { headline: CONTENT.headline, location: CONTENT.location },
      { headline: CONTENT.headline, emphasis: 'nowhere in the headline' },
      { headline: CONTENT.headline, emphasis: CONTENT.headline },
      { headline: 'One', kicker: '  ', location: '  ', emphasis: '  ' },
      { headline: 'A headline long enough to run past three lines of type on any frame at all' },
    ];

    for (const content of partial) {
      for (const photo of [CALM, BUSY]) {
        expect(() => look.compose(content, photo)).not.toThrow();
        expect(look.compose(content, photo).parts.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the type column inside the frame', () => {
    for (const photo of [CALM, BUSY]) {
      const { leftPct, rightPct, offsetHPct } = look.compose(CONTENT, photo);

      expect(leftPct).toBeGreaterThan(0);
      expect(rightPct).toBeGreaterThan(0);
      expect(leftPct + rightPct).toBeLessThan(50);
      expect(offsetHPct).toBeGreaterThan(0);
      expect(offsetHPct).toBeLessThan(50);
    }
  });

  it('marks at most one run in the frame', () => {
    // Three marks on one frame was too much (decision 7.23): one device, once.
    const composition = look.compose(CONTENT, CALM);

    expect(texts(composition).filter((part) => part.mark).length).toBeLessThanOrEqual(1);
  });

  it('keeps every word of the headline', () => {
    const composition = look.compose(CONTENT, CALM);
    const drawn = [
      ...texts(composition).map((part) => part.runs.map((run) => run.text).join('')),
      ...tags(composition).map((tag) => tag.text),
    ].join(' ');

    for (const word of CONTENT.headline.split(' ')) {
      expect(drawn).toContain(word);
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

  it('asks for the bands it wants, best first', () => {
    expect(look.prefer.length).toBeGreaterThan(0);
  });

  // 7.26: `thought` has to land in a visibly different slot from the rungs above
  // it, or the model collapses the two. Same words either side, so the only
  // thing that can move the type is the density the creator stated.
  it('sets a thought visibly smaller than a beat', () => {
    const beat = displayWPct(look.compose({ ...CONTENT, density: 'beat' }, CALM));
    const thought = displayWPct(look.compose({ ...CONTENT, density: 'thought' }, CALM));

    expect(thought).toBeLessThan(beat * 0.8);
  });
});

describe('scrapbook', () => {
  it('tilts the whole page', () => {
    expect(SCRAPBOOK.compose(CONTENT, CALM).rotationDeg).toBeLessThan(0);
  });

  it('marks the emphasis with a drawn stroke', () => {
    const marked = texts(SCRAPBOOK.compose(CONTENT, CALM)).filter(
      (part) => part.mark === 'hand-underline',
    );

    expect(marked).toHaveLength(1);
    expect(marked[0].runs.some((run) => run.emphasised)).toBe(true);
  });

  it('tapes the location to the page', () => {
    const taped = tags(SCRAPBOOK.compose(CONTENT, CALM)).filter((tag) => tag.style === 'tape');

    expect(taped.map((tag) => tag.text)).toEqual(['Lofoten, Norway']);
  });

  it('is still a composed page with no location', () => {
    const composition = SCRAPBOOK.compose({ headline: CONTENT.headline }, CALM);

    expect(tags(composition)).toEqual([]);
    expect(composition.parts.length).toBeGreaterThan(0);
  });
});

describe('sticker-sheet', () => {
  it('sets every line as its own chip', () => {
    const composition = STICKER_SHEET.compose(CONTENT, CALM);

    expect(tags(composition).length).toBeGreaterThan(1);
    expect(tags(composition).every((tag) => tag.style === 'chip')).toBe(true);
    expect(texts(composition)).toEqual([]);
  });

  it('offsets the chips so they read as stuck on by hand', () => {
    const tilts = tags(STICKER_SHEET.compose(CONTENT, CALM)).map((tag) => tag.rotationDeg);

    expect(tilts.every((tilt) => typeof tilt === 'number')).toBe(true);
    expect(new Set(tilts).size).toBeGreaterThan(1);
  });

  it('gives the emphasised phrase a chip of its own', () => {
    const chips = tags(STICKER_SHEET.compose(CONTENT, CALM)).map((tag) => tag.text);

    expect(chips).toContain('mountain');
  });

  it('shrinks the type rather than overflowing on a long headline', () => {
    // A chip is never wrapped by the renderer, so it has to fit the column at
    // whatever size it is set. Density only sets the ceiling; the fit still
    // lowers the type from there, so both frames are stated at the rung that
    // allows the largest chip and the width is the only thing left to move it.
    const short = STICKER_SHEET.compose({ headline: 'Sunday', density: 'beat' }, CALM);
    const long = STICKER_SHEET.compose(
      {
        headline: 'A headline long enough to run past three lines of type on any frame at all',
        density: 'beat',
      },
      CALM,
    );

    expect(tags(long)[0].fontSizeWPct).toBeLessThan(tags(short)[0].fontSizeWPct);
    expect(tags(long).length).toBeLessThanOrEqual(3 + 2);
  });

  it('caps the chip at what the density allows, even when the words would fit bigger', () => {
    const beat = STICKER_SHEET.compose({ headline: 'Sunday', density: 'beat' }, CALM);
    const thought = STICKER_SHEET.compose({ headline: 'Sunday', density: 'thought' }, CALM);

    expect(tags(thought)[0].fontSizeWPct).toBeLessThan(tags(beat)[0].fontSizeWPct);
  });

  it('is still a sheet of chips with no location', () => {
    const composition = STICKER_SHEET.compose({ headline: CONTENT.headline }, CALM);

    expect(tags(composition).length).toBeGreaterThan(0);
    expect(tags(composition).map((tag) => tag.text)).not.toContain(CONTENT.location);
  });
});

describe('zine', () => {
  it('marks the emphasis with a block', () => {
    const marked = texts(ZINE.compose(CONTENT, CALM)).filter(
      (part) => part.mark === 'accent-block',
    );

    expect(marked).toHaveLength(1);
    expect(marked[0].runs.some((run) => run.emphasised)).toBe(true);
  });

  it('is tilted and set in caps', () => {
    const composition = ZINE.compose(CONTENT, CALM);

    expect(composition.rotationDeg).not.toBe(0);
    expect(texts(composition).every((part) => part.textTransform === 'uppercase')).toBe(true);
  });
});

describe('index-card', () => {
  it('writes on its own paper panel, in dark ink', () => {
    const composition = INDEX_CARD.compose(CONTENT, CALM);

    expect(composition.panel?.color).toBe('paper');
    expect(composition.ink).toBe('dark');
    // The panel is the background, so a gradient over the photo is redundant.
    expect(composition.scrim).toBeNull();
  });

  it('rules the card with a hairline', () => {
    const rules = INDEX_CARD.compose(CONTENT, CALM).parts.filter((part) => part.kind === 'rule');

    expect(rules.length).toBeGreaterThan(0);
  });

  it('marks nothing', () => {
    const composition = INDEX_CARD.compose(CONTENT, CALM);

    expect(texts(composition).every((part) => part.mark === undefined)).toBe(true);
  });
});

describe('postcard-back', () => {
  it('stamps the location as the postmark', () => {
    const stamps = tags(POSTCARD_BACK.compose(CONTENT, CALM)).filter(
      (tag) => tag.style === 'stamp',
    );

    expect(stamps).toHaveLength(1);
    expect(stamps[0].text).toBe('Lofoten, Norway');
    expect(stamps[0].rotationDeg).toBeDefined();
  });

  it('franks the kicker when there is no place to postmark', () => {
    const composition = POSTCARD_BACK.compose(
      { headline: CONTENT.headline, kicker: CONTENT.kicker },
      CALM,
    );

    expect(tags(composition).map((tag) => tag.text)).toEqual(['Day two']);
  });

  it('names the place once — the postmark or nothing', () => {
    const drawn = texts(POSTCARD_BACK.compose(CONTENT, CALM)).map((part) =>
      part.runs.map((run) => run.text).join(''),
    );

    expect(drawn).not.toContain(CONTENT.location);
  });

  it('is still a postcard with neither place nor kicker', () => {
    const composition = POSTCARD_BACK.compose({ headline: CONTENT.headline }, CALM);

    expect(tags(composition)).toEqual([]);
    expect(composition.parts.length).toBeGreaterThan(0);
  });
});

function texts(composition: HasParts): TextPart[] {
  return composition.parts.filter((part): part is TextPart => part.kind === 'text');
}

function tags(composition: HasParts): TagPart[] {
  return composition.parts.filter((part): part is TagPart => part.kind === 'tag');
}

/**
 * The largest type in the frame, whatever kind of part carries it — Sticker
 * Sheet sets its headline in tags and the rest of the group in text, so a test
 * about the headline's size should not have to know which.
 */
function displayWPct(composition: HasParts): number {
  return Math.max(
    ...composition.parts.map((part) => (part.kind === 'rule' ? 0 : part.fontSizeWPct)),
  );
}

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
