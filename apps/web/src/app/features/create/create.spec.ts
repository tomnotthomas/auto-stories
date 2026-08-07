import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';

import { Create } from './create';
import { CreateHarness } from './create.harness';
import { StoryService } from '../../story/story.service';
import type { Limits } from '@auto-stories/api-types';

function imageFile(name = 'photo.jpg'): File {
  return new File(['bytes'], name, { type: 'image/jpeg' });
}

describe('Create', () => {
  let fixture: ComponentFixture<Create>;
  let harness: CreateHarness;
  let story: StoryService;

  beforeEach(async () => {
    URL.createObjectURL = () => 'blob:mock';
    URL.revokeObjectURL = () => undefined;

    await TestBed.configureTestingModule({
      imports: [Create],
    }).compileComponents();

    fixture = TestBed.createComponent(Create);
    story = TestBed.inject(StoryService);
    story.startCreating();
    harness = await TestbedHarnessEnvironment.harnessForFixture(fixture, CreateHarness);
  });

  it('shows the step title', async () => {
    expect(await harness.getTitle()).toBe('New story');
  });

  it('returns to the example when back is clicked', async () => {
    await harness.clickBack();
    expect(story.phase()).toBe('example');
  });

  it('shows a tile for each picked photo', async () => {
    story.addPhotos([imageFile('a.jpg'), imageFile('b.jpg'), imageFile('c.jpg')]);
    expect(await harness.photoCount()).toBe(3);
  });

  it('adds photos chosen through the file input', async () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', { value: [imageFile()], configurable: true });
    input.dispatchEvent(new Event('change'));
    expect(story.photoCount()).toBe(1);
  });

  it('removes a photo when its remove button is clicked', async () => {
    story.addPhotos([imageFile('a.jpg'), imageFile('b.jpg')]);
    await harness.removeFirstPhoto();
    expect(await harness.photoCount()).toBe(1);
  });

  it('keeps Create disabled until there are enough photos and a story line', async () => {
    story.addPhotos([imageFile('a.jpg'), imageFile('b.jpg')]);
    expect(await harness.isCreateEnabled()).toBe(false);

    story.addPhotos([imageFile('c.jpg')]);
    await harness.typeStory('Maya turns one at the lake');

    expect(await harness.isCreateEnabled()).toBe(true);
  });

  it('records the chosen tone', async () => {
    await harness.selectTone('Heartfelt');
    expect(story.tone()).toBe('heartfelt');
  });

  it('comes back showing the photos, story line and tone already picked', async () => {
    // What "Go back" from the error screen relies on (7.39): the picker renders
    // from the service, so returning to it restores the work with no
    // persistence of its own.
    story.addPhotos([imageFile('a.jpg'), imageFile('b.jpg'), imageFile('c.jpg')]);
    story.setStoryLine('Maya turns one at the lake');
    story.setTone('heartfelt');

    expect(await harness.photoCount()).toBe(3);
    expect(await harness.getStoryLine()).toBe('Maya turns one at the lake');
    expect(await harness.getSelectedTone()).toContain('Heartfelt');
  });

  it('starts generating when Create is clicked', async () => {
    story.addPhotos([imageFile('a.jpg'), imageFile('b.jpg'), imageFile('c.jpg')]);
    await harness.typeStory('A day at the lake');

    await harness.clickCreate();

    expect(story.phase()).toBe('generating');
  });

  describe('where the photos go (7.41)', () => {
    // The upload happens here, so the disclosure belongs here — the landing
    // footer is not where the user parts with their photos.
    it('names the third party the photos are sent to', async () => {
      expect(await harness.getPrivacyNote()).toContain('Google');
    });

    it('links to the privacy policy', async () => {
      expect(await harness.getPrivacyHref()).toBe('/privacy.html');
    });

    it('opens the policy without discarding the picked photos', async () => {
      // The picker holds photos, story line and tone in memory only. A
      // same-tab navigation would throw all of it away — the very loss 7.39
      // was written to prevent.
      expect(await harness.getPrivacyTarget()).toBe('_blank');
    });
  });

  describe('the fair-use allowance (7.36)', () => {
    const limits = (over: Partial<Limits> = {}): Limits => ({
      remaining: 2,
      limit: 2,
      resetAt: '2026-08-06T15:00:00.000Z',
      dayExhausted: false,
      ...over,
    });

    it('says nothing while the user is nowhere near the limit', async () => {
      story.setLimits(limits({ remaining: 2 }));
      expect(await harness.getLimitNote()).toBeNull();
    });

    it('still says nothing while the whole allowance is intact', async () => {
      story.setLimits(limits({ remaining: 2 }));
      expect(await harness.getLimitNote()).toBeNull();
    });

    it('says how many are left once it is close enough to matter', async () => {
      story.setLimits(limits({ remaining: 1 }));
      expect(await harness.getLimitNote()).toContain('1 more story');
    });

    it('reads as one story, not "1 stories"', async () => {
      story.setLimits(limits({ remaining: 1 }));
      expect(await harness.getLimitNote()).toContain('1 more story today');
    });

    it('says why, so the cap reads as fairness rather than a fault', async () => {
      story.setLimits(limits({ remaining: 1 }));
      expect(await harness.getLimitNote()).toContain('shared');
    });

    it('warns before the work when the shared day is already spent', async () => {
      story.setLimits(limits({ remaining: 2, dayExhausted: true }));
      expect(await harness.getLimitNote()).toContain('back tomorrow');
    });

    it('says nothing at all when the allowance could not be read', async () => {
      story.setLimits(null);
      expect(await harness.getLimitNote()).toBeNull();
    });
  });
});
