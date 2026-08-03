import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { StoryService, FramePlacement } from '../../story/story.service';
import { GenerationService } from '../../story/generation.service';
import { StoryExporter } from '../../story/story-exporter.service';
import { DEFAULT_STYLE } from '../../story/caption-style';
import { paletteFor } from '../../story/caption-palette';
import {
  fitMultiplier,
  fontFamily,
  fontWeightCss,
  sizeScale,
  textAlignCss,
  textTransformCss,
} from '../../story/caption-render';
import { CaptionEditor } from '../refine/caption-editor/caption-editor';
import { RefineFilmstrip } from '../refine/filmstrip/filmstrip';
import { StorySparks } from './sparks/sparks';
import { HandoffCompanion } from './handoff-companion/handoff-companion';
import { LayoutView } from './layout-view/layout-view';
import type { Suggestion } from '@auto-stories/api-types';
import type { Composition } from '../../story/look';

/** A frame resolved for display: the picked photo plus its editable state. */
interface ViewFrame {
  readonly photoId: string;
  readonly previewUrl: string | null;
  /** CSS `filter` that matches this photo's exposure to the story (cohesion). */
  readonly imageFilter: string;
  readonly caption: string;
  readonly placement: FramePlacement;
  readonly legibility: boolean;
  /** The AI style resolved to CSS + the device-computed caption colour. */
  readonly fontFamily: string;
  readonly fontWeight: number;
  readonly textAlign: 'left' | 'center' | 'right';
  readonly textTransform: 'none' | 'uppercase';
  readonly sizeMult: number;
  /** Length-based fit: short caption → bigger, long → smaller. */
  readonly fitMult: number;
  readonly color: string;
  /** Tailwind scrim class (dark on light text, light on dark text), or ''. */
  readonly scrimClass: string;
  /** Optional Instagram add-ons the AI suggested for this frame (in-app sparks). */
  readonly suggestions: readonly Suggestion[];
  /** Extra placed text blocks the AI added besides the caption (read-only). */
  readonly extraTexts: readonly ViewTextBlock[];
  /** This frame composed under the story's Look — supersedes the
   * caption/style/texts for rendering in view mode (decision 7.24). */
  readonly composition: Composition | undefined;
  /** Frame-level computed light (white vs dark text), from the pixels (7.10). */
  readonly light: boolean;
  /** The accent colour, sampled from the photo (7.23). */
  readonly accent: string | undefined;
}

