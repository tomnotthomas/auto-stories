import { Component, computed, inject, input, signal } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { Suggestion, SuggestionTypeEnum } from '@auto-stories/api-types';

import { DEFAULT_STYLE, zoneToPlacement } from '../../../story/caption-style';

/** How each add-on type reads in the bloom: its Material icon and the human verb
 * ("Location", "Mention", …). The `query` is what the user copies into Instagram. */
const META: Record<SuggestionTypeEnum, { readonly icon: string; readonly label: string }> = {
  location: { icon: 'location_on', label: 'Location' },
  mention: { icon: 'alternate_email', label: 'Mention' },
  gif: { icon: 'gif_box', label: 'GIF' },
  poll: { icon: 'poll', label: 'Poll' },
  music: { icon: 'music_note', label: 'Music' },
};

/** A suggestion resolved for the overlay: its icon/verb and where the dot sits. */
interface SparkView {
  readonly index: number;
  readonly icon: string;
  readonly label: string;
  readonly query: string;
  readonly xPct: number;
  readonly yPct: number;
}

/**
 * The in-app "sparks" layer over the current story frame (approach 7.17 re-expanded):
 * for each add-on the AI suggested, a small dot sits at the spot it proposes. Tapping
 * a dot blooms it into a ghost of the element — its icon, what it is, and the exact
 * term — with a one-tap Copy so the user can paste it into Instagram's own sticker
 * search during the hand-off. Read-only in P1: nothing is dragged, dismissed, or baked
 * into the exported image (decision 7.10). Music is story-level (no anchor) and gets a
 * docked pill later, so it is not shown as a dot here.
 *
 * The layer itself is click-through (`pointer-events-none`); only the dots and the
 * bloom capture taps, so paging the story underneath still works between them.
 */
@Component({
  selector: 'app-story-sparks',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './sparks.html',
})
export class StorySparks {
  private readonly clipboard = inject(Clipboard);

  /** The current frame's suggestions (0–2), straight off the contract. */
  readonly suggestions = input<readonly Suggestion[]>([]);

  /** Which dot is bloomed open, or null. One at a time keeps the frame calm. */
  protected readonly openIndex = signal<number | null>(null);
  /** The dot whose term was just copied, so its button can read "Copied". */
  protected readonly copiedIndex = signal<number | null>(null);

  /** The positioned suggestions (music excluded) resolved to dot placements. */
  protected readonly sparks = computed<SparkView[]>(() => {
    const out: SparkView[] = [];
    for (const suggestion of this.suggestions()) {
      if (suggestion.type === 'music') continue; // story-level; docked pill, not a dot
      const meta = META[suggestion.type];
      const placement = zoneToPlacement(suggestion.position ?? DEFAULT_STYLE.position);
      out.push({
        index: out.length,
        icon: meta.icon,
        label: meta.label,
        query: suggestion.query,
        xPct: placement.xPct,
        yPct: placement.yPct,
      });
    }
    return out;
  });

  /** Open the tapped dot's bloom, or close it if it was already open. */
  protected toggle(index: number): void {
    const wasOpen = this.openIndex() === index;
    this.openIndex.set(wasOpen ? null : index);
    if (wasOpen) this.copiedIndex.set(null);
  }

  /** Copy the term to the clipboard so it survives the switch to Instagram. */
  protected copy(spark: SparkView): void {
    this.clipboard.copy(spark.query);
    this.copiedIndex.set(spark.index);
  }
}
