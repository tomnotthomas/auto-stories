import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { StoryService, DEFAULT_PLACEMENT, FramePlacement } from '../../story/story.service';
import { CaptionEditor } from '../refine/caption-editor/caption-editor';

/**
 * First-open interactive example — the wow (approach 2.3, 5.5). Shows a finished
 * example Story frame with an editable caption + coach mark; tapping it opens the
 * same caption editor the real flow uses (demo mode: no Regenerate), so the first
 * open teaches the refine interaction (5.9). One CTA drops the user into creating.
 */
@Component({
  selector: 'app-example',
  imports: [MatButtonModule, MatIconModule, CaptionEditor],
  templateUrl: './example.html',
})
export class Example {
  private readonly story = inject(StoryService);

  /** The canned example frame — editable locally, never persisted. */
  protected readonly caption = signal(
    'One candle, ten sets of hands ready to help her blow it out.',
  );
  protected readonly placement = signal<FramePlacement>(DEFAULT_PLACEMENT);
  protected readonly legibility = signal(true);

  /** Whether the editor overlay is open, and whether the coach mark still shows. */
  protected readonly editing = signal(false);
  protected readonly coachSeen = signal(false);
  protected readonly fontSize = computed(() => this.placement().scale * 24);

  /** Open the editor; the first tap retires the coach mark. */
  protected editCaption(): void {
    this.coachSeen.set(true);
    this.editing.set(true);
  }

  protected closeEditor(): void {
    this.editing.set(false);
  }

  protected onCaption(caption: string): void {
    this.caption.set(caption);
  }

  protected onPlacement(placement: Partial<FramePlacement>): void {
    this.placement.update((current) => ({ ...current, ...placement }));
  }

  protected onLegibility(): void {
    this.legibility.update((on) => !on);
  }

  /** Leave the example and start creating a real story. */
  protected tryIt(): void {
    this.story.startCreating();
  }
}
