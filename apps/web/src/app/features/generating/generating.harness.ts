import { ComponentHarness, TestElement } from '@angular/cdk/testing';

/** Where a simulated finger goes down on a print. */
const GRAB_X = 195;
const GRAB_Y = 420;

/** Page-object harness for the Generating screen. Exposes what the screen is
 * doing — never how it is styled. */
export class GeneratingHarness extends ComponentHarness {
  static hostSelector = 'app-generating';

  private readonly heading = this.locatorFor('h1');
  private readonly statusLine = this.locatorFor('[role="status"]');
  private readonly printCards = this.locatorForAll('[data-print]');
  private readonly seenTally = this.locatorFor('[data-tally="seen"]');
  private readonly keptTally = this.locatorFor('[data-tally="kept"]');
  private readonly invitation = this.locatorForOptional('[data-hint]');
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

  /** Whether the "drag a photo down to keep it" invitation is showing. */
  async hasInvitation(): Promise<boolean> {
    return (await this.invitation()) !== null;
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

  /** Put a finger on the print showing `photoId`. */
  async pressPrint(photoId: string): Promise<void> {
    this.pointer = { x: GRAB_X, y: GRAB_Y };
    await (
      await this.printOf(photoId)
    ).dispatchEvent('pointerdown', { clientX: GRAB_X, clientY: GRAB_Y, pointerId: 1 });
  }

  /** Move the finger `dy` px from where it went down (negative is upward). */
  async dragBy(dy: number): Promise<void> {
    this.pointer = { x: GRAB_X, y: GRAB_Y + dy };
    await (
      await this.host()
    ).dispatchEvent('pointermove', {
      clientX: this.pointer.x,
      clientY: this.pointer.y,
      pointerId: 1,
    });
  }

  /** Lift the finger where the last move left it. */
  async release(): Promise<void> {
    await (
      await this.host()
    ).dispatchEvent('pointerup', {
      clientX: this.pointer.x,
      clientY: this.pointer.y,
      pointerId: 1,
    });
  }

  /** Press, drag and release in one gesture. */
  async dragPrint(photoId: string, dy: number): Promise<void> {
    await this.pressPrint(photoId);
    await this.dragBy(dy);
    await this.release();
  }

  private pointer = { x: GRAB_X, y: GRAB_Y };

  private async printOf(photoId: string): Promise<TestElement> {
    return this.locatorFor(`[data-print="${photoId}"]`)();
  }
}
