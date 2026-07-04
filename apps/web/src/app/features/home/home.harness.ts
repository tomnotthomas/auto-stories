import { ComponentHarness } from '@angular/cdk/testing';
import { MatButtonHarness } from '@angular/material/button/testing';

/**
 * Page-object harness for the Home landing component.
 *
 * Exposes the component's state and actions by intent; it never asserts —
 * tests read from it and make the assertions. Built-in Material harnesses
 * (e.g. MatButtonHarness) are reused rather than re-deriving locators.
 */
export class HomeHarness extends ComponentHarness {
  static hostSelector = 'app-home';

  private readonly heading = this.locatorFor('h1');
  private readonly cta = this.locatorFor(MatButtonHarness);

  /** Text of the landing headline. */
  async getHeadingText(): Promise<string> {
    return (await this.heading()).text();
  }

  /** Label of the call-to-action button. */
  async getCtaText(): Promise<string> {
    return (await this.cta()).getText();
  }

  /** Click the call-to-action button. */
  async clickCta(): Promise<void> {
    await (await this.cta()).click();
  }
}
