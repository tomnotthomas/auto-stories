import { DEFAULT_ACCENT } from '../accent-color';
import type {
  Composition,
  FrameContent,
  Look,
  PhotoAnalysis,
  RulePart,
  TextPart,
  HasParts,
} from '../look';
import { EDGE_CAPS } from './edge-caps';
import { SUBTITLE } from './subtitle';
import { TITLE_CARD } from './title-card';
import { TYPEWRITER } from './typewriter';

/**
 * The four quiet, cinematic Looks. They share a restraint, so the shared block
 * below asserts the contract every Look owes the engine (composes, goes silent,
 * never throws, stays inside the frame) and each Look then gets the one test
 * that says what makes it itself — because these four are only distinguishable
 * by placement and rhythm, not by typeface.
 */

const CALM: PhotoAnalysis = {
  accent: DEFAULT_ACCENT,
  bands: { top: 0.1, middle: 0.1, bottom: 0.1 },
};

const BUSY: PhotoAnalysis = {
  accent: DEFAULT_ACCENT,
  bands: { top: 0.97, middle: 0.98, bottom: 0.99 },
};

const CONTENT: FrameContent = {
  kicker: 'The Ascent',
  headline: 'Where the mountain meets its mirror',
  emphasis: 'mountain',
  location: 'Chamonix',
};

const LOOKS: readonly [string, Look][] = [
  ['typewriter', TYPEWRITER],
  ['title-card', TITLE_CARD],
  ['subtitle', SUBTITLE],
  ['edge-caps', EDGE_CAPS],
];

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

