import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import type { Frame } from '@auto-stories/api-types';

import { Story } from './story';
import { StoryHarness } from './story.harness';
import { StoryService } from '../../story/story.service';

const frames: Frame[] = [
  { photoId: 'a', order: 1, caption: 'Everyone made it to the lake', style: { font: 'inter', weight: 'regular', case: 'normal', align: 'center', size: 'm', position: 'bottom-center', letterbox: 'blur' } },
  { photoId: 'b', order: 2, caption: 'Then she blew out the candle', style: { font: 'inter', weight: 'regular', case: 'normal', align: 'center', size: 'm', position: 'bottom-center', letterbox: 'blur' } },
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

  it("renders the AI's extra placed text blocks besides the caption", async () => {
    await TestBed.configureTestingModule({ imports: [Story] }).compileComponents();
    story = TestBed.inject(StoryService);
    const style = frames[0].style;
    story.completeStory(
      [
        {
          photoId: 'a',
          order: 1,
          caption: 'we ate everything',
          style,
          texts: [
            { text: 'we ate', font: 'playfair', weight: 'bold', case: 'normal', align: 'right', size: 'l', position: 'top-right' },
            { text: 'brunch · Tartine', font: 'inter', weight: 'regular', case: 'normal', align: 'left', size: 's', position: 'bottom-left' },
          ],
        },
      ],
      false,
    );
    const fixture = TestBed.createComponent(Story);
    const harness = await TestbedHarnessEnvironment.harnessForFixture(fixture, StoryHarness);

    expect(await harness.getCaption()).toBe('we ate everything');
    expect(await harness.extraTexts()).toEqual(['we ate', 'brunch · Tartine']);
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

  it('preloads the current frame and its neighbours so paging stays in sync', async () => {
    const three: Frame[] = [
      { photoId: 'a', order: 1, caption: 'one', style: { font: 'inter', weight: 'regular', case: 'normal', align: 'center', size: 'm', position: 'bottom-center', letterbox: 'blur' } },
      { photoId: 'b', order: 2, caption: 'two', style: { font: 'inter', weight: 'regular', case: 'normal', align: 'center', size: 'm', position: 'bottom-center', letterbox: 'blur' } },
      { photoId: 'c', order: 3, caption: 'three', style: { font: 'inter', weight: 'regular', case: 'normal', align: 'center', size: 'm', position: 'bottom-center', letterbox: 'blur' } },
    ];
    await TestBed.configureTestingModule({ imports: [Story] }).compileComponents();
    story = TestBed.inject(StoryService);
    story.completeStory(three, false);
    const fixture = TestBed.createComponent(Story);
    const harness = await TestbedHarnessEnvironment.harnessForFixture(fixture, StoryHarness);

    // On the first frame, the next one is already mounted; the far frame is not.
    expect(await harness.mountedFrameIds()).toEqual(['a', 'b']);

    await harness.tapNext();
    // Now on the middle frame, all three fall inside the ±1 preload window.
    expect(await harness.mountedFrameIds()).toEqual(['a', 'b', 'c']);
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

  describe('refine', () => {
    it('opens the caption editor when a caption is tapped in refine mode', async () => {
      const harness = await render();
      await harness.clickRefine();
      expect(await harness.getEditor()).toBeNull();
      await harness.tapCaption();
      expect(await harness.getEditor()).not.toBeNull();
    });

    it('adds an extra text block and opens its editor', async () => {
      const harness = await render();
      await harness.clickRefine();
      await harness.clickAddText();

      expect(story.frames()[0].extraTexts).toHaveLength(1);
      expect(await harness.getEditor()).not.toBeNull();
    });

    it('marks the coach mark seen once the user starts editing', async () => {
      const harness = await render();
      await harness.clickRefine();
      await harness.tapCaption();
      expect(story.coachSeen()).toBe(true);
    });

    it('edits the caption of the current frame through the editor', async () => {
      const harness = await render();
      await harness.clickRefine();
      await harness.tapCaption();
      const editor = await harness.getEditor();
      await editor!.setCaption('A brand new line');
      expect(story.frames()[0].caption).toBe('A brand new line');
    });

    it('toggles legibility of the current frame through the editor', async () => {
      const harness = await render();
      await harness.clickRefine();
      await harness.tapCaption();
      const editor = await harness.getEditor();
      await editor!.toggleLegibility();
      expect(story.frames()[0].legibility).toBe(false);
    });

    it('lists every frame on the reorder & remove screen', async () => {
      const harness = await render();
      await harness.clickRefine();
      expect(await harness.getFilmstrip()).toBeNull();
      await harness.clickManage();
      const filmstrip = await harness.getFilmstrip();
      expect(await filmstrip!.getThumbnailCount()).toBe(frames.length);
    });

    it('leaves refine mode when the refine bar Done is pressed', async () => {
      const harness = await render();
      await harness.clickRefine();
      await harness.clickDone();
      // Back in view mode: tap zones page the story again.
      await harness.tapNext();
      expect(await harness.getCaption()).toBe('Then she blew out the candle');
    });
  });
});
