import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import type { Frame } from '@auto-stories/api-types';

import { Story } from './story';
import { StoryHarness } from './story.harness';
import { StoryService } from '../../story/story.service';

const frames: Frame[] = [
  { photoId: 'a', order: 1, caption: 'Everyone made it to the lake' },
  { photoId: 'b', order: 2, caption: 'Then she blew out the candle' },
];

describe('Story', () => {
  let story: StoryService;

  async function render(partial = false): Promise<StoryHarness> {
    await TestBed.configureTestingModule({ imports: [Story] }).compileComponents();
    story = TestBed.inject(StoryService);
    story.completeStory(frames, partial);
    const fixture = TestBed.createComponent(Story);
    return TestbedHarnessEnvironment.harnessForFixture(fixture, StoryHarness);
  }

  it('shows the first frame caption', async () => {
    const harness = await render();
    expect(await harness.getCaption()).toBe('Everyone made it to the lake');
  });

  it('advances to the next frame on tap', async () => {
    const harness = await render();
    await harness.tapNext();
    expect(await harness.getCaption()).toBe('Then she blew out the candle');
  });

  it('does not advance past the last frame', async () => {
    const harness = await render();
    await harness.tapNext();
    await harness.tapNext();
    expect(await harness.getCaption()).toBe('Then she blew out the candle');
  });

  it('hides the dropped-photo banner for a complete story', async () => {
    expect(await (await render(false)).hasDroppedBanner()).toBe(false);
  });

  it('shows the dropped-photo banner for a partial story', async () => {
    expect(await (await render(true)).hasDroppedBanner()).toBe(true);
  });

  it('starts over from the beginning', async () => {
    const harness = await render();
    await harness.clickStartOver();
    expect(story.phase()).toBe('example');
  });
});
