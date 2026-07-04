import { ComponentHarness } from '@angular/cdk/testing';
import { MatButtonHarness } from '@angular/material/button/testing';

/**
 * Page-object harness for the first-open Example (wow) screen.
 *
 * Exposes state and actions by intent; it never asserts — tests read from it
 * and make the assertions. Reuses MatButtonHarness for the CTA.
 */
export class ExampleHarness extends ComponentHarness {
  static hostSelector = 'app-example';

  private readonly caption = this.locatorFor('.story-caption');
  private readonly cta = this.locatorFor(MatButtonHarness);

  /** The caption shown on the example story frame. */
  async getCaptionText(): Promise<string> {
    return (await this.caption()).text();
  }

  /** Label of the "start creating" call-to-action. */
  async getCtaText(): Promise<string> {
    return (await this.cta()).getText();
  }

  /** Click the call-to-action that starts the real flow. */
  async clickCta(): Promise<void> {
    await (await this.cta()).click();
  }
}
