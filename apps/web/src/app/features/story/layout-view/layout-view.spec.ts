import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';

import {
  composeFrame,
  type Composition,
  type FrameContent,
  type Part,
  type PhotoAnalysis,
  type Run,
  type TagPart,
  type TextPart,
} from '../../../story/look';
import { LayoutView } from './layout-view';
import { LayoutViewHarness } from './layout-view.harness';

const CALM: PhotoAnalysis = {
  accent: 'rgb(232, 102, 58)',
  bands: { top: 0.1, middle: 0.1, bottom: 0.1 },
};

/** One frame with nothing on it — the base every hand-built case varies. */
const BLANK: Composition = {
  lookId: 'magazine-masthead',
  ink: 'light',
  leftPct: 7,
  rightPct: 7,
  anchor: 'bottom',
  offsetHPct: 8,
  scrim: null,
  accent: 'rgb(232, 102, 58)',
  parts: [],
};

/** Type that says nothing in particular, so each test only states what it tests. */
const TYPE = {
  fontFamily: 'serif',
  fontWeight: 700,
  fontSizeWPct: 8,
  lineHeight: 1.1,
  letterSpacingEm: 0,
  textTransform: 'none',
  textAlign: 'left',
  color: 'ink',
} as const;

function frame(parts: readonly Part[], extra: Partial<Composition> = {}): Composition {
  return { ...BLANK, parts, ...extra };
}

function text(runs: readonly Run[], extra: Partial<TextPart> = {}): TextPart {
  return { kind: 'text', ...TYPE, runs, gapHPct: 0, ...extra };
}

function tag(style: TagPart['style'], extra: Partial<TagPart> = {}): TagPart {
  return { kind: 'tag', ...TYPE, text: 'Zermatt', style, gapHPct: 2, ...extra };
}

async function renderComposition(
  composition: Composition,
  accent?: string,
): Promise<LayoutViewHarness> {
  await TestBed.configureTestingModule({ imports: [LayoutView] }).compileComponents();
  const fixture = TestBed.createComponent(LayoutView);
  fixture.componentRef.setInput('composition', composition);
  if (accent) fixture.componentRef.setInput('accent', accent);
  fixture.detectChanges();
  return TestbedHarnessEnvironment.harnessForFixture(fixture, LayoutViewHarness);
}

async function render(content: FrameContent, accent?: string): Promise<LayoutViewHarness> {
  return renderComposition(composeFrame('magazine-masthead', content, CALM), accent);
}

