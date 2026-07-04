import { Injectable, inject } from '@angular/core';

import { StoryService } from './story.service';
import { StoryGateway } from './story.gateway';
import { ImageService } from './image.service';

/**
 * Owns the "build a story" round trip so both the generating screen and refine
 * reuse one pipeline: downscale the picked photos to proxies (3.4), POST them,
 * and apply the result. Keeping it here leaves StoryService as pure state and
 * removes the duplicate call the refine actions would otherwise need.
 */
@Injectable({ providedIn: 'root' })
export class GenerationService {
  private readonly story = inject(StoryService);
  private readonly images = inject(ImageService);
  private readonly gateway = inject(StoryGateway);

  /**
   * Build (or rebuild) the whole story from the current picks + story line, then
   * land on the payoff or a specific error (4.3). Used by the generating screen
   * and by refine's "Regenerate story" (a rebuild resets placement — it's a new
   * story).
   */
  async generate(): Promise<void> {
    try {
      const outcome = await this.request();
      if (outcome.ok) {
        this.story.completeStory(outcome.response.frames, outcome.response.partial ?? false);
      } else {
        this.story.failStory({ code: outcome.code, message: outcome.message });
      }
    } catch {
      this.story.failStory({
        code: 'network',
        message: 'Something went wrong. Please try again.',
      });
    }
  }

  /**
   * Refine: rewrite one frame's caption, keeping its placement and the rest of
   * the story. Re-runs generation and applies only the matching photo's fresh
   * caption — no backend change, and a transient failure never bounces the user
   * off the payoff (returns false so the caller can show a light message).
   */
  async regenerateCaption(photoId: string): Promise<boolean> {
    try {
      const outcome = await this.request();
      if (!outcome.ok) return false;
      const fresh = outcome.response.frames.find((frame) => frame.photoId === photoId);
      if (!fresh) return false;
      this.story.setCaption(photoId, fresh.caption);
      return true;
    } catch {
      return false;
    }
  }

  private async request() {
    const photos = await this.images.toProxies(this.story.photos());
    return this.gateway.generate({
      story: this.story.storyLine().trim(),
      tone: this.story.tone() ?? undefined,
      photos,
    });
  }
}
