import { Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type {
  Suggestion,
  SuggestionPositionEnum,
  SuggestionTypeEnum,
} from '@auto-stories/api-types';

import { StoryService } from '../../../story/story.service';

/**
 * TODO(slice 2): sparks are still placed by a fixed zone table. Slice 2 of the
 * frame-harmony plan places every sticker from the free-space map the
 * composition hands on, and drops `position` from the contract — at which point
 * this table and `SPARK_FALLBACK_ZONE` go away. Until then the numbers below are
 * the ones `zoneToPlacement` used, moved here unchanged so behaviour is
 * identical after the caption layer that owned them was deleted (7.25 slice 1).
 */
const ZONE_TO_SPOT: Record<SuggestionPositionEnum, { xPct: number; yPct: number }> = {
  'top-left': { xPct: 42, yPct: 22 },
  'top-center': { xPct: 50, yPct: 22 },
  'top-right': { xPct: 58, yPct: 22 },
  'bottom-left': { xPct: 42, yPct: 56 },
  'bottom-center': { xPct: 50, yPct: 56 },
  'bottom-right': { xPct: 58, yPct: 56 },
};

/** Where a suggestion goes when the model named no zone. */
const SPARK_FALLBACK_ZONE: SuggestionPositionEnum = 'bottom-center';

/** A suggestion resolved for the overlay: which type-shaped marker to draw, the
 * exact term it previews, and where it sits. Dismissed ones are filtered out. */
interface SparkView {
  /** Index within the frame's `suggestions` array — the stable state key. */
  readonly index: number;
  readonly type: SuggestionTypeEnum;
  readonly query: string;
  readonly xPct: number;
  readonly yPct: number;
}

/** A story-level music suggestion — no anchor, previewed as a docked chip. */
interface MusicView {
  readonly index: number;
  readonly query: string;
}

/**
 * The in-app "sparks" layer over the current story frame. Each add-on the AI
 * suggested is a small, self-explanatory marker shaped like the Instagram
 * element it stands for — a pin for a location, an @-chip for a mention, a poll
 * or GIF badge — showing the exact term as a preview so a first-time viewer just
 * *sees* what it is (no mystery dot, no tutorial). Music is story-level and docks
 * as a chip, not a marker.
 *
 * The markers are **passive previews** — you can't drag or swipe them. The one
 * interaction model in the story is the caption's tap-to-edit; a spark gesture
 * that behaved differently (a sideways flick that dismissed) read as confusing,
 * so all of the acting on a suggestion — copy its term, drop it — happens after
 * export in the hand-off card, where every add-on is a tappable row. Here the
 * layer just shows what's coming. Nothing is baked into the export (7.10); spark
 * state lives in {@link StoryService} so a regenerate resets it.
 *
 * The whole layer is click-through (`pointer-events-none`), so paging the story
 * by tapping the photo works everywhere, markers included.
 */
@Component({
  selector: 'app-story-sparks',
  imports: [MatIconModule],
  templateUrl: './sparks.html',
})
export class StorySparks {
  private readonly story = inject(StoryService);

  /** The frame these sparks belong to — keys their per-spark state. */
  readonly photoId = input('');
  /** The current frame's suggestions (0–2), straight off the contract. */
  readonly suggestions = input<readonly Suggestion[]>([]);

  /** The positioned suggestions (music excluded, dismissed hidden), each keeping
   * its original index so its state stays keyed. */
  protected readonly sparks = computed<SparkView[]>(() => {
    const states = this.story.sparks();
    const id = this.photoId();
    const out: SparkView[] = [];
    this.suggestions().forEach((suggestion, index) => {
      if (suggestion.type === 'music') return; // story-level; docked chip, not a marker
      const state = states.get(`${id}#${index}`);
      if (state?.dismissed) return;
      const base = ZONE_TO_SPOT[suggestion.position ?? SPARK_FALLBACK_ZONE];
      out.push({
        index,
        type: suggestion.type,
        query: suggestion.query,
        xPct: state?.xPct ?? base.xPct,
        yPct: state?.yPct ?? base.yPct,
      });
    });
    return out;
  });

  /** Story-level music suggestions (no anchor) for the docked chip. */
  protected readonly music = computed<MusicView[]>(() => {
    const states = this.story.sparks();
    const id = this.photoId();
    const out: MusicView[] = [];
    this.suggestions().forEach((suggestion, index) => {
      if (suggestion.type !== 'music') return;
      if (states.get(`${id}#${index}`)?.dismissed) return;
      out.push({ index, query: suggestion.query });
    });
    return out;
  });
}
