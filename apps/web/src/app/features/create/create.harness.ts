import { ComponentHarness } from '@angular/cdk/testing';
import { MatButtonHarness } from '@angular/material/button/testing';

/**
 * Page-object harness for the Create component. Exposes state and actions by
 * intent; it never asserts — tests read from it and make the assertions.
 */
export class CreateHarness extends ComponentHarness {
  static hostSelector = 'app-create';

  private readonly heading = this.locatorFor('h1');
  private readonly pickButton = this.locatorFor(MatButtonHarness);
  private readonly selectedCount = this.locatorForOptional('[aria-live]');

  /** Text of the create headline. */
  async getHeadingText(): Promise<string> {
    return (await this.heading()).text();
  }

  /** Label of the photo-picker button. */
  async getPickButtonText(): Promise<string> {
    return (await this.pickButton()).getText();
  }

  /** The "N photos selected" confirmation, or null before any pick. */
  async getSelectedCountText(): Promise<string | null> {
    const el = await this.selectedCount();
    return el ? el.text() : null;
  }
}
