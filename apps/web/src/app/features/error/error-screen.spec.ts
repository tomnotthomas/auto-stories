import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';

import { ErrorScreen } from './error-screen';
import { ErrorScreenHarness } from './error-screen.harness';
import { StoryService } from '../../story/story.service';

describe('ErrorScreen', () => {
  let story: StoryService;

  async function render(): Promise<ErrorScreenHarness> {
    await TestBed.configureTestingModule({ imports: [ErrorScreen] }).compileComponents();
    story = TestBed.inject(StoryService);
    story.failStory({ code: 'quota_exhausted', message: "We're at capacity, try again later." });
    const fixture = TestBed.createComponent(ErrorScreen);
    return TestbedHarnessEnvironment.harnessForFixture(fixture, ErrorScreenHarness);
  }

  it('shows the specific failure message', async () => {
    expect(await (await render()).getMessage()).toContain('at capacity');
  });

  it('retries generation on Try again', async () => {
    const harness = await render();
    await harness.clickTryAgain();
    expect(story.phase()).toBe('generating');
  });

  it('starts over on Start over', async () => {
    const harness = await render();
    await harness.clickStartOver();
    expect(story.phase()).toBe('example');
  });
});
