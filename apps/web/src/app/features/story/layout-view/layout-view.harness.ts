import { ComponentHarness } from '@angular/cdk/testing';

/** Page-object harness for the Looks renderer's DOM half. Exposes intent only —
 * what the frame shows, never how it is styled. */
export class LayoutViewHarness extends ComponentHarness {
  static hostSelector = 'app-layout-view';

  private readonly texts = this.locatorForAll('[data-layout-text]');
  private readonly rules = this.locatorForAll('[data-layout-rule]');
  private readonly rows = this.locatorForAll('[data-layout-row]');
  private readonly tags = this.locatorForAll('[data-layout-tag]');
  private readonly marks = this.locatorForAll('[data-layout-mark]');
  private readonly tabs = this.locatorForAll('[data-layout-tab]');
  private readonly stencilled = this.locatorForAll('[data-layout-stroke]');
  private readonly scrim = this.locatorForOptional('[data-layout-scrim]');
  private readonly panel = this.locatorForOptional('[data-layout-panel]');
  private readonly border = this.locatorForOptional('[data-layout-border]');
  private readonly stack = this.locatorFor('[data-layout-column]');

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

  /** How many tags are rendered. */
  async tagCount(): Promise<number> {
    return (await this.tags()).length;
  }

  /** How many blocks of type are drawn as outlines rather than filled. */
  async stencilledTextCount(): Promise<number> {
    return (await this.stencilled()).length;
  }

  /** The text of every marked (emphasised) phrase, in order. */
  async markTexts(): Promise<string[]> {
    const els = await this.marks();
    return Promise.all(els.map(async (el) => (await el.text()).trim()));
  }

  /** Which mark each emphasised phrase carries, in order. */
  async markKinds(): Promise<string[]> {
    const els = await this.marks();
    const kinds = await Promise.all(els.map((el) => el.getAttribute('data-layout-mark')));
    return kinds.map((kind) => kind ?? '');
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

  /** Every tag's label, in order. */
  async tagContents(): Promise<string[]> {
    const els = await this.tags();
    return Promise.all(els.map(async (el) => (await el.text()).replace(/\s+/g, ' ').trim()));
  }

  /** Which style each tag is drawn in (pill / tape / stamp / chip), in order. */
  async tagStyles(): Promise<string[]> {
    const els = await this.tags();
    const styles = await Promise.all(els.map((el) => el.getAttribute('data-layout-tag-style')));
    return styles.map((style) => style ?? '');
  }

  /** Whether the legibility scrim is present. */
  async hasScrim(): Promise<boolean> {
    return (await this.scrim()) !== null;
  }

  /** Whether a solid panel is drawn behind the stack. */
  async hasPanel(): Promise<boolean> {
    return (await this.panel()) !== null;
  }

  /** Whether an inset frame is drawn on the photo. */
  async hasBorder(): Promise<boolean> {
    return (await this.border()) !== null;
  }

  /** How far the whole stack is tilted, or null when it sits square. */
  async stackTiltDeg(): Promise<number | null> {
    const tilt = await (await this.stack()).getAttribute('data-layout-rotation');
    return tilt === null ? null : Number(tilt);
  }
}
