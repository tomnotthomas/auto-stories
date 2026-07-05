import { ComponentHarness } from '@angular/cdk/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatSliderHarness } from '@angular/material/slider/testing';

/** Page-object harness for the refine caption editor. Exposes intent; asserts nothing. */
export class CaptionEditorHarness extends ComponentHarness {
  static hostSelector = 'app-caption-editor';

  private readonly captionInput = this.locatorFor('.caption-input');
  private readonly sizeSlider = this.locatorFor(MatSliderHarness);
  private readonly legibilityButton = this.locatorFor(MatButtonHarness.with({ text: /Legibility/ }));
  private readonly regenerateButton = this.locatorForOptional(
    MatButtonHarness.with({ text: /Regenerate/ }),
  );
  private readonly doneButton = this.locatorFor(MatButtonHarness.with({ text: /Done/ }));

  /** The caption text currently in the editable field. */
  async getCaption(): Promise<string> {
    return (await this.captionInput()).getProperty<string>('value');
  }

  /** Replace the caption text (fires one input event). */
  async setCaption(text: string): Promise<void> {
    const input = await this.captionInput();
    await input.setInputValue(text);
    await input.dispatchEvent('input');
  }

  /** Drag the text-size slider to a scale value. */
  async setSize(scale: number): Promise<void> {
    const thumb = await (await this.sizeSlider()).getEndThumb();
    await thumb.setValue(scale);
  }

  /** Flip the legibility-background toggle. */
  async toggleLegibility(): Promise<void> {
    await (await this.legibilityButton()).click();
  }

  /** Whether the Regenerate action is offered (hidden in demo mode). */
  async hasRegenerate(): Promise<boolean> {
    return (await this.regenerateButton()) !== null;
  }

  /** Whether Regenerate is currently disabled (e.g. while busy). */
  async isRegenerateDisabled(): Promise<boolean> {
    const button = await this.regenerateButton();
    return button ? button.isDisabled() : true;
  }

  /** Ask for a fresh caption. */
  async clickRegenerate(): Promise<void> {
    const button = await this.regenerateButton();
    await button?.click();
  }

  /** Finish editing. */
  async clickDone(): Promise<void> {
    await (await this.doneButton()).click();
  }
}
