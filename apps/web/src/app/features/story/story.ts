import { DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
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
/** Below this much travel a pointer gesture is a tap and moved nothing. */
const TAP_SLOP = 6;
/**
 * Distance **or** velocity ends the gesture: 48px of travel, or a flick fast
 * enough to count while staying short. 0.11 px/ms is the threshold the spark
 * flick used (decision 7.23) — slower than a deliberate throw-away, faster than
 * a hand coming to rest, so the app keeps one idea of "a flick".
 */
const FLICK_VELOCITY = 0.11;
/** How far past the end of its travel the panel can be pulled before it stops
 * moving — the rubber band's asymptote, in px. */
const RUBBER_LIMIT = 96;
/** The panel rests 24px off the bottom (`bottom-6`), so it clears the screen at
 * its own height plus that inset. */
const PANEL_INSET_PX = 24;
/** How long the panel takes to settle once the finger is off. The dismissal is
 * committed when it lands, so the panel is never cut off mid-flight. */
export const SETTLE_MS = 260;
/** The settle is a **transition**, not a keyframe: a drag that reverses (or a
 * second gesture) retargets it from wherever the panel is, instead of restarting
 * from zero. Written inline on the panel alone, so it beats both the enter class
 * and the `none` the drag itself sets. */
const SETTLE_TRANSITION = `transform ${SETTLE_MS}ms var(--ease-drawer)`;

/** What the pointer went down on, which is what gives a vertical swipe its
 * meaning: down on the actions dismisses them, up from the bottom edge (where
 * they left from) brings them back. */
type SwipeOrigin = 'actions' | 'edge';

/** A point in the gesture: where the finger was and when. Two of these — the
 * last two moves — are what the release reads its speed from. */
interface Sample {
  readonly y: number;
  readonly t: number;
}

/**
 * Resistance past the end of the panel's travel: the further it is pulled, the
 * less it moves, tending to `limit` px however hard it is dragged. Keeps a pull
 * in the wrong direction alive under the finger instead of hitting a wall.
 */
function rubberBand(overshoot: number, limit: number): number {
  return (overshoot * limit) / (limit + Math.abs(overshoot));
}

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
    '(pointermove)': 'onSwipeMove($event)',
    '(pointerup)': 'onSwipeEnd($event)',
    '(pointercancel)': 'onSwipeCancel()',
    '(click)': 'onClickSettled()',
  },
})
export class Story {
  private readonly story = inject(StoryService);
  private readonly generation = inject(GenerationService);
  private readonly exporter = inject(StoryExporter);
  private readonly injector = inject(Injector);
  private readonly view = inject(DOCUMENT).defaultView;
  private readonly index = signal(0);
  /** The action panel itself — the one element the drag transforms. */
  private readonly panel = viewChild<ElementRef<HTMLElement>>('actionsPanel');

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
  /** The last two points of the gesture. The release reads its speed from the
   * segment between them — the *final* one — so a drag that turned around is
   * judged on where it was going when it ended, not on the whole trip. */
  private prevSample: Sample = { y: 0, t: 0 };
  private lastSample: Sample = { y: 0, t: 0 };
  /** This gesture moved the panel: it followed the finger, so whatever it ends
   * on has already been acted on. */
  private dragged = false;
  /** This gesture animates. False under `prefers-reduced-motion`, where the
   * panel does not follow the finger and the swap is instant. */
  private tracking = false;
  /** The pending end of a settle — the moment the state is committed. */
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
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
  /** The panel is on screen for a passing reason rather than a settled one: it
   * is still animating out after a dismissal, or a restore drag has pulled it
   * back into the DOM so it can follow the finger up. */
  private readonly panelTransient = signal(false);
  /** Whether the panel is in the DOM at all — its state, plus the in-between. */
  protected readonly actionsMounted = computed(() => this.actionsShown() || this.panelTransient());
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

