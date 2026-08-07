import { ComponentHarness, TestElement } from '@angular/cdk/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatIconHarness } from '@angular/material/icon/testing';

import { CaptionEditorHarness } from '../refine/caption-editor/caption-editor.harness';
import { RefineFilmstripHarness } from '../refine/filmstrip/filmstrip.harness';
import { LayoutViewHarness } from './layout-view/layout-view.harness';
import { SETTLE_MS } from './story';

/** Where a simulated gesture starts, in viewport pixels. Any point does — the
 * component only reads how far the pointer travelled. */
const GESTURE_X = 160;
const GESTURE_Y = 600;
/** Far enough past the component's 48px threshold to be unambiguously a swipe. */
const GESTURE_PX = 120;

/** Page-object harness for the finished-story (payoff) viewer. */
export class StoryHarness extends ComponentHarness {
  static hostSelector = 'app-story';

  private readonly editText = this.locatorFor('[data-edit-text]');
  private readonly frameLayers = this.locatorForAll('[data-frame]');
  private readonly nextZone = this.locatorFor('button[aria-label="Next frame"]');
  private readonly prevZone = this.locatorFor('button[aria-label="Previous frame"]');
  private readonly banner = this.locatorForOptional('[aria-label="Dismiss notice"]');
  private readonly bannerIcon = this.locatorFor(
    MatIconHarness.with({ ancestor: '[data-partial-banner]' }),
  );
  private readonly postIcon = this.locatorFor(MatIconHarness.with({ ancestor: '[data-post]' }));
  private readonly startOverButton = this.locatorFor(MatButtonHarness.with({ text: /Start over/ }));
  private readonly refineButton = this.locatorFor(MatButtonHarness.with({ text: /Refine story/ }));
  private readonly doneButton = this.locatorFor(MatButtonHarness.with({ text: /Done/ }));
  private readonly manageButton = this.locatorFor(MatButtonHarness.with({ text: /Reorder/ }));
  private readonly editor = this.locatorForOptional(CaptionEditorHarness);
  private readonly filmstrip = this.locatorForOptional(RefineFilmstripHarness);
  private readonly layoutView = this.locatorForOptional(LayoutViewHarness);
  private readonly actionCluster = this.locatorFor('[data-actions]');
  private readonly startOverTarget = this.locatorFor('[data-start-over]');
  private readonly restoreStrip = this.locatorFor('[data-swipe-restore]');
  private readonly restoreHint = this.locatorForOptional('[data-restore-hint]');
  private readonly actionsToggle = this.locatorFor(
    MatButtonHarness.with({ text: /Hide story actions|Show story actions/ }),
  );
  private readonly postButtons = this.locatorForAll(
    MatButtonHarness.with({ text: /Post to Instagram/ }),
  );
  private readonly reservation = this.locatorFor('[data-safe-bottom]');

  /**
   * The frame's words, as the composition renders them. A Look sets the words as
   * the last block of type in its stack (an optional kicker comes first), so the
   * headline is the last entry.
   */
  async getHeadline(): Promise<string> {
    const texts = await (await this.requireLayoutView()).textContents();
    return texts[texts.length - 1] ?? '';
  }

  /** Every block of type the composition renders, in order. */
  async getComposedTexts(): Promise<string[]> {
    return (await this.requireLayoutView()).textContents();
  }

  /** The Looks renderer for the current frame; null only while the editor is open. */
  async getLayoutView(): Promise<LayoutViewHarness | null> {
    return this.layoutView();
  }

  private async requireLayoutView(): Promise<LayoutViewHarness> {
    const view = await this.layoutView();
    if (!view) throw new Error('No composition is rendered on the current frame');
    return view;
  }

  /** The Material symbol on the primary hand-off action. */
  async getPostIcon(): Promise<string | null> {
    return (await this.postIcon()).getName();
  }

  /** Hand off to Instagram (renders + posts). */
  async clickPost(): Promise<void> {
    await (await this.locatorFor(MatButtonHarness.with({ text: /Post to Instagram/ }))()).click();
  }

