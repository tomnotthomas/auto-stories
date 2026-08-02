import { ComponentHarness } from '@angular/cdk/testing';
import { MatButtonHarness } from '@angular/material/button/testing';

/** Page-object harness for the hand-off card. Exposes intent; asserts nothing. */
export class HandoffCompanionHarness extends ComponentHarness {
  static hostSelector = 'app-handoff-companion';

  private readonly items = this.locatorForAll('[data-tray-item]');
  private readonly terms = this.locatorForAll('[data-tray-term]');
  private readonly copyButtons = this.locatorForAll(MatButtonHarness.with({ text: /Copy|Copied/ }));
  private readonly saveButton = this.locatorFor(
    MatButtonHarness.with({ text: /Save & open|Preparing/ }),
  );
  private readonly closeButton = this.locatorFor('[data-tray-close]');

  /** How many add-on rows are shown (hero + the rest; dismissed ones excluded). */
  async itemCount(): Promise<number> {
    return (await this.items()).length;
  }

  /** The terms listed, in order — the hero first, then the rest. */
  async termTexts(): Promise<string[]> {
    const els = await this.terms();
    return Promise.all(els.map(async (el) => (await el.text()).trim()));
  }

  /** Copy the term at `index` (0 = hero). */
  async clickCopy(index: number): Promise<void> {
    await (await this.copyButtons())[index].click();
  }

  /** Whether the copy control at `index` has confirmed "Copied". */
  async isCopied(index: number): Promise<boolean> {
    return /Copied/.test(await (await this.copyButtons())[index].getText());
  }

  /** Confirm — render + hand off to Instagram ("Save & open Instagram"). */
  async clickSaveAndOpen(): Promise<void> {
    await (await this.saveButton()).click();
  }

  /** Dismiss the card without handing off ("Not now"). */
  async clickAllSet(): Promise<void> {
    await (await this.closeButton()).click();
  }
}
