import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { Clipboard } from '@angular/cdk/clipboard';
import type { Frame, Style, Suggestion } from '@auto-stories/api-types';

import { HandoffCompanion } from './handoff-companion';
import { HandoffCompanionHarness } from './handoff-companion.harness';
import { StoryService } from '../../../story/story.service';

const STYLE: Style = {
  font: 'inter',
  weight: 'regular',
  case: 'normal',
  align: 'center',
  size: 'm',
  position: 'bottom-center',
  letterbox: 'blur',
};

function frame(photoId: string, order: number, suggestions: Suggestion[]): Frame {
  return { photoId, order, caption: `caption ${order}`, headline: `caption ${order}`, style: STYLE, suggestions };
}

function imageFile(name: string): File {
  return new File(['bytes'], name, { type: 'image/jpeg' });
}

describe('HandoffCompanion (card)', () => {
  let fixture: ComponentFixture<HandoffCompanion>;
  let story: StoryService;
  let copied: string[];
  let saved: number;
  let closed: number;

  /** Seed photos + a story whose frames carry the given suggestions. */
  async function render(frameSuggestions: Suggestion[][]): Promise<HandoffCompanionHarness> {
    copied = [];
    saved = 0;
    closed = 0;
    URL.createObjectURL = () => 'blob:mock';
    URL.revokeObjectURL = () => undefined;
    await TestBed.configureTestingModule({ imports: [HandoffCompanion] }).compileComponents();
    story = TestBed.inject(StoryService);
    vi.spyOn(TestBed.inject(Clipboard), 'copy').mockImplementation((t: string) => {
      copied.push(t);
      return true;
    });
    story.addPhotos(frameSuggestions.map((_, i) => imageFile(`p${i + 1}.jpg`)));
    const ids = story.photos().map((p) => p.id);
    story.completeStory(
      frameSuggestions.map((sugg, i) => frame(ids[i], i + 1, sugg)),
      false,
    );
    fixture = TestBed.createComponent(HandoffCompanion);
    fixture.componentInstance.save.subscribe(() => (saved += 1));
    fixture.componentInstance.done.subscribe(() => (closed += 1));
    fixture.detectChanges();
    return TestbedHarnessEnvironment.harnessForFixture(fixture, HandoffCompanionHarness);
  }

  afterEach(() => fixture?.destroy());

  it('lists every kept add-on across frames, skipping frames with none', async () => {
    const harness = await render([
      [{ type: 'location', query: 'Tartine', confidence: 0.9 }],
      [], // frame 2 has no add-on
      [
        { type: 'music', query: 'indie folk', confidence: 0.6 },
        { type: 'poll', query: 'Best pastry?', confidence: 0.7 },
      ],
    ]);

    expect(await harness.itemCount()).toBe(3);
    expect(await harness.termTexts()).toEqual(['Tartine', 'indie folk', 'Best pastry?']);
  });

  it('leads with the location as the hero, wherever it falls in the story', async () => {
    const harness = await render([
      [{ type: 'music', query: 'indie folk', confidence: 0.6 }],
      [{ type: 'location', query: 'Bixby Bridge', confidence: 0.9 }],
    ]);

    // Hero (the place) is listed first even though its frame is second.
    expect(await harness.termTexts()).toEqual(['Bixby Bridge', 'indie folk']);
  });

  it('shows no add-ons when no frame has one', async () => {
    const harness = await render([[], []]);
    expect(await harness.itemCount()).toBe(0);
  });

  it('copies an add-on term and confirms', async () => {
    const harness = await render([[{ type: 'location', query: 'Bixby Bridge', confidence: 0.9 }]]);

    await harness.clickCopy(0);

    expect(copied).toEqual(['Bixby Bridge']);
    expect(await harness.isCopied(0)).toBe(true);
  });

  it('drops an add-on when the user dismisses it, leaving the rest', async () => {
    const harness = await render([
      [{ type: 'location', query: 'Tartine', confidence: 0.9 }],
      [{ type: 'poll', query: 'Best pastry?', confidence: 0.7 }],
    ]);
    expect(await harness.itemCount()).toBe(2);

    await harness.clickDismiss(0); // drop the hero (the place)
    fixture.detectChanges();

    expect(await harness.termTexts()).toEqual(['Best pastry?']);
  });

  it('emits save when the user confirms the hand-off', async () => {
    const harness = await render([[{ type: 'location', query: 'Tartine', confidence: 0.9 }]]);

    await harness.clickSaveAndOpen();

    expect(saved).toBe(1);
  });

  it('emits done when the user dismisses the card ("Not now")', async () => {
    const harness = await render([[{ type: 'location', query: 'Tartine', confidence: 0.9 }]]);

    await harness.clickAllSet();

    expect(closed).toBe(1);
  });
});
