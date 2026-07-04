import { ComponentHarness } from '@angular/cdk/testing';
import { MatButtonHarness } from '@angular/material/button/testing';

import { CaptionEditorHarness } from '../refine/caption-editor/caption-editor.harness';

/**
 * Page-object harness for the first-open Example (wow) screen.
 *
 * Exposes state and actions by intent; it never asserts — tests read from it
 * and make the assertions. Reuses MatButtonHarness for the CTA.
 */
export class ExampleHarness extends ComponentHarness {
  static hostSelector = 'app-example';

  private readonly caption = this.locatorFor('.story-caption');
  private readonly cta = this.locatorFor(MatButtonHarness.with({ text: /Try it/ }));
  private readonly editor = this.locatorForOptional(CaptionEditorHarness);

  /** The caption shown on the example story frame. */
  async getCaptionText(): Promise<string> {
    return (await this.caption()).text();
  }

  /** Tap the example caption to open the editor. */
  async tapCaption(): Promise<void> {
    await (await this.caption()).click();
  }

  /** The caption editor, when open; otherwise null. */
  async getEditor(): Promise<CaptionEditorHarness | null> {
    return this.editor();
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
