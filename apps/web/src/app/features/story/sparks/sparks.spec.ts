import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import type { Suggestion } from '@auto-stories/api-types';

import { StorySparks } from './sparks';
import { StorySparksHarness } from './sparks.harness';
import { StoryService } from '../../../story/story.service';
import type { Composition } from '../../../story/look';
import { claim, emptySpace, GRID_COLS, type Box, type FreeSpace } from '../../../story/quiet-zone';

function suggestion(partial: Partial<Suggestion>): Suggestion {
  return {
    type: 'location',
    query: 'Blue Bottle Coffee',
    confidence: 0.9,
    ...partial,
  };
}

/** A composition with no design drawn — the neutral map to place stickers into. */
function composition(partial: Partial<Composition> = {}): Composition {
  return {
    lookId: 'quiet-editorial',
    ink: 'auto',
    leftPct: 8,
    rightPct: 8,
    anchor: 'bottom',
    offsetHPct: 10,
    scrim: null,
    accent: '#ffffff',
    parts: [],
    claimed: [],
    free: emptySpace(),
    consumedLocation: false,
    ...partial,
  };
}

/** A composition whose design occupies `box`, with that box already subtracted
 * from the free map — exactly what `composeFrame` hands on. */
function designOccupying(box: Box): Composition {
  return composition({ claimed: [box], free: claim(emptySpace(), box) });
}

/** A free map where one cell is calm and every other is merely usable, so the
 * "calmest cell" is a single known spot. */
function calmestAt(row: number, col: number): FreeSpace {
  const base = emptySpace();
  const busy = base.busy.map((_, index) => (index === row * GRID_COLS + col ? 0.05 : 0.4));
  return { ...base, busy };
}

