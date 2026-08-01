import { ComponentHarness } from '@angular/cdk/testing';
import { MatButtonHarness } from '@angular/material/button/testing';

/** Page-object harness for the hand-off checklist. Exposes intent; asserts nothing. */
export class HandoffChecklistHarness extends ComponentHarness {
  static hostSelector = 'app-handoff-checklist';

  private readonly items = this.locatorForAll('[data-handoff-item]');
  private readonly queries = this.locatorForAll('[data-handoff-query]');
  private readonly copyButtons = this.locatorForAll(MatButtonHarness.with({ text: /Copy|Copied/ }));
  private readonly doneButtons = this.locatorForAll('[data-handoff-done]');

  /** How many add-ons are listed (dismissed ones are excluded upstream). */
  async itemCount(): Promise<number> {
    return (await this.items()).length;
  }

  /** The listed terms, in order. */
  async queryTexts(): Promise<string[]> {
    const els = await this.queries();
    return Promise.all(els.map(async (el) => (await el.text()).trim()));
  }

  /** Copy the term for the item at `index`. */
  async clickCopy(index: number): Promise<void> {
    await (await this.copyButtons())[index].click();
  }

  /** Tick the item at `index` added / not-added. */
  async clickDone(index: number): Promise<void> {
    await (await this.doneButtons())[index].click();
  }
}
