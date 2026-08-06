import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { StoryService } from '../../story/story.service';
import { canRetryAt, copyFor, retryTimeLabel } from './error-copy';

/** How often the screen re-checks whether a timed refusal has lifted. */
const TICK_MS = 1000;

/**
 * A specific failure, explained (4.3, 5.7) — and since decision 7.36, explained
 * with its *cause*. The two fair-use limits and the free tier's timeouts all
 * used to read as "the app is broken"; each now says which it is, why it
 * happened, and when it lifts. Photos and the story line are kept, so Try again
 * just re-runs.
 */
@Component({
  selector: 'app-error',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './error-screen.html',
})
export class ErrorScreen implements OnDestroy {
  private readonly story = inject(StoryService);

  /** The specific failure to explain. */
  protected readonly error = this.story.error;
  protected readonly copy = computed(() => copyFor(this.error()?.code ?? 'upstream_error'));

  /** Ticks while a timed refusal is in force, so the button re-enables itself
   * the moment it can actually work. */
  private readonly now = signal(Date.now());
  private readonly timer = setInterval(() => this.now.set(Date.now()), TICK_MS);

  /** The local time the refusal lifts, or null when there is none to state. */
  protected readonly retryLabel = computed(() => retryTimeLabel(this.error()?.retryAt));
  /** False while a timed refusal is still in force — a retry then is a button
   * guaranteed to fail, which is worse than no button. */
  protected readonly canRetry = computed(() => canRetryAt(this.error()?.retryAt, this.now()));
  /** Whether to offer a retry at all: not for a failure the same input repeats. */
  protected readonly offersRetry = computed(() => this.copy().next !== 'change-photos');

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  protected tryAgain(): void {
    if (!this.canRetry()) return;
    this.story.startGenerating();
  }

  protected startOver(): void {
    this.story.reset();
  }

  /** Back to the picker with the photos intact, for the failures the same set
   * cannot pass. Start over throws the work away; this keeps it. */
  protected changePhotos(): void {
    this.story.startCreating();
  }
}
