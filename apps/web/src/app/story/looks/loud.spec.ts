import { DEFAULT_ACCENT } from '../accent-color';
import {
  textParts,
  type FrameContent,
  type Look,
  type PhotoAnalysis,
  type TextPart,
} from '../look';

import { MARKER } from './marker';
import { SPLIT_BLOCK } from './split-block';
import { STENCIL_CAPS } from './stencil-caps';
import { TICKER } from './ticker';

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

  it('is deterministic', () => {
    expect(look.compose(CONTENT, CALM)).toEqual(look.compose(CONTENT, CALM));
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
  it('shrinks its type as the headline grows, so the bar stays thin', () => {
    // The bar IS the Look. Without this a ~70-character headline wraps to four
    // lines and the ticker becomes a caption block.
    const short = TICKER.compose({ headline: 'We went higher' }, CALM);
    const long = TICKER.compose(
      { headline: 'Everyone made it to the lake before the cake even arrived and stayed all day' },
      CALM,
    );
    const size = (c: ReturnType<typeof TICKER.compose>): number => {
      const text = c.parts.find((part) => part.kind === 'text' && part.fontSizeWPct > 2.5);
      return text && text.kind === 'text' ? text.fontSizeWPct : 0;
    };

    expect(size(long)).toBeLessThan(size(short));
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

  it('steps the type down as the headline gets longer', () => {
    // Type this big fits about seven capitals to a line, so a headline the
    // model wrote long would otherwise run off the top of the frame.
    const sizes = ['Roof', 'Everyone made it to the roof', LONG_HEADLINE].map(
      (headline) => headlinePart(STENCIL_CAPS.compose({ headline }, CALM).parts)?.fontSizeWPct ?? 0,
    );

    expect(sizes[0]).toBeGreaterThan(sizes[1]);
    expect(sizes[1]).toBeGreaterThan(sizes[2]);
  });

  it('keeps the headline the largest type in the frame, even stepped down', () => {
    const composition = STENCIL_CAPS.compose({ ...CONTENT, headline: LONG_HEADLINE }, CALM);
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
