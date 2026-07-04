import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { StoryService } from '../../story/story.service';

/**
 * First-open interactive example — the wow (approach 2.3, 5.5). Shows a finished
 * example Story frame (real output, editable-looking caption + coach mark) with
 * one CTA that drops the user straight into creating their own.
 */
@Component({
  selector: 'app-example',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './example.html',
})
export class Example {
  private readonly story = inject(StoryService);

  /** The canned example story shown on first open. */
  protected readonly caption =
    'One candle, ten sets of hands ready to help her blow it out.';

  /** Leave the example and start creating a real story. */
  protected tryIt(): void {
    this.story.startCreating();
  }
}
