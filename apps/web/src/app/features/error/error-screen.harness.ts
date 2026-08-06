import { ComponentHarness } from '@angular/cdk/testing';
import { MatButtonHarness } from '@angular/material/button/testing';

/** Page-object harness for the Error screen. */
export class ErrorScreenHarness extends ComponentHarness {
  static hostSelector = 'app-error';

  private readonly why = this.locatorFor('[data-why]');
  private readonly when = this.locatorForOptional('[data-when]');
  private readonly kept = this.locatorForOptional('[data-kept]');
  private readonly heading = this.locatorFor('h1');
  private readonly tryAgainButton = this.locatorForOptional(
    MatButtonHarness.with({ text: /Try again/ }),
  );
  private readonly changePhotosButton = this.locatorForOptional(
    MatButtonHarness.with({ text: /Change photos/ }),
  );
  private readonly goBackButton = this.locatorForOptional(
    MatButtonHarness.with({ text: /Go back/ }),
  );

  /** What the screen says happened. */
  async getTitle(): Promise<string> {
    return (await this.heading()).text();
  }

  /** Why it happened — the explanation of the cause. */
  async getWhy(): Promise<string> {
    return (await this.why()).text();
  }

  /** When the refusal lifts, if the screen states a time. */
  async getWhen(): Promise<string | null> {
    const when = await this.when();
    return when ? when.text() : null;
  }

  /** What the screen promises is kept, if it promises anything. */
  async getKept(): Promise<string | null> {
    const kept = await this.kept();
    return kept ? kept.text() : null;
  }

  /** Whether a retry is offered at all. */
  async hasTryAgain(): Promise<boolean> {
    return (await this.tryAgainButton()) !== null;
  }

  /** Whether the retry is currently usable. */
  async isTryAgainEnabled(): Promise<boolean> {
    const button = await this.tryAgainButton();
    return button !== null && !(await button.isDisabled());
  }

  /** Whether the screen offers a route back to the picker instead of a retry. */
  async hasChangePhotos(): Promise<boolean> {
    return (await this.changePhotosButton()) !== null;
  }

  /** Whether the screen offers a way out that keeps the work. */
  async hasGoBack(): Promise<boolean> {
    return (await this.goBackButton()) !== null;
  }

  /** Retry generation. */
  async clickTryAgain(): Promise<void> {
    await this.click(await this.tryAgainButton(), 'Try again');
  }

  /** Back to the picker to pick a different set. */
  async clickChangePhotos(): Promise<void> {
    await this.click(await this.changePhotosButton(), 'Change photos');
  }

  /** Back to the picker with the work intact. */
  async clickGoBack(): Promise<void> {
    await this.click(await this.goBackButton(), 'Go back');
  }

  /** Click a button the screen only sometimes offers, saying which one is
   * missing rather than passing silently when it is not there. */
  private async click(button: MatButtonHarness | null, label: string): Promise<void> {
    if (!button) throw new Error(`The error screen does not offer "${label}"`);
    await button.click();
  }
}
