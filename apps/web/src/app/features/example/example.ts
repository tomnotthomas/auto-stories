import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { StoryService, DEFAULT_PLACEMENT, FramePlacement } from '../../story/story.service';
import { CaptionEditor } from '../refine/caption-editor/caption-editor';

/** A frame of the canned example story — editable locally, never persisted. */
interface ExampleFrame {
  readonly src: string;
  readonly caption: string;
  readonly placement: FramePlacement;
  readonly legibility: boolean;
}

/** The finished example story: a real, ordered, captioned arc the user can page
 * and edit, so the first open shows (not tells) what the app produces (2.3, 5.5). */
const SEED: readonly Omit<ExampleFrame, 'placement' | 'legibility'>[] = [
  { src: 'sample/example-1.jpg', caption: 'Everyone made it to the lake for Maya’s first birthday.' },
  { src: 'sample/example-2.jpg', caption: 'The cousins claimed the dock before the cake even arrived.' },
  { src: 'sample/example-3.jpg', caption: 'Ten cousins, one birthday girl, zero chill.' },
  { src: 'sample/example-4.jpg', caption: 'Then it was time — one cake, one candle.' },
  { src: 'sample/example-5.jpg', caption: 'One candle, ten sets of hands ready to help her blow it out.' },
];

/**
 * First-open interactive example — the wow (approach 2.3, 5.5). Shows a finished,
 * ordered, captioned Story the user can page through (tap/swipe) and edit in
 * place (tap a caption → the same editor the real flow uses, demo mode: no
 * Regenerate). One CTA drops the user into creating their own.
 */
@Component({
  selector: 'app-example',
  imports: [MatButtonModule, MatIconModule, CaptionEditor],
  templateUrl: './example.html',
})
export class Example {
  private readonly story = inject(StoryService);

  protected readonly frames = signal<ExampleFrame[]>(
    SEED.map((frame) => ({ ...frame, placement: DEFAULT_PLACEMENT, legibility: true })),
  );
  protected readonly index = signal(0);

  /** Whether the editor overlay is open, and whether the coach mark still shows. */
  protected readonly editing = signal(false);
  protected readonly coachSeen = signal(false);
  private swipeStartX: number | null = null;

  protected readonly current = computed(() => this.frames()[this.index()]);
  protected readonly frameCount = computed(() => this.frames().length);
  protected readonly fontSize = computed(() => this.current().placement.scale * 24);

  protected next(): void {
    this.index.set(Math.min(this.index() + 1, this.frameCount() - 1));
  }

  protected prev(): void {
    this.index.set(Math.max(this.index() - 1, 0));
  }

  /** Swipe left/right to page, like a real Story on the web. */
  protected onSwipeStart(event: PointerEvent): void {
    this.swipeStartX = this.editing() ? null : event.clientX;
  }

  protected onSwipeEnd(event: PointerEvent): void {
    if (this.swipeStartX === null) return;
    const dx = event.clientX - this.swipeStartX;
    this.swipeStartX = null;
    if (Math.abs(dx) < 48) return; // a tap, not a swipe — the tap zones handle it
    if (dx < 0) this.next();
    else this.prev();
  }

  /** Open the editor for the current frame; the first tap retires the coach mark. */
  protected editCaption(): void {
    this.coachSeen.set(true);
    this.editing.set(true);
  }

  protected closeEditor(): void {
    this.editing.set(false);
  }

  protected onCaption(caption: string): void {
    this.patchCurrent({ caption });
  }

  protected onPlacement(placement: Partial<FramePlacement>): void {
    this.patchCurrent({ placement: { ...this.current().placement, ...placement } });
  }

  protected onLegibility(): void {
    this.patchCurrent({ legibility: !this.current().legibility });
  }

  private patchCurrent(patch: Partial<ExampleFrame>): void {
    const i = this.index();
    this.frames.update((frames) => frames.map((frame, idx) => (idx === i ? { ...frame, ...patch } : frame)));
  }

  /** Leave the example and start creating a real story. */
  protected tryIt(): void {
    this.story.startCreating();
  }
}
