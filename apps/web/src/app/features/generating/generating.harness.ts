import { ComponentHarness } from '@angular/cdk/testing';

/** Page-object harness for the Generating screen. */
export class GeneratingHarness extends ComponentHarness {
  static hostSelector = 'app-generating';

  private readonly heading = this.locatorFor('h1');
  private readonly stepItems = this.locatorForAll('li');

  /** The status heading text. */
  async getHeadingText(): Promise<string> {
    return (await this.heading()).text();
  }

  /** The narrated work steps shown while waiting. */
  async getStepCount(): Promise<number> {
    return (await this.stepItems()).length;
  }
}
