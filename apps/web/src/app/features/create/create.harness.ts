import { ComponentHarness } from '@angular/cdk/testing';
import { MatButtonHarness } from '@angular/material/button/testing';

/**
 * Page-object harness for the Create (step 1) screen.
 * Exposes state and actions by intent; tests do the asserting.
 */
export class CreateHarness extends ComponentHarness {
  static hostSelector = 'app-create';

  private readonly title = this.locatorFor('h1');
  private readonly backButton = this.locatorFor(
    MatButtonHarness.with({ selector: '[aria-label="Back to example"]' }),
  );

  /** The screen title. */
  async getTitle(): Promise<string> {
    return (await this.title()).text();
  }

  /** Go back to the first-open example. */
  async clickBack(): Promise<void> {
    await (await this.backButton()).click();
  }
}
