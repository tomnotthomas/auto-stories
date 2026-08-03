import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { StoryService } from '../../story/story.service';
import { GenerationService } from '../../story/generation.service';
import { StoryExporter } from '../../story/story-exporter.service';
import { photoFilter } from '../../story/frame-renderer';
import { CaptionEditor } from '../refine/caption-editor/caption-editor';
import { RefineFilmstrip } from '../refine/filmstrip/filmstrip';
import { StorySparks } from './sparks/sparks';
import { HandoffCompanion } from './handoff-companion/handoff-companion';
import { LayoutView } from './layout-view/layout-view';
import type { Suggestion } from '@auto-stories/api-types';
import type { Composition } from '../../story/look';

/**
 * How much of the frame the on-screen chrome covers at the bottom. The exported
 * PNG has no chrome, so a Look's bottom offset is measured from the bottom of
 * the *usable* frame and only the preview allows for this.
 *
 * The three actions where they can appear: 3 × 40px buttons, 2 × 8px gaps, the
 * 24px `bottom-6` inset under them and a 16px gap above. This is a **constant**.
 * The actions are an overlay that can be swiped away, and the frame must not
 * recompose because chrome came and went — so the composition clears the strip
 * the actions *can* occupy, whether they are on screen or not.
 */
const ACTIONS_PX = 24 + 136 + 16;
/** The refine sheet, which the dismiss gesture does not touch — refine has its
 * own bar and its own reservation. */
const REFINE_BAR_PX = 160;
/** How far a pointer must travel before it is a swipe and not a tap — one
 * threshold for paging left/right and for dismissing the actions. */
const SWIPE_PX = 48;

/** What the pointer went down on, which is what gives a vertical swipe its
 * meaning: down on the actions dismisses them, up from the bottom edge (where
 * they left from) brings them back. */
type SwipeOrigin = 'actions' | 'edge';

/** A frame resolved for display: the picked photo plus what the device composed
 * for it. One text, one renderer (decision 7.25) — the composition is the whole
 * of what is drawn on the photo, in view and in refine alike. */
interface ViewFrame {
  readonly photoId: string;
  readonly previewUrl: string | null;
  /** CSS `filter` for the photo: the exposure match that pulls the story
   * together, plus the Look's own treatment (a warm wash, sepia). */
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
  host: {
    // The gesture listens on the whole screen: a swipe is judged by where it
    // started (an inner handler marks that) and where it was released, which
    // can be anywhere by the time the finger lifts.
    '(pointerdown)': 'onSwipeStart($event)',
    '(pointerup)': 'onSwipeEnd($event)',
    '(pointercancel)': 'onSwipeCancel()',
    '(click)': 'onClickSettled()',
  },
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
  /** Where the current gesture began, and how far it has to go to count. */
  private swipeStartX: number | null = null;
  private swipeStartY = 0;
  private swipeOrigin: SwipeOrigin | null = null;
  /** The gesture just ended travelled far enough to be a swipe. A drag still
   * ends in a `click` on whatever it started on, so every handler a pointer can
   * reach checks this first and swallows that one click. */
  private swiped = false;
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

  /**
   * The three story actions are on screen. Swiping them down hands the whole
   * frame back to the photo, at no cost in permanent chrome; a swipe up from
   * the bottom edge — the place they left from — brings them back.
   */
  protected readonly actionsShown = signal(true);
  /** The return gesture is the one thing a user cannot find by accident, so it
   * is shown once, on the first dismissal, then retired (like the nav hint). */
  protected readonly restoreHintSeen = signal(false);

  /** What the composition keeps clear of the chrome at the bottom of the
   * preview. Constant in view mode: dismissing the actions changes whether the
   * overlay is drawn and nothing else, so the frame never recomposes. */
  protected readonly safeBottomPx = computed(() => (this.refining() ? REFINE_BAR_PX : ACTIONS_PX));

