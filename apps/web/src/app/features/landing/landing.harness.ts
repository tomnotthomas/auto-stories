import { ComponentHarness } from '@angular/cdk/testing';
import { MatButtonHarness } from '@angular/material/button/testing';

/**
 * Page-object harness for the Landing component. Exposes state and actions by
 * intent; it never asserts — tests read from it and make the assertions.
 */
export class LandingHarness extends ComponentHarness {
  static hostSelector = 'app-landing';

  private readonly heading = this.locatorFor('h1');
  private readonly buttons = this.locatorForAll(MatButtonHarness);

  /** Text of the landing headline. */
  async getHeadingText(): Promise<string> {
    return (await this.heading()).text();
  }

  /** Labels of every call-to-action, in document order. */
  async getCtaLabels(): Promise<string[]> {
    const buttons = await this.buttons();
    return Promise.all(buttons.map((b) => b.getText()));
  }
}
