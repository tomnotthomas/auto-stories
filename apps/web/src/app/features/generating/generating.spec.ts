import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';

import { Generating } from './generating';
import { GeneratingHarness } from './generating.harness';
import { StoryService } from '../../story/story.service';
import { StoryGateway, GenerateOutcome } from '../../story/story.gateway';
import type { Frame } from '@auto-stories/api-types';
import { ImageService } from '../../story/image.service';

function imageFile(name: string): File {
  return new File(['bytes'], name, { type: 'image/jpeg' });
}

/** The model's two choices, in the order it writes them. */
const FRAMES: Frame[] = [
  { photoId: 'photo-1', order: 1, headline: 'It started with a mirror and a plan' },
  { photoId: 'photo-2', order: 2, headline: 'Home sticky and victorious' },
];

/** The finished story those choices add up to. */
const STORY: GenerateOutcome = {
  ok: true,
  response: { frames: FRAMES, look: 'magazine-masthead' },
};

/** Longer than the whole reveal — the drift in, the catch, and the ending. */
const WHOLE_REVEAL_MS = 20_000;

describe('Generating', () => {
  let fixture: ComponentFixture<Generating>;
  let land: (outcome: GenerateOutcome) => void;
  /** Report frames the way the server does while the model is still writing. */
  let report: ((frames: readonly Frame[]) => void) | undefined;

  /**
   * Mount the screen with the model still working, so a test can play with the
   * table before the story lands. `land()` is what returns the model's answer.
   */
  async function setup(): Promise<{ story: StoryService; harness: GeneratingHarness }> {
    URL.createObjectURL = () => 'blob:mock';
    URL.revokeObjectURL = () => undefined;

    const pending = new Promise<GenerateOutcome>((resolve) => {
      land = resolve;
    });
    const gateway: Pick<StoryGateway, 'generate' | 'streamStory'> = {
      generate: async () => ({ ok: true, jobId: 'job-1' }),
      streamStory: (_jobId, onFrames) => {
        report = onFrames;
        return pending;
      },
    };
    const images: Pick<ImageService, 'toProxies'> = {
      toProxies: async () => [{ id: 'photo-1', b64: 'x' }],
    };

    await TestBed.configureTestingModule({
      imports: [Generating],
      providers: [
        { provide: ImageService, useValue: images },
        { provide: StoryGateway, useValue: gateway },
      ],
    }).compileComponents();

    const story = TestBed.inject(StoryService);
    story.addPhotos([
      imageFile('a.jpg'),
      imageFile('b.jpg'),
      imageFile('c.jpg'),
      imageFile('d.jpg'),
    ]);
    story.startGenerating();
    fixture = TestBed.createComponent(Generating);
    const harness = await TestbedHarnessEnvironment.harnessForFixture(fixture, GeneratingHarness);
    return { story, harness };
  }

  beforeEach(() => vi.useFakeTimers());

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
  });

  /** Let the screen run for `ms` of its own time. */
  async function play(ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
  }

  it('tells the user the story is being built', async () => {
    const { harness } = await setup();
    expect(await harness.getHeadingText()).toContain('Building your story');
    expect(await harness.getStatusText()).toContain('Building your story');
  });

  it('deals the user’s own photos onto the table', async () => {
    const { story, harness } = await setup();
    const dealt = await harness.getPrintPhotoIds();
    expect(dealt.length).toBeGreaterThan(0);
    const picked = story.photos().map((photo) => photo.id);
    expect(dealt.every((id) => picked.includes(id))).toBe(true);
  });

  it('keeps a print the user pulls down as their own pick', async () => {
    const { story, harness } = await setup();

    await harness.dragPrint('photo-1', 260);

    expect(story.userPicks()).toEqual(['photo-1']);
    expect(await harness.getKeptTally()).toContain('1 yours');
  });

  it('does not keep a print the user pushes up past the seen pile', async () => {
    const { story, harness } = await setup();

    await harness.dragPrint('photo-1', -700);

    expect(story.userPicks()).toEqual([]);
    expect(await harness.getSeenTally()).toContain('looked at');
  });

  it('invites the user in after a moment, and never once they have touched a print', async () => {
    const { harness } = await setup();
    expect(await harness.hasInvitation()).toBe(false);
    await play(2500);
    expect(await harness.hasInvitation()).toBe(true);

    await harness.dragPrint('photo-1', 10);
    expect(await harness.hasInvitation()).toBe(false);
  });

  it('shows a choice while the model is still working, not only at the end', async () => {
    const { harness } = await setup();

    report?.([FRAMES[0]]);
    await play(WHOLE_REVEAL_MS);

    // The story has not landed — this is the model still writing.
    expect(await harness.getSetHeadlines()).toContain('It started with a mirror and a plan');
    expect(await harness.getSegmentCount()).toBe(0);
  });

  it('never claims a frame closes a story whose length it does not know yet', async () => {
    const { harness } = await setup();

    report?.(FRAMES);
    await play(WHOLE_REVEAL_MS);

    expect(await harness.getSetKickers()).not.toContain('closes it');
  });

  it('catches each choice as it arrives, in the order the model wrote them', async () => {
    const { harness } = await setup();

    report?.([FRAMES[0]]);
    await play(WHOLE_REVEAL_MS);
    report?.(FRAMES);
    await play(WHOLE_REVEAL_MS);

    expect(await harness.getSetHeadlines()).toEqual([
      'It started with a mirror and a plan',
      'Home sticky and victorious',
    ]);
  });

  it('does not deal the same photo twice when the report repeats it', async () => {
    const { harness } = await setup();

    report?.([FRAMES[0]]);
    await play(WHOLE_REVEAL_MS);
    report?.([FRAMES[0]]);
    await play(2000);

    const dealt = await harness.getPrintPhotoIds();
    expect(dealt.filter((id) => id === 'photo-1')).toHaveLength(1);
  });

  it('sets the model’s own words on the print it caught', async () => {
    const { harness } = await setup();
    land(STORY);
    await play(WHOLE_REVEAL_MS);

    expect(await harness.getSetHeadlines()).toContain('It started with a mirror and a plan');
    expect(await harness.getSetKickers()).toContain('opens the story');
  });

  it('says the user called it when the model picks a photo they pulled down', async () => {
    const { harness } = await setup();
    await harness.dragPrint('photo-1', 260);

    land(STORY);
    await play(WHOLE_REVEAL_MS);

    expect(await harness.getSetKickers()).toContain('you called it');
  });

  it('flattens the kept pile into the story’s progress bars before it hands over', async () => {
    const { harness } = await setup();
    land(STORY);
    await play(WHOLE_REVEAL_MS);

    expect(await harness.getSegmentCount()).toBe(2);
  });

  it('lands on the payoff once the reveal is over', async () => {
    const { story } = await setup();
    land(STORY);
    await play(WHOLE_REVEAL_MS);

    expect(story.phase()).toBe('story');
    expect(story.frames().map((frame) => frame.headline)).toEqual([
      'It started with a mirror and a plan',
      'Home sticky and victorious',
    ]);
  });

  it('adds a photo the user kept that the model did not use', async () => {
    const { story, harness } = await setup();
    await harness.dragPrint('photo-3', 260);

    land(STORY);
    await play(WHOLE_REVEAL_MS);

    expect(story.frames().map((frame) => frame.photoId)).toContain('photo-3');
  });

  it('shows a specific error when generation fails, with no reveal to sit through', async () => {
    const { story } = await setup();
    land({ ok: false, code: 'timeout', message: 'took too long' });
    await play(0);

    expect(story.phase()).toBe('error');
    expect(story.error()).toEqual({ code: 'timeout', message: 'took too long' });
  });

  it('goes quiet rather than repeating photos once the pool is spent', async () => {
    const { harness } = await setup();
    for (const id of await harness.getPrintPhotoIds()) await harness.dragPrint(id, -700);
    await play(200);

    expect(await harness.hasQuietLine()).toBe(true);
    expect(await harness.getStatusText()).toContain('Still looking');
  });
});
