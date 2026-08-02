import { ComponentHarness } from '@angular/cdk/testing';
import { MatButtonHarness } from '@angular/material/button/testing';

import { CaptionEditorHarness } from '../refine/caption-editor/caption-editor.harness';
import { RefineFilmstripHarness } from '../refine/filmstrip/filmstrip.harness';

/** Page-object harness for the finished-story (payoff) viewer. */
export class StoryHarness extends ComponentHarness {
  static hostSelector = 'app-story';

  private readonly caption = this.locatorFor('.story-caption');
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

  /** The caption of the frame currently shown. */
  async getCaption(): Promise<string> {
    return (await this.caption()).text();
  }

  /** The AI's extra placed text blocks shown on the current frame, in order. */
  async extraTexts(): Promise<string[]> {
    const els = await this.locatorForAll('[data-extra-text]')();
    return Promise.all(els.map(async (el) => (await el.text()).trim()));
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

  /** Tap the caption (refine mode) to open the editor. */
  async tapCaption(): Promise<void> {
    await (await this.caption()).click();
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
