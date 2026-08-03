import { ComponentHarness } from '@angular/cdk/testing';
import { MatButtonHarness } from '@angular/material/button/testing';

import { CaptionEditorHarness } from '../refine/caption-editor/caption-editor.harness';
import { RefineFilmstripHarness } from '../refine/filmstrip/filmstrip.harness';
import { LayoutViewHarness } from './layout-view/layout-view.harness';

/** Page-object harness for the finished-story (payoff) viewer. */
export class StoryHarness extends ComponentHarness {
  static hostSelector = 'app-story';

  private readonly editText = this.locatorFor('[data-edit-text]');
  private readonly frameLayers = this.locatorForAll('[data-frame]');
  private readonly nextZone = this.locatorFor('button[aria-label="Next frame"]');
  private readonly prevZone = this.locatorFor('button[aria-label="Previous frame"]');
  private readonly banner = this.locatorForOptional('[aria-label="Dismiss notice"]');
  private readonly startOverButton = this.locatorFor(MatButtonHarness.with({ text: /Start over/ }));
  private readonly refineButton = this.locatorFor(MatButtonHarness.with({ text: /Refine story/ }));
  private readonly doneButton = this.locatorFor(MatButtonHarness.with({ text: /Done/ }));
  private readonly manageButton = this.locatorFor(MatButtonHarness.with({ text: /Reorder/ }));
  private readonly editor = this.locatorForOptional(CaptionEditorHarness);
  private readonly filmstrip = this.locatorForOptional(RefineFilmstripHarness);
  private readonly layoutView = this.locatorForOptional(LayoutViewHarness);

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
}
