import { ComponentHarness } from '@angular/cdk/testing';
import { MatButtonHarness } from '@angular/material/button/testing';

/** Page-object harness for the hand-off tray. Exposes intent; asserts nothing. */
export class HandoffCompanionHarness extends ComponentHarness {
  static hostSelector = 'app-handoff-companion';

  private readonly items = this.locatorForAll('[data-tray-item]');
  private readonly terms = this.locatorForAll('[data-tray-term]');
  private readonly copyButtons = this.locatorForAll(MatButtonHarness.with({ text: /Copy|Copied/ }));
  private readonly dismissButtons = this.locatorForAll('[data-tray-dismiss]');
  private readonly closeButton = this.locatorFor('[data-tray-close]');

  /** How many add-on cards are shown (dismissed ones are excluded upstream). */
  async itemCount(): Promise<number> {
    return (await this.items()).length;
  }

  /** The terms listed on the cards, in order. */
  async termTexts(): Promise<string[]> {
    const els = await this.terms();
    return Promise.all(els.map(async (el) => (await el.text()).trim()));
  }

  /** Copy the term on the card at `index`. */
  async clickCopy(index: number): Promise<void> {
    await (await this.copyButtons())[index].click();
  }

  /** Whether the card at `index` has confirmed "Copied". */
  async isCopied(index: number): Promise<boolean> {
    return /Copied/.test(await (await this.copyButtons())[index].getText());
  }

  /** Remove the card at `index`. */
  async clickDismiss(index: number): Promise<void> {
    await (await this.dismissButtons())[index].click();
  }

  /** Collapse the tray ("All set"). */
  async clickAllSet(): Promise<void> {
    await (await this.closeButton()).click();
  }
}
