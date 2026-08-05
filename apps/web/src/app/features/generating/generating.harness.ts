import { ComponentHarness } from '@angular/cdk/testing';

/** Page-object harness for the Generating screen. Exposes what the screen is
 * doing — never how it is styled. */
export class GeneratingHarness extends ComponentHarness {
  static hostSelector = 'app-generating';

  private readonly heading = this.locatorFor('h1');
  private readonly statusLine = this.locatorFor('[role="status"]');
  private readonly printCards = this.locatorForAll('[data-print]');
  private readonly seenTally = this.locatorFor('[data-tally="seen"]');
  private readonly keptTally = this.locatorFor('[data-tally="kept"]');
  private readonly quietLine = this.locatorForOptional('[data-quiet]');
  private readonly headlines = this.locatorForAll('[data-headline]');
  private readonly kickers = this.locatorForAll('[data-kicker]');
  private readonly segmentBars = this.locatorForAll('[data-segment]');

  /** The status heading text. */
  async getHeadingText(): Promise<string> {
    return (await this.heading()).text();
  }

  /** What the screen is telling assistive tech right now. */
  async getStatusText(): Promise<string> {
    return (await this.statusLine()).text();
  }

  /** The photos currently on the table, in the order they were dealt. */
  async getPrintPhotoIds(): Promise<string[]> {
    const cards = await this.printCards();
    const ids = await Promise.all(cards.map((card) => card.getAttribute('data-print')));
    return ids.filter((id): id is string => id !== null);
  }

  /** The "N looked at" tally. */
  async getSeenTally(): Promise<string> {
    return (await this.seenTally()).text();
  }

  /** The "N kept · N yours" tally. */
  async getKeptTally(): Promise<string> {
    return (await this.keptTally()).text();
  }

  /** Whether the screen has gone quiet because it ran out of photos to show. */
  async hasQuietLine(): Promise<boolean> {
    return (await this.quietLine()) !== null;
  }

  /** The words set on the prints the model chose, in deal order. */
  async getSetHeadlines(): Promise<string[]> {
    const headlines = await this.headlines();
    return Promise.all(headlines.map((headline) => headline.text()));
  }

  /** The small-caps lines above those words. */
  async getSetKickers(): Promise<string[]> {
    const kickers = await this.kickers();
    return Promise.all(kickers.map((kicker) => kicker.text()));
  }

  /** How many of the story's progress bars the kept pile has become. */
  async getSegmentCount(): Promise<number> {
    return (await this.segmentBars()).length;
  }
}
