import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import type { Layout, LayoutElement } from '@auto-stories/api-types';

import { LayoutView } from './layout-view';
import { LayoutViewHarness } from './layout-view.harness';

function element(over: Partial<LayoutElement> = {}): LayoutElement {
  return {
    role: 'title',
    text: 'Golden hour',
    font: 'playfair',
    weight: 'bold',
    case: 'normal',
    align: 'left',
    size: 4,
    tracking: 'normal',
    leading: 'normal',
    x: 8,
    y: 12,
    anchor: 'top-left',
    ...over,
  };
}

async function render(layout: Layout): Promise<LayoutViewHarness> {
  await TestBed.configureTestingModule({ imports: [LayoutView] }).compileComponents();
  const fixture = TestBed.createComponent(LayoutView);
  fixture.componentRef.setInput('layout', layout);
  fixture.detectChanges();
  return TestbedHarnessEnvironment.harnessForFixture(fixture, LayoutViewHarness);
}

describe('LayoutView', () => {
  it('renders one element per spec element, with its text', async () => {
    const harness = await render({
      elements: [element({ text: 'Golden hour' }), element({ text: 'the coast', role: 'deck' })],
    });
    expect(await harness.elementCount()).toBe(2);
    expect(await harness.lineTexts()).toEqual(['Golden hour', 'the coast']);
  });

  it('renders a stacked element as one line per word', async () => {
    const harness = await render({
      elements: [element({ text: 'we drove till', stack: true })],
    });
    expect(await harness.elementCount()).toBe(1);
    expect(await harness.lineTexts()).toEqual(['we', 'drove', 'till']);
  });

  it('renders every element when per-element readability is supplied', async () => {
    await TestBed.configureTestingModule({ imports: [LayoutView] }).compileComponents();
    const fixture = TestBed.createComponent(LayoutView);
    fixture.componentRef.setInput('layout', {
      elements: [element({ text: 'Golden hour' }), element({ text: 'the coast', role: 'deck' })],
    });
    // Different readability per element (dark title in the sky, light deck below).
    fixture.componentRef.setInput('readable', [
      { light: false, scrim: true },
      { light: true, scrim: false },
    ]);
    fixture.detectChanges();
    const harness = await TestbedHarnessEnvironment.harnessForFixture(fixture, LayoutViewHarness);

    expect(await harness.lineTexts()).toEqual(['Golden hour', 'the coast']);
  });
});
