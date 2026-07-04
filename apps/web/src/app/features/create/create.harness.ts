import { ComponentHarness } from '@angular/cdk/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatChipListboxHarness } from '@angular/material/chips/testing';

/**
 * Page-object harness for the Create (step 1) screen — pick photos, story
 * line, tone. Exposes state and actions by intent; tests do the asserting.
 */
export class CreateHarness extends ComponentHarness {
  static hostSelector = 'app-create';

  private readonly title = this.locatorFor('h1');
  private readonly backButton = this.locatorFor(
    MatButtonHarness.with({ selector: '[aria-label="Back to example"]' }),
  );
  private readonly storyField = this.locatorFor(MatInputHarness);
  private readonly toneList = this.locatorFor(MatChipListboxHarness);
  private readonly createButton = this.locatorFor(
    MatButtonHarness.with({ text: /Create my story/ }),
  );
  // The per-photo remove control is a native overlay button (a small dark
  // circle over the photo), not a Material button, so locate it by selector.
  private readonly removeButtons = this.locatorForAll('button[aria-label="Remove photo"]');

  /** The screen title. */
  async getTitle(): Promise<string> {
    return (await this.title()).text();
  }

  /** Go back to the first-open example. */
  async clickBack(): Promise<void> {
    await (await this.backButton()).click();
  }

  /** Type the "What's the story?" line. */
  async typeStory(text: string): Promise<void> {
    await (await this.storyField()).setValue(text);
  }

  /** Select a tone chip by its visible label. */
  async selectTone(label: string): Promise<void> {
    const [chip] = await (await this.toneList()).getChips({ text: new RegExp(label) });
    await chip.select();
  }

  /** Number of picked photos currently shown (one remove button per photo). */
  async photoCount(): Promise<number> {
    return (await this.removeButtons()).length;
  }

  /** Remove the first picked photo. */
  async removeFirstPhoto(): Promise<void> {
    await (await this.removeButtons())[0].click();
  }

  /** Whether the Create action is enabled. */
  async isCreateEnabled(): Promise<boolean> {
    return !(await (await this.createButton()).isDisabled());
  }

  /** Submit the story. */
  async clickCreate(): Promise<void> {
    await (await this.createButton()).click();
  }
}
