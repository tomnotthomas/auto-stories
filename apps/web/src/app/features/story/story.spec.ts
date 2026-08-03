import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import type { Frame } from '@auto-stories/api-types';

import { Story } from './story';
import { StoryHarness } from './story.harness';
import { StoryService } from '../../story/story.service';
import { StoryExporter } from '../../story/story-exporter.service';

const frames: Frame[] = [
  { photoId: 'a', order: 1, headline: 'Everyone made it to the lake' },
  { photoId: 'b', order: 2, headline: 'Then she blew out the candle' },
];

describe('Story', () => {
  let story: StoryService;

  async function renderFrames(
    list: Frame[],
    partial = false,
    look?: string,
  ): Promise<StoryHarness> {
    await TestBed.configureTestingModule({ imports: [Story] }).compileComponents();
    story = TestBed.inject(StoryService);
    story.completeStory(list, partial, look);
    const fixture = TestBed.createComponent(Story);
    return TestbedHarnessEnvironment.harnessForFixture(fixture, StoryHarness);
  }

  async function render(partial = false): Promise<StoryHarness> {
    return renderFrames(frames, partial);
  }

  it("shows the first frame's words", async () => {
    const harness = await render();
    expect(await harness.getHeadline()).toBe('Everyone made it to the lake');
  });

  it("renders the frame's composition under the story Look", async () => {
    const harness = await renderFrames(
      [{ photoId: 'a', order: 1, kicker: 'The coast', headline: 'Golden hour' }],
      false,
      'magazine-masthead',
    );

    const layout = await harness.getLayoutView();
    expect(layout).not.toBeNull();
    expect(await layout!.textContents()).toEqual(['The coast', 'Golden hour']);
  });

  it('advances to the next frame on tap', async () => {
    const harness = await render();
    await harness.tapNext();
    expect(await harness.getHeadline()).toBe('Then she blew out the candle');
  });

  it('does not advance past the last frame', async () => {
    const harness = await render();
    await harness.tapNext();
    await harness.tapNext();
    expect(await harness.getHeadline()).toBe('Then she blew out the candle');
  });

  it('preloads the current frame and its neighbours so paging stays in sync', async () => {
    const harness = await renderFrames([
      { photoId: 'a', order: 1, headline: 'one' },
      { photoId: 'b', order: 2, headline: 'two' },
      { photoId: 'c', order: 3, headline: 'three' },
    ]);

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

  describe('swiping the actions away', () => {
    it('shows the three story actions to begin with', async () => {
      expect(await (await render()).isActionBarVisible()).toBe(true);
    });

    it('dismisses the actions on a swipe down', async () => {
      const harness = await render();
      await harness.swipeActionsAway();
      expect(await harness.isActionBarVisible()).toBe(false);
    });

    it('brings them back on a swipe up from the bottom edge', async () => {
      const harness = await render();
      await harness.swipeActionsAway();
      await harness.swipeActionsBack();

      expect(await harness.isActionBarVisible()).toBe(true);
      // Back in working order, not just back on screen.
      await harness.clickStartOver();
      expect(story.phase()).toBe('example');
    });

    it('ignores a swipe down that did not start on the actions', async () => {
      const harness = await render();
      await harness.swipeDownOnPhoto();
      expect(await harness.isActionBarVisible()).toBe(true);
    });

    it('ignores a swipe up that did not start at the bottom edge', async () => {
      const harness = await render();
      await harness.swipeActionsAway();
      await harness.swipeUpOnPhoto();
      expect(await harness.isActionBarVisible()).toBe(false);
    });

    it('does not fire the button the swipe started on', async () => {
      const harness = await render();
      // A drag is still followed by a click on the element it began on, so a
      // swipe made across the buttons must never start the story over.
      await harness.swipeAcrossStartOver();

      expect(story.phase()).toBe('story');
      expect(await harness.getHeadline()).toBe('Then she blew out the candle');
    });

    it('never moves the composition — the reservation is the same either way', async () => {
      const harness = await render();
      const shown = await harness.reservedBottomPx();

      await harness.swipeActionsAway();
      expect(await harness.reservedBottomPx()).toBe(shown);

      await harness.swipeActionsBack();
      expect(await harness.reservedBottomPx()).toBe(shown);
    });

    it('still pages the story while the actions are dismissed', async () => {
      const harness = await render();
      await harness.swipeActionsAway();
      await harness.tapNext();
      expect(await harness.getHeadline()).toBe('Then she blew out the candle');
    });

    it('shows the way back once, after the first dismissal', async () => {
      const harness = await render();
      expect(await harness.hasRestoreHint()).toBe(false);

      await harness.swipeActionsAway();
      expect(await harness.hasRestoreHint()).toBe(true);

      await harness.swipeActionsBack();
      await harness.swipeActionsAway();
      expect(await harness.hasRestoreHint()).toBe(false);
    });

    it('dismisses and restores from the keyboard, without a gesture', async () => {
      const harness = await render();
      expect(await harness.actionsToggleLabel()).toMatch(/Hide/);

      await harness.clickActionsToggle();
      expect(await harness.isActionBarVisible()).toBe(false);
      expect(await harness.actionsToggleLabel()).toMatch(/Show/);

      await harness.clickActionsToggle();
      expect(await harness.isActionBarVisible()).toBe(true);
    });
  });

  describe('dragging the actions', () => {
    /** Shorter than the 48px the distance threshold asks for, so only how fast
     * the finger was moving can decide these. */
    const SHORT = 32;
    /** Long enough that 16px of travel is nowhere near the flick velocity. */
    const SLOW_MS = 400;

    const realMatchMedia = window.matchMedia;
    afterEach(() => {
      window.matchMedia = realMatchMedia;
    });

    /** Answer every media query with "reduce", as an OS setting would. */
    function reduceMotion(): void {
      window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
    }

    it('dismisses on a short, fast flick down', async () => {
      const harness = await render();

      await harness.pressActions();
      await harness.dragTo(SHORT / 2);
      await harness.dragTo(SHORT);
      await harness.release();
      await harness.settle();

      expect(await harness.isActionBarVisible()).toBe(false);
    });

    it('springs back when a slow drag stops short of the threshold', async () => {
      const harness = await render();

      await harness.pressActions();
      await harness.dragTo(SHORT / 2);
      await harness.hold(SLOW_MS);
      await harness.dragTo(SHORT);
      await harness.release();
      await harness.settle();

      expect(await harness.isActionBarVisible()).toBe(true);
    });

    it('does not dismiss a drag that reverses before the finger lifts', async () => {
      const harness = await render();

      await harness.pressActions();
      await harness.dragTo(120); // past the threshold…
      await harness.dragTo(8); // …but pulled back up before letting go
      await harness.release();
      await harness.settle();

      expect(await harness.isActionBarVisible()).toBe(true);
    });

    it('brings the actions back on a short, fast flick up from the edge', async () => {
      const harness = await render();
      await harness.swipeActionsAway();

      await harness.pressEdge();
      await harness.dragTo(-SHORT / 2);
      await harness.dragTo(-SHORT);
      await harness.release();
      await harness.settle();

      expect(await harness.isActionBarVisible()).toBe(true);
    });

    it('leaves them dismissed when a slow restore drag stops short', async () => {
      const harness = await render();
      await harness.swipeActionsAway();

      await harness.pressEdge();
      await harness.dragTo(-SHORT / 2);
      await harness.hold(SLOW_MS);
      await harness.dragTo(-SHORT);
      await harness.release();
      await harness.settle();

      expect(await harness.isActionBarVisible()).toBe(false);
    });

    it('does not fire the button under a drag that sprang back', async () => {
      const harness = await render();

      await harness.pressActions();
      await harness.dragTo(20);
      await harness.dragTo(10);
      await harness.release();
      // The browser follows any drag with a click on where it began.
      await harness.tailClickStartOver();

      expect(story.phase()).toBe('story');
      expect(await harness.isActionBarVisible()).toBe(true);
    });

    it('never moves the composition, mid-drag or after it', async () => {
      const harness = await render();
      const reserved = await harness.reservedBottomPx();

      await harness.pressActions();
      await harness.dragTo(60);
      expect(await harness.reservedBottomPx()).toBe(reserved);

      await harness.release();
      expect(await harness.reservedBottomPx()).toBe(reserved);

      await harness.settle();
      expect(await harness.reservedBottomPx()).toBe(reserved);
    });

    it('keeps the actions on screen until the panel has left', async () => {
      const harness = await render();

      await harness.pressActions();
      await harness.dragTo(120);
      await harness.release();
      // The finger is off, but the panel is still on its way out.
      expect(await harness.isActionBarVisible()).toBe(true);

      await harness.settle();
      expect(await harness.isActionBarVisible()).toBe(false);
    });

    it('swaps instantly, with no panel to wait for, when motion is reduced', async () => {
      const harness = await render();
      reduceMotion();

      await harness.pressActions();
      await harness.dragTo(120);
      await harness.release();

      expect(await harness.isActionBarVisible()).toBe(false);
    });
  });

  describe('paging by swipe', () => {
    it('advances a frame on a swipe left', async () => {
      const harness = await render();
      await harness.swipeToNextFrame();
      expect(await harness.getHeadline()).toBe('Then she blew out the candle');
    });

    it('advances only one frame, even though the swipe ends on a tap zone', async () => {
      const harness = await renderFrames([
        { photoId: 'a', order: 1, headline: 'one' },
        { photoId: 'b', order: 2, headline: 'two' },
        { photoId: 'c', order: 3, headline: 'three' },
      ]);

      await harness.swipeToNextFrame();

      expect(await harness.getHeadline()).toBe('two');
    });

    it('goes back a frame on a swipe right', async () => {
      const harness = await render();
      await harness.tapNext();
      await harness.swipeToPreviousFrame();
      expect(await harness.getHeadline()).toBe('Everyone made it to the lake');
    });
  });

  describe('refine', () => {
    it('keeps rendering the same composition it shows in view mode', async () => {
      const harness = await render();
      const inView = await harness.getComposedTexts();

      await harness.clickRefine();

      expect(await harness.getLayoutView()).not.toBeNull();
      expect(await harness.getComposedTexts()).toEqual(inView);
    });

    it('opens the text editor when the composition is tapped in refine mode', async () => {
      const harness = await render();
      await harness.clickRefine();
      expect(await harness.getEditor()).toBeNull();
      await harness.tapText();
      expect(await harness.getEditor()).not.toBeNull();
    });

    it('opens the editor on the words the composition is rendering', async () => {
      const harness = await render();
      await harness.clickRefine();
      await harness.tapText();
      expect(await (await harness.getEditor())!.getHeadline()).toBe('Everyone made it to the lake');
    });

    it('marks the coach mark seen once the user starts editing', async () => {
      const harness = await render();
      await harness.clickRefine();
      await harness.tapText();
      expect(story.coachSeen()).toBe(true);
    });

    it("edits the frame's words, and the composition renders the edit", async () => {
      const harness = await render();
      await harness.clickRefine();
      await harness.tapText();
      const editor = await harness.getEditor();
      await editor!.setHeadline('A brand new line');
      await editor!.clickDone();

      expect(story.frames()[0].headline).toBe('A brand new line');
      // The whole point of 7.25: the edit lands in the one thing that renders.
      expect(await harness.getHeadline()).toBe('A brand new line');
    });

    it('offers no placement or legibility controls — the Look owns both', async () => {
      const harness = await render();
      await harness.clickRefine();
      await harness.tapText();
      const editor = await harness.getEditor();
      expect(await editor!.hasSize()).toBe(false);
      expect(await editor!.hasLegibility()).toBe(false);
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
      expect(await harness.getHeadline()).toBe('Then she blew out the candle');
    });
  });

  describe('hand-off', () => {
    let post: ReturnType<typeof vi.fn>;

    const withLocation: Frame = {
      photoId: 'a',
      order: 1,
      headline: 'By the lake',
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
      const harness = await postWith([{ photoId: 'a', order: 1, headline: 'x' }]);

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
