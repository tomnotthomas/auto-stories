import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { SuggestionTypeEnum } from '@auto-stories/api-types';

import { StoryService, sparkKey } from '../../../story/story.service';
import { SUGGESTION_META } from '../../../story/suggestion-meta';

/** One add-on the AI suggested, resolved for the card: what it is and the exact
 * term to search for in Instagram. */
interface TrayItem {
  /** Stable key (frame + suggestion index) — drives the copy-confirm state. */
  readonly key: string;
  readonly type: SuggestionTypeEnum;
  readonly icon: string;
  readonly label: string;
  readonly query: string;
}

/**
 * The hand-off card — shown the moment the user posts, *before* the frames are
 * handed off to Instagram, so the add-ons are seen while still on our screen (the
 * export is clean — nothing is baked in, 7.10 — so this is how they survive the
 * switch). It grows in place where the action button was, leads with a single
 * hero add-on (the place, usually) big and copyable, lists any others below, and
 * its own "Save & open Instagram" button is what actually renders + hands off.
 * A suggestion, not a checklist: no counter; copy what you want, ignore the rest.
 */
@Component({
  selector: 'app-handoff-companion',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './handoff-companion.html',
})
export class HandoffCompanion {
  private readonly story = inject(StoryService);
  private readonly clipboard = inject(Clipboard);

  /** True while the frames are rendering + handing off (drives the button label). */
  readonly busy = input(false);
  /** The user confirmed — render the frames and hand off to Instagram. */
  readonly save = output<void>();
  /** The user dismissed the card without handing off ("Not now"). */
  readonly done = output<void>();

  /** The key of the item whose term was just copied, so its card can confirm. */
  protected readonly copiedKey = signal<string | null>(null);

  /** Every kept add-on across the story, in frame order. */
  protected readonly items = computed<TrayItem[]>(() => {
    const states = this.story.sparks();
    const out: TrayItem[] = [];
    this.story.frames().forEach((frame) => {
      (frame.suggestions ?? []).forEach((suggestion, index) => {
        if (states.get(sparkKey(frame.photoId, index))?.dismissed) return;
        const meta = SUGGESTION_META[suggestion.type];
        out.push({
          key: sparkKey(frame.photoId, index),
          type: suggestion.type,
          icon: meta.icon,
          label: meta.label,
          query: suggestion.query,
        });
      });
    });
    return out;
  });

  /** The one add-on to lead with — the place if there is one (highest value and
   * the one the user can't re-derive), else the first. */
  protected readonly hero = computed<TrayItem | null>(() => {
    const items = this.items();
    return items.find((i) => i.type === 'location') ?? items[0] ?? null;
  });

  /** The remaining add-ons, shown as compact rows below the hero. */
  protected readonly rest = computed<TrayItem[]>(() => {
    const hero = this.hero();
    return this.items().filter((i) => i !== hero);
  });

  /** Copy an add-on's exact term for Instagram's sticker search. */
  protected copy(item: TrayItem): void {
    this.clipboard.copy(item.query);
    this.copiedKey.set(item.key);
  }

  /** Confirm — render the frames and hand off to Instagram. */
  protected saveAndOpen(): void {
    this.save.emit();
  }

  /** Dismiss the card without handing off ("Not now"). */
  protected close(): void {
    this.done.emit();
  }
}
