import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';

import { Generating } from './generating';
import { GeneratingHarness } from './generating.harness';
import { StoryService } from '../../story/story.service';
import { StoryGateway, GenerateOutcome } from '../../story/story.gateway';
import { ImageService } from '../../story/image.service';

/** Let the async run() (two awaits over resolved stubs) settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve));

describe('Generating', () => {
  let fixture: ComponentFixture<Generating>;

  async function setup(outcome: GenerateOutcome): Promise<{
    story: StoryService;
    harness: GeneratingHarness;
  }> {
    const gateway: Pick<StoryGateway, 'generate' | 'streamStory'> = {
      generate: async () => ({ ok: true, jobId: 'job-1' }),
      streamStory: async () => outcome,
    };
    const images: Pick<ImageService, 'toProxies'> = {
      toProxies: async () => [{ id: 'p1', b64: 'x' }],
    };

    await TestBed.configureTestingModule({
      imports: [Generating],
      providers: [
        { provide: ImageService, useValue: images },
        { provide: StoryGateway, useValue: gateway },
      ],
    }).compileComponents();

    const story = TestBed.inject(StoryService);
    fixture = TestBed.createComponent(Generating);
    const harness = await TestbedHarnessEnvironment.harnessForFixture(fixture, GeneratingHarness);
    return { story, harness };
  }

  afterEach(() => fixture?.destroy());

  const success: GenerateOutcome = {
    ok: true,
    response: { frames: [{ photoId: 'p1', order: 1, caption: 'By the water', headline: 'By the water', style: { font: 'inter', weight: 'regular', case: 'normal', align: 'center', size: 'm', position: 'bottom-center', letterbox: 'blur' } }], look: 'magazine-masthead' },
  };

  it('tells the user the story is being built', async () => {
    const { harness } = await setup(success);
    expect(await harness.getHeadingText()).toContain('Building your story');
  });

  it('narrates the work in steps', async () => {
    const { harness } = await setup(success);
    expect(await harness.getStepCount()).toBe(3);
  });

  it('lands on the payoff when generation succeeds', async () => {
    const { story } = await setup(success);
    await flush();
    expect(story.phase()).toBe('story');
    // frames() now carry editable refine state on top of the contract fields.
    expect(
      story
        .frames()
        .map((f) => ({
          photoId: f.photoId,
          order: f.order,
          caption: f.caption,
          headline: f.headline,
          style: f.style,
        })),
    ).toEqual(
      success.response.frames,
    );
  });

  it('shows a specific error when generation fails', async () => {
    const { story } = await setup({ ok: false, code: 'timeout', message: 'took too long' });
    await flush();
    expect(story.phase()).toBe('error');
    expect(story.error()).toEqual({ code: 'timeout', message: 'took too long' });
  });
});