  /** Whether the hand-off tray is showing. */
  async hasTray(): Promise<boolean> {
    return (await this.locatorForOptional('app-handoff-companion')()) !== null;
  }

  /** The add-on terms listed in the hand-off card, in order. */
  async trayTerms(): Promise<string[]> {
    const els = await this.locatorForAll('[data-tray-term]')();
    return Promise.all(els.map(async (el) => (await el.text()).trim()));
  }

  /** Confirm the hand-off from the card ("Save & open Instagram"). */
  async clickSaveAndOpen(): Promise<void> {
    await (
      await this.locatorFor(MatButtonHarness.with({ text: /Save & open|Preparing/ }))()
    ).click();
  }

  /** Dismiss the hand-off card ("Not now"). */
  async clickAllSet(): Promise<void> {
    await (await this.locatorFor('[data-tray-close]')()).click();
  }

  /** photoIds of the frame background layers currently mounted — the current
   * frame plus its preloaded neighbours. */
  async mountedFrameIds(): Promise<string[]> {
    const layers = await this.frameLayers();
    const ids = await Promise.all(layers.map((el) => el.getAttribute('data-frame')));
    return ids.filter((id): id is string => id !== null);
  }

  /** Advance to the next frame. */
  async tapNext(): Promise<void> {
    await (await this.nextZone()).click();
  }

  /** Go back to the previous frame. */
  async tapPrev(): Promise<void> {
    await (await this.prevZone()).click();
  }

  /** Whether the "a photo was dropped" banner is showing. */
  async hasDroppedBanner(): Promise<boolean> {
    return (await this.banner()) !== null;
  }

  /** The Material symbol on the "a photo was dropped" banner. */
  async getDroppedBannerIcon(): Promise<string | null> {
    return (await this.bannerIcon()).getName();
  }

  /** Start the flow over. */
  async clickStartOver(): Promise<void> {
    await (await this.startOverButton()).click();
  }

  /** Enter refine mode. */
  async clickRefine(): Promise<void> {
    await (await this.refineButton()).click();
  }

  /** Leave refine mode via the refine bar's Done (only present when not editing). */
  async clickDone(): Promise<void> {
    await (await this.doneButton()).click();
  }

  /** Tap the composition (refine mode) to open the text editor. */
  async tapText(): Promise<void> {
    await (await this.editText()).click();
  }

  /** Open the "Reorder & remove" management screen (refine mode). */
  async clickManage(): Promise<void> {
    await (await this.manageButton()).click();
  }

  /** The caption editor, when open; otherwise null. */
  async getEditor(): Promise<CaptionEditorHarness | null> {
    return this.editor();
  }

  /** The refine filmstrip, when in refine mode; otherwise null. */
  async getFilmstrip(): Promise<RefineFilmstripHarness | null> {
    return this.filmstrip();
  }

  /** Whether the three story actions are on screen. */
  async isActionBarVisible(): Promise<boolean> {
    return (await this.postButtons()).length > 0;
  }

  /**
   * Press somewhere, drag, release — one gesture. The press lands on `from`
   * (which is what tells the component whether it began on the actions or on
   * the bottom edge) and the release goes to the host, which is where the
   * component listens, exactly as a real pointer's release bubbles to it.
   */
  private async swipe(from: TestElement, dx: number, dy: number): Promise<void> {
    await this.press(from);
    this.pointer = { x: GESTURE_X + dx, y: GESTURE_Y + dy };
    await this.release();
  }

  /** Where the simulated finger is now, so a release lands where the last move
   * left it — exactly as a real pointerup does. */
  private pointer = { x: GESTURE_X, y: GESTURE_Y };

  private async press(on: TestElement): Promise<void> {
    this.pointer = { x: GESTURE_X, y: GESTURE_Y };
    await on.dispatchEvent('pointerdown', { clientX: GESTURE_X, clientY: GESTURE_Y });
  }

