import { ComponentHarness } from '@angular/cdk/testing';

/** Page-object harness for the art-directed layout view. Exposes intent only. */
export class LayoutViewHarness extends ComponentHarness {
  static hostSelector = 'app-layout-view';

  private readonly elements = this.locatorForAll('[data-layout-element]');
  private readonly lines = this.locatorForAll('[data-layout-line]');

  /** How many placed elements are rendered. */
  async elementCount(): Promise<number> {
    return (await this.elements()).length;
  }

  /** Every rendered line of text, in order (stacked elements contribute a line each). */
  async lineTexts(): Promise<string[]> {
    const els = await this.lines();
    return Promise.all(els.map(async (el) => (await el.text()).trim()));
  }
}