describe('StorySparks', () => {
  let fixture: ComponentFixture<StorySparks>;
  let story: StoryService;

  async function render(
    suggestions: Suggestion[],
    options: { photoId?: string; composition?: Composition } = {},
  ): Promise<StorySparksHarness> {
    await TestBed.configureTestingModule({ imports: [StorySparks] }).compileComponents();
    story = TestBed.inject(StoryService);
    fixture = TestBed.createComponent(StorySparks);
    fixture.componentRef.setInput('photoId', options.photoId ?? 'p1');
    fixture.componentRef.setInput('suggestions', suggestions);
    if (options.composition) fixture.componentRef.setInput('composition', options.composition);
    fixture.detectChanges();
    return TestbedHarnessEnvironment.harnessForFixture(fixture, StorySparksHarness);
  }

  afterEach(() => fixture?.destroy());

  it('draws a type-shaped marker per positioned suggestion, previewing the term', async () => {
    const harness = await render([
      suggestion({ type: 'location', query: 'Tartine' }),
      suggestion({ type: 'poll', query: 'Best pastry?' }),
    ]);

    expect(await harness.markerCount()).toBe(2);
    expect(await harness.queryTexts()).toEqual(['Tartine', 'Best pastry?']);
  });

  it('shapes each marker by its suggestion type', async () => {
    const harness = await render([
      suggestion({ type: 'location', query: 'Tartine' }),
      suggestion({ type: 'mention', query: 'maya.r' }),
      suggestion({ type: 'gif', query: 'confetti' }),
    ]);

    expect(await harness.markerTypes()).toEqual(['location', 'mention', 'gif']);
  });

  it('previews story-level music as a docked chip, not a marker', async () => {
    const harness = await render([
      suggestion({ type: 'location', query: 'Tartine' }),
      { type: 'music', query: 'indie folk', confidence: 0.6 },
    ]);

    expect(await harness.markerCount()).toBe(1);
    expect(await harness.musicCount()).toBe(1);
    expect(await harness.musicQuery()).toBe('indie folk');
  });

  it('renders nothing when there are no suggestions', async () => {
    const harness = await render([]);
    expect(await harness.markerCount()).toBe(0);
    expect(await harness.musicCount()).toBe(0);
  });

  it('hides a suggestion the user dismissed, keyed by its original index', async () => {
    // location@0, music@1, poll@2 — dismissing the poll must hide index 2.
    const harness = await render([
      suggestion({ type: 'location', query: 'Tartine' }),
      { type: 'music', query: 'lo-fi', confidence: 0.5 },
      suggestion({ type: 'poll', query: 'Best pastry?' }),
    ]);
    expect(await harness.markerCount()).toBe(2);

    story.dismissSpark('p1', 2);
    fixture.detectChanges();

    expect(await harness.queryTexts()).toEqual(['Tartine']);
    expect(await harness.musicCount()).toBe(1);
  });

  describe('placement', () => {
    it('keeps a sticker off the box the design claimed', async () => {
      // The design owns the whole bottom half of the frame.
      const harness = await render([suggestion({ type: 'location', query: 'Tartine' })], {
        composition: designOccupying({ xPct: 0, yPct: 50, wPct: 100, hPct: 50 }),
      });

      const [placement] = await harness.placements();
      expect(placement.yPct).toBeLessThan(50);
    });

    it('never places two stickers in the same cell', async () => {
      const harness = await render(
        [
          suggestion({ type: 'location', query: 'Tartine' }),
          suggestion({ type: 'mention', query: 'maya.r' }),
          suggestion({ type: 'poll', query: 'Best pastry?' }),
        ],
        { composition: composition() },
      );

      const spots = (await harness.placements()).map((p) => `${p.xPct},${p.yPct}`);
      expect(spots).toHaveLength(3);
      expect(new Set(spots).size).toBe(3);
    });

    it('gives the calmest free cell to the most confident suggestion', async () => {
      const harness = await render(
        [
          suggestion({ type: 'poll', query: 'Best pastry?', confidence: 0.3 }),
          suggestion({ type: 'mention', query: 'maya.r', confidence: 0.95 }),
        ],
        { composition: composition({ free: calmestAt(4, 2) }) },
      );

      const placements = await harness.placements();
      const mention = placements.find((p) => p.type === 'mention');
      // Row 4 of 8, column 2 of 4 → the centre of that cell.
      expect(mention).toEqual({ type: 'mention', xPct: 62.5, yPct: 56.25 });
    });

    it('drops a sticker that has no free cell rather than colliding', async () => {
      const harness = await render(
        [
          suggestion({ type: 'location', query: 'Tartine' }),
          { type: 'music', query: 'lo-fi', confidence: 0.5 },
        ],
        { composition: designOccupying({ xPct: 0, yPct: 0, wPct: 100, hPct: 100 }) },
      );

      expect(await harness.markerCount()).toBe(0);
      // Music has no anchor, so it is unaffected by the free map.
      expect(await harness.musicCount()).toBe(1);
    });

    it('drops the location sticker when the design already drew the place name', async () => {
      const harness = await render(
        [
          suggestion({ type: 'location', query: 'Tartine' }),
          suggestion({ type: 'mention', query: 'maya.r' }),
        ],
        { composition: composition({ consumedLocation: true }) },
      );

      expect(await harness.markerTypes()).toEqual(['mention']);
    });

    it('uses the spot the user dragged a spark to, unchanged', async () => {
      const harness = await render([suggestion({ type: 'location', query: 'Tartine' })], {
        composition: composition(),
      });

      story.moveSpark('p1', 0, 30, 70);
      fixture.detectChanges();

      expect(await harness.placements()).toEqual([{ type: 'location', xPct: 30, yPct: 70 }]);
    });

    it('does not auto-place another sticker onto a dragged one', async () => {
      const harness = await render(
        [
          suggestion({ type: 'location', query: 'Tartine' }),
          suggestion({ type: 'mention', query: 'maya.r' }),
        ],
        { composition: composition() },
      );

      // The centre of the first cell — where an automatic placement would land.
      story.moveSpark('p1', 0, 12.5, 6.25);
      fixture.detectChanges();

      const placements = await harness.placements();
      const mention = placements.find((p) => p.type === 'mention');
      expect(mention).toBeDefined();
      expect(`${mention?.xPct},${mention?.yPct}`).not.toBe('12.5,6.25');
    });

    it('still draws markers when no composition has been bound yet', async () => {
      const harness = await render([suggestion({ type: 'location', query: 'Tartine' })]);

      const placements = await harness.placements();
      expect(placements).toHaveLength(1);
      expect(Number.isFinite(placements[0].xPct)).toBe(true);
      expect(Number.isFinite(placements[0].yPct)).toBe(true);
    });

    it('survives a blank free map', async () => {
      const blank: FreeSpace = { cols: 0, rows: 0, busy: [], taken: [] };
      const harness = await render([suggestion({ type: 'location', query: 'Tartine' })], {
        composition: composition({ free: blank }),
      });

      // No cells means no honest room — the sticker is dropped, nothing throws.
      expect(await harness.markerCount()).toBe(0);
    });
  });

  describe('the app’s own chrome', () => {
    // Regression: ISSUE-001 — a gif sticker was placed in the top-left cell,
    // overlapping the story progress bar, so it read as a rendering fault.
    // Found by /qa on 2026-08-03 against a live `faded-album` story.
    // Report: .gstack/qa-reports/qa-report-localhost-2026-08-03.md
    it('never places a sticker on the progress row or the action overlay', async () => {
      const harness = await render([
        suggestion({ type: 'gif', query: 'sparkles', confidence: 0.9 }),
        suggestion({ type: 'poll', query: 'best costume?', confidence: 0.8 }),
        suggestion({ type: 'mention', query: 'Maya', confidence: 0.7 }),
      ]);

      for (const placed of await harness.placements()) {
        // The photo's own busyness cannot know about furniture drawn over it.
        expect(placed.yPct).toBeGreaterThan(12);
        expect(placed.yPct).toBeLessThan(78);
      }
    });
  });
});