  /** Put a finger on the action cluster — the start of a tracked drag. */
  async pressActions(): Promise<void> {
    await this.press(await this.actionCluster());
  }

  /** Put a finger on the bottom edge, where the actions left from. */
  async pressEdge(): Promise<void> {
    await this.press(await this.restoreStrip());
  }

  /** Move the finger to `dy` px from where it went down (negative is upward). */
  async dragTo(dy: number): Promise<void> {
    this.pointer = { x: GESTURE_X, y: GESTURE_Y + dy };
    await (
      await this.host()
    ).dispatchEvent('pointermove', { clientX: this.pointer.x, clientY: this.pointer.y });
  }

  /** Hold the finger still, so what follows reads as a slow drag, not a flick. */
  async hold(ms: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  /** Lift the finger where the last move left it. */
  async release(): Promise<void> {
    await (
      await this.host()
    ).dispatchEvent('pointerup', { clientX: this.pointer.x, clientY: this.pointer.y });
  }

  /** Wait out the panel's settle — the dismissal is committed when it ends. */
  async settle(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, SETTLE_MS + 20));
    await this.forceStabilize();
  }

  /** Swipe the three story actions down and away, and let them leave. */
  async swipeActionsAway(): Promise<void> {
    await this.swipe(await this.actionCluster(), 0, GESTURE_PX);
    await this.settle();
  }

  /**
   * A swipe made on top of "Start over" — a drag across the buttons, which the
   * browser follows with a click on the element the drag began on. The story
   * must move and must not start over.
   * (The press is delivered to the cluster, which is where a real pointerdown
   * on the button arrives once it has bubbled.)
   */
  async swipeAcrossStartOver(): Promise<void> {
    await this.swipe(await this.actionCluster(), -GESTURE_PX, 0);
    await this.tailClickStartOver();
  }

  /** The click the browser fires after a drag, on the button it began on. */
  async tailClickStartOver(): Promise<void> {
    await (await this.startOverTarget()).dispatchEvent('click');
  }

  /** Swipe up from the bottom edge to bring the actions back. */
  async swipeActionsBack(): Promise<void> {
    await this.swipe(await this.restoreStrip(), 0, -GESTURE_PX);
    await this.settle();
  }

  /** A swipe down on the photo itself, nowhere near the actions. */
  async swipeDownOnPhoto(): Promise<void> {
    await this.swipe(await this.host(), 0, GESTURE_PX);
  }

  /** A swipe up on the photo itself, away from the bottom edge. */
  async swipeUpOnPhoto(): Promise<void> {
    await this.swipe(await this.host(), 0, -GESTURE_PX);
  }

  /** Swipe left to advance, then the click the browser fires on the tap zone
   * the gesture ended over — so one swipe must still be one frame. */
  async swipeToNextFrame(): Promise<void> {
    await this.swipe(await this.host(), -GESTURE_PX, 0);
    await (await this.nextZone()).dispatchEvent('click');
  }

  /** Swipe right to go back, with the same trailing click. */
  async swipeToPreviousFrame(): Promise<void> {
    await this.swipe(await this.host(), GESTURE_PX, 0);
    await (await this.prevZone()).dispatchEvent('click');
  }

  /** Whether the one-time "swipe up to bring them back" hint is showing. */
  async hasRestoreHint(): Promise<boolean> {
    return (await this.restoreHint()) !== null;
  }

  /** The keyboard/screen-reader equivalent of the swipe: dismiss or restore. */
  async clickActionsToggle(): Promise<void> {
    await (await this.actionsToggle()).click();
    await this.settle();
  }

  /** The label that control carries — it says which way it will go. */
  async actionsToggleLabel(): Promise<string> {
    return (await this.actionsToggle()).getText();
  }

  /** How much of the frame's bottom the composition is currently told to keep
   * clear of the on-screen chrome (the export reserves nothing). */
  async reservedBottomPx(): Promise<number> {
    return Number(await (await this.reservation()).getAttribute('data-safe-bottom'));
  }
}
