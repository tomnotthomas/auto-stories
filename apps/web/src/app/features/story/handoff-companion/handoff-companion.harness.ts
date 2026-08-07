import { ComponentHarness } from '@angular/cdk/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatIconHarness } from '@angular/material/icon/testing';

/** Page-object harness for the hand-off card. Exposes intent; asserts nothing. */
export class HandoffCompanionHarness extends ComponentHarness {
  static hostSelector = 'app-handoff-companion';

  private readonly items = this.locatorForAll('[data-tray-item]');
  private readonly terms = this.locatorForAll('[data-tray-term]');
  private readonly copyButtons = this.locatorForAll(MatButtonHarness.with({ text: /Copy|Copied/ }));
  private readonly dismissButtons = this.locatorForAll('[data-tray-dismiss]');
  private readonly saveButton = this.locatorFor(
    MatButtonHarness.with({ text: /Save & open|Preparing/ }),
  );
  private readonly closeButton = this.locatorFor('[data-tray-close]');
  private readonly headingIcon = this.locatorFor(
    MatIconHarness.with({ ancestor: '[data-tray-heading]' }),
  );
  private readonly saveIcon = this.locatorFor(
    MatIconHarness.with({ ancestor: '[data-tray-save]' }),
  );

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

  /** Drop the add-on at `index` from the list (0 = hero). */
  async clickDismiss(index: number): Promise<void> {
    await (await this.dismissButtons())[index].click();
  }

  /** Whether the copy control at `index` has confirmed "Copied". */
  async isCopied(index: number): Promise<boolean> {
    return /Copied/.test(await (await this.copyButtons())[index].getText());
  }

  /** The Material symbol beside the card's heading. */
  async getHeadingIcon(): Promise<string | null> {
    return (await this.headingIcon()).getName();
  }

  /** The Material symbol on the confirm ("Save & open Instagram") action. */
  async getSaveIcon(): Promise<string | null> {
    return (await this.saveIcon()).getName();
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
