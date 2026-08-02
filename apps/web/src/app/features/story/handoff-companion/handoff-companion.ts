import { Component, computed, inject, output, signal } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { SuggestionTypeEnum } from '@auto-stories/api-types';

import { StoryService, sparkKey } from '../../../story/story.service';
import { DEFAULT_STYLE, zoneToPlacement } from '../../../story/caption-style';
import { SUGGESTION_META } from '../../../story/suggestion-meta';

/** One add-on the AI suggested, resolved for the tray: what it is, the exact
 * term, which frame's photo it sits on, and where on that photo it goes. */
interface TrayItem {
  /** Stable key (frame + suggestion index) — drives copy-confirm + done state. */
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
  /** Positioned types (everything but music) show a pin on the photo thumb. */
  readonly positioned: boolean;
  readonly xPct: number;
  readonly yPct: number;
}

/**
 * The hand-off tray — the post-share screen. The export is clean (nothing baked
 * in, 7.10), so this is how the AI's add-ons survive the switch to Instagram: the
 * moment the story is posted, the tray rises presenting every kept add-on as a
 * self-explanatory card (a photo thumb with the pin on its spot, what it is, the
 * exact term, and one-tap Copy). It's a suggestion, not a checklist — no counter;
 * copy what you want, tick or dismiss the rest, "All set" collapses it. Because
 * it's the post-share screen (not a button), the user leaves knowing it's here,
 * and it persists so returning from Instagram is instantly legible.
 */
@Component({
  selector: 'app-handoff-companion',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './handoff-companion.html',
})
export class HandoffCompanion {
  private readonly story = inject(StoryService);
  private readonly clipboard = inject(Clipboard);

  /** How many frames the user saved — shown in the Select-Multiple line. */
  readonly frameCount = this.story.frames;
  /** Emitted when the user collapses the tray ("All set"). */
  readonly done = output<void>();

  /** The key of the item whose term was just copied, so its card can confirm. */
  protected readonly copiedKey = signal<string | null>(null);

  /** Every kept add-on across the story, in frame order, as tray cards. */
  protected readonly items = computed<TrayItem[]>(() => {
    const states = this.story.sparks();
    const previews = new Map(this.story.photos().map((p) => [p.id, p.previewUrl]));
    const out: TrayItem[] = [];
    this.story.frames().forEach((frame, frameIndex) => {
      (frame.suggestions ?? []).forEach((suggestion, index) => {
        const state = states.get(sparkKey(frame.photoId, index));
        if (state?.dismissed) return;
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

  /** Copy an add-on's exact term for Instagram's sticker search. */
  protected copy(item: TrayItem): void {
    this.clipboard.copy(item.query);
    this.copiedKey.set(item.key);
  }

  /** Remove an add-on from the tray (won't return this story). */
  protected dismiss(item: TrayItem): void {
    this.story.dismissSpark(item.photoId, item.index);
  }

  /** Collapse the tray ("All set"). */
  protected close(): void {
    this.done.emit();
  }
}
