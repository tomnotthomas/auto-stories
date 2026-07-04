import { TestBed } from '@angular/core/testing';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';

import { App } from './app';
import { StoryService } from './story/story.service';
import { ExampleHarness } from './features/example/example.harness';
import { CreateHarness } from './features/create/create.harness';

describe('App', () => {
  async function setup(): Promise<{ loader: HarnessLoader; story: StoryService }> {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    return {
      loader: TestbedHarnessEnvironment.loader(fixture),
      story: TestBed.inject(StoryService),
    };
  }

  it('shows the first-open example by default', async () => {
    const { loader } = await setup();
    expect(await loader.getHarnessOrNull(ExampleHarness)).not.toBeNull();
  });

  it('shows the create step once the user starts', async () => {
    const { loader, story } = await setup();

    story.startCreating();

    expect(await loader.getHarnessOrNull(CreateHarness)).not.toBeNull();
    expect(await loader.getHarnessOrNull(ExampleHarness)).toBeNull();
  });
});
