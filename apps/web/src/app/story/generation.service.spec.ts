import { TestBed } from '@angular/core/testing';

import { GenerationService } from './generation.service';
import { StoryService } from './story.service';
import { StoryGateway, GenerateOutcome } from './story.gateway';
import { ImageService } from './image.service';

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

    const gateway: Pick<StoryGateway, 'generate'> = { generate: async () => outcome };
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
      response: { frames: [{ photoId: 'p1', order: 1, caption: 'By the water' }], partial: true },
    };
    await generation.generate();
    expect(story.phase()).toBe('story');
    expect(story.frames()[0].caption).toBe('By the water');
    expect(story.partial()).toBe(true);
  });

  it('shows the specific error when generation fails', async () => {
    outcome = { ok: false, code: 'timeout', message: 'took too long' };
    await generation.generate();
    expect(story.phase()).toBe('error');
    expect(story.error()).toEqual({ code: 'timeout', message: 'took too long' });
  });

  it('regenerates only the target caption, keeping the rest of the refined story', async () => {
    story.completeStory(
      [
        { photoId: 'p1', order: 1, caption: 'first' },
        { photoId: 'p2', order: 2, caption: 'second' },
      ],
      false,
    );
    story.setPlacement('p1', { xPct: 20, yPct: 20 });

    outcome = {
      ok: true,
      response: {
        frames: [
          { photoId: 'p1', order: 1, caption: 'first — reworded' },
          { photoId: 'p2', order: 2, caption: 'second — reworded' },
        ],
      },
    };
    const applied = await generation.regenerateCaption('p2');

    expect(applied).toBe(true);
    expect(story.frames().find((f) => f.photoId === 'p2')?.caption).toBe('second — reworded');
    // The untouched frame keeps its caption and the placement the user set.
    const p1 = story.frames().find((f) => f.photoId === 'p1');
    expect(p1?.caption).toBe('first');
    expect(p1?.placement).toEqual({ xPct: 20, yPct: 20, scale: 1 });
    // A caption regenerate must not bounce the user off the payoff.
    expect(story.phase()).toBe('story');
  });

  it('leaves the caption untouched when a regenerate fails', async () => {
    story.completeStory([{ photoId: 'p1', order: 1, caption: 'first' }], false);
    outcome = { ok: false, code: 'network', message: 'nope' };
    const applied = await generation.regenerateCaption('p1');
    expect(applied).toBe(false);
    expect(story.frames()[0].caption).toBe('first');
    expect(story.phase()).toBe('story');
  });
});
