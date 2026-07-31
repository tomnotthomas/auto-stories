import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { StoryService, FramePlacement } from '../../story/story.service';
import { GenerationService } from '../../story/generation.service';
import { StoryExporter } from '../../story/story-exporter.service';
import { DEFAULT_STYLE } from '../../story/caption-style';
import {
  fontFamily,
  fontWeightCss,
  sizeScale,
  textAlignCss,
  textTransformCss,
} from '../../story/caption-render';
import { CaptionEditor } from '../refine/caption-editor/caption-editor';
import { RefineFilmstrip } from '../refine/filmstrip/filmstrip';

/** A frame resolved for display: the picked photo plus its editable state. */
interface ViewFrame {
  readonly photoId: string;
  readonly previewUrl: string | null;
  readonly caption: string;
  readonly placement: FramePlacement;
  readonly legibility: boolean;
  /** The AI style resolved to CSS + the device-computed caption colour. */
  readonly fontFamily: string;
  readonly fontWeight: number;
  readonly textAlign: 'left' | 'center' | 'right';
  readonly textTransform: 'none' | 'uppercase';
  readonly sizeMult: number;
  readonly color: string;
  /** Tailwind scrim class (dark on light text, light on dark text), or ''. */
  readonly scrimClass: string;
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
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    CaptionEditor,
    RefineFilmstrip,
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
  /** True while a whole-story rebuild (Regenerate story) or an add-photo append
   * is in flight. */
  protected readonly storyBusy = signal(false);
  /** True while rendering + handing off the frames. */
  protected readonly exporting = signal(false);
  /** True once the frames have been shared/downloaded (shows the next-step copy). */
  protected readonly posted = signal(false);

  /** Frames in narrative order, each resolved to its picked photo. */
  protected readonly frames = computed<ViewFrame[]>(() => {
    const photos = this.story.photos();
    return this.story.frames().map((frame) => {
      const style = frame.style ?? DEFAULT_STYLE;
      return {
        photoId: frame.photoId,
        previewUrl: photos.find((p) => p.id === frame.photoId)?.previewUrl ?? null,
        caption: frame.caption,
        placement: frame.placement,
        legibility: frame.legibility,
        fontFamily: fontFamily(style.font),
        fontWeight: fontWeightCss(style.weight),
        textAlign: textAlignCss(style.align),
        textTransform: textTransformCss(style.case),
        sizeMult: sizeScale(style.size),
        color: frame.light ? '#ffffff' : '#141414',
        scrimClass: frame.legibility ? (frame.light ? 'bg-black/40' : 'bg-white/60') : '',
      };
    });
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

  /** Refine: caption the photo(s) just added in the filmstrip and append them,
   * keeping the existing frames and their placements — no full rebuild (2.5). */
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

  /** Render the frames to images and hand them off (Web Share on mobile, else a
   * download), then show the "open Instagram → Select Multiple" next step. */
  protected async postToInstagram(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
      await this.exporter.post();
      this.posted.set(true);
    } catch {
      // A cancelled share or a failed render leaves the user on the payoff; they
      // can tap again. Nothing destructive happened.
    } finally {
      this.exporting.set(false);
    }
  }
}
