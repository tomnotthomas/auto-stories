import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { StoryService, FramePlacement } from '../../story/story.service';
import { GenerationService } from '../../story/generation.service';
import { CaptionEditor } from '../refine/caption-editor/caption-editor';
import { RefineFilmstrip } from '../refine/filmstrip/filmstrip';

/** A frame resolved for display: the picked photo plus its editable state. */
interface ViewFrame {
  readonly photoId: string;
  readonly previewUrl: string | null;
  readonly caption: string;
  readonly placement: FramePlacement;
  readonly legibility: boolean;
}

/**
 * The payoff — the finished, ordered, captioned story (approach 5.3). View mode
 * pages one frame at a time, Stories-style (tap right to advance, left to go
 * back). "Refine story" enters refine mode: tap a caption to edit/move/resize or
 * regenerate it (a first-time coach mark points the way, 5.9). Reorder + drop and
 * whole-story regenerate live in the refine bar.
 */
@Component({
  selector: 'app-story',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, CaptionEditor, RefineFilmstrip],
  templateUrl: './story.html',
})
export class Story {
  private readonly story = inject(StoryService);
  private readonly generation = inject(GenerationService);
  private readonly index = signal(0);

  /** True when the model dropped a photo but still built a story (4.3). */
  protected readonly partial = this.story.partial;
  protected readonly pickedCount = this.story.photoCount;
  protected readonly coachSeen = this.story.coachSeen;
  protected readonly bannerDismissed = signal(false);

  /** View vs refine mode, and which caption (if any) is open in the editor. */
  protected readonly refining = signal(false);
  protected readonly editingPhotoId = signal<string | null>(null);
  /** The "Reorder & remove" management screen is open. */
  protected readonly managing = signal(false);
  /** True while a per-caption regenerate is in flight. */
  protected readonly regenBusy = signal(false);
  /** The "tap/swipe to move through the story" hint, shown until first use. */
  protected readonly navHintSeen = signal(false);
  private swipeStartX: number | null = null;
  /** True while a whole-story rebuild (Regenerate story / Add photo) is in flight. */
  protected readonly storyBusy = signal(false);

  /** Frames in narrative order, each resolved to its picked photo. */
  protected readonly frames = computed<ViewFrame[]>(() => {
    const photos = this.story.photos();
    return this.story.frames().map((frame) => ({
      photoId: frame.photoId,
      previewUrl: photos.find((p) => p.id === frame.photoId)?.previewUrl ?? null,
      caption: frame.caption,
      placement: frame.placement,
      legibility: frame.legibility,
    }));
  });
  protected readonly frameCount = computed(() => this.frames().length);
  /** Clamped so a drop that shortens the story never strands the index. */
  protected readonly currentIndex = computed(() =>
    Math.min(this.index(), Math.max(0, this.frameCount() - 1)),
  );
  protected readonly current = computed(() => this.frames()[this.currentIndex()] ?? null);
  /** The frame whose caption is open in the editor, or null. */
  protected readonly editingFrame = computed(
    () => this.frames().find((f) => f.photoId === this.editingPhotoId()) ?? null,
  );

  /** More than one frame, so paging is meaningful. */
  protected readonly multiFrame = computed(() => this.frameCount() > 1);

  protected next(): void {
    this.navHintSeen.set(true);
    this.index.set(Math.min(this.currentIndex() + 1, this.frameCount() - 1));
  }

  protected prev(): void {
    this.navHintSeen.set(true);
    this.index.set(Math.max(this.currentIndex() - 1, 0));
  }

  /** Swipe left/right to page (Stories are consumed with a swipe on the web).
   * Off while a caption editor or the manage screen is open. */
  protected onSwipeStart(event: PointerEvent): void {
    this.swipeStartX = this.editingPhotoId() || this.managing() ? null : event.clientX;
  }

  protected onSwipeEnd(event: PointerEvent): void {
    if (this.swipeStartX === null) return;
    const dx = event.clientX - this.swipeStartX;
    this.swipeStartX = null;
    if (Math.abs(dx) < 48) return; // a tap, not a swipe — the tap zones handle it
    if (dx < 0) this.next();
    else this.prev();
  }

  protected dismissBanner(): void {
    this.bannerDismissed.set(true);
  }

  protected enterRefine(): void {
    this.refining.set(true);
  }

  protected exitRefine(): void {
    this.editingPhotoId.set(null);
    this.refining.set(false);
  }

  /** Open the caption editor for a frame; the first tap retires the coach mark. */
  protected editCaption(photoId: string): void {
    this.story.markCoachSeen();
    this.editingPhotoId.set(photoId);
  }

  protected closeEditor(): void {
    this.editingPhotoId.set(null);
  }

  protected onCaption(caption: string): void {
    const id = this.editingPhotoId();
    if (id) this.story.setCaption(id, caption);
  }

  protected onPlacement(placement: Partial<FramePlacement>): void {
    const id = this.editingPhotoId();
    if (id) this.story.setPlacement(id, placement);
  }

  protected onLegibility(): void {
    const id = this.editingPhotoId();
    if (id) this.story.toggleLegibility(id);
  }

  protected async regenerateCaption(): Promise<void> {
    const id = this.editingPhotoId();
    if (!id || this.regenBusy()) return;
    this.regenBusy.set(true);
    try {
      await this.generation.regenerateCaption(id);
    } finally {
      this.regenBusy.set(false);
    }
  }

  /** Open / close the "Reorder & remove" management screen. */
  protected openManage(): void {
    this.managing.set(true);
  }

  protected closeManage(): void {
    this.managing.set(false);
  }

  /** Jump the viewer to the frame the user tapped in the manage list. */
  protected selectFrame(index: number): void {
    this.index.set(index);
  }

  /** Rebuild the whole story from the current picks (Regenerate story, or after
   * adding a photo). A rebuild resets placement — it's a new story. */
  protected async regenerateStory(): Promise<void> {
    if (this.storyBusy()) return;
    this.storyBusy.set(true);
    try {
      await this.generation.generate();
    } finally {
      this.storyBusy.set(false);
    }
  }

  protected startOver(): void {
    this.story.reset();
  }
}
