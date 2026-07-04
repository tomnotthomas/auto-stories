import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { StoryService } from '../../story/story.service';

/** A frame resolved for display: the picked photo's preview URL + its caption. */
interface ViewFrame {
  readonly previewUrl: string | null;
  readonly caption: string;
}

/**
 * The payoff — the finished, ordered, captioned story (approach 5.3). One frame
 * at a time, Stories-style: tap right to advance, left to go back. Refine (tap
 * a caption to edit/move, regenerate, reorder) lands in a follow-up; for now the
 * caption is shown for reading, not editing.
 */
@Component({
  selector: 'app-story',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './story.html',
})
export class Story {
  private readonly story = inject(StoryService);
  private readonly index = signal(0);

  /** True when the model dropped a photo but still built a story (4.3). */
  protected readonly partial = this.story.partial;
  protected readonly pickedCount = this.story.photoCount;
  protected readonly bannerDismissed = signal(false);

  /** Frames in narrative order, each resolved to its picked photo. */
  protected readonly frames = computed<ViewFrame[]>(() => {
    const photos = this.story.photos();
    return [...this.story.frames()]
      .sort((a, b) => a.order - b.order)
      .map((frame) => ({
        previewUrl: photos.find((p) => p.id === frame.photoId)?.previewUrl ?? null,
        caption: frame.caption,
      }));
  });
  protected readonly frameCount = computed(() => this.frames().length);
  protected readonly currentIndex = this.index.asReadonly();
  protected readonly current = computed(() => this.frames()[this.index()] ?? null);

  protected next(): void {
    this.index.update((i) => Math.min(i + 1, this.frameCount() - 1));
  }

  protected prev(): void {
    this.index.update((i) => Math.max(i - 1, 0));
  }

  protected dismissBanner(): void {
    this.bannerDismissed.set(true);
  }

  protected startOver(): void {
    this.story.reset();
  }
}
