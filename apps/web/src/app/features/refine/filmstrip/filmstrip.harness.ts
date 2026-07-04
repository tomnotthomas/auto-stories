import { ComponentHarness } from '@angular/cdk/testing';

/** Page-object harness for the refine filmstrip. Exposes intent; asserts nothing. */
export class RefineFilmstripHarness extends ComponentHarness {
  static hostSelector = 'app-refine-filmstrip';

  private readonly thumbs = this.locatorForAll('button[aria-label^="View frame"]');
  private readonly dropButtons = this.locatorForAll('button[aria-label="Drop frame"]');
  private readonly addInput = this.locatorForOptional('input[aria-label="Add photos"]');

  /** How many frame thumbnails are shown. */
  async getThumbnailCount(): Promise<number> {
    return (await this.thumbs()).length;
  }

  /** Tap the thumbnail at `index` to view that frame. */
  async selectThumbnail(index: number): Promise<void> {
    await (await this.thumbs())[index].click();
  }

  /** Whether any thumbnail offers a drop control (hidden at the minimum). */
  async canDrop(): Promise<boolean> {
    return (await this.dropButtons()).length > 0;
  }

  /** Drop the frame at `index`. */
  async dropThumbnail(index: number): Promise<void> {
    await (await this.dropButtons())[index].click();
  }

  /** Whether the Add tile is offered (hidden when the pool is full). */
  async hasAddTile(): Promise<boolean> {
    return (await this.addInput()) !== null;
  }
}
