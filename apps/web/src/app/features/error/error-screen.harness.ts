import { ComponentHarness } from '@angular/cdk/testing';
import { MatButtonHarness } from '@angular/material/button/testing';

/** Page-object harness for the Error screen. */
export class ErrorScreenHarness extends ComponentHarness {
  static hostSelector = 'app-error';

  private readonly why = this.locatorFor('[data-why]');
  private readonly when = this.locatorForOptional('[data-when]');
  private readonly heading = this.locatorFor('h1');
  private readonly changePhotosButton = this.locatorForOptional(
    MatButtonHarness.with({ text: /Change photos/ }),
  );
  private readonly tryAgainButton = this.locatorFor(MatButtonHarness.with({ text: /Try again/ }));
  private readonly startOverButton = this.locatorFor(MatButtonHarness.with({ text: /Start over/ }));

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

  /** Whether a retry is offered at all. */
  async hasTryAgain(): Promise<boolean> {
    return (await this.tryAgainButtonOptional()) !== null;
  }

  /** Whether the retry is currently usable. */
  async isTryAgainEnabled(): Promise<boolean> {
    const button = await this.tryAgainButtonOptional();
    return button !== null && !(await button.isDisabled());
  }

  /** Whether the screen offers a route back to the picker instead of a retry. */
  async hasChangePhotos(): Promise<boolean> {
    return (await this.changePhotosButton()) !== null;
  }

  /** Go back to the picker, keeping the photos. */
  async clickChangePhotos(): Promise<void> {
    const button = await this.changePhotosButton();
    if (button) await button.click();
  }

  private readonly tryAgainButtonOptional = this.locatorForOptional(
    MatButtonHarness.with({ text: /Try again/ }),
  );

  /** Retry generation. */
  async clickTryAgain(): Promise<void> {
    await (await this.tryAgainButton()).click();
  }

  /** Start the flow over. */
  async clickStartOver(): Promise<void> {
    await (await this.startOverButton()).click();
  }
}
