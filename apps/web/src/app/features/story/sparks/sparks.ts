import { Component, computed, inject, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { Suggestion, SuggestionTypeEnum } from '@auto-stories/api-types';

import { DEFAULT_STYLE, zoneToPlacement } from '../../../story/caption-style';
import { StoryService } from '../../../story/story.service';
import { swipeDismissed } from '../../../story/gesture';

/** Below this many px of travel a pointer gesture is a tap, not a flick. */
const TAP_SLOP = 6;

/** A suggestion resolved for the overlay: which type-shaped marker to draw, the
 * exact term it previews, and where it sits. Dismissed ones are filtered out. */
interface SparkView {
  /** Index within the frame's `suggestions` array — the stable state key. */
  readonly index: number;
  readonly type: SuggestionTypeEnum;
  readonly query: string;
  readonly xPct: number;
  readonly yPct: number;
}

/** A story-level music suggestion — no anchor, previewed as a docked chip. */
interface MusicView {
  readonly index: number;
  readonly query: string;
}

/**
 * The in-app "sparks" layer over the current story frame. Each add-on the AI
 * suggested is a small, self-explanatory marker shaped like the Instagram
 * element it stands for — a pin for a location, an @-chip for a mention, a poll
 * or GIF badge — showing the exact term as a preview so a first-time viewer just
 * *sees* what it is (no mystery dot, no tutorial). It's a preview only: the
 * guided "copy it / add it in Instagram" step happens after export in the
 * hand-off companion, keeping the payoff photo calm. A quick horizontal flick
 * dismisses a marker you don't want. Music is story-level and docks as a chip,
 * not a marker. Nothing is baked into the export (decision 7.10); spark edits
 * live in {@link StoryService} so a regenerate resets them.
 *
 * The layer is click-through (`pointer-events-none`); only the markers capture
 * pointer events, so paging the story between them still works.
 */
@Component({
  selector: 'app-story-sparks',
  imports: [MatIconModule],
  templateUrl: './sparks.html',
})
export class StorySparks {
  private readonly story = inject(StoryService);

  /** The frame these sparks belong to — keys their per-spark state. */
  readonly photoId = input('');
  /** The current frame's suggestions (0–2), straight off the contract. */
  readonly suggestions = input<readonly Suggestion[]>([]);

  /** The live flick in progress: which marker and how far it's dragged (px). */
  protected readonly flick = signal<{ index: number; dx: number } | null>(null);

  // Pointer bookkeeping for the flick-to-dismiss gesture on a marker.
  private pointerId: number | null = null;
  private startX = 0;
  private startT = 0;

  /** The positioned suggestions (music excluded, dismissed hidden), each keeping
   * its original index so its state stays keyed. */
  protected readonly sparks = computed<SparkView[]>(() => {
    const states = this.story.sparks();
    const id = this.photoId();
    const out: SparkView[] = [];
    this.suggestions().forEach((suggestion, index) => {
      if (suggestion.type === 'music') return; // story-level; docked chip, not a marker
      const state = states.get(`${id}#${index}`);
      if (state?.dismissed) return;
      const base = zoneToPlacement(suggestion.position ?? DEFAULT_STYLE.position);
      out.push({
        index,
        type: suggestion.type,
        query: suggestion.query,
        xPct: state?.xPct ?? base.xPct,
        yPct: state?.yPct ?? base.yPct,
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

  /** Horizontal offset (px) to render on the marker currently being flicked. */
  protected flickDx(index: number): number {
    const flick = this.flick();
    return flick?.index === index ? flick.dx : 0;
  }

  /** A finger lands on a marker: start tracking for a flick-to-dismiss. */
  protected onPointerDown(event: PointerEvent, index: number): void {
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    this.pointerId = event.pointerId;
    this.startX = event.clientX;
    this.startT = event.timeStamp;
    this.flick.set({ index, dx: 0 });
  }

  /** Track the flick so the marker follows the finger horizontally. */
  protected onPointerMove(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) return;
    const dx = event.clientX - this.startX;
    this.flick.update((flick) => (flick ? { ...flick, dx } : flick));
  }

  /** Release: a quick/long horizontal flick dismisses the marker; anything
   * shorter snaps back (the marker is a preview, so a tap does nothing). */
  protected onPointerUp(event: PointerEvent, index: number): void {
    if (this.pointerId !== event.pointerId) return;
    const dx = event.clientX - this.startX;
    const dt = event.timeStamp - this.startT;
    this.pointerId = null;
    this.flick.set(null);
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    if (Math.abs(dx) > TAP_SLOP && swipeDismissed(dx, dt)) this.dismiss(index);
  }

  /** Pointer/gesture cancelled (e.g. a second finger): abandon the flick. */
  protected onPointerCancel(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) return;
    this.pointerId = null;
    this.flick.set(null);
  }

  /** Remove a suggestion from the overlay (its marker won't return this story). */
  protected dismiss(index: number): void {
    this.story.dismissSpark(this.photoId(), index);
  }
}
