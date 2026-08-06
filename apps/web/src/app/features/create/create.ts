import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule, MatChipListboxChange } from '@angular/material/chips';
import { TextFieldModule } from '@angular/cdk/text-field';
import type { Tone } from '@auto-stories/api-types';

import { MAX_PHOTOS, MAX_STORY_LENGTH, StoryService } from '../../story/story.service';
import { StoryGateway } from '../../story/story.gateway';

interface ToneChip {
  readonly value: Tone;
  readonly label: string;
  readonly emoji: string;
}

/**
 * Step 1 — pick photos, answer "What's the story?", pick an optional tone.
 * The StoryService is the form model: the picker and field read/write its
 * signals directly (approach 3.8), so there's no separate form to keep in sync.
 */
@Component({
  selector: 'app-create',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    TextFieldModule,
  ],
  templateUrl: './create.html',
})
export class Create {
  protected readonly story = inject(StoryService);
  private readonly gateway = inject(StoryGateway);
  protected readonly maxPhotos = MAX_PHOTOS;
  protected readonly maxStoryLength = MAX_STORY_LENGTH;
  /** The story field grows to give more room while it's focused (being typed in). */
  protected readonly storyFocused = signal(false);

  constructor() {
    // Read the fair-use allowance on arrival, so the picker can say what is
    // left *before* the user picks photos and writes their line rather than
    // refusing them after it (decision 7.36). A failure here says nothing.
    void this.gateway.limits().then((limits) => this.story.setLimits(limits));
  }

  /** "1 more story this hour" / "today's free stories are used up" — shown only
   * when it is close enough to matter. */
  protected readonly limitNote = computed(() => {
    if (!this.story.limitWorthSaying()) return null;
    const limits = this.story.limits();
    if (!limits) return null;
    if (limits.dayExhausted) return "Today's free stories are all used up — back tomorrow.";
    if (limits.remaining === 0) return 'No more stories this hour — the free tier is shared.';
    const plural = limits.remaining === 1 ? 'story' : 'stories';
    return `${limits.remaining} more ${plural} this hour — the free tier is shared.`;
  });

  /** Tone chips — the labels shown; the value is the contract Tone enum. */
  protected readonly tones: readonly ToneChip[] = [
    { value: 'funny', label: 'Funny', emoji: '😄' },
    { value: 'heartfelt', label: 'Heartfelt', emoji: '🫶' },
    { value: 'hype', label: 'Hype', emoji: '🔥' },
    { value: 'chill', label: 'Chill', emoji: '😌' },
  ];

  /** Show the character counter only as the soft limit approaches (5.6). */
  protected get showCounter(): boolean {
    return this.story.storyLine().length > this.maxStoryLength - 30;
  }

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) this.story.addPhotos(Array.from(input.files));
    input.value = ''; // let the same file be re-picked after removal
  }

  protected onToneChange(change: MatChipListboxChange): void {
    this.story.setTone((change.value as Tone) ?? null);
  }

  protected back(): void {
    this.story.reset();
  }

  protected create(): void {
    if (this.story.canGenerate()) this.story.startGenerating();
  }
}
