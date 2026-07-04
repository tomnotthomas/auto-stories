import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { StoryService } from '../../story/story.service';

/**
 * A specific failure (at-capacity / timeout / network …) with a clear next step
 * (4.3, 5.7). Basic for now — the playful per-error animations (5.9) are a
 * follow-up. Photos and the story line are kept, so Try again just re-runs.
 */
@Component({
  selector: 'app-error',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './error-screen.html',
})
export class ErrorScreen {
  private readonly story = inject(StoryService);

  /** The specific failure to explain. */
  protected readonly error = this.story.error;

  protected tryAgain(): void {
    this.story.startGenerating();
  }

  protected startOver(): void {
    this.story.reset();
  }
}
