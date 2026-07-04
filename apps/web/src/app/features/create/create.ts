import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { StoryService } from '../../story/story.service';

/**
 * Step 1 — pick photos + "What's the story?" + tone.
 *
 * Placeholder shell for now (the flow can reach it and go back); the photo
 * picker, story field, tone chips, and Create action land in a follow-up PR.
 */
@Component({
  selector: 'app-create',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './create.html',
})
export class Create {
  private readonly story = inject(StoryService);

  /** Return to the first-open example. */
  protected back(): void {
    this.story.reset();
  }
}
