import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';

import { Example } from './example';
import { ExampleHarness } from './example.harness';
import { StoryService } from '../../story/story.service';

describe('Example', () => {
  let harness: ExampleHarness;
  let story: StoryService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Example],
    }).compileComponents();

    const fixture = TestBed.createComponent(Example);
    story = TestBed.inject(StoryService);
    harness = await TestbedHarnessEnvironment.harnessForFixture(fixture, ExampleHarness);
  });

  it('shows a finished example caption', async () => {
    expect((await harness.getCaptionText()).length).toBeGreaterThan(0);
  });

  it('offers a call-to-action to start with your own photos', async () => {
    expect(await harness.getCtaText()).toContain('Try it with your photos');
  });

  it('starts the create step when the call-to-action is clicked', async () => {
    await harness.clickCta();
    expect(story.phase()).toBe('create');
  });
});