describe('LayoutView', () => {
  it('renders the headline', async () => {
    const harness = await render({ headline: 'Where the mountain meets its mirror' });

    expect((await harness.textContents()).join(' ')).toContain(
      'Where the mountain meets its mirror',
    );
  });

  it('renders the kicker alongside the headline', async () => {
    const harness = await render({
      kicker: 'The Ascent',
      headline: 'Where the mountain meets its mirror',
    });

    expect(await harness.textCount()).toBe(2);
    expect((await harness.textContents()).join(' ')).toContain('The Ascent');
  });

  it('renders no kicker block when the frame has none', async () => {
    const harness = await render({ headline: 'Where the mountain meets its mirror' });

    expect(await harness.textCount()).toBe(1);
  });

  it('renders the accent tab that leads the kicker', async () => {
    const harness = await render({ kicker: 'The Ascent', headline: 'A line' });

    expect(await harness.tabCount()).toBe(1);
  });

  it('renders no accent tab when there is no kicker', async () => {
    const harness = await render({ headline: 'A line' });

    expect(await harness.tabCount()).toBe(0);
  });

  it('marks the emphasised phrase', async () => {
    const harness = await render({
      headline: 'Where the mountain meets its mirror',
      emphasis: 'mountain',
    });

    expect(await harness.markTexts()).toEqual(['mountain']);
  });

  it('marks nothing when the emphasis is not in the headline', async () => {
    const harness = await render({
      headline: 'Where the mountain meets its mirror',
      emphasis: 'elsewhere',
    });

    expect(await harness.markTexts()).toEqual([]);
  });

  it('renders the masthead rule', async () => {
    const harness = await render({ headline: 'A line' });

    expect(await harness.ruleCount()).toBeGreaterThan(0);
  });

  it('renders the byline row when the frame names a place', async () => {
    const harness = await render({ headline: 'A line', location: 'Zermatt' });

    expect(await harness.rowCount()).toBe(1);
    expect((await harness.rowContents()).join(' ')).toContain('Zermatt');
  });

  it('renders no byline row without a place', async () => {
    const harness = await render({ headline: 'A line' });

    expect(await harness.rowCount()).toBe(0);
  });

  it('renders the legibility scrim', async () => {
    const harness = await render({ headline: 'A line' });

    expect(await harness.hasScrim()).toBe(true);
  });

  it('still renders the headline when no accent was sampled', async () => {
    const harness = await render({ headline: 'A line', emphasis: 'line' });

    expect(await harness.markTexts()).toEqual(['line']);
  });

  describe('marks', () => {
    const MARKS = ['accent-underline', 'accent-block', 'highlighter', 'hand-underline'] as const;

    for (const mark of MARKS) {
      it(`draws the ${mark} the Look asked for`, async () => {
        const harness = await renderComposition(
          frame([
            text([{ text: 'up where it feels like the ' }, { text: 'top', emphasised: true }], {
              mark,
            }),
          ]),
        );

        expect(await harness.markTexts()).toEqual(['top']);
        expect(await harness.markKinds()).toEqual([mark]);
      });
    }

    it('leaves an emphasised run unmarked when the Look draws no mark', async () => {
      const harness = await renderComposition(
        frame([text([{ text: 'plain' }, { text: 'emphasis', emphasised: true }])]),
      );

      expect(await harness.markTexts()).toEqual([]);
    });

    it('keeps the runs flush, whatever the mark', async () => {
      const harness = await renderComposition(
        frame([
          text([{ text: 'cousins' }, { text: ', one cake', emphasised: true }], {
            mark: 'hand-underline',
          }),
        ]),
      );

      expect(await harness.textContents()).toEqual(['cousins, one cake']);
    });
  });

  describe('stencilled type', () => {
    it('draws a stroked part as an outline', async () => {
      const harness = await renderComposition(
        frame([text([{ text: 'STENCIL' }], { stroke: true })]),
      );

      expect(await harness.stencilledTextCount()).toBe(1);
      expect(await harness.textContents()).toEqual(['STENCIL']);
    });

    it('fills a part that is not stroked', async () => {
      const harness = await renderComposition(frame([text([{ text: 'SOLID' }])]));

      expect(await harness.stencilledTextCount()).toBe(0);
    });
  });

  describe('tags', () => {
    it('renders a tag with its label', async () => {
      const harness = await renderComposition(frame([tag('pill', { text: 'Crystal Lake' })]));

      expect(await harness.tagCount()).toBe(1);
      expect(await harness.tagContents()).toEqual(['Crystal Lake']);
    });

    it('renders each tag in the style the Look chose', async () => {
      const harness = await renderComposition(
        frame([tag('pill'), tag('tape'), tag('stamp'), tag('chip')]),
      );

      expect(await harness.tagStyles()).toEqual(['pill', 'tape', 'stamp', 'chip']);
    });

    it('renders a tag alongside the type it is set apart from', async () => {
      const harness = await renderComposition(
        frame([text([{ text: 'everyone made it to the lake' }]), tag('tape')]),
      );

      expect(await harness.textCount()).toBe(1);
      expect(await harness.tagCount()).toBe(1);
    });

    it('renders no tag when the composition has none', async () => {
      const harness = await render({ headline: 'A line', location: 'Zermatt' });

      expect(await harness.tagCount()).toBe(0);
    });

    it('tilts a tag the Look angled by hand', async () => {
      const harness = await renderComposition(frame([tag('tape', { rotationDeg: 3 })]));

      expect(await harness.tagContents()).toEqual(['Zermatt']);
    });
  });

  describe('panel', () => {
    const PANEL = {
      color: 'paper',
      opacity: 0.92,
      padWPct: 6,
      padHPct: 4,
      radiusWPct: 2,
      fullWidth: false,
    } as const;

    it('draws a panel behind the stack when the Look calls for one', async () => {
      const harness = await renderComposition(
        frame([text([{ text: 'A gallery label' }])], { panel: PANEL }),
      );

      expect(await harness.hasPanel()).toBe(true);
      expect(await harness.textContents()).toEqual(['A gallery label']);
    });

    it('draws no panel when the Look has none', async () => {
      const harness = await renderComposition(frame([text([{ text: 'A line' }])]));

      expect(await harness.hasPanel()).toBe(false);
    });

    it('drops the panel when there is no type to sit behind', async () => {
      const harness = await renderComposition(frame([], { panel: PANEL }));

      expect(await harness.hasPanel()).toBe(false);
    });

    it('keeps the type when the panel runs edge to edge', async () => {
      const harness = await renderComposition(
        frame([text([{ text: 'A ticker' }])], { panel: { ...PANEL, fullWidth: true, opacity: 1 } }),
      );

      expect(await harness.hasPanel()).toBe(true);
      expect(await harness.textContents()).toEqual(['A ticker']);
    });
  });

  describe('border', () => {
    it('draws the inset frame the Look calls for', async () => {
      const harness = await renderComposition(
        frame([text([{ text: 'A print' }])], {
          border: { insetWPct: 3.4, widthWPct: 0.7, color: 'paper', radiusWPct: 0 },
        }),
      );

      expect(await harness.hasBorder()).toBe(true);
    });

    it('draws no frame when the Look has none', async () => {
      const harness = await renderComposition(frame([text([{ text: 'A print' }])]));

      expect(await harness.hasBorder()).toBe(false);
    });
  });

  describe('rotation', () => {
    it('tilts the whole stack by the composed angle', async () => {
      const harness = await renderComposition(
        frame([text([{ text: 'laid down by hand' }])], { rotationDeg: -2.2 }),
      );

      expect(await harness.stackTiltDeg()).toBe(-2.2);
    });

    it('leaves the stack square when the Look does not tilt it', async () => {
      const harness = await renderComposition(frame([text([{ text: 'typeset' }])]));

      expect(await harness.stackTiltDeg()).toBeNull();
    });

    it('leaves the stack square for a zero tilt', async () => {
      const harness = await renderComposition(
        frame([text([{ text: 'typeset' }])], { rotationDeg: 0 }),
      );

      expect(await harness.stackTiltDeg()).toBeNull();
    });
  });
});
