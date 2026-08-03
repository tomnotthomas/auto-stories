import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { StoryService } from '../../story/story.service';
import { GenerationService } from '../../story/generation.service';
import { StoryExporter } from '../../story/story-exporter.service';
import { CaptionEditor } from '../refine/caption-editor/caption-editor';
import { RefineFilmstrip } from '../refine/filmstrip/filmstrip';
import { StorySparks } from './sparks/sparks';
import { HandoffCompanion } from './handoff-companion/handoff-companion';
import { LayoutView } from './layout-view/layout-view';
import type { Suggestion } from '@auto-stories/api-types';
import type { Composition } from '../../story/look';

/** A frame resolved for display: the picked photo plus what the device composed
 * for it. One text, one renderer (decision 7.25) — the composition is the whole
 * of what is drawn on the photo, in view and in refine alike. */
interface ViewFrame {
  readonly photoId: string;
  readonly previewUrl: string | null;
  /** CSS `filter` that matches this photo's exposure to the story (cohesion). */
  readonly imageFilter: string;
  /** The frame's words — what refine edits and what the composition renders. */
  readonly headline: string;
  /** Optional Instagram add-ons the AI suggested for this frame (in-app sparks). */
  readonly suggestions: readonly Suggestion[];
  /** This frame composed under the story's Look (decision 7.24). */
  readonly composition: Composition;
  /** Frame-level computed light (white vs dark text), from the pixels (7.10). */
  readonly light: boolean;
}

/**
 * The payoff — the finished, ordered, captioned story (approach 5.3). View mode
 * pages one frame at a time, Stories-style (tap right to advance, left to go
 * back). "Refine story" enters refine mode: the same composition stays on screen
 * and tapping it opens the editor for the frame's words (a first-time coach mark
 * points the way, 5.9). Reorder + drop and whole-story regenerate live in the
 * refine bar.
 */
@Component({
  selector: 'app-story',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    CaptionEditor,
    RefineFilmstrip,
    StorySparks,
    HandoffCompanion,
    LayoutView,
  ],
  templateUrl: './story.html',
})
export class Story {
  private readonly story = inject(StoryService);
  private readonly generation = inject(GenerationService);
  private readonly exporter = inject(StoryExporter);
  private readonly index = signal(0);

  /** True when the model dropped a photo but still built a story (4.3). */
  protected readonly partial = this.story.partial;
  protected readonly pickedCount = this.story.photoCount;
  protected readonly coachSeen = this.story.coachSeen;
  protected readonly bannerDismissed = signal(false);

  /** View vs refine mode. */
  protected readonly refining = signal(false);
  /** The photoId whose text is open in the editor, or null when it's closed. */
  protected readonly editing = signal<string | null>(null);
  /** The "Reorder & remove" management screen is open. */
  protected readonly managing = signal(false);
  /** True while a per-frame regenerate is in flight. */
  protected readonly regenBusy = signal(false);
  /** The "tap/swipe to move through the story" hint, shown until first use. */
  protected readonly navHintSeen = signal(false);
  private swipeStartX: number | null = null;
  /** True while a whole-story rebuild (Regenerate story) or an add-photo append
   * is in flight. */
  protected readonly storyBusy = signal(false);
  /** True while rendering + handing off the frames. */
  protected readonly exporting = signal(false);
  /** The hand-off card is showing — reached by tapping Post when the story has
   * add-ons. The card presents them and its own button does the actual hand-off,
   * so the add-ons are seen before we ever leave for Instagram. */
  protected readonly handingOff = signal(false);
  /** Whether the story has any add-ons to surface at the hand-off. */
  protected readonly hasAddOns = computed(() => this.story.keptSuggestionCount() > 0);

  /** Frames in narrative order, each resolved to its picked photo. */
  /**
   * How much of the frame the bottom action bar covers on screen (its 136px of
   * buttons plus the 24px `bottom-6` gap). The exported PNG has no action bar,
   * so a Look's bottom offset is measured from the bottom of the usable frame
   * and only the preview allows for this.
   */
  protected readonly ACTION_BAR_PX = 160;

