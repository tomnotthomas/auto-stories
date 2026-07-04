import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule, MatChipListboxChange } from '@angular/material/chips';
import { TextFieldModule } from '@angular/cdk/text-field';
import type { Tone } from '@auto-stories/api-types';

import { MAX_PHOTOS, MAX_STORY_LENGTH, StoryService } from '../../story/story.service';

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
  protected readonly maxPhotos = MAX_PHOTOS;
  protected readonly maxStoryLength = MAX_STORY_LENGTH;

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
