import { ComponentHarness } from '@angular/cdk/testing';

/** Where one marker ended up, in % of the frame — the placement decision itself. */
export interface SparkPlacement {
  readonly type: string;
  readonly xPct: number;
  readonly yPct: number;
}

/** Page-object harness for the sparks overlay. Exposes intent; asserts nothing. */
export class StorySparksHarness extends ComponentHarness {
  static hostSelector = 'app-story-sparks';

  private readonly markers = this.locatorForAll('[data-spark-marker]');
  private readonly queries = this.locatorForAll('[data-spark-query]');
  private readonly musicChips = this.locatorForAll('[data-spark-music]');
  private readonly musicQueryEl = this.locatorForOptional('[data-spark-music-query]');

  /** How many type-shaped markers are drawn (music/dismissed excluded upstream). */
  async markerCount(): Promise<number> {
    return (await this.markers()).length;
  }

  /** The suggestion type of each marker, in order — its shape follows this. */
  async markerTypes(): Promise<string[]> {
    const els = await this.markers();
    return Promise.all(els.map(async (el) => (await el.getAttribute('data-spark-type')) ?? ''));
  }

  /** Where each marker sits, in order — what the placement pass decided. */
  async placements(): Promise<SparkPlacement[]> {
    const els = await this.markers();
    return Promise.all(
      els.map(async (el) => ({
        type: (await el.getAttribute('data-spark-type')) ?? '',
        xPct: Number(await el.getAttribute('data-spark-x')),
        yPct: Number(await el.getAttribute('data-spark-y')),
      })),
    );
  }

  /** The term previewed on each marker, in order. */
  async queryTexts(): Promise<string[]> {
    const els = await this.queries();
    return Promise.all(els.map(async (el) => (await el.text()).trim()));
  }

  /** How many docked music chips are shown. */
  async musicCount(): Promise<number> {
    return (await this.musicChips()).length;
  }

  /** The term previewed on the (first) music chip, or null. */
  async musicQuery(): Promise<string | null> {
    const el = await this.musicQueryEl();
    return el ? (await el.text()).trim() : null;
  }
}
