import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';

import { ErrorScreen } from './error-screen';
import { ErrorScreenHarness } from './error-screen.harness';
import { StoryService } from '../../story/story.service';

function imageFile(name = 'photo.jpg'): File {
  return new File(['bytes'], name, { type: 'image/jpeg' });
}

describe('ErrorScreen', () => {
  let story: StoryService;

  beforeEach(() => {
    // jsdom has no object-URL support; stub it so photo state is testable.
    URL.createObjectURL = () => 'blob:mock';
    URL.revokeObjectURL = () => undefined;
  });

  async function render(
    error: Parameters<StoryService['failStory']>[0] = {
      code: 'quota_exhausted',
      message: "We're at capacity, try again later.",
    },
    seed?: (story: StoryService) => void,
  ): Promise<ErrorScreenHarness> {
    await TestBed.configureTestingModule({ imports: [ErrorScreen] }).compileComponents();
    story = TestBed.inject(StoryService);
    seed?.(story);
    story.failStory(error);
    const fixture = TestBed.createComponent(ErrorScreen);
    return TestbedHarnessEnvironment.harnessForFixture(fixture, ErrorScreenHarness);
  }

  /** A user who had done the work before the failure: photos, line and tone. */
  function withWork(story: StoryService): void {
    story.addPhotos([imageFile('a.jpg'), imageFile('b.jpg'), imageFile('c.jpg')]);
    story.setStoryLine('Maya turns one at the lake');
    story.setTone('heartfelt');
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

  it('goes back to the picker on Go back', async () => {
    // Was "starts over on Start over", which landed on the example with the
    // work discarded. A failure the user did not cause must not cost them it.
    const harness = await render();
    await harness.clickGoBack();
    expect(story.phase()).toBe('create');
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

  describe('the way out keeps the work (7.39)', () => {
    for (const code of ['upstream_error', 'network', 'timeout'] as const) {
      it(`returns the photos, story line and tone after ${code}`, async () => {
        const harness = await render({ code, message: 'nope' }, withWork);
        const picked = story.photos();

        await harness.clickGoBack();

        expect(story.phase()).toBe('create');
        expect(story.photos()).toEqual(picked);
        expect(story.storyLine()).toBe('Maya turns one at the lake');
        expect(story.tone()).toBe('heartfelt');
      });
    }

    it('offers Go back on the failures that are worth retrying', async () => {
      const harness = await render({ code: 'upstream_error', message: 'nope' }, withWork);

      expect(await harness.hasTryAgain()).toBe(true);
      expect(await harness.hasGoBack()).toBe(true);
    });

    it('does not repeat itself when the primary already leads to the picker', async () => {
      // Change photos goes to the same place; a second button doing the same
      // thing is noise, not an option.
      const harness = await render({ code: 'safety_blocked', message: 'nope' }, withWork);

      expect(await harness.hasChangePhotos()).toBe(true);
      expect(await harness.hasGoBack()).toBe(false);
    });

    it('says the work is kept, before the user has to trust that it is', async () => {
      const harness = await render({ code: 'upstream_error', message: 'nope' }, withWork);

      expect(await harness.getKept()).toContain('kept');
    });

    it('promises nothing when there is no work to come back to', async () => {
      const harness = await render({ code: 'upstream_error', message: 'nope' });

      expect(await harness.getKept()).toBeNull();
    });
  });
});
