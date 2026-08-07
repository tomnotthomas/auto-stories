import { TestBed } from '@angular/core/testing';

import {
  DEFAULT_PHOTO_ASPECT,
  MAX_PHOTOS,
  MAX_STORY_LENGTH,
  StoryService,
  sparkKey,
} from './story.service';
import { DEFAULT_ACCENT } from './accent-color';
import { textParts } from './look';

function imageFile(name = 'photo.jpg'): File {
  return new File(['bytes'], name, { type: 'image/jpeg' });
}

/** The words a composition rendered, in order — the only thing drawn on a frame
 * now that the Look owns the whole of it (7.25). */
function composedText(service: StoryService, photoId: string): string[] {
  const frame = service.frames().find((f) => f.photoId === photoId);
  if (!frame) throw new Error(`no frame ${photoId}`);
  return textParts(frame.composition).map((part) => part.runs.map((run) => run.text).join(''));
}

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

  describe('the shape of a picked photo', () => {
    /** Stand in for the browser decoder with a photo of a known size. */
    function decodesAs(width: number, height: number): () => void {
      const real = globalThis.createImageBitmap;
      globalThis.createImageBitmap = (() =>
        Promise.resolve({
          width,
          height,
          close: () => undefined,
        })) as unknown as typeof createImageBitmap;
      return () => {
        globalThis.createImageBitmap = real;
      };
    }

    it('assumes a phone photo until the file has been read', () => {
      service.addPhotos([imageFile('a.jpg')]);
      expect(service.photos()[0].aspect).toBeCloseTo(DEFAULT_PHOTO_ASPECT, 5);
    });

    it('records the photo’s own shape once it can be decoded', async () => {
      const restore = decodesAs(1200, 800);
      try {
        service.addPhotos([imageFile('a.jpg')]);
        await vi.waitFor(() => expect(service.photos()[0].aspect).toBeCloseTo(1.5, 3));
      } finally {
        restore();
      }
    });

    it('keeps the assumed shape when the photo cannot be decoded', async () => {
      const real = globalThis.createImageBitmap;
      globalThis.createImageBitmap = (() =>
        Promise.reject(new Error('undecodable'))) as unknown as typeof createImageBitmap;
      try {
        service.addPhotos([imageFile('a.jpg')]);
        await Promise.resolve();
        await Promise.resolve();
        expect(service.photos()[0].aspect).toBeCloseTo(DEFAULT_PHOTO_ASPECT, 5);
      } finally {
        globalThis.createImageBitmap = real;
      }
    });

    it('leaves a photo the user removed while it was being read', async () => {
      const restore = decodesAs(1200, 800);
      try {
        service.addPhotos([imageFile('a.jpg')]);
        service.removePhoto(service.photos()[0].id);
        await vi.waitFor(() => expect(service.photoCount()).toBe(0));
        expect(service.photos()).toEqual([]);
      } finally {
        restore();
      }
    });
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
    const frames = [{ photoId: 'p1', order: 1, headline: 'By the water' }];
    service.completeStory(frames, true);
    expect(service.phase()).toBe('story');
    expect(service.partial()).toBe(true);
    const [frame] = service.frames();
    expect(frame).toMatchObject({ photoId: 'p1', order: 1, headline: 'By the water' });
  });

  it('composes every frame the moment the story arrives, so nothing renders a hole', () => {
    // The photo has not been decoded yet, so the reading is the neutral one —
    // but the frame still has a full composition to draw (7.25).
    service.completeStory([{ photoId: 'p1', order: 1, headline: 'By the water' }], false);
    const [frame] = service.frames();
    expect(frame.analysis).toEqual({
      accent: DEFAULT_ACCENT,
      bands: { top: 0, middle: 0, bottom: 0 },
    });
    expect(composedText(service, 'p1')).toEqual(['By the water']);
  });

  it('composes under the story Look, holding it across every frame', () => {
    service.completeStory(
      [
        { photoId: 'p1', order: 1, kicker: 'The coast', headline: 'Golden hour' },
        { photoId: 'p2', order: 2, headline: 'Then the tide' },
      ],
      false,
      'magazine-masthead',
    );
    expect(service.frames().map((f) => f.composition.lookId)).toEqual([
      'magazine-masthead',
      'magazine-masthead',
    ]);
    expect(composedText(service, 'p1')).toEqual(['The coast', 'Golden hour']);
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
    service.completeStory([{ photoId: 'photo-1', order: 1, headline: 'x' }], false);
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
          { photoId: 'p1', order: 1, headline: 'first' },
          { photoId: 'p2', order: 2, headline: 'second' },
          { photoId: 'p3', order: 3, headline: 'third' },
          { photoId: 'p4', order: 4, headline: 'fourth' },
        ],
        false,
      );

    it("rewrites a frame's words by photo id", () => {
      seedFour();
      service.setHeadline('p2', 'rewritten');
      expect(service.frames().find((f) => f.photoId === 'p2')?.headline).toBe('rewritten');
    });

    it('recomposes the edited frame, so the new words are the ones drawn', () => {
      seedFour();
      service.setHeadline('p2', 'rewritten');
      expect(composedText(service, 'p2')).toEqual(['rewritten']);
      // Only that frame changes.
      expect(composedText(service, 'p1')).toEqual(['first']);
    });

    it('recomposes from the photo reading already on the frame', () => {
      seedFour();
      const before = service.frames()[1].analysis;
      service.setHeadline('p2', 'rewritten');
      expect(service.frames()[1].analysis).toBe(before);
      expect(service.frames()[1].composition.accent).toBe(before.accent);
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
          { photoId: 'p1', order: 1, headline: 'first' },
          { photoId: pooled, order: 2, headline: 'second' },
          { photoId: 'p3', order: 3, headline: 'third' },
          { photoId: 'p4', order: 4, headline: 'fourth' },
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
          { photoId: 'p1', order: 1, headline: 'a' },
          { photoId: 'p2', order: 2, headline: 'b' },
          { photoId: 'p3', order: 3, headline: 'c' },
        ],
        false,
      );
      service.dropPhoto('p2');
      expect(service.frames().map((f) => f.photoId)).toEqual(['p1', 'p2', 'p3']);
    });

    it('appends a hand-added photo as a new frame, keeping the rest', () => {
      seedFour();
      service.setHeadline('p1', 'edited by hand');
      service.appendFrame({ photoId: 'p5', order: 99, headline: 'newcomer' });

      const frames = service.frames();
      expect(frames.map((f) => f.photoId)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
      expect(frames.map((f) => f.order)).toEqual([1, 2, 3, 4, 5]);
      // The appended frame arrives already composed, like every other one.
      expect(frames[4].headline).toBe('newcomer');
      expect(composedText(service, 'p5')).toEqual(['newcomer']);
      // The existing frame keeps the words the user set.
      expect(frames[0].headline).toBe('edited by hand');
    });

    it('ignores appending a photo already in the story', () => {
      seedFour();
      service.appendFrame({ photoId: 'p2', order: 9, headline: 'dupe' });
      expect(service.frames()).toHaveLength(4);
    });

    it('records that the refine coach mark has been seen', () => {
      expect(service.coachSeen()).toBe(false);
      service.markCoachSeen();
      expect(service.coachSeen()).toBe(true);
    });
  });

  describe('sparks (per-suggestion user edits)', () => {
    const seed = () => service.completeStory([{ photoId: 'p1', order: 1, headline: 'a' }], false);

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
      service.completeStory([{ photoId: 'p9', order: 1, headline: 'fresh' }], false);
      expect(service.sparks().size).toBe(0);
    });

    it('counts kept (non-dismissed) suggestions across frames for the hand-off', () => {
      service.completeStory(
        [
          {
            photoId: 'p1',
            order: 1,
            headline: 'a',
            suggestions: [
              { type: 'location', query: 'Tartine', confidence: 0.9 },
              { type: 'music', query: 'indie folk', confidence: 0.6 },
            ],
          },
          { photoId: 'p2', order: 2, headline: 'b' },
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
});
