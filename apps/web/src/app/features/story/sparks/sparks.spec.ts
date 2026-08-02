import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import type { Suggestion } from '@auto-stories/api-types';

import { StorySparks } from './sparks';
import { StorySparksHarness } from './sparks.harness';
import { StoryService } from '../../../story/story.service';

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
  let story: StoryService;

  async function render(suggestions: Suggestion[], photoId = 'p1'): Promise<StorySparksHarness> {
    await TestBed.configureTestingModule({ imports: [StorySparks] }).compileComponents();
    story = TestBed.inject(StoryService);
    fixture = TestBed.createComponent(StorySparks);
    fixture.componentRef.setInput('photoId', photoId);
    fixture.componentRef.setInput('suggestions', suggestions);
    fixture.detectChanges();
    return TestbedHarnessEnvironment.harnessForFixture(fixture, StorySparksHarness);
  }

  afterEach(() => fixture?.destroy());

  it('draws a type-shaped marker per positioned suggestion, previewing the term', async () => {
    const harness = await render([
      suggestion({ type: 'location', query: 'Tartine' }),
      suggestion({ type: 'poll', query: 'Best pastry?', position: 'top-right' }),
    ]);

    expect(await harness.markerCount()).toBe(2);
    expect(await harness.queryTexts()).toEqual(['Tartine', 'Best pastry?']);
  });

  it('shapes each marker by its suggestion type', async () => {
    const harness = await render([
      suggestion({ type: 'location', query: 'Tartine' }),
      suggestion({ type: 'mention', query: 'maya.r', position: 'top-left' }),
      suggestion({ type: 'gif', query: 'confetti', position: 'top-center' }),
    ]);

    expect(await harness.markerTypes()).toEqual(['location', 'mention', 'gif']);
  });

  it('previews story-level music as a docked chip, not a marker', async () => {
    const harness = await render([
      suggestion({ type: 'location', query: 'Tartine' }),
      { type: 'music', query: 'indie folk', confidence: 0.6 },
    ]);

    expect(await harness.markerCount()).toBe(1);
    expect(await harness.musicCount()).toBe(1);
    expect(await harness.musicQuery()).toBe('indie folk');
  });

  it('renders nothing when there are no suggestions', async () => {
    const harness = await render([]);
    expect(await harness.markerCount()).toBe(0);
    expect(await harness.musicCount()).toBe(0);
  });

  it('hides a suggestion the user dismissed, keyed by its original index', async () => {
    // location@0, music@1, poll@2 — dismissing the poll must hide index 2.
    const harness = await render(
      [
        suggestion({ type: 'location', query: 'Tartine' }),
        { type: 'music', query: 'lo-fi', confidence: 0.5 },
        suggestion({ type: 'poll', query: 'Best pastry?', position: 'top-right' }),
      ],
      'p1',
    );
    expect(await harness.markerCount()).toBe(2);

    story.dismissSpark('p1', 2);
    fixture.detectChanges();

    expect(await harness.queryTexts()).toEqual(['Tartine']);
    expect(await harness.musicCount()).toBe(1);
  });
});
