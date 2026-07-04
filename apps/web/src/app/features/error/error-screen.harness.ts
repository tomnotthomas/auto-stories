import { ComponentHarness } from '@angular/cdk/testing';
import { MatButtonHarness } from '@angular/material/button/testing';

/** Page-object harness for the Error screen. */
export class ErrorScreenHarness extends ComponentHarness {
  static hostSelector = 'app-error';

  private readonly message = this.locatorFor('p');
  private readonly tryAgainButton = this.locatorFor(MatButtonHarness.with({ text: /Try again/ }));
  private readonly startOverButton = this.locatorFor(MatButtonHarness.with({ text: /Start over/ }));

  /** The specific failure message shown. */
  async getMessage(): Promise<string> {
    return (await this.message()).text();
  }

  /** Retry generation. */
  async clickTryAgain(): Promise<void> {
    await (await this.tryAgainButton()).click();
  }

  /** Start the flow over. */
  async clickStartOver(): Promise<void> {
    await (await this.startOverButton()).click();
  }
}