  /** Frames in narrative order, each resolved to its picked photo. */
  protected readonly frames = computed<ViewFrame[]>(() => {
    const photos = this.story.photos();
    return this.story.frames().map((frame) => ({
      photoId: frame.photoId,
      previewUrl: photos.find((p) => p.id === frame.photoId)?.previewUrl ?? null,
      imageFilter: photoFilter(frame),
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

  /** The tap zones. A swipe that ends over one of them is still followed by a
   * click, and that click is not a tap — it has already been acted on. */
  protected next(): void {
    if (this.swallowedSwipeClick()) return;
    this.advance(1);
  }

  protected prev(): void {
    if (this.swallowedSwipeClick()) return;
    this.advance(-1);
  }

  private advance(step: number): void {
    this.navHintSeen.set(true);
    const last = this.frameCount() - 1;
    this.index.set(Math.min(Math.max(this.currentIndex() + step, 0), last));
  }

  /**
   * A gesture starts. The screen records where from; an inner handler may
   * already have recorded what it started on (pointerdown reaches the target
   * before it reaches us), so that is left alone here.
   * Paging is off while a caption editor or the manage screen is open.
   */
  protected onSwipeStart(event: PointerEvent): void {
    this.swiped = false;
    if (this.editing() || this.managing()) {
      this.swipeStartX = null;
      return;
    }
    this.swipeStartX = event.clientX;
    this.swipeStartY = event.clientY;
  }

  /** The gesture began on the action cluster, so a downward swipe dismisses it. */
  protected onActionsSwipeStart(event: PointerEvent): void {
    this.onSwipeStart(event);
    this.swipeOrigin = 'actions';
  }

  /** The gesture began on the bottom edge, so an upward swipe restores. */
  protected onEdgeSwipeStart(event: PointerEvent): void {
    this.onSwipeStart(event);
    this.swipeOrigin = 'edge';
  }

  /**
   * The gesture ends. The axis it travelled furthest on decides what it was:
   * sideways pages the story (Stories are consumed with a swipe on the web),
   * up/down dismisses or restores the actions — and only from the right place,
   * so a swipe down over the photo does nothing.
   */
  protected onSwipeEnd(event: PointerEvent): void {
    const startX = this.swipeStartX;
    const origin = this.swipeOrigin;
    this.swipeStartX = null;
    this.swipeOrigin = null;
    if (startX === null) return;

    const dx = event.clientX - startX;
    const dy = event.clientY - this.swipeStartY;
    if (Math.abs(dx) < SWIPE_PX && Math.abs(dy) < SWIPE_PX) return; // a tap
    this.swiped = true;

    if (Math.abs(dy) > Math.abs(dx)) {
      if (dy > 0 && origin === 'actions') this.actionsShown.set(false);
      if (dy < 0 && origin === 'edge') this.showActions();
      return;
    }
    this.advance(dx < 0 ? 1 : -1);
  }

  /** The pointer was taken away (a scroll took over, the window lost it), so
   * there is no gesture to finish. */
  protected onSwipeCancel(): void {
    this.swipeStartX = null;
    this.swipeOrigin = null;
  }

  /** Every click ends here, after the handler it was meant for. Whatever the
   * gesture left behind is spent by now, so nothing can swallow a later tap. */
  protected onClickSettled(): void {
    this.swiped = false;
  }

  /** True when this click is only the tail of a swipe. Spent on reading, so the
   * next click — a real one — gets through. */
  private swallowedSwipeClick(): boolean {
    if (!this.swiped) return false;
    this.swiped = false;
    return true;
  }

  /** Bring the actions back, and retire the hint that said how. */
  private showActions(): void {
    this.actionsShown.set(true);
    this.restoreHintSeen.set(true);
  }

  /** The keyboard and screen-reader equivalent of the swipe: one labelled
   * control, off screen until it is focused, that says which way it goes. */
  protected toggleActions(): void {
    if (this.actionsShown()) this.actionsShown.set(false);
    else this.showActions();
  }

  protected dismissBanner(): void {
    this.bannerDismissed.set(true);
  }

  protected enterRefine(): void {
    if (this.swallowedSwipeClick()) return;
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

  /** Destroys the story, so it is the one click a stray gesture must never
   * produce: a drag that began on this button is not a press of it. */
  protected startOver(): void {
    if (this.swallowedSwipeClick()) return;
    this.story.reset();
  }

  /** Post to Instagram. With add-ons, reveal the hand-off card first (in place,
   * before we leave) so they're seen — its button does the actual hand-off. With
   * none, there's nothing to surface, so hand off directly (one tap). */
  protected async postToInstagram(): Promise<void> {
    if (this.swallowedSwipeClick()) return;
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