  constructor() {
    // A settle that is still pending when the story goes away has nothing left
    // to commit to.
    inject(DestroyRef).onDestroy(() => this.clearSettle());
  }

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
    this.dragged = false;
    this.tracking = !this.reducedMotion();
    // A gesture takes the panel back from whatever it was doing: an interrupted
    // settle is retargeted from where the finger now is, never finished behind it.
    this.clearSettle();
    if (this.editing() || this.managing()) {
      this.swipeStartX = null;
      return;
    }
    this.swipeStartX = event.clientX;
    this.swipeStartY = event.clientY;
    this.prevSample = { y: event.clientY, t: this.now() };
    this.lastSample = this.prevSample;
  }

  /** The gesture began on the action cluster, so a downward swipe dismisses it. */
  protected onActionsSwipeStart(event: PointerEvent): void {
    this.onSwipeStart(event);
    this.swipeOrigin = 'actions';
  }

  /**
   * The gesture began on the bottom edge, so an upward swipe restores. The panel
   * is not in the DOM at that point, so it is mounted now — parked off screen
   * before the frame is painted — and the drag pulls it up from there.
   */
  protected onEdgeSwipeStart(event: PointerEvent): void {
    this.onSwipeStart(event);
    this.swipeOrigin = 'edge';
    if (!this.tracking) return;
    this.panelTransient.set(true);
    afterNextRender(
      () => {
        if (this.swipeOrigin === 'edge') this.applyOffset(this.exitOffsetPx(), false);
      },
      { injector: this.injector },
    );
  }

  /**
   * The finger moves. While a gesture that began on the panel is running, the
   * panel goes with it: down as it is pushed away, up as it is pulled back, and
   * with rising resistance past either end of its travel.
   */
  protected onSwipeMove(event: PointerEvent): void {
    const origin = this.swipeOrigin;
    if (this.swipeStartX === null || origin === null) return;
    this.prevSample = this.lastSample;
    this.lastSample = { y: event.clientY, t: this.now() };
    const dy = event.clientY - this.swipeStartY;
    if (Math.abs(dy) >= TAP_SLOP) this.dragged = true;
    if (this.tracking) this.applyOffset(this.boundedOffset(origin, dy), false);
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
    const dragged = this.dragged;
    this.swipeStartX = null;
    this.swipeOrigin = null;
    this.dragged = false;
    if (startX === null) {
      if (origin) this.revertPanel(origin, dragged);
      return;
    }

    const dx = event.clientX - startX;
    const dy = event.clientY - this.swipeStartY;
    const travel = Math.max(Math.abs(dx), Math.abs(dy));
    // A drag that moved the panel is spent on the panel: the click the browser
    // fires next is the tail of that drag, never a press of the button under it.
    this.swiped = travel >= SWIPE_PX || (origin !== null && dragged);

    const vertical = Math.abs(dy) > Math.abs(dx);
    if (origin !== null) {
      if (vertical && this.gestureCompletes(origin, dy)) this.commitPanel(origin);
      else this.revertPanel(origin, dragged);
    }
    if (!vertical && travel >= SWIPE_PX) this.advance(dx < 0 ? 1 : -1);
  }

  /** The pointer was taken away (a scroll took over, the window lost it), so
   * there is no gesture to finish — the panel goes back where it came from. */
  protected onSwipeCancel(): void {
    const origin = this.swipeOrigin;
    const dragged = this.dragged;
    this.swipeStartX = null;
    this.swipeOrigin = null;
    this.dragged = false;
    if (origin) this.revertPanel(origin, dragged);
  }

  /**
   * Whether the gesture goes through. Either it travelled far enough, or it was
   * still moving fast enough the moment it ended — so a short flick counts,
   * measured on the last segment of the drag, which is what makes a gesture that
   * turned around stay where the finger left it.
   */
  private gestureCompletes(origin: SwipeOrigin, dy: number): boolean {
    // Positive is the way this gesture goes: down for the actions leaving, up
    // for bringing them back.
    const direction = origin === 'actions' ? 1 : -1;
    if (dy * direction >= SWIPE_PX) return true;
    const recent = (this.lastSample.y - this.prevSample.y) * direction;
    const elapsed = this.lastSample.t - this.prevSample.t;
    if (recent <= 0 || elapsed <= 0) return false; // still, or turned around
    return recent / elapsed > FLICK_VELOCITY;
  }

  /** The gesture won: finish the move it was making and commit the state when
   * the panel lands. */
  private commitPanel(origin: SwipeOrigin): void {
    if (origin === 'actions') {
      // Reduced motion: the instant swap, with nothing to watch leave.
      if (this.tracking) this.settleTo(this.exitOffsetPx(), () => this.finishDismiss());
      else this.finishDismiss();
      return;
    }
    // Restoring is committed at once — the panel is on screen and staying.
    this.showActions();
    this.panelTransient.set(false);
    if (this.tracking) this.settleTo(0, () => this.clearPanelStyles());
    else this.clearPanelStyles();
  }

  /** The gesture fell short: put the panel back where it started. */
  private revertPanel(origin: SwipeOrigin, dragged: boolean): void {
    if (origin === 'actions') {
      if (dragged && this.tracking) this.settleTo(0, () => this.clearPanelStyles());
      return;
    }
    if (!dragged || !this.tracking) {
      this.panelTransient.set(false);
      return;
    }
    this.settleTo(this.exitOffsetPx(), () => this.panelTransient.set(false));
  }

  private finishDismiss(): void {
    this.actionsShown.set(false);
    this.panelTransient.set(false);
  }

  /** Move the panel to `px` and commit when it gets there. */
  private settleTo(px: number, done: () => void): void {
    this.applyOffset(px, true);
    this.clearSettle();
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      done();
    }, SETTLE_MS);
  }

  private clearSettle(): void {
    if (this.settleTimer === null) return;
    clearTimeout(this.settleTimer);
    this.settleTimer = null;
  }

  /**
   * Put the panel where the gesture says it is. Transform only — the panel is a
   * pure overlay, so nothing it does can move the composition — and written
   * straight to the one element rather than through a variable on a parent,
   * which would recalculate every child on every frame of the drag.
   */
  private applyOffset(px: number, animate: boolean): void {
    const el = this.panel()?.nativeElement;
    if (!el) return;
    el.style.transition = animate ? SETTLE_TRANSITION : 'none';
    el.style.transform = `translate3d(0, ${px}px, 0)`;
  }

  /** Hand the panel back to its classes, once nothing is animating it. */
  private clearPanelStyles(): void {
    const el = this.panel()?.nativeElement;
    if (!el) return;
    el.style.transition = '';
    el.style.transform = '';
  }

  /** Where the drag has put the panel: free in the direction it is going, and
   * rubber-banded past either end of the travel it has. */
  private boundedOffset(origin: SwipeOrigin, dy: number): number {
    const exit = this.exitOffsetPx();
    // A restore drag starts from off screen; a dismiss drag from the resting place.
    const raw = (origin === 'edge' ? exit : 0) + dy;
    // Down is unbounded while the actions are leaving — that is the way out.
    const max = origin === 'edge' ? exit : Number.POSITIVE_INFINITY;
    if (raw < 0) return rubberBand(raw, RUBBER_LIMIT);
    if (raw > max) return max + rubberBand(raw - max, RUBBER_LIMIT);
    return raw;
  }

  /** How far the panel travels to clear the screen: its own height plus the
   * inset it rests on. */
  private exitOffsetPx(): number {
    return (this.panel()?.nativeElement.offsetHeight ?? 0) + PANEL_INSET_PX;
  }

  /** The clock the samples are taken on. Sub-millisecond, unlike a pointer
   * event's own `timeStamp`, which is whole milliseconds — two moves inside one
   * millisecond would read as infinitely fast, or as no time at all. */
  private now(): number {
    return this.view?.performance.now() ?? 0;
  }

  /** The OS asked for less movement, so the panel does not follow the finger and
   * the swap is instant — read per gesture, so changing the setting takes hold
   * without a reload. */
  private reducedMotion(): boolean {
    return this.view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
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
    this.tracking = !this.reducedMotion();
    this.clearSettle();
    // The same two moves the gesture makes, so the panel leaves the same way
    // whether it was pushed or asked to go.
    if (this.actionsShown()) this.commitPanel('actions');
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
