import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { Clipboard } from '@angular/cdk/clipboard';
import type { Frame, Style, Suggestion } from '@auto-stories/api-types';

import { HandoffChecklist } from './handoff-checklist';
import { HandoffChecklistHarness } from './handoff-checklist.harness';
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
  return { photoId, order, caption: `caption ${order}`, style: STYLE, suggestions };
}

describe('HandoffChecklist', () => {
  let fixture: ComponentFixture<HandoffChecklist>;
  let story: StoryService;
  let copied: string[];

  async function render(frames: Frame[]): Promise<HandoffChecklistHarness> {
    copied = [];
    URL.createObjectURL = () => 'blob:mock';
    URL.revokeObjectURL = () => undefined;
    await TestBed.configureTestingModule({ imports: [HandoffChecklist] }).compileComponents();
    story = TestBed.inject(StoryService);
    vi.spyOn(TestBed.inject(Clipboard), 'copy').mockImplementation((text: string) => {
      copied.push(text);
      return true;
    });
    story.completeStory(frames, false);
    fixture = TestBed.createComponent(HandoffChecklist);
    fixture.detectChanges();
    return TestbedHarnessEnvironment.harnessForFixture(fixture, HandoffChecklistHarness);
  }

  afterEach(() => fixture?.destroy());

  it('lists every kept suggestion across the story, in frame order', async () => {
    const harness = await render([
      frame('p1', 1, [{ type: 'location', query: 'Tartine', confidence: 0.9 }]),
      frame('p2', 2, [
        { type: 'music', query: 'indie folk', confidence: 0.6 },
        { type: 'poll', query: 'Best pastry?', confidence: 0.7 },
      ]),
    ]);

    expect(await harness.itemCount()).toBe(3);
    expect(await harness.queryTexts()).toEqual(['Tartine', 'indie folk', 'Best pastry?']);
  });

  it('renders nothing when no frame has a suggestion', async () => {
    const harness = await render([frame('p1', 1, [])]);
    expect(await harness.itemCount()).toBe(0);
  });

  it('omits suggestions the user dismissed in the overlay', async () => {
    const harness = await render([
      frame('p1', 1, [
        { type: 'location', query: 'Tartine', confidence: 0.9 },
        { type: 'poll', query: 'Best pastry?', confidence: 0.7 },
      ]),
    ]);
    story.dismissSpark('p1', 0);
    fixture.detectChanges();

    expect(await harness.queryTexts()).toEqual(['Best pastry?']);
  });

  it('copies an add-on term for the Instagram search', async () => {
    const harness = await render([
      frame('p1', 1, [{ type: 'location', query: 'Blue Bottle Coffee', confidence: 0.9 }]),
    ]);

    await harness.clickCopy(0);

    expect(copied).toEqual(['Blue Bottle Coffee']);
  });

  it('ticks an add-on off, sharing done-state with the overlay', async () => {
    const harness = await render([
      frame('p1', 1, [{ type: 'location', query: 'Tartine', confidence: 0.9 }]),
    ]);

    await harness.clickDone(0);

    expect(story.sparks().get('p1#0')?.done).toBe(true);
  });
});
