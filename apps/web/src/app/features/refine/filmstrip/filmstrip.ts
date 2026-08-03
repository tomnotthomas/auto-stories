import { Component, computed, inject, input, output } from '@angular/core';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { MIN_PHOTOS, StoryService } from '../../../story/story.service';

/** One frame resolved to its picked photo, for the list. */
interface Thumb {
  readonly photoId: string;
  readonly previewUrl: string | null;
  readonly caption: string;
}

/**
 * The "reorder & remove" list (spec 5.1): the story's frames on a clean surface,
 * one row each (drag handle, thumbnail, caption, delete). Drag a row to reorder
 * the narrative, tap a thumbnail to jump to that frame, delete to drop one (never
 * below MIN_PHOTOS), and an Add row picks more photos. Reorder/drop/add write
 * through StoryService directly (the same pattern the picker uses); adding photos
 * emits `photosAdded` so the parent rebuilds the story to place them.
 */
@Component({
  selector: 'app-refine-filmstrip',
  imports: [DragDropModule, MatButtonModule, MatIconModule],
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
      caption: frame.headline,
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
