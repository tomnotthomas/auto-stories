import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';

import { Create } from './create';
import { CreateHarness } from './create.harness';
import { StoryService } from '../../story/story.service';

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

  it('starts generating when Create is clicked', async () => {
    story.addPhotos([imageFile('a.jpg'), imageFile('b.jpg'), imageFile('c.jpg')]);
    await harness.typeStory('A day at the lake');

    await harness.clickCreate();

    expect(story.phase()).toBe('generating');
  });
});
