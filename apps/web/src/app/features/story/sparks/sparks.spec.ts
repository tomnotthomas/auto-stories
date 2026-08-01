import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { Clipboard } from '@angular/cdk/clipboard';
import type { Suggestion } from '@auto-stories/api-types';

import { StorySparks } from './sparks';
import { StorySparksHarness } from './sparks.harness';

function suggestion(partial: Partial<Suggestion>): Suggestion {
  return {
    type: 'location',
    query: 'Blue Bottle Coffee',
    position: 'bottom-left',
    confidence: 0.9,
    ...partial,
  };
}

describe('StorySparks', () => {
  let fixture: ComponentFixture<StorySparks>;
  let copied: string[];

  async function render(suggestions: Suggestion[]): Promise<StorySparksHarness> {
    copied = [];
    await TestBed.configureTestingModule({ imports: [StorySparks] }).compileComponents();
    const clipboard = TestBed.inject(Clipboard);
    vi.spyOn(clipboard, 'copy').mockImplementation((text: string) => {
      copied.push(text);
      return true;
    });
    fixture = TestBed.createComponent(StorySparks);
    fixture.componentRef.setInput('suggestions', suggestions);
    fixture.detectChanges();
    return TestbedHarnessEnvironment.harnessForFixture(fixture, StorySparksHarness);
  }

  afterEach(() => fixture?.destroy());

  it('renders one dot per positioned suggestion', async () => {
    const harness = await render([
      suggestion({ type: 'location', query: 'Tartine' }),
      suggestion({ type: 'poll', query: 'Best pastry?', position: 'top-right' }),
    ]);

    expect(await harness.dotCount()).toBe(2);
  });

  it('does not show a dot for story-level music (no anchor)', async () => {
    const harness = await render([
      suggestion({ type: 'location', query: 'Tartine' }),
      { type: 'music', query: 'indie folk', confidence: 0.6 },
    ]);

    expect(await harness.dotCount()).toBe(1);
  });

  it('renders nothing when there are no suggestions', async () => {
    const harness = await render([]);

    expect(await harness.dotCount()).toBe(0);
    expect(await harness.isBloomOpen()).toBe(false);
  });

  it('blooms the suggestion term when its dot is tapped', async () => {
    const harness = await render([suggestion({ query: 'Blue Bottle Coffee' })]);

    expect(await harness.isBloomOpen()).toBe(false);
    await harness.openDot(0);

    expect(await harness.isBloomOpen()).toBe(true);
    expect(await harness.openQuery()).toBe('Blue Bottle Coffee');
  });

  it('copies the exact term to the clipboard and confirms', async () => {
    const harness = await render([suggestion({ query: 'Blue Bottle Coffee' })]);
    await harness.openDot(0);

    await harness.clickCopy();

    expect(copied).toEqual(['Blue Bottle Coffee']);
    expect(await harness.isCopied()).toBe(true);
  });

  it('closes the bloom when the open dot is tapped again', async () => {
    const harness = await render([suggestion({ query: 'Tartine' })]);
    await harness.openDot(0);
    expect(await harness.isBloomOpen()).toBe(true);

    await harness.openDot(0);

    expect(await harness.isBloomOpen()).toBe(false);
  });
});
