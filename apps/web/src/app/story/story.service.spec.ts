import { TestBed } from '@angular/core/testing';
import type { Style } from '@auto-stories/api-types';

import { MAX_PHOTOS, MAX_STORY_LENGTH, StoryService, sparkKey } from './story.service';
import { zoneToPlacement } from './caption-style';

function imageFile(name = 'photo.jpg'): File {
  return new File(['bytes'], name, { type: 'image/jpeg' });
}

/** A valid caption style for Frame fixtures (the model always returns one). */
const STYLE: Style = {
  font: 'inter',
  weight: 'regular',
  case: 'normal',
  align: 'center',
  size: 'm',
  position: 'bottom-center',
  letterbox: 'blur',
};

describe('StoryService', () => {
  let service: StoryService;

  beforeEach(() => {
    // jsdom has no object-URL support; stub it so photo state is testable.
    URL.createObjectURL = () => 'blob:mock';
    URL.revokeObjectURL = () => undefined;
    TestBed.configureTestingModule({});
    service = TestBed.inject(StoryService);
  });

  it('starts on the first-open example', () => {
    expect(service.phase()).toBe('example');
  });

  it('moves to the create step when the user starts', () => {
    service.startCreating();
    expect(service.phase()).toBe('create');
  });

  describe('startFromPath (landing deep-link)', () => {
    it('boots into the create/picker phase for /app/create', () => {
      service.startFromPath('/app/create');
      expect(service.phase()).toBe('create');
    });

    it('boots into create even with a trailing slash', () => {
      service.startFromPath('/app/create/');
      expect(service.phase()).toBe('create');
    });

    it('keeps the first-open example for /app/example', () => {
      service.startFromPath('/app/example');
      expect(service.phase()).toBe('example');
    });

    it('keeps the first-open example at the app root', () => {
      service.startFromPath('/app/');
      expect(service.phase()).toBe('example');
    });
  });

  it('adds picked image files as photos', () => {
    service.addPhotos([imageFile('a.jpg'), imageFile('b.jpg')]);
    expect(service.photoCount()).toBe(2);
    expect(service.photos()[0].id).not.toBe(service.photos()[1].id);
  });

  it('ignores non-image files', () => {
    service.addPhotos([imageFile(), new File(['x'], 'notes.txt', { type: 'text/plain' })]);
    expect(service.photoCount()).toBe(1);
  });

  it('caps the number of photos at the maximum', () => {
    service.addPhotos(Array.from({ length: MAX_PHOTOS + 3 }, (_, i) => imageFile(`p${i}.jpg`)));
    expect(service.photoCount()).toBe(MAX_PHOTOS);
    expect(service.isFull()).toBe(true);
  });

  it('removes a photo by id', () => {
    service.addPhotos([imageFile('a.jpg'), imageFile('b.jpg')]);
    const [first] = service.photos();
    service.removePhoto(first.id);
    expect(service.photoCount()).toBe(1);
    expect(service.photos().some((p) => p.id === first.id)).toBe(false);
  });

  it('trims the story line to the soft max length', () => {
    service.setStoryLine('x'.repeat(MAX_STORY_LENGTH + 50));
    expect(service.storyLine().length).toBe(MAX_STORY_LENGTH);
  });

  it('sets and clears the optional tone', () => {
    service.setTone('heartfelt');
    expect(service.tone()).toBe('heartfelt');
    service.setTone(null);
    expect(service.tone()).toBeNull();
  });

  it('only allows generating with enough photos and a story line', () => {
    expect(service.canGenerate()).toBe(false);

    service.addPhotos([imageFile('a.jpg'), imageFile('b.jpg'), imageFile('c.jpg')]);
    expect(service.canGenerate()).toBe(false); // still no story line

    service.setStoryLine('Maya turns one at the lake');
    expect(service.canGenerate()).toBe(true);
  });

  it('moves to the generating screen on submit', () => {
    service.startGenerating();
    expect(service.phase()).toBe('generating');
  });

  it('shows the payoff with the finished frames, ready to refine', () => {
    const frames = [{ photoId: 'p1', order: 1, caption: 'By the water', style: STYLE }];
    service.completeStory(frames, true);
    expect(service.phase()).toBe('story');
    expect(service.partial()).toBe(true);
    // Each frame gains editable placement + legibility state for refine.
    const [frame] = service.frames();
    expect(frame).toMatchObject({ photoId: 'p1', order: 1, caption: 'By the water', style: STYLE });
    expect(frame.placement).toEqual(zoneToPlacement(STYLE.position));
    expect(frame.legibility).toBe(true);
  });

  it('shows the error screen with a specific failure', () => {
    service.failStory({ code: 'rate_limited', message: 'Slow down' });
    expect(service.phase()).toBe('error');
    expect(service.error()).toEqual({ code: 'rate_limited', message: 'Slow down' });
  });

  it('clears photos, story, tone, and any result on reset', () => {
    service.addPhotos([imageFile('a.jpg')]);
    service.setStoryLine('something');
    service.setTone('funny');
    service.completeStory([{ photoId: 'photo-1', order: 1, caption: 'x', style: STYLE }], false);
    service.failStory({ code: 'timeout', message: 'took too long' });

    service.reset();

    expect(service.phase()).toBe('example');
    expect(service.photoCount()).toBe(0);
    expect(service.storyLine()).toBe('');
    expect(service.tone()).toBeNull();
    expect(service.frames()).toEqual([]);
    expect(service.error()).toBeNull();
  });

  describe('refine', () => {
    const seedFour = () =>
      service.completeStory(
        [
          { photoId: 'p1', order: 1, caption: 'first', style: STYLE },
          { photoId: 'p2', order: 2, caption: 'second', style: STYLE },
          { photoId: 'p3', order: 3, caption: 'third', style: STYLE },
          { photoId: 'p4', order: 4, caption: 'fourth', style: STYLE },
        ],
        false,
      );

    it('edits a caption by photo id', () => {
      seedFour();
      service.setCaption('p2', 'rewritten');
      expect(service.frames().find((f) => f.photoId === 'p2')?.caption).toBe('rewritten');
    });

    it('moves and resizes a caption, merging partial placement updates', () => {
      seedFour();
      service.setPlacement('p1', { xPct: 30, yPct: 40 });
      service.setPlacement('p1', { scale: 1.5 });
      expect(service.frames()[0].placement).toEqual({ xPct: 30, yPct: 40, scale: 1.5 });
    });

    it('toggles the legibility background of a frame', () => {
      seedFour();
      expect(service.frames()[0].legibility).toBe(true);
      service.toggleLegibility('p1');
      expect(service.frames()[0].legibility).toBe(false);
    });

    it('reorders frames and re-indexes the narrative order', () => {
      seedFour();
      service.reorderFrames(0, 2);
      expect(service.frames().map((f) => f.photoId)).toEqual(['p2', 'p3', 'p1', 'p4']);
      expect(service.frames().map((f) => f.order)).toEqual([1, 2, 3, 4]);
    });

    it('drops a photo from the story and the pool, re-indexing the rest', () => {
      service.addPhotos([imageFile('p2.jpg')]);
      const pooled = service.photos()[0].id;
      service.completeStory(
        [
          { photoId: 'p1', order: 1, caption: 'first', style: STYLE },
          { photoId: pooled, order: 2, caption: 'second', style: STYLE },
          { photoId: 'p3', order: 3, caption: 'third', style: STYLE },
          { photoId: 'p4', order: 4, caption: 'fourth', style: STYLE },
        ],
        false,
      );
      service.dropPhoto(pooled);
      expect(service.frames().map((f) => f.photoId)).toEqual(['p1', 'p3', 'p4']);
      expect(service.frames().map((f) => f.order)).toEqual([1, 2, 3]);
      // Gone from the pool too, so a rebuild won't resurrect it.
      expect(service.photos().some((p) => p.id === pooled)).toBe(false);
    });

    it('refuses to drop below the minimum photo count', () => {
      service.completeStory(
        [
          { photoId: 'p1', order: 1, caption: 'a', style: STYLE },
          { photoId: 'p2', order: 2, caption: 'b', style: STYLE },
          { photoId: 'p3', order: 3, caption: 'c', style: STYLE },
        ],
        false,
      );
      service.dropPhoto('p2');
      expect(service.frames().map((f) => f.photoId)).toEqual(['p1', 'p2', 'p3']);
    });

    it('appends a hand-added photo as a new frame, keeping the rest', () => {
      seedFour();
      service.setPlacement('p1', { xPct: 10, yPct: 10 });
      service.appendFrame({ photoId: 'p5', order: 99, caption: 'newcomer', style: STYLE });

      const frames = service.frames();
      expect(frames.map((f) => f.photoId)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
      expect(frames.map((f) => f.order)).toEqual([1, 2, 3, 4, 5]);
      const p5 = frames[4];
      expect(p5.caption).toBe('newcomer');
      expect(p5.placement).toEqual(zoneToPlacement(STYLE.position));
      expect(p5.legibility).toBe(true);
      // The existing frame keeps the placement the user set.
      expect(frames[0].placement).toEqual({ xPct: 10, yPct: 10, scale: 1 });
    });

    it('ignores appending a photo already in the story', () => {
      seedFour();
      service.appendFrame({ photoId: 'p2', order: 9, caption: 'dupe', style: STYLE });
      expect(service.frames()).toHaveLength(4);
    });

    it('records that the refine coach mark has been seen', () => {
      expect(service.coachSeen()).toBe(false);
      service.markCoachSeen();
      expect(service.coachSeen()).toBe(true);
    });
  });

  describe('sparks (per-suggestion user edits)', () => {
    const seed = () =>
      service.completeStory([{ photoId: 'p1', order: 1, caption: 'a', style: STYLE }], false);

    it('starts with no spark edits', () => {
      seed();
      expect(service.sparks().size).toBe(0);
    });

    it('records where a spark was dragged, keyed by frame + index', () => {
      seed();
      service.moveSpark('p1', 0, 30, 70);
      expect(service.sparks().get(sparkKey('p1', 0))).toMatchObject({ xPct: 30, yPct: 70 });
    });

    it('marks a spark dismissed', () => {
      seed();
      service.dismissSpark('p1', 1);
      expect(service.sparks().get(sparkKey('p1', 1))?.dismissed).toBe(true);
    });

    it('toggles a spark done on and off, preserving other edits', () => {
      seed();
      service.moveSpark('p1', 0, 25, 25);
      service.toggleSparkDone('p1', 0);
      expect(service.sparks().get(sparkKey('p1', 0))).toMatchObject({
        xPct: 25,
        yPct: 25,
        done: true,
      });
      service.toggleSparkDone('p1', 0);
      expect(service.sparks().get(sparkKey('p1', 0))?.done).toBe(false);
    });

    it('clears spark edits when a new story is generated', () => {
      seed();
      service.dismissSpark('p1', 0);
      expect(service.sparks().size).toBe(1);
      service.completeStory([{ photoId: 'p9', order: 1, caption: 'fresh', style: STYLE }], false);
      expect(service.sparks().size).toBe(0);
    });

    it('counts kept (non-dismissed) suggestions across frames for the hand-off', () => {
      service.completeStory(
        [
          {
            photoId: 'p1',
            order: 1,
            caption: 'a',
            style: STYLE,
            suggestions: [
              { type: 'location', query: 'Tartine', confidence: 0.9 },
              { type: 'music', query: 'indie folk', confidence: 0.6 },
            ],
          },
          { photoId: 'p2', order: 2, caption: 'b', style: STYLE },
        ],
        false,
      );
      expect(service.keptSuggestionCount()).toBe(2);

      service.dismissSpark('p1', 1);
      expect(service.keptSuggestionCount()).toBe(1);
    });

    it('reports no kept suggestions when the story has none', () => {
      seed();
      expect(service.keptSuggestionCount()).toBe(0);
    });
  });

  describe('extra text blocks', () => {
    const seed = () =>
      service.completeStory(
        [
          {
            photoId: 'p1',
            order: 1,
            caption: 'cap',
            style: STYLE,
            texts: [
              {
                text: 'we ate',
                font: 'playfair',
                weight: 'bold',
                case: 'normal',
                align: 'right',
                size: 'l',
                position: 'top-right',
              },
            ],
          },
        ],
        false,
      );

    it('builds editable extra-text state from the frame texts', () => {
      seed();
      const [frame] = service.frames();
      expect(frame.extraTexts).toHaveLength(1);
      expect(frame.extraTexts[0]).toMatchObject({
        text: 'we ate',
        font: 'playfair',
        size: 'l',
        legibility: true,
      });
      expect(frame.extraTexts[0].placement).toEqual(zoneToPlacement('top-right'));
    });

    it('edits an extra block text and placement', () => {
      seed();
      service.setExtraText('p1', 0, 'we ate everything');
      service.setExtraPlacement('p1', 0, { xPct: 30 });
      const block = service.frames()[0].extraTexts[0];
      expect(block.text).toBe('we ate everything');
      expect(block.placement.xPct).toBe(30);
    });

    it('toggles an extra block background', () => {
      seed();
      expect(service.frames()[0].extraTexts[0].legibility).toBe(true);
      service.toggleExtraLegibility('p1', 0);
      expect(service.frames()[0].extraTexts[0].legibility).toBe(false);
    });

    it('adds an extra block (returning its index), capped at 2', () => {
      seed();
      expect(service.addExtraText('p1')).toBe(1);
      expect(service.frames()[0].extraTexts).toHaveLength(2);
      expect(service.addExtraText('p1')).toBe(-1);
      expect(service.frames()[0].extraTexts).toHaveLength(2);
    });

    it('removes an extra block', () => {
      seed();
      service.removeExtraText('p1', 0);
      expect(service.frames()[0].extraTexts).toHaveLength(0);
    });
  });
});
