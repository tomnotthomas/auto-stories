import { Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { Suggestion, SuggestionTypeEnum } from '@auto-stories/api-types';

import { StoryService, sparkKey } from '../../../story/story.service';
import type { Composition } from '../../../story/look';
import { bestCell, cellBox, claim, emptySpace } from '../../../story/quiet-zone';

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
 * Placement comes from the composition, not from the model and not from a table
 * (7.25 slice 2). The Look claims the box its design occupies and hands on what
 * is left; each sticker takes the calmest cell still free, most confident first,
 * and claims it so the next one cannot land on it. A sticker with no free cell
 * is **dropped** — nothing is better than a collision. A location the design
 * already drew itself (Magazine's byline, Scrapbook's taped tag) is dropped too,
 * so the place name never appears twice.
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
  /**
   * The frame's composition — the stage before this one. It carries both things
   * placement needs (`free`, `consumedLocation`), so one binding is enough and
   * the two can never be passed out of step with each other. Optional: until the
   * binding exists the layer falls back to an empty map, which places stickers as
   * if the photo were flat and no design had claimed anything.
   */
  readonly composition = input<Composition | null>(null);

  /** The placed suggestions (music excluded, dismissed hidden, anything with no
   * room dropped), each keeping its original index so its state stays keyed. */
  protected readonly sparks = computed<SparkView[]>(() => {
    const states = this.story.sparks();
    const id = this.photoId();
    const composition = this.composition();
    const consumedLocation = composition?.consumedLocation ?? false;

    const candidates = this.suggestions()
      .map((suggestion, index) => ({ suggestion, index }))
      .filter(({ suggestion, index }) => {
        if (suggestion.type === 'music') return false; // story-level; docked chip
        if (states.get(sparkKey(id, index))?.dismissed) return false;
        // The design drew the place name itself — don't draw it a second time.
        return !(consumedLocation && suggestion.type === 'location');
      });

    let space = composition?.free ?? emptySpace();
    const placed = new Map<number, SparkView>();

    // A spot the user dragged to is fixed: used unchanged, and subtracted from
    // the map first so nothing is auto-placed on top of it.
    for (const { suggestion, index } of candidates) {
      const state = states.get(sparkKey(id, index));
      const xPct = state?.xPct;
      const yPct = state?.yPct;
      if (xPct === undefined || yPct === undefined) continue;
      placed.set(index, { index, type: suggestion.type, query: suggestion.query, xPct, yPct });
      space = claim(space, cellBox(space, { xPct, yPct, busy: 0 }));
    }

    // The rest take the calmest free cell, most confident first, each claiming
    // what it took. One with nowhere honest to go is dropped (7.25).
    const automatic = candidates
      .filter(({ index }) => !placed.has(index))
      .sort((a, b) => b.suggestion.confidence - a.suggestion.confidence);
    for (const { suggestion, index } of automatic) {
      const cell = bestCell(space);
      if (!cell) continue;
      space = claim(space, cellBox(space, cell));
      placed.set(index, {
        index,
        type: suggestion.type,
        query: suggestion.query,
        xPct: cell.xPct,
        yPct: cell.yPct,
      });
    }

    // Draw in suggestion order — placement follows confidence, but the DOM order
    // stays the frame's own so markers don't re-shuffle between renders.
    return candidates
      .map(({ index }) => placed.get(index))
      .filter((view): view is SparkView => view !== undefined);
  });

  /** Story-level music suggestions (no anchor) for the docked chip. */
  protected readonly music = computed<MusicView[]>(() => {
    const states = this.story.sparks();
    const id = this.photoId();
    const out: MusicView[] = [];
    this.suggestions().forEach((suggestion, index) => {
      if (suggestion.type !== 'music') return;
      if (states.get(sparkKey(id, index))?.dismissed) return;
      out.push({ index, query: suggestion.query });
    });
    return out;
  });
}
