import { Injectable, inject } from '@angular/core';

import { StoryService } from './story.service';
import { StoryGateway, type GenerateOutcome } from './story.gateway';
import { ImageService } from './image.service';
import { DEFAULT_STYLE } from './caption-style';

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

  /**
   * Refine: caption photos the user added by hand during refine and append them
   * as new frames, keeping every existing frame and its placement (this is the
   * "Add photo" path — no full rebuild that resets the user's edits). The new
   * ids go up as `mustInclude` so the model captions them even past the 5–7
   * target (2.5). A transient failure never bounces the user off the payoff: the
   * photo is still appended (empty caption) so it never silently vanishes, and
   * the user can type or regenerate it.
   */
  async captionNewPhotos(): Promise<void> {
    const inStory = new Set(this.story.frames().map((frame) => frame.photoId));
    const newIds = this.story
      .photos()
      .map((photo) => photo.id)
      .filter((id) => !inStory.has(id));
    if (newIds.length === 0) return;

    const captions = new Map<string, string>();
    try {
      const outcome = await this.request(newIds);
      if (outcome.ok) {
        for (const frame of outcome.response.frames) {
          if (newIds.includes(frame.photoId)) captions.set(frame.photoId, frame.caption);
        }
      }
    } catch {
      // Fall through — append with empty captions rather than bounce the user.
    }

    for (const id of newIds) {
      this.story.appendFrame({
        photoId: id,
        order: 0,
        caption: captions.get(id) ?? '',
        style: DEFAULT_STYLE,
      });
    }
  }

  /**
   * One round trip: downscale the picks, enqueue the job, then wait on its SSE
   * stream for the finished story (architecture 6.1). Returns the same
   * GenerateOutcome as before, so the three callers above are unchanged — the
   * async transport is hidden here. A synchronous accept error (400/413/429) is
   * returned as-is without opening a stream.
   */
  private async request(
    mustInclude?: readonly string[],
  ): Promise<GenerateOutcome> {
    const photos = await this.images.toProxies(this.story.photos());
    const accepted = await this.gateway.generate({
      story: this.story.storyLine().trim(),
      tone: this.story.tone() ?? undefined,
      photos,
      mustInclude: mustInclude && mustInclude.length ? [...mustInclude] : undefined,
    });
    if (!accepted.ok) return accepted;
    return this.gateway.streamStory(accepted.jobId);
  }
}
