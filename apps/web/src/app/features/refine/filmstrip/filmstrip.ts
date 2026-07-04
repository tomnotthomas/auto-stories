import { Component, computed, inject, input, output } from '@angular/core';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';

import { MIN_PHOTOS, StoryService } from '../../../story/story.service';

/** One frame resolved to its picked photo, for the strip. */
interface Thumb {
  readonly photoId: string;
  readonly previewUrl: string | null;
}

/**
 * The refine filmstrip (spec 5.1): the story's frames as draggable thumbnails.
 * Drag to reorder the narrative, tap to jump to a frame, "×" to drop one (never
 * below MIN_PHOTOS), and an Add tile picks more photos. Reorder/drop/add write
 * through StoryService directly (the same pattern the picker uses); adding photos
 * emits `photosAdded` so the parent rebuilds the story to place them.
 */
@Component({
  selector: 'app-refine-filmstrip',
  imports: [DragDropModule, MatIconModule],
  templateUrl: './filmstrip.html',
})
export class RefineFilmstrip {
  private readonly story = inject(StoryService);

  /** The frame index currently shown, so the strip highlights it. */
  readonly current = input(0);
  /** The user tapped a thumbnail to view that frame. */
  readonly select = output<number>();
  /** Photos were added — the parent should rebuild the story to place them. */
  readonly photosAdded = output<void>();

  protected readonly thumbs = computed<Thumb[]>(() => {
    const photos = this.story.photos();
    return this.story.frames().map((frame) => ({
      photoId: frame.photoId,
      previewUrl: photos.find((p) => p.id === frame.photoId)?.previewUrl ?? null,
    }));
  });
  /** Dropping is allowed only while the story stays above the minimum length. */
  protected readonly canDrop = computed(() => this.thumbs().length > MIN_PHOTOS);
  /** The Add tile hides once the photo pool is full. */
  protected readonly isFull = this.story.isFull;

  protected onReorder(event: CdkDragDrop<unknown>): void {
    this.story.reorderFrames(event.previousIndex, event.currentIndex);
  }

  protected onSelect(index: number): void {
    this.select.emit(index);
  }

  protected onDrop(photoId: string): void {
    this.story.dropPhoto(photoId);
  }

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.story.addPhotos(Array.from(input.files));
      this.photosAdded.emit();
    }
    input.value = ''; // let the same file be re-picked
  }
}
