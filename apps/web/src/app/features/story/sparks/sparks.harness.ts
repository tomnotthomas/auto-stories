import { ComponentHarness } from '@angular/cdk/testing';
import { MatButtonHarness } from '@angular/material/button/testing';

/** Page-object harness for the sparks overlay. Exposes intent; asserts nothing. */
export class StorySparksHarness extends ComponentHarness {
  static hostSelector = 'app-story-sparks';

  private readonly dots = this.locatorForAll('[data-spark-dot]');
  private readonly query = this.locatorForOptional('[data-spark-query]');
  private readonly copyButton = this.locatorForOptional(
    MatButtonHarness.with({ text: /Copy|Copied/ }),
  );
  private readonly doneButton = this.locatorForOptional('[data-spark-done]');
  private readonly dismissButton = this.locatorForOptional('[data-spark-dismiss]');
  private readonly musicChips = this.locatorForAll('[data-spark-music]');
  private readonly musicQueryEl = this.locatorForOptional('[data-spark-music-query]');
  private readonly musicCopy = this.locatorForOptional(
    MatButtonHarness.with({ ancestor: '[data-spark-music]', text: /Copy|Copied/ }),
  );
  private readonly musicDismiss = this.locatorForOptional('[data-spark-music-dismiss]');

  /** How many spark dots are rendered (music is excluded upstream). */
  async dotCount(): Promise<number> {
    return (await this.dots()).length;
  }

  /** Tap the dot at `index` to bloom (or re-tap to close) its suggestion. */
  async openDot(index: number): Promise<void> {
    const dots = await this.dots();
    await dots[index].click();
  }

  /** The term shown in the currently-open bloom, or null if none is open. */
  async openQuery(): Promise<string | null> {
    const el = await this.query();
    return el ? (await el.text()).trim() : null;
  }

  /** Whether a bloom is open (its Copy affordance is present). */
  async isBloomOpen(): Promise<boolean> {
    return (await this.copyButton()) !== null;
  }

  /** Copy the open bloom's term to the clipboard. */
  async clickCopy(): Promise<void> {
    await (await this.copyButton())?.click();
  }

  /** Whether the Copy button has flipped to its "Copied" confirmation. */
  async isCopied(): Promise<boolean> {
    const button = await this.copyButton();
    return button ? /Copied/.test(await button.getText()) : false;
  }

  /** Check the open bloom's suggestion off (added in Instagram), or un-check it. */
  async clickDone(): Promise<void> {
    await (await this.doneButton())?.click();
  }

  /** Dismiss the open bloom's suggestion. */
  async clickDismiss(): Promise<void> {
    await (await this.dismissButton())?.click();
  }

  /** How many docked music chips are shown. */
  async musicCount(): Promise<number> {
    return (await this.musicChips()).length;
  }

  /** The search term shown in the (first) music chip, or null. */
  async musicQuery(): Promise<string | null> {
    const el = await this.musicQueryEl();
    return el ? (await el.text()).trim() : null;
  }

  /** Copy the music chip's search term. */
  async clickMusicCopy(): Promise<void> {
    await (await this.musicCopy())?.click();
  }

  /** Dismiss the music chip. */
  async clickMusicDismiss(): Promise<void> {
    await (await this.musicDismiss())?.click();
  }
}
