import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';

import { StoryService } from '../../story/story.service';
import { StoryGateway } from '../../story/story.gateway';
import { ImageService } from '../../story/image.service';

/**
 * The model is building the story. This screen owns the generate call: it
 * downscales the picked photos, POSTs them, and lands the flow on the payoff
 * or a specific error (4.3). While it waits it narrates the real work over the
 * user's own photos (5.7) — a ticker advances the steps and cycles the images.
 */
@Component({
  selector: 'app-generating',
  imports: [MatProgressBarModule, MatIconModule],
  templateUrl: './generating.html',
})
export class Generating implements OnDestroy {
  private readonly story = inject(StoryService);
  private readonly images = inject(ImageService);
  private readonly gateway = inject(StoryGateway);

  protected readonly steps = [
    'Reading your photos',
    'Finding the story — strongest hook first',
    'Writing the captions',
  ] as const;

  private readonly tick = signal(0);
  /** The step to highlight — advances then holds on the last one. */
  protected readonly activeStep = computed(() => Math.min(this.tick(), this.steps.length - 1));
  /** The user's photos cycle behind the copy while they wait. */
  protected readonly backgroundUrl = computed(() => {
    const photos = this.story.photos();
    return photos.length ? photos[this.tick() % photos.length].previewUrl : null;
  });

  private readonly timer = setInterval(() => this.tick.update((t) => t + 1), 1600);

  constructor() {
    void this.run();
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  private async run(): Promise<void> {
    try {
      const photos = await this.images.toProxies(this.story.photos());
      const outcome = await this.gateway.generate({
        story: this.story.storyLine().trim(),
        tone: this.story.tone() ?? undefined,
        photos,
      });
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
}
