import { ComponentHarness } from '@angular/cdk/testing';

/** Page-object harness for the Looks renderer's DOM half. Exposes intent only —
 * what the frame shows, never how it is styled. */
export class LayoutViewHarness extends ComponentHarness {
  static hostSelector = 'app-layout-view';

  private readonly texts = this.locatorForAll('[data-layout-text]');
  private readonly rules = this.locatorForAll('[data-layout-rule]');
  private readonly rows = this.locatorForAll('[data-layout-row]');
  private readonly marks = this.locatorForAll('[data-layout-mark]');
  private readonly tabs = this.locatorForAll('[data-layout-tab]');
  private readonly scrim = this.locatorForOptional('[data-layout-scrim]');

  /** How many blocks of type are rendered. */
  async textCount(): Promise<number> {
    return (await this.texts()).length;
  }

  /** How many hairline rules are rendered. */
  async ruleCount(): Promise<number> {
    return (await this.rules()).length;
  }

  /** How many byline rows are rendered. */
  async rowCount(): Promise<number> {
    return (await this.rows()).length;
  }

  /** How many accent tabs are rendered. */
  async tabCount(): Promise<number> {
    return (await this.tabs()).length;
  }

  /** The text of every marked (emphasised) phrase, in order. */
  async markTexts(): Promise<string[]> {
    const els = await this.marks();
    return Promise.all(els.map(async (el) => (await el.text()).trim()));
  }

  /** Every block of type, in order. */
  async textContents(): Promise<string[]> {
    const els = await this.texts();
    return Promise.all(els.map(async (el) => (await el.text()).replace(/\s+/g, ' ').trim()));
  }

  /** Every byline row's text, in order. */
  async rowContents(): Promise<string[]> {
    const els = await this.rows();
    return Promise.all(els.map(async (el) => (await el.text()).replace(/\s+/g, ' ').trim()));
  }

  /** Whether the legibility scrim is present. */
  async hasScrim(): Promise<boolean> {
    return (await this.scrim()) !== null;
  }
}
