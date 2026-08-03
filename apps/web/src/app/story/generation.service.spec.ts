import { TestBed } from '@angular/core/testing';

import { GenerationService } from './generation.service';
import { StoryService } from './story.service';
import { StoryGateway, GenerateOutcome } from './story.gateway';
import { ImageService } from './image.service';
import type { GenerateRequest } from '@auto-stories/api-types';

function imageFile(name: string): File {
  return new File(['bytes'], name, { type: 'image/jpeg' });
}

describe('GenerationService', () => {
  let generation: GenerationService;
  let story: StoryService;
  let outcome: GenerateOutcome;

  beforeEach(() => {
    URL.createObjectURL = () => 'blob:mock';
    URL.revokeObjectURL = () => undefined;

    // Accept always succeeds with a jobId; the SSE stream returns the outcome
    // the test controls, so these tests exercise the terminal states.
    const gateway: Pick<StoryGateway, 'generate' | 'streamStory'> = {
      generate: async () => ({ ok: true, jobId: 'job-1' }),
      streamStory: async () => outcome,
    };
    const images: Pick<ImageService, 'toProxies'> = {
      toProxies: async () => [{ id: 'p1', b64: 'x' }],
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: StoryGateway, useValue: gateway },
        { provide: ImageService, useValue: images },
      ],
    });
    generation = TestBed.inject(GenerationService);
    story = TestBed.inject(StoryService);
    story.addPhotos([imageFile('a.jpg'), imageFile('b.jpg'), imageFile('c.jpg')]);
    story.setStoryLine('Maya turns one');
  });

  it('lands the finished story on the payoff when generation succeeds', async () => {
    outcome = {
      ok: true,
      response: {
        frames: [{ photoId: 'p1', order: 1, headline: 'By the water' }],
        partial: true,
        look: 'magazine-masthead',
      },
    };
    await generation.generate();
    expect(story.phase()).toBe('story');
    expect(story.frames()[0].headline).toBe('By the water');
    expect(story.partial()).toBe(true);
  });

  it('shows the specific error when generation fails', async () => {
    outcome = { ok: false, code: 'timeout', message: 'took too long' };
    await generation.generate();
    expect(story.phase()).toBe('error');
    expect(story.error()).toEqual({ code: 'timeout', message: 'took too long' });
  });

  it("regenerates only the target frame's words, keeping the rest of the refined story", async () => {
    story.completeStory(
      [
        { photoId: 'p1', order: 1, headline: 'first' },
        { photoId: 'p2', order: 2, headline: 'second' },
      ],
      false,
    );

    outcome = {
      ok: true,
      response: {
        frames: [
          { photoId: 'p1', order: 1, headline: 'first — reworded' },
          { photoId: 'p2', order: 2, headline: 'second — reworded' },
        ],
        look: 'magazine-masthead',
      },
    };
    const applied = await generation.regenerateHeadline('p2');

    expect(applied).toBe(true);
    expect(story.frames().find((f) => f.photoId === 'p2')?.headline).toBe('second — reworded');
    // The untouched frame keeps its words.
    expect(story.frames().find((f) => f.photoId === 'p1')?.headline).toBe('first');
    // A regenerate must not bounce the user off the payoff.
    expect(story.phase()).toBe('story');
  });

  it('leaves the words untouched when a regenerate fails', async () => {
    story.completeStory([{ photoId: 'p1', order: 1, headline: 'first' }], false);
    outcome = { ok: false, code: 'network', message: 'nope' };
    const applied = await generation.regenerateHeadline('p1');
    expect(applied).toBe(false);
    expect(story.frames()[0].headline).toBe('first');
    expect(story.phase()).toBe('story');
  });

  describe('captionNewPhotos (Add photo in refine)', () => {
    /** Seed a finished 3-frame story from the pool, then add one more photo. */
    function seedStoryPlusOne(): string {
      const [a, b, c] = story.photos();
      story.completeStory(
        [
          { photoId: a.id, order: 1, headline: 'first' },
          { photoId: b.id, order: 2, headline: 'second' },
          { photoId: c.id, order: 3, headline: 'third' },
        ],
        false,
      );
      story.setHeadline(a.id, 'kept by hand');
      story.addPhotos([imageFile('d.jpg')]);
      return story.photos()[3].id;
    }

    it('appends the added photo with the words the model wrote, keeping the story', async () => {
      const newId = seedStoryPlusOne();
      outcome = {
        ok: true,
        response: {
          frames: [{ photoId: newId, order: 1, headline: 'the newcomer' }],
          look: 'magazine-masthead',
        },
      };

      await generation.captionNewPhotos();

      const frames = story.frames();
      expect(frames).toHaveLength(4);
      expect(frames[3].photoId).toBe(newId);
      expect(frames[3].headline).toBe('the newcomer');
      // Existing frames are untouched.
      expect(frames[0].headline).toBe('kept by hand');
      expect(story.phase()).toBe('story');
    });

    it('sends the new photo id as mustInclude', async () => {
      const newId = seedStoryPlusOne();
      let sent: GenerateRequest | undefined;
      (
        generation as unknown as {
          gateway: Pick<StoryGateway, 'generate' | 'streamStory'>;
        }
      ).gateway = {
        generate: async (req) => {
          sent = req;
          return { ok: true, jobId: 'job-1' };
        },
        streamStory: async () => ({
          ok: true,
          response: {
            frames: [{ photoId: newId, order: 1, headline: 'x' }],
            look: 'magazine-masthead',
          },
        }),
      };

      await generation.captionNewPhotos();

      expect(sent?.mustInclude).toEqual([newId]);
    });

    it('still appends the photo (empty words) when generation fails', async () => {
      const newId = seedStoryPlusOne();
      outcome = { ok: false, code: 'network', message: 'nope' };

      await generation.captionNewPhotos();

      const added = story.frames().find((f) => f.photoId === newId);
      expect(added?.headline).toBe('');
      // Never bounced off the payoff.
      expect(story.phase()).toBe('story');
    });

    it('does nothing when no photos were added', async () => {
      const [a, b, c] = story.photos();
      story.completeStory(
        [
          { photoId: a.id, order: 1, headline: 'first' },
          { photoId: b.id, order: 2, headline: 'second' },
          { photoId: c.id, order: 3, headline: 'third' },
        ],
        false,
      );
      await generation.captionNewPhotos();
      expect(story.frames()).toHaveLength(3);
    });
  });
});
