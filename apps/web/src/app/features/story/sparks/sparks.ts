import { Component, computed, inject, input, signal } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { Suggestion } from '@auto-stories/api-types';

import { DEFAULT_STYLE, zoneToPlacement } from '../../../story/caption-style';
import { StoryService } from '../../../story/story.service';
import { swipeDismissed } from '../../../story/gesture';
import { SUGGESTION_META } from '../../../story/suggestion-meta';

/** Below this many px of travel a pointer gesture is a tap, not a drag. */
const TAP_SLOP = 6;

/** A suggestion resolved for the overlay: its icon/verb, where the dot sits, and
 * the user's edits (done). Dismissed ones are filtered out upstream. */
interface SparkView {
  /** Index within the frame's `suggestions` array — the stable state key. */
  readonly index: number;
  readonly icon: string;
  readonly label: string;
  readonly query: string;
  readonly xPct: number;
  readonly yPct: number;
  readonly done: boolean;
}

/** A story-level music suggestion — no anchor, shown as a docked chip. */
interface MusicView {
  readonly index: number;
  readonly query: string;
}

/**
 * The in-app "sparks" layer over the current story frame (approach 7.17 re-expanded):
 * for each add-on the AI suggested, a small dot sits at the spot it proposes. Tapping
 * a dot blooms it into a ghost of the element — its icon, what it is, and the exact
 * term — with a one-tap Copy so the user can paste it into Instagram's own sticker
 * search during the hand-off, plus Done (check it off as you add it) and Dismiss.
 * A quick horizontal flick on a dot also dismisses it. Nothing is dragged into the
 * exported image (decision 7.10); music is story-level and gets a docked pill, not a
 * dot. Spark edits live in {@link StoryService} so a regenerate resets them.
 *
 * The layer itself is click-through (`pointer-events-none`); only the dots and the
 * bloom capture taps, so paging the story underneath still works between them.
 */
@Component({
  selector: 'app-story-sparks',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './sparks.html',
})
export class StorySparks {
  private readonly clipboard = inject(Clipboard);
  private readonly story = inject(StoryService);

  /** The frame these sparks belong to — keys their per-spark state. */
  readonly photoId = input('');
  /** The current frame's suggestions (0–2), straight off the contract. */
  readonly suggestions = input<readonly Suggestion[]>([]);

  /** Which dot is bloomed open, or null. One at a time keeps the frame calm. */
  protected readonly openIndex = signal<number | null>(null);
  /** The dot whose term was just copied, so its button can read "Copied". */
  protected readonly copiedIndex = signal<number | null>(null);
  /** The live flick in progress: which dot and how far it's been dragged (px). */
  protected readonly flick = signal<{ index: number; dx: number } | null>(null);

  // Pointer bookkeeping for the tap-vs-flick gesture on a dot.
  private pointerId: number | null = null;
  private startX = 0;
  private startT = 0;
  private moved = false;
  /** Set when a gesture ends as a drag, so the trailing click doesn't also toggle. */
  private suppressClick = false;

  /** The positioned suggestions (music excluded, dismissed hidden) resolved to
   * dot placements, each carrying its original index so its state stays keyed. */
  protected readonly sparks = computed<SparkView[]>(() => {
    const states = this.story.sparks();
    const id = this.photoId();
    const out: SparkView[] = [];
    this.suggestions().forEach((suggestion, index) => {
      if (suggestion.type === 'music') return; // story-level; docked pill, not a dot
      const state = states.get(`${id}#${index}`);
      if (state?.dismissed) return;
      const meta = SUGGESTION_META[suggestion.type];
      const base = zoneToPlacement(suggestion.position ?? DEFAULT_STYLE.position);
      out.push({
        index,
        icon: meta.icon,
        label: meta.label,
        query: suggestion.query,
        xPct: state?.xPct ?? base.xPct,
        yPct: state?.yPct ?? base.yPct,
        done: state?.done ?? false,
      });
    });
    return out;
  });

  /** Story-level music suggestions (no anchor) for the docked chip. */
  protected readonly music = computed<MusicView[]>(() => {
    const states = this.story.sparks();
    const id = this.photoId();
    const out: MusicView[] = [];
    this.suggestions().forEach((suggestion, index) => {
      if (suggestion.type !== 'music') return;
      if (states.get(`${id}#${index}`)?.dismissed) return;
      out.push({ index, query: suggestion.query });
    });
    return out;
  });

  /** Horizontal offset (px) to render on the dot currently being flicked. */
  protected flickDx(index: number): number {
    const flick = this.flick();
    return flick?.index === index ? flick.dx : 0;
  }

  /** A finger lands on a dot: start tracking for a tap-vs-flick decision. */
  protected onPointerDown(event: PointerEvent, spark: SparkView): void {
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    this.pointerId = event.pointerId;
    this.startX = event.clientX;
    this.startT = event.timeStamp;
    this.moved = false;
    this.suppressClick = false;
    this.flick.set({ index: spark.index, dx: 0 });
  }

  /** Track the flick so the dot follows the finger horizontally. */
  protected onPointerMove(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) return;
    const dx = event.clientX - this.startX;
    if (Math.abs(dx) > TAP_SLOP) this.moved = true;
    this.flick.update((flick) => (flick ? { ...flick, dx } : flick));
  }

  /** Release: a quick/long horizontal flick dismisses; a still finger is a tap
   * (handled by the click); a small drag that didn't qualify snaps back. */
  protected onPointerUp(event: PointerEvent, spark: SparkView): void {
    if (this.pointerId !== event.pointerId) return;
    const dx = event.clientX - this.startX;
    const dt = event.timeStamp - this.startT;
    this.pointerId = null;
    this.flick.set(null);
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    if (this.moved) {
      this.suppressClick = true; // a drag, not a tap — don't let the click toggle
      if (swipeDismissed(dx, dt)) this.dismiss(spark);
    }
  }

  /** Pointer/gesture cancelled (e.g. a second finger): abandon the flick. */
  protected onPointerCancel(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) return;
    this.pointerId = null;
    this.flick.set(null);
  }

  /** Tap the dot: open its bloom, or close it if already open (suppressed right
   * after a drag so a flick/reposition doesn't also toggle). */
  protected onTap(index: number): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    const wasOpen = this.openIndex() === index;
    this.openIndex.set(wasOpen ? null : index);
    if (wasOpen) this.copiedIndex.set(null);
  }

  /** Copy the term to the clipboard so it survives the switch to Instagram. */
  protected copy(item: { readonly index: number; readonly query: string }): void {
    this.clipboard.copy(item.query);
    this.copiedIndex.set(item.index);
  }

  /** Check a suggestion off (or un-check it) after adding it in Instagram. */
  protected toggleDone(spark: SparkView): void {
    this.story.toggleSparkDone(this.photoId(), spark.index);
  }

  /** Remove a suggestion from the overlay (its dot/chip won't return this story). */
  protected dismiss(item: { readonly index: number }): void {
    if (this.openIndex() === item.index) this.openIndex.set(null);
    this.story.dismissSpark(this.photoId(), item.index);
  }
}