  protected readonly frames = computed<ViewFrame[]>(() => {
    const photos = this.story.photos();
    return this.story.frames().map((frame) => ({
      photoId: frame.photoId,
      previewUrl: photos.find((p) => p.id === frame.photoId)?.previewUrl ?? null,
      imageFilter: frame.imageFilter,
      headline: frame.headline,
      suggestions: frame.suggestions ?? [],
      composition: frame.composition,
      light: frame.light,
    }));
  });
  protected readonly frameCount = computed(() => this.frames().length);
  /** Clamped so a drop that shortens the story never strands the index. */
  protected readonly currentIndex = computed(() =>
    Math.min(this.index(), Math.max(0, this.frameCount() - 1)),
  );
  protected readonly current = computed(() => this.frames()[this.currentIndex()] ?? null);
  /** The current frame plus its immediate neighbours, each with its absolute
   * index. Rendering these as layers keeps ≤3 photos decoded, so paging swaps an
   * already-decoded image and the photo flips in the same paint as the progress
   * bar — no lag, no bar/photo desync. */
  protected readonly frameWindow = computed(() => {
    const frames = this.frames();
    const i = this.currentIndex();
    const from = Math.max(0, i - 1);
    const to = Math.min(frames.length - 1, i + 1);
    const window: { index: number; frame: ViewFrame }[] = [];
    for (let j = from; j <= to; j++) window.push({ index: j, frame: frames[j] });
    return window;
  });
  /** The frame whose text is open in the editor, or null. */
  protected readonly editingFrame = computed(
    () => this.frames().find((f) => f.photoId === this.editing()) ?? null,
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
    this.swipeStartX = this.editing() || this.managing() ? null : event.clientX;
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
    this.editing.set(null);
    this.refining.set(false);
  }

  /** Open the editor on a frame's words; the first tap retires the coach mark. */
  protected editHeadline(photoId: string): void {
    this.story.markCoachSeen();
    this.editing.set(photoId);
  }

  protected closeEditor(): void {
    this.editing.set(null);
  }

  /** An edit writes straight through to the frame, which recomposes — so the
   * words on screen are the words the story holds (decision 7.25). */
  protected onHeadline(text: string): void {
    const photoId = this.editing();
    if (photoId) this.story.setHeadline(photoId, text);
  }

  protected async regenerateHeadline(): Promise<void> {
    const photoId = this.editing();
    if (!photoId || this.regenBusy()) return;
    this.regenBusy.set(true);
    try {
      await this.generation.regenerateHeadline(photoId);
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
   * adding a photo). A rebuild replaces every frame's words — it's a new story. */
  protected async regenerateStory(): Promise<void> {
    if (this.storyBusy()) return;
    this.storyBusy.set(true);
    try {
      await this.generation.generate();
    } finally {
      this.storyBusy.set(false);
    }
  }

  /** Refine: write words for the photo(s) just added in the filmstrip and append
   * them, keeping every existing frame — no full rebuild (2.5). */
  protected async appendPhotos(): Promise<void> {
    if (this.storyBusy()) return;
    this.storyBusy.set(true);
    try {
      await this.generation.captionNewPhotos();
    } finally {
      this.storyBusy.set(false);
    }
  }

  protected startOver(): void {
    this.story.reset();
  }

  /** Post to Instagram. With add-ons, reveal the hand-off card first (in place,
   * before we leave) so they're seen — its button does the actual hand-off. With
   * none, there's nothing to surface, so hand off directly (one tap). */
  protected async postToInstagram(): Promise<void> {
    if (this.exporting()) return;
    if (this.hasAddOns()) {
      this.handingOff.set(true);
      return;
    }
    await this.handOff();
  }

  /** The hand-off card's "Save & open Instagram" — actually render + hand off.
   * The card stays up so returning from Instagram lands back on the add-ons. */
  protected async confirmHandoff(): Promise<void> {
    await this.handOff();
  }

  /** Render the frames to images and hand them off (Web Share on mobile, else a
   * download). A cancelled share or failed render leaves the user in place. */
  private async handOff(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
      await this.exporter.post();
    } catch {
      // Nothing destructive happened; the user can tap again.
    } finally {
      this.exporting.set(false);
    }
  }

  /** Dismiss the hand-off card ("Not now") — reveals the action bar again. */
  protected closeTray(): void {
    this.handingOff.set(false);
  }
}
