import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';

import { composeFrame, type FrameContent, type PhotoAnalysis } from '../../../story/look';
import { LayoutView } from './layout-view';
import { LayoutViewHarness } from './layout-view.harness';

const CALM: PhotoAnalysis = {
  accent: 'rgb(232, 102, 58)',
  bands: { top: 0.1, middle: 0.1, bottom: 0.1 },
};

async function render(content: FrameContent, accent?: string): Promise<LayoutViewHarness> {
  await TestBed.configureTestingModule({ imports: [LayoutView] }).compileComponents();
  const fixture = TestBed.createComponent(LayoutView);
  fixture.componentRef.setInput('composition', composeFrame('magazine-masthead', content, CALM));
  if (accent) fixture.componentRef.setInput('accent', accent);
  fixture.detectChanges();
  return TestbedHarnessEnvironment.harnessForFixture(fixture, LayoutViewHarness);
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
});
