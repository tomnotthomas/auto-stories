import { ComponentHarness } from '@angular/cdk/testing';
import { MatButtonHarness } from '@angular/material/button/testing';

/** Page-object harness for the hand-off companion. Exposes intent; asserts nothing. */
export class HandoffCompanionHarness extends ComponentHarness {
  static hostSelector = 'app-handoff-companion';

  private readonly cardEl = this.locatorForOptional('[data-companion-card]');
  private readonly termEl = this.locatorForOptional('[data-companion-term]');
  private readonly copyButton = this.locatorForOptional(
    MatButtonHarness.with({ text: /Copy|Copied/ }),
  );
  private readonly nextButton = this.locatorForOptional('[data-companion-next]');
  private readonly dismissButton = this.locatorForOptional('[data-companion-dismiss]');
  private readonly doneButton = this.locatorFor('[data-companion-done]');

  /** Whether a suggestion card is showing (vs the "all done" end state). */
  async isShowingCard(): Promise<boolean> {
    return (await this.cardEl()) !== null;
  }

  /** The term on the current card, or null if none is showing. */
  async term(): Promise<string | null> {
    const el = await this.termEl();
    return el ? (await el.text()).trim() : null;
  }

  /** Copy the current term. */
  async clickCopy(): Promise<void> {
    await (await this.copyButton())?.click();
  }

  /** Whether Copy has flipped to its "Copied" confirmation. */
  async isCopied(): Promise<boolean> {
    const button = await this.copyButton();
    return button ? /Copied/.test(await button.getText()) : false;
  }

  /** "Added it → next" — advance to the next idea. */
  async clickNext(): Promise<void> {
    await (await this.nextButton())?.click();
  }

  /** "Not this one" — dismiss the current idea. */
  async clickDismiss(): Promise<void> {
    await (await this.dismissButton())?.click();
  }

  /** Close the companion. */
  async clickDone(): Promise<void> {
    await (await this.doneButton()).click();
  }
}