describe.each(LOOKS)('%s', (id, look) => {
  it('is registered under its own id and prefers at least one band', () => {
    expect(look.id).toBe(id);
    expect(look.prefer.length).toBeGreaterThan(0);
  });

  it('composes the headline into the frame', () => {
    const composition = look.compose(CONTENT, CALM);

    expect(composition.parts.length).toBeGreaterThan(0);
    expect(allText(composition)).toContain(CONTENT.headline);
    expect(composition.accent).toBe(DEFAULT_ACCENT);
  });

  it('composes a silent frame to nothing at all', () => {
    for (const headline of ['', '   ']) {
      const composition = look.compose({ ...CONTENT, headline }, CALM);

      expect(composition.parts).toEqual([]);
      expect(composition.scrim).toBeNull();
      expect(composition.panel).toBeUndefined();
      expect(composition.border).toBeUndefined();
    }
  });

  it('never throws on sparse content or a photo that is busy everywhere', () => {
    const sparse: FrameContent[] = [
      { headline: 'Just this' },
      { headline: 'Just this', emphasis: 'not in here' },
      { headline: 'Just this', kicker: '   ', location: '   ' },
      { headline: 'Just this', kicker: 'Day one', location: 'Chamonix' },
    ];

    for (const content of sparse) {
      for (const photo of [CALM, BUSY]) {
        expect(() => look.compose(content, photo)).not.toThrow();
        expect(look.compose(content, photo).parts.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the type column inside the frame', () => {
    const { leftPct, rightPct, offsetHPct } = look.compose(CONTENT, CALM);

    expect(leftPct).toBeGreaterThan(0);
    expect(rightPct).toBeGreaterThan(0);
    expect(leftPct + rightPct).toBeLessThan(50);
    expect(offsetHPct).toBeGreaterThanOrEqual(0);
    expect(offsetHPct).toBeLessThan(100);
  });

  // 7.25: the place must render once. A Look that sets it in its own design
  // says so, and the sticker layer then suppresses the duplicate — so the flag
  // has to describe THIS call, not what the Look does in general.
  it.each(LOCATION_CASES)(
    'flags the place as consumed for %s only when it set the place itself',
    (_case, content) => {
      const composition = look.compose(content, CALM);
      const place = content.location?.trim() ?? '';
      const drawn = place !== '' && allText(composition).includes(place);

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
});

describe('typewriter', () => {
  it('draws a rule above the line, with or without a kicker over it', () => {
    for (const content of [CONTENT, { headline: CONTENT.headline }]) {
      const { parts } = TYPEWRITER.compose(content, CALM);
      const ruleAt = parts.findIndex((part) => part.kind === 'rule');
      const headlineAt = parts.findIndex(
        (part) => part.kind === 'text' && runText(part) === CONTENT.headline,
      );

      expect(ruleAt).toBeGreaterThanOrEqual(0);
      expect(ruleAt).toBeLessThan(headlineAt);
    }
  });

  it('sets the whole stack low and to the left', () => {
    const composition = TYPEWRITER.compose({ headline: CONTENT.headline }, CALM);

    expect(composition.anchor).toBe('bottom');
    expect(textOf(composition).every((part) => part.textAlign === 'left')).toBe(true);
  });
});

describe('title-card', () => {
  it('sits in the middle of the frame, clear of both edges', () => {
    const composition = TITLE_CARD.compose(CONTENT, CALM);

    // Anchored off an edge by a large fraction of the frame — the only way to
    // say "middle" in a model with just top and bottom anchors.
    expect(composition.offsetHPct).toBeGreaterThan(30);
    expect(composition.offsetHPct).toBeLessThan(60);
  });

  it('centres its type and brackets the line with a rule above and below', () => {
    const composition = TITLE_CARD.compose({ headline: CONTENT.headline }, CALM);
    const kinds = composition.parts.map((part) => part.kind);

    expect(textOf(composition).every((part) => part.textAlign === 'center')).toBe(true);
    expect(kinds).toEqual(['rule', 'text', 'rule']);
  });

  it('gives up the middle when the photo is busy there', () => {
    const busyMiddle = TITLE_CARD.compose(CONTENT, {
      ...CALM,
      bands: { top: 0.05, middle: 0.95, bottom: 0.05 },
    });

    expect(busyMiddle.offsetHPct).toBeLessThan(30);
  });
});

describe('subtitle', () => {
  it('emits exactly one text part and no furniture', () => {
    const composition = SUBTITLE.compose(CONTENT, CALM);

    expect(textOf(composition)).toHaveLength(1);
    expect(composition.parts).toHaveLength(1);
    expect(rulesOf(composition)).toHaveLength(0);
    expect(composition.panel).toBeUndefined();
    expect(composition.border).toBeUndefined();
  });

  it('sits centred at the very bottom on a scrim', () => {
    const composition = SUBTITLE.compose(CONTENT, CALM);

    expect(composition.anchor).toBe('bottom');
    expect(composition.offsetHPct).toBeLessThan(10);
    expect(textOf(composition)[0].textAlign).toBe('center');
    expect(composition.scrim?.from).toBe('bottom');
  });

  it('stays at the bottom even when the photo is busy there', () => {
    const composition = SUBTITLE.compose(CONTENT, BUSY);

    expect(composition.anchor).toBe('bottom');
  });

  it('sets a question larger than the same line stated as a statement', () => {
    // A subtitle has no furniture to signal with, so size is the only thing it
    // can say a question with (7.26). It still holds the bottom and stays one
    // bare part — the difference is that the line asks to be answered.
    const question = SUBTITLE.compose({ ...CONTENT, density: 'question' }, CALM);
    const statement = SUBTITLE.compose({ ...CONTENT, density: 'line' }, CALM);

    expect(textOf(question)[0].fontSizeWPct).toBeGreaterThan(textOf(statement)[0].fontSizeWPct);
    expect(question.parts).toHaveLength(1);
  });

  it('reaches its wash further up for a question, which holds the eye longer', () => {
    const question = SUBTITLE.compose({ ...CONTENT, density: 'question' }, CALM);
    const statement = SUBTITLE.compose({ ...CONTENT, density: 'line' }, CALM);

    expect(question.scrim?.extentHPct).toBeGreaterThan(statement.scrim!.extentHPct);
  });

  it('reads a question off the words when the model states no density', () => {
    const asked = SUBTITLE.compose({ headline: 'Who booked this place?' }, CALM);
    const told = SUBTITLE.compose({ headline: 'Someone booked this place' }, CALM);

    expect(textOf(asked)[0].fontSizeWPct).toBeGreaterThan(textOf(told)[0].fontSizeWPct);
  });
});

describe('edge-caps', () => {
  it('runs effectively the full width of the frame', () => {
    const composition = EDGE_CAPS.compose(CONTENT, CALM);

    expect(composition.leftPct + composition.rightPct).toBeLessThanOrEqual(10);
  });

  it('is a single line of caps hard against the edge, and nothing else', () => {
    const composition = EDGE_CAPS.compose(CONTENT, CALM);

    expect(composition.parts).toHaveLength(1);
    expect(textOf(composition)[0].textTransform).toBe('uppercase');
    expect(composition.offsetHPct).toBeLessThan(6);
  });

  it('names the place on the same line rather than adding a second one', () => {
    const composition = EDGE_CAPS.compose(CONTENT, CALM);

    expect(composition.parts).toHaveLength(1);
    expect(allText(composition)).toContain('Chamonix');
  });
});

/** Every text part of a composition. */
function textOf(composition: HasParts): TextPart[] {
  return composition.parts.filter((part): part is TextPart => part.kind === 'text');
}

/**
 * The largest type in the frame, whatever kind of part carries it — the size a
 * reader reads as the headline, without a test having to know which part a given
 * Look reaches for.
 */
function displayWPct(composition: HasParts): number {
  return Math.max(
    ...composition.parts.map((part) => (part.kind === 'rule' ? 0 : part.fontSizeWPct)),
  );
}

/** Every rule of a composition, in stack order. */
function rulesOf(composition: HasParts): RulePart[] {
  return composition.parts.filter((part): part is RulePart => part.kind === 'rule');
}

/** The visible text of a text part, runs joined. */
function runText(part: TextPart): string {
  return part.runs.map((run) => run.text).join('');
}

/** All the words a composition renders, joined — order preserved. */
function allText(composition: HasParts): string {
  return composition.parts
    .map((part) => {
      if (part.kind === 'text') return part.runs.map((run) => run.text).join('');
      if (part.kind === 'row') return `${part.left} ${part.right}`;
      if (part.kind === 'tag') return part.text;
      return '';
    })
    .join(' ');
}