/** One extra placed text block, resolved to CSS + its editable state. */
interface ViewTextBlock {
  /** Index within the frame's extra blocks — the editor targets it. */
  readonly index: number;
  readonly text: string;
  readonly placement: FramePlacement;
  readonly legibility: boolean;
  readonly fontFamily: string;
  readonly fontWeight: number;
  readonly textAlign: 'left' | 'center' | 'right';
  readonly textTransform: 'none' | 'uppercase';
  readonly sizeMult: number;
  readonly fitMult: number;
  readonly color: string;
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
  /** The text open in the editor: a frame's caption (index −1) or one of its
   * extra text blocks (index ≥ 0), or null when the editor is closed. */
  protected readonly editing = signal<{ photoId: string; index: number } | null>(null);
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
    const palette = paletteFor();
    return this.story.frames().map((frame) => {
      const style = frame.style ?? DEFAULT_STYLE;
      return {
        photoId: frame.photoId,
        previewUrl: photos.find((p) => p.id === frame.photoId)?.previewUrl ?? null,
        imageFilter: frame.imageFilter,
        caption: frame.caption,
        placement: frame.placement,
        legibility: frame.legibility,
        fontFamily: fontFamily(style.font),
        fontWeight: fontWeightCss(style.weight),
        textAlign: textAlignCss(style.align),
        textTransform: textTransformCss(style.case),
        sizeMult: sizeScale(style.size),
        fitMult: fitMultiplier(frame.caption),
        color: frame.light ? palette.textLight : palette.textDark,
        scrimClass: frame.legibility ? (frame.light ? 'bg-black/40' : 'bg-white/60') : '',
        suggestions: frame.suggestions ?? [],
        composition: frame.composition,
        light: frame.light,
        accent: frame.accent,
        extraTexts: frame.extraTexts.map((b, i) => ({
          index: i,
          text: b.text,
          placement: b.placement,
          legibility: b.legibility,
          fontFamily: fontFamily(b.font),
          fontWeight: fontWeightCss(b.weight),
          textAlign: textAlignCss(b.align),
          textTransform: textTransformCss(b.case),
          sizeMult: sizeScale(b.size),
          fitMult: fitMultiplier(b.text),
          color: b.light ? palette.textLight : palette.textDark,
          scrimClass: b.legibility ? (b.light ? 'bg-black/40' : 'bg-white/60') : '',
        })),
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
  /** The frame whose text is open in the editor, or null. */
  protected readonly editingFrame = computed(
    () => this.frames().find((f) => f.photoId === this.editing()?.photoId) ?? null,
  );
  /** True when the editor is on the caption (vs an extra block) — extras don't
   * regenerate, and get a Remove action instead. */
  protected readonly editingIsCaption = computed(() => (this.editing()?.index ?? -1) < 0);
  /** The specific text (caption or extra block) the editor is bound to, or null. */
  protected readonly editingBlock = computed(() => {
    const target = this.editing();
    const frame = this.editingFrame();
    if (!target || !frame) return null;
    if (target.index < 0) {
      return { text: frame.caption, placement: frame.placement, legibility: frame.legibility };
    }
    const block = frame.extraTexts[target.index];
    return block
      ? { text: block.text, placement: block.placement, legibility: block.legibility }
      : null;
  });

  /** More than one frame, so paging is meaningful. */
  protected readonly multiFrame = computed(() => this.frameCount() > 1);
  /** Room for another extra text block on the current frame (capped at 2). */
  protected readonly canAddText = computed(() => (this.current()?.extraTexts.length ?? 0) < 2);

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

  /** Open the editor on a frame's caption; the first tap retires the coach mark. */
  protected editCaption(photoId: string): void {
    this.story.markCoachSeen();
    this.editing.set({ photoId, index: -1 });
  }

  /** Open the editor on one of a frame's extra text blocks. */
  protected editExtra(photoId: string, index: number): void {
    this.story.markCoachSeen();
    this.editing.set({ photoId, index });
  }

  protected closeEditor(): void {
    const target = this.editing();
    // An extra block left empty was never really added — drop it on close.
    if (target && target.index >= 0) {
      const block = this.editingFrame()?.extraTexts[target.index];
      if (block && block.text.trim() === '') {
        this.story.removeExtraText(target.photoId, target.index);
      }
    }
    this.editing.set(null);
  }

  protected onCaption(text: string): void {
    const t = this.editing();
    if (!t) return;
    if (t.index < 0) this.story.setCaption(t.photoId, text);
    else this.story.setExtraText(t.photoId, t.index, text);
  }

  protected onPlacement(placement: Partial<FramePlacement>): void {
    const t = this.editing();
    if (!t) return;
    if (t.index < 0) this.story.setPlacement(t.photoId, placement);
    else this.story.setExtraPlacement(t.photoId, t.index, placement);
  }

  protected onLegibility(): void {
    const t = this.editing();
    if (!t) return;
    if (t.index < 0) this.story.toggleLegibility(t.photoId);
    else this.story.toggleExtraLegibility(t.photoId, t.index);
  }

  protected async regenerateCaption(): Promise<void> {
    const t = this.editing();
    if (!t || t.index >= 0 || this.regenBusy()) return;
    this.regenBusy.set(true);
    try {
      await this.generation.regenerateCaption(t.photoId);
    } finally {
      this.regenBusy.set(false);
    }
  }

  /** Refine: add a new extra text block to the current frame and open its editor. */
  protected addText(): void {
    const photoId = this.current()?.photoId;
    if (!photoId) return;
    const index = this.story.addExtraText(photoId);
    if (index >= 0) this.editExtra(photoId, index);
  }

  /** Refine: delete the extra text block currently open in the editor. */
  protected removeCurrentText(): void {
    const t = this.editing();
    if (!t || t.index < 0) return;
    this.story.removeExtraText(t.photoId, t.index);
    this.editing.set(null);
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
