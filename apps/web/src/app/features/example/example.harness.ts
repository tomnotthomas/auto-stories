import { ComponentHarness } from '@angular/cdk/testing';
import { MatButtonHarness } from '@angular/material/button/testing';

/**
 * Page-object harness for the Example component. Exposes state and actions by
 * intent; it never asserts — tests read from it and make the assertions.
 */
export class ExampleHarness extends ComponentHarness {
  static hostSelector = 'app-example';

  private readonly heading = this.locatorFor('h1');
  private readonly cta = this.locatorFor(MatButtonHarness);

  /** Text of the example headline. */
  async getHeadingText(): Promise<string> {
    return (await this.heading()).text();
  }

  /** Label of the call-to-action that leads onward to create. */
  async getCtaText(): Promise<string> {
    return (await this.cta()).getText();
  }

  /** Click the call-to-action. */
  async clickCta(): Promise<void> {
    await (await this.cta()).click();
  }
}
