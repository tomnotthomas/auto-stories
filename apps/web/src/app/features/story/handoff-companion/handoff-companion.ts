import { Component, computed, inject, output, signal } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { SuggestionTypeEnum } from '@auto-stories/api-types';

import { StoryService, sparkKey } from '../../../story/story.service';
import { DEFAULT_STYLE, zoneToPlacement } from '../../../story/caption-style';
import { SUGGESTION_META } from '../../../story/suggestion-meta';

/** One add-on the AI suggested, resolved for the companion: what it is, the exact
 * term, which frame's photo it sits on, and where on that photo it goes. */
interface CompanionItem {
  /** Stable key (frame + suggestion index) — also drives copy-confirm. */
  readonly key: string;
  readonly photoId: string;
  readonly index: number;
  /** 1-based frame number, so the user knows which photo it's for. */
  readonly frameNo: number;
  readonly type: SuggestionTypeEnum;
  readonly icon: string;
  readonly label: string;
  readonly query: string;
  readonly previewUrl: string | null;
  /** Positioned types (everything but music) show a pin on the photo. */
  readonly positioned: boolean;
  readonly xPct: number;
  readonly yPct: number;
}

/**
 * The guided hand-off companion, opened after "Post to Instagram". The export is
 * clean (nothing baked in, 7.10), so this is how the AI's add-ons survive the
 * switch: it walks — one card at a time — only the frames that carry a
 * suggestion, and for each it *offers an idea and shows where it goes* (the pin
 * sits on the photo, on the spot) with a one-tap Copy of the exact term. It reads
 * as a suggestion, not a task list: no completion counter, and Done closes it
 * anytime. Dismissing an idea drops it (shared with the in-story overlay).
 */
@Component({
  selector: 'app-handoff-companion',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './handoff-companion.html',
})
export class HandoffCompanion {
  private readonly story = inject(StoryService);
  private readonly clipboard = inject(Clipboard);

  /** Emitted when the companion is closed (Done, or the last idea handled). */
  readonly done = output<void>();

  /** Which card is showing. */
  protected readonly step = signal(0);
  /** The key of the item whose term was just copied, so its button can confirm. */
  protected readonly copiedKey = signal<string | null>(null);

  /** Every kept suggestion across the story, in frame order, as walkable cards. */
  protected readonly items = computed<CompanionItem[]>(() => {
    const states = this.story.sparks();
    const previews = new Map(this.story.photos().map((p) => [p.id, p.previewUrl]));
    const out: CompanionItem[] = [];
    this.story.frames().forEach((frame, frameIndex) => {
      (frame.suggestions ?? []).forEach((suggestion, index) => {
        if (states.get(sparkKey(frame.photoId, index))?.dismissed) return;
        const meta = SUGGESTION_META[suggestion.type];
        const positioned = suggestion.type !== 'music';
        const place = zoneToPlacement(suggestion.position ?? DEFAULT_STYLE.position);
        out.push({
          key: sparkKey(frame.photoId, index),
          photoId: frame.photoId,
          index,
          frameNo: frameIndex + 1,
          type: suggestion.type,
          icon: meta.icon,
          label: meta.label,
          query: suggestion.query,
          previewUrl: previews.get(frame.photoId) ?? null,
          positioned,
          xPct: place.xPct,
          yPct: place.yPct,
        });
      });
    });
    return out;
  });

  /** The card currently in view (clamped), or null once nothing is left. */
  protected readonly current = computed<CompanionItem | null>(() => {
    const items = this.items();
    if (items.length === 0) return null;
    return items[Math.min(this.step(), items.length - 1)] ?? null;
  });

  /** Copy an idea's exact term for Instagram's sticker search. */
  protected copy(item: CompanionItem): void {
    this.clipboard.copy(item.query);
    this.copiedKey.set(item.key);
  }

  /** Move to the next idea (or finish). Used by "Added it → next". */
  protected next(): void {
    if (this.step() < this.items().length - 1) this.step.update((s) => s + 1);
    else this.done.emit();
    this.copiedKey.set(null);
  }

  /** Drop this idea, then show whatever slid into its place (or finish). */
  protected notThisOne(item: CompanionItem): void {
    this.story.dismissSpark(item.photoId, item.index);
    this.copiedKey.set(null);
    // Removing the current item shifts the next one into this slot, so we stay
    // put unless we ran off the end.
    if (this.step() >= this.items().length) this.done.emit();
  }

  /** Close the companion (Done). */
  protected close(): void {
    this.done.emit();
  }
}
