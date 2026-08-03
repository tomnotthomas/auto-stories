import { DEFAULT_ACCENT } from '../accent-color';
import {
  textParts,
  type Composition,
  type FrameContent,
  type Look,
  type PhotoAnalysis,
  type TagPart,
  type HasParts,
} from '../look';
import { FADED_ALBUM } from './faded-album';
import { FILM_POSTCARD } from './film-postcard';
import { POLAROID } from './polaroid';
import { SUPER_8 } from './super-8';

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

/** Every tag of a composition — the group's stamps. */
function tagParts(composition: HasParts): TagPart[] {
  return composition.parts.filter((part): part is TagPart => part.kind === 'tag');
}
