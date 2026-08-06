import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';

import { ErrorScreen } from './error-screen';
import { ErrorScreenHarness } from './error-screen.harness';
import { StoryService } from '../../story/story.service';

describe('ErrorScreen', () => {
  let story: StoryService;

  async function render(
    error: Parameters<StoryService['failStory']>[0] = {
      code: 'quota_exhausted',
      message: "We're at capacity, try again later.",
    },
  ): Promise<ErrorScreenHarness> {
    await TestBed.configureTestingModule({ imports: [ErrorScreen] }).compileComponents();
    story = TestBed.inject(StoryService);
    story.failStory(error);
    const fixture = TestBed.createComponent(ErrorScreen);
    return TestbedHarnessEnvironment.harnessForFixture(fixture, ErrorScreenHarness);
  }

  it('says why it happened, not just that it did', async () => {
    // The message used to be the server's prose; the screen now explains the
    // cause, which is the whole point of decision 7.36.
    expect(await (await render()).getWhy()).toContain('free');
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

  describe('explaining the cause (7.36)', () => {
    it('reads a timeout as busy rather than broken, and blames the free tier', async () => {
      const harness = await render({ code: 'timeout', message: 'took too long' });

      expect(await harness.getTitle()).toContain('busy');
      expect(await harness.getWhy()).toContain('free tier');
    });

    it('says which limit was hit when the caller has had their hour’s worth', async () => {
      const harness = await render({ code: 'rate_limited', message: 'slow down' });

      expect(await harness.getTitle()).toContain('today');
      expect(await harness.getWhy()).toContain('shared');
    });

    it('states the time the refusal lifts instead of "shortly"', async () => {
      const harness = await render({
        code: 'rate_limited',
        message: 'slow down',
        retryAt: new Date(Date.now() + 20 * 60_000).toISOString(),
      });

      expect(await harness.getWhen()).toMatch(/You can start another at \d/);
    });

    it('says nothing about timing when the server gave no time', async () => {
      const harness = await render({ code: 'upstream_error', message: 'nope' });

      expect(await harness.getWhen()).toBeNull();
    });

    it('will not offer a retry before it could possibly work', async () => {
      const harness = await render({
        code: 'rate_limited',
        message: 'slow down',
        retryAt: new Date(Date.now() + 20 * 60_000).toISOString(),
      });

      expect(await harness.isTryAgainEnabled()).toBe(false);
    });

    it('offers the retry once the refusal has already lifted', async () => {
      const harness = await render({
        code: 'rate_limited',
        message: 'slow down',
        retryAt: new Date(Date.now() - 1000).toISOString(),
      });

      expect(await harness.isTryAgainEnabled()).toBe(true);
    });

    it('offers different photos, not a retry, when the same set cannot pass', async () => {
      const harness = await render({ code: 'safety_blocked', message: 'nope' });

      expect(await harness.hasTryAgain()).toBe(false);
      expect(await harness.hasChangePhotos()).toBe(true);
    });

    it('keeps the photos when it sends the user back to the picker', async () => {
      const harness = await render({ code: 'safety_blocked', message: 'nope' });

      await harness.clickChangePhotos();

      expect(story.phase()).toBe('create');
    });
  });
});
