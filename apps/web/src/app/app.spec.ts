import { TestBed } from '@angular/core/testing';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';

import { App } from './app';
import { StoryService } from './story/story.service';
import { StoryGateway } from './story/story.gateway';
import { ImageService } from './story/image.service';
import { ExampleHarness } from './features/example/example.harness';
import { CreateHarness } from './features/create/create.harness';
import { GeneratingHarness } from './features/generating/generating.harness';
import { StoryHarness } from './features/story/story.harness';
import { ErrorScreenHarness } from './features/error/error-screen.harness';

describe('App', () => {
  async function setup(): Promise<{ loader: HarnessLoader; story: StoryService }> {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        // The generating screen kicks off a call on mount; keep it pending so the
        // flow stays on 'generating' and no real HTTP/canvas runs in the shell test.
        { provide: ImageService, useValue: { toProxies: async () => [], toDisplayUrl: async () => null } },
        { provide: StoryGateway, useValue: { generate: () => new Promise<never>(() => {}) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    return {
      loader: TestbedHarnessEnvironment.loader(fixture),
      story: TestBed.inject(StoryService),
    };
  }

  afterEach(() => history.replaceState(null, '', '/'));

  it('shows the first-open example by default', async () => {
    const { loader } = await setup();
    expect(await loader.getHarnessOrNull(ExampleHarness)).not.toBeNull();
  });

  it('boots straight into the picker when opened at /app/create', async () => {
    history.replaceState(null, '', '/app/create');
    const { loader } = await setup();
    expect(await loader.getHarnessOrNull(CreateHarness)).not.toBeNull();
    expect(await loader.getHarnessOrNull(ExampleHarness)).toBeNull();
  });

  it('shows the example when opened at /app/example', async () => {
    history.replaceState(null, '', '/app/example');
    const { loader } = await setup();
    expect(await loader.getHarnessOrNull(ExampleHarness)).not.toBeNull();
  });

  it('shows the create step once the user starts', async () => {
    const { loader, story } = await setup();
    story.startCreating();
    expect(await loader.getHarnessOrNull(CreateHarness)).not.toBeNull();
    expect(await loader.getHarnessOrNull(ExampleHarness)).toBeNull();
  });

  it('shows the generating screen while the story is being built', async () => {
    const { loader, story } = await setup();
    story.startGenerating();
    expect(await loader.getHarnessOrNull(GeneratingHarness)).not.toBeNull();
  });

  it('shows the payoff once the story is ready', async () => {
    const { loader, story } = await setup();
    story.completeStory([{ photoId: 'p1', order: 1, headline: 'hi' }], false);
    expect(await loader.getHarnessOrNull(StoryHarness)).not.toBeNull();
  });

  it('shows the error screen on failure', async () => {
    const { loader, story } = await setup();
    story.failStory({ code: 'timeout', message: 'took too long' });
    expect(await loader.getHarnessOrNull(ErrorScreenHarness)).not.toBeNull();
  });
});
