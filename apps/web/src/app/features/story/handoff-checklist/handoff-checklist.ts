import { Component, computed, inject, signal } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { StoryService, sparkKey } from '../../../story/story.service';
import { SUGGESTION_META } from '../../../story/suggestion-meta';

/** One add-on to place during the Instagram hand-off. */
interface ChecklistItem {
  /** Stable key (frame + suggestion index) for copy-confirm + done state. */
  readonly key: string;
  readonly photoId: string;
  readonly index: number;
  /** 1-based frame number, so the user knows which photo it belongs to. */
  readonly frameNo: number;
  readonly icon: string;
  readonly label: string;
  readonly query: string;
  readonly done: boolean;
}

/**
 * The guided hand-off checklist, shown after "Post to Instagram" (approach 7.17 /
 * spec §14). The export is clean — suggestions are never baked in (decision 7.10) —
 * so this is how the AI's add-ons survive the switch to Instagram: every suggestion
 * the user kept is listed with a one-tap Copy for Instagram's own sticker search and
 * a check to tick off as they add each one. Reads the same per-frame suggestions and
 * per-spark state as the in-story overlay, so dismissed ones stay gone and a
 * suggestion checked off here shows checked there too.
 */
@Component({
  selector: 'app-handoff-checklist',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './handoff-checklist.html',
})
export class HandoffChecklist {
  private readonly story = inject(StoryService);
  private readonly clipboard = inject(Clipboard);

  /** The key of the item whose term was just copied, so its row can confirm. */
  protected readonly copiedKey = signal<string | null>(null);

  /** Every kept suggestion across the story, in frame order, flattened to a list. */
  protected readonly items = computed<ChecklistItem[]>(() => {
    const states = this.story.sparks();
    const out: ChecklistItem[] = [];
    this.story.frames().forEach((frame, frameIndex) => {
      (frame.suggestions ?? []).forEach((suggestion, index) => {
        const state = states.get(sparkKey(frame.photoId, index));
        if (state?.dismissed) return;
        const meta = SUGGESTION_META[suggestion.type];
        out.push({
          key: sparkKey(frame.photoId, index),
          photoId: frame.photoId,
          index,
          frameNo: frameIndex + 1,
          icon: meta.icon,
          label: meta.label,
          query: suggestion.query,
          done: state?.done ?? false,
        });
      });
    });
    return out;
  });

  /** Total add-ons to place, and how many are checked off. */
  protected readonly total = computed(() => this.items().length);
  protected readonly doneCount = computed(() => this.items().filter((i) => i.done).length);

  /** Copy an add-on's exact term for Instagram's search. */
  protected copy(item: ChecklistItem): void {
    this.clipboard.copy(item.query);
    this.copiedKey.set(item.key);
  }

  /** Tick an add-on off (or back on) as it's added in Instagram. */
  protected toggleDone(item: ChecklistItem): void {
    this.story.toggleSparkDone(item.photoId, item.index);
  }
}
