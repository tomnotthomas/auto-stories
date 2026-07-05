import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';

import { StoryService } from '../../story/story.service';
import { GenerationService } from '../../story/generation.service';

/**
 * The model is building the story. The generate round trip lives in
 * GenerationService (shared with refine); this screen kicks it off and, while it
 * waits, narrates the real work over the user's own photos (5.7) — a ticker
 * advances the steps and cycles the images.
 */
@Component({
  selector: 'app-generating',
  imports: [MatProgressBarModule, MatIconModule],
  templateUrl: './generating.html',
})
export class Generating implements OnDestroy {
  private readonly story = inject(StoryService);
  private readonly generation = inject(GenerationService);

  protected readonly steps = [
    'Reading your photos',
    'Finding the story — strongest hook first',
    'Writing the captions',
  ] as const;

  private readonly tick = signal(0);
  /** The step to highlight — advances then holds on the last one. */
  protected readonly activeStep = computed(() => Math.min(this.tick(), this.steps.length - 1));
  /** The user's photos, stacked behind the copy; the active one crossfades in. */
  protected readonly photos = this.story.photos;
  protected readonly activePhoto = computed(() => {
    const count = this.story.photos().length;
    return count ? this.tick() % count : 0;
  });

  private readonly timer = setInterval(() => this.tick.update((t) => t + 1), 1600);

  constructor() {
    void this.generation.generate();
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }
}
