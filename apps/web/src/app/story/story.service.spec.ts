import { TestBed } from '@angular/core/testing';

import { DEFAULT_PLACEMENT, MAX_PHOTOS, MAX_STORY_LENGTH, StoryService } from './story.service';

function imageFile(name = 'photo.jpg'): File {
  return new File(['bytes'], name, { type: 'image/jpeg' });
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
    const frames = [{ photoId: 'p1', order: 1, caption: 'By the water' }];
    service.completeStory(frames, true);
    expect(service.phase()).toBe('story');
    expect(service.partial()).toBe(true);
    // Each frame gains editable placement + legibility state for refine.
    const [frame] = service.frames();
    expect(frame).toMatchObject({ photoId: 'p1', order: 1, caption: 'By the water' });
    expect(frame.placement).toEqual(DEFAULT_PLACEMENT);
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
    service.completeStory([{ photoId: 'photo-1', order: 1, caption: 'x' }], false);
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
          { photoId: 'p1', order: 1, caption: 'first' },
          { photoId: 'p2', order: 2, caption: 'second' },
          { photoId: 'p3', order: 3, caption: 'third' },
          { photoId: 'p4', order: 4, caption: 'fourth' },
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

    it('drops a photo and re-indexes the remaining frames', () => {
      seedFour();
      service.dropPhoto('p2');
      expect(service.frames().map((f) => f.photoId)).toEqual(['p1', 'p3', 'p4']);
      expect(service.frames().map((f) => f.order)).toEqual([1, 2, 3]);
    });

    it('refuses to drop below the minimum photo count', () => {
      service.completeStory(
        [
          { photoId: 'p1', order: 1, caption: 'a' },
          { photoId: 'p2', order: 2, caption: 'b' },
          { photoId: 'p3', order: 3, caption: 'c' },
        ],
        false,
      );
      service.dropPhoto('p2');
      expect(service.frames().map((f) => f.photoId)).toEqual(['p1', 'p2', 'p3']);
    });

    it('records that the refine coach mark has been seen', () => {
      expect(service.coachSeen()).toBe(false);
      service.markCoachSeen();
      expect(service.coachSeen()).toBe(true);
    });
  });
});
