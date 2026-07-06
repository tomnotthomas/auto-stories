import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import type { Frame } from '@auto-stories/api-types';

import { Story } from './story';
import { StoryHarness } from './story.harness';
import { MAX_PHOTOS, StoryService } from '../../story/story.service';
import { GenerationService } from '../../story/generation.service';

const frames: Frame[] = [
  { photoId: 'a', order: 1, caption: 'Everyone made it to the lake' },
  { photoId: 'b', order: 2, caption: 'Then she blew out the candle' },
];

function imageFile(name: string): File {
  return new File(['bytes'], name, { type: 'image/jpeg' });
}

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

  it('preloads the current frame and its neighbours so paging stays in sync', async () => {
    const three: Frame[] = [
      { photoId: 'a', order: 1, caption: 'one' },
      { photoId: 'b', order: 2, caption: 'two' },
      { photoId: 'c', order: 3, caption: 'three' },
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

  describe('add a photo', () => {
    it('surfaces an Add-a-photo action directly in the refine bar', async () => {
      const harness = await render();
      await harness.clickRefine();
      expect(await harness.hasAddPhotoButton()).toBe(true);
    });

    it('enables Add-a-photo and shows no limit hint below the photo cap', async () => {
      const harness = await render();
      await harness.clickRefine();
      expect(await harness.isAddPhotoDisabled()).toBe(false);
      expect(await harness.hasAddPhotoLimitHint()).toBe(false);
    });

    it('keeps Add-a-photo visible but disabled, with a hint, at the photo cap', async () => {
      URL.createObjectURL = () => 'blob:mock';
      URL.revokeObjectURL = () => undefined;
      await TestBed.configureTestingModule({ imports: [Story] }).compileComponents();
      story = TestBed.inject(StoryService);
      story.addPhotos(Array.from({ length: MAX_PHOTOS }, (_, i) => imageFile(`p${i}.jpg`)));
      story.completeStory(
        story.photos().map((p, i) => ({ photoId: p.id, order: i + 1, caption: `c${i}` })),
        false,
      );
      const fixture = TestBed.createComponent(Story);
      const harness = await TestbedHarnessEnvironment.harnessForFixture(fixture, StoryHarness);
      await harness.clickRefine();
      // The button never disappears — it stays put and explains the limit (5.21).
      expect(await harness.hasAddPhotoButton()).toBe(true);
      expect(await harness.isAddPhotoDisabled()).toBe(true);
      expect(await harness.hasAddPhotoLimitHint()).toBe(true);
    });

    it('adds a picked photo to the pool and appends it without a full rebuild', async () => {
      URL.createObjectURL = () => 'blob:mock';
      URL.revokeObjectURL = () => undefined;
      let appendCalls = 0;
      let rebuildCalls = 0;
      const generation: Pick<
        GenerationService,
        'captionNewPhotos' | 'generate' | 'regenerateCaption'
      > = {
        captionNewPhotos: async () => {
          appendCalls++;
        },
        generate: async () => {
          rebuildCalls++;
        },
        regenerateCaption: async () => true,
      };
      await TestBed.configureTestingModule({
        imports: [Story],
        providers: [{ provide: GenerationService, useValue: generation }],
      }).compileComponents();
      story = TestBed.inject(StoryService);
      story.completeStory(frames, false);
      const fixture = TestBed.createComponent(Story);
      const before = story.photoCount();

      await (
        fixture.componentInstance as unknown as { onAddPhotos(e: Event): Promise<void> }
      ).onAddPhotos({ target: { files: [imageFile('new.jpg')], value: '' } } as unknown as Event);

      expect(story.photoCount()).toBe(before + 1);
      expect(appendCalls).toBe(1);
      expect(rebuildCalls).toBe(0);
    });
  });
});
