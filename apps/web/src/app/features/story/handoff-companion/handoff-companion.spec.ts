import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { Clipboard } from '@angular/cdk/clipboard';
import type { Frame, Style, Suggestion } from '@auto-stories/api-types';

import { HandoffCompanion } from './handoff-companion';
import { HandoffCompanionHarness } from './handoff-companion.harness';
import { StoryService, sparkKey } from '../../../story/story.service';

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
  return { photoId, order, caption: `caption ${order}`, style: STYLE, suggestions };
}

function imageFile(name: string): File {
  return new File(['bytes'], name, { type: 'image/jpeg' });
}

describe('HandoffCompanion', () => {
  let fixture: ComponentFixture<HandoffCompanion>;
  let story: StoryService;
  let copied: string[];
  let closed: number;

  /** Seed photos + a story whose frames carry the given suggestions. */
  async function render(frameSuggestions: Suggestion[][]): Promise<HandoffCompanionHarness> {
    copied = [];
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
    fixture.componentInstance.done.subscribe(() => (closed += 1));
    fixture.detectChanges();
    return TestbedHarnessEnvironment.harnessForFixture(fixture, HandoffCompanionHarness);
  }

  afterEach(() => fixture?.destroy());

  it('shows the first idea, and only frames that carry one', async () => {
    const harness = await render([
      [{ type: 'location', query: 'Tartine', confidence: 0.9 }],
      [], // frame 2 has no suggestion — it is skipped
      [{ type: 'poll', query: 'Best pastry?', confidence: 0.7 }],
    ]);

    expect(await harness.isShowingCard()).toBe(true);
    expect(await harness.term()).toBe('Tartine');
  });

  it('copies the current term for the Instagram sticker', async () => {
    const harness = await render([[{ type: 'location', query: 'Bixby Bridge', confidence: 0.9 }]]);

    await harness.clickCopy();

    expect(copied).toEqual(['Bixby Bridge']);
    expect(await harness.isCopied()).toBe(true);
  });

  it('advances to the next idea on "Added it → next"', async () => {
    const harness = await render([
      [{ type: 'location', query: 'Tartine', confidence: 0.9 }],
      [{ type: 'poll', query: 'Best pastry?', confidence: 0.7 }],
    ]);

    await harness.clickNext();

    expect(await harness.term()).toBe('Best pastry?');
  });

  it('closes when the last idea is passed', async () => {
    const harness = await render([[{ type: 'location', query: 'Tartine', confidence: 0.9 }]]);

    await harness.clickNext();

    expect(closed).toBe(1);
  });

  it('dismisses an idea and slides the next one in', async () => {
    const harness = await render([
      [{ type: 'location', query: 'Tartine', confidence: 0.9 }],
      [{ type: 'poll', query: 'Best pastry?', confidence: 0.7 }],
    ]);

    await harness.clickDismiss();

    expect(story.sparks().get(sparkKey(story.photos()[0].id, 0))?.dismissed).toBe(true);
    expect(await harness.term()).toBe('Best pastry?');
  });

  it('closes on Done', async () => {
    const harness = await render([[{ type: 'location', query: 'Tartine', confidence: 0.9 }]]);

    await harness.clickDone();

    expect(closed).toBe(1);
  });
});
