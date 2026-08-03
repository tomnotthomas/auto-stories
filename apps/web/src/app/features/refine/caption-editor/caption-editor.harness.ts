import { ComponentHarness } from '@angular/cdk/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatSliderHarness } from '@angular/material/slider/testing';

/** Page-object harness for the refine text editor. Exposes intent; asserts nothing. */
export class CaptionEditorHarness extends ComponentHarness {
  static hostSelector = 'app-caption-editor';

  private readonly textInput = this.locatorFor('.caption-input');
  private readonly sizeSlider = this.locatorForOptional(MatSliderHarness);
  private readonly legibilityButton = this.locatorForOptional(
    MatButtonHarness.with({ text: /Legibility/ }),
  );
  private readonly regenerateButton = this.locatorForOptional(
    MatButtonHarness.with({ text: /Regenerate/ }),
  );
  private readonly doneButton = this.locatorFor(MatButtonHarness.with({ text: /Done/ }));
  private readonly removeButton = this.locatorForOptional(
    MatButtonHarness.with({ text: /Remove/ }),
  );

  /** The text currently in the editable field. */
  async getHeadline(): Promise<string> {
    return (await this.textInput()).getProperty<string>('value');
  }

  /** Replace the text (fires one input event). */
  async setHeadline(text: string): Promise<void> {
    const input = await this.textInput();
    await input.setInputValue(text);
    await input.dispatchEvent('input');
  }

  /** Whether the text-size control is offered (only when the host stores a placement). */
  async hasSize(): Promise<boolean> {
    return (await this.sizeSlider()) !== null;
  }

  /** Drag the text-size slider to a scale value. */
  async setSize(scale: number): Promise<void> {
    const slider = await this.sizeSlider();
    const thumb = await slider?.getEndThumb();
    await thumb?.setValue(scale);
  }

  /** Whether the legibility toggle is offered (only when the host stores one). */
  async hasLegibility(): Promise<boolean> {
    return (await this.legibilityButton()) !== null;
  }

  /** Flip the legibility-background toggle. */
  async toggleLegibility(): Promise<void> {
    await (await this.legibilityButton())?.click();
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

  /** Ask for fresh words. */
  async clickRegenerate(): Promise<void> {
    const button = await this.regenerateButton();
    await button?.click();
  }

  /** Finish editing. */
  async clickDone(): Promise<void> {
    await (await this.doneButton()).click();
  }

  /** Whether the Remove action is offered. */
  async hasRemove(): Promise<boolean> {
    return (await this.removeButton()) !== null;
  }

  /** Delete the text block being edited. */
  async clickRemove(): Promise<void> {
    await (await this.removeButton())?.click();
  }
}
