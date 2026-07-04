import { ComponentHarness } from '@angular/cdk/testing';

/** Page-object harness for the Generating screen. */
export class GeneratingHarness extends ComponentHarness {
  static hostSelector = 'app-generating';

  private readonly heading = this.locatorFor('h1');

  /** The status heading text. */
  async getHeadingText(): Promise<string> {
    return (await this.heading()).text();
  }
}
