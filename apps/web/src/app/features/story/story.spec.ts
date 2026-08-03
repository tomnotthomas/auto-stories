import type { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import type { Frame } from '@auto-stories/api-types';

import { Story } from './story';
import { StoryHarness } from './story.harness';
import { StoryService, type EditableFrame } from '../../story/story.service';
import { StoryExporter } from '../../story/story-exporter.service';
import { composeFrame, type Composition, type PhotoAnalysis } from '../../story/look';

/** An evenly lit photo, so the Look's band choice is not what's under test. */
const CALM_PHOTO: PhotoAnalysis = {
  accent: '#e8663a',
  bands: { top: 0.1, middle: 0.1, bottom: 0.1 },
};

/**
 * Put a composition on a frame directly. The service composes frames inside
 * computeReadable(), which needs a decoded bitmap — jsdom has no canvas, so the
 * render path is exercised by seeding the same state the decode would produce.
 */
function setComposition(service: StoryService, photoId: string, composition: Composition): void {
  const frames = (service as unknown as { _frames: WritableSignal<readonly EditableFrame[]> })
    ._frames;
  frames.update((list) =>
    list.map((frame) => (frame.photoId === photoId ? { ...frame, composition } : frame)),
  );
}

const frames: Frame[] = [
  { photoId: 'a', order: 1, caption: 'Everyone made it to the lake', headline: 'Everyone made it to the lake', style: { font: 'inter', weight: 'regular', case: 'normal', align: 'center', size: 'm', position: 'bottom-center', letterbox: 'blur' } },
  { photoId: 'b', order: 2, caption: 'Then she blew out the candle', headline: 'Then she blew out the candle', style: { font: 'inter', weight: 'regular', case: 'normal', align: 'center', size: 'm', position: 'bottom-center', letterbox: 'blur' } },
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
          caption: 'we ate everything', headline: 'we ate everything',
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

  it("renders the frame's composition when it has composed under the story Look", async () => {
    await TestBed.configureTestingModule({ imports: [Story] }).compileComponents();
    story = TestBed.inject(StoryService);
    const style = frames[0].style;
    const content = { kicker: 'The coast', headline: 'Golden hour' };
    story.completeStory(
      [{ photoId: 'a', order: 1, caption: 'we ate everything', ...content, style }],
      false,
      'magazine-masthead',
    );
    setComposition(story, 'a', composeFrame('magazine-masthead', content, CALM_PHOTO));
    const fixture = TestBed.createComponent(Story);
    const harness = await TestbedHarnessEnvironment.harnessForFixture(fixture, StoryHarness);

    const layout = await harness.getLayoutView();
    expect(layout).not.toBeNull();
    expect(await layout!.textContents()).toEqual(['The coast', 'Golden hour']);
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
      { photoId: 'a', order: 1, caption: 'one', headline: 'one', style: { font: 'inter', weight: 'regular', case: 'normal', align: 'center', size: 'm', position: 'bottom-center', letterbox: 'blur' } },
      { photoId: 'b', order: 2, caption: 'two', headline: 'two', style: { font: 'inter', weight: 'regular', case: 'normal', align: 'center', size: 'm', position: 'bottom-center', letterbox: 'blur' } },
      { photoId: 'c', order: 3, caption: 'three', headline: 'three', style: { font: 'inter', weight: 'regular', case: 'normal', align: 'center', size: 'm', position: 'bottom-center', letterbox: 'blur' } },
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

  describe('hand-off', () => {
    const STYLE = frames[0].style;
    let post: ReturnType<typeof vi.fn>;

    const withLocation: Frame = {
      photoId: 'a',
      order: 1,
      caption: 'By the lake', headline: 'By the lake',
      style: STYLE,
      suggestions: [{ type: 'location', query: 'Bixby Bridge', confidence: 0.9 }],
    };

    /** Render with a stubbed exporter (jsdom has no canvas) and tap Post. */
    async function postWith(frameList: Frame[]): Promise<StoryHarness> {
      post = vi.fn(() => Promise.resolve('shared'));
      TestBed.configureTestingModule({
        imports: [Story],
        providers: [{ provide: StoryExporter, useValue: { post } }],
      });
      await TestBed.compileComponents();
      story = TestBed.inject(StoryService);
      story.completeStory(frameList, false);
      const fixture = TestBed.createComponent(Story);
      const harness = await TestbedHarnessEnvironment.harnessForFixture(fixture, StoryHarness);
      await harness.clickPost();
      await fixture.whenStable();
      return harness;
    }

    it('reveals the add-on card on Post, before handing off', async () => {
      const harness = await postWith([withLocation]);

      expect(await harness.hasTray()).toBe(true);
      expect(await harness.trayTerms()).toEqual(['Bixby Bridge']);
      // The card is shown *before* the export — nothing has been handed off yet.
      expect(post).not.toHaveBeenCalled();
    });

    it('hands off directly, with no card, when there are no add-ons', async () => {
      const harness = await postWith([{ photoId: 'a', order: 1, caption: 'x', headline: 'x', style: STYLE }]);

      expect(await harness.hasTray()).toBe(false);
      expect(post).toHaveBeenCalledTimes(1);
    });

    it('renders + hands off when the card\'s "Save & open Instagram" is tapped', async () => {
      const harness = await postWith([withLocation]);
      expect(post).not.toHaveBeenCalled();

      await harness.clickSaveAndOpen();

      expect(post).toHaveBeenCalledTimes(1);
      // The card stays up so returning from Instagram lands back on the add-ons.
      expect(await harness.hasTray()).toBe(true);
    });

    it('dismisses the card on "Not now"', async () => {
      const harness = await postWith([withLocation]);

      await harness.clickAllSet();

      expect(await harness.hasTray()).toBe(false);
    });
  });
});
