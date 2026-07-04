import { ComponentHarness } from '@angular/cdk/testing';
import { MatButtonHarness } from '@angular/material/button/testing';

/** Page-object harness for the finished-story (payoff) viewer. */
export class StoryHarness extends ComponentHarness {
  static hostSelector = 'app-story';

  private readonly caption = this.locatorFor('.story-caption');
  private readonly nextZone = this.locatorFor('button[aria-label="Next frame"]');
  private readonly prevZone = this.locatorFor('button[aria-label="Previous frame"]');
  private readonly banner = this.locatorForOptional('[aria-label="Dismiss notice"]');
  private readonly startOverButton = this.locatorFor(MatButtonHarness.with({ text: /Start over/ }));

  /** The caption of the frame currently shown. */
  async getCaption(): Promise<string> {
    return (await this.caption()).text();
  }

  /** Advance to the next frame. */
  async tapNext(): Promise<void> {
    await (await this.nextZone()).click();
  }

  /** Go back to the previous frame. */
  async tapPrev(): Promise<void> {
    await (await this.prevZone()).click();
  }

  /** Whether the "a photo was dropped" banner is showing. */
  async hasDroppedBanner(): Promise<boolean> {
    return (await this.banner()) !== null;
  }

  /** Start the flow over. */
  async clickStartOver(): Promise<void> {
    await (await this.startOverButton()).click();
  }
}
