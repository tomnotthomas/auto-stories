import { TestBed } from '@angular/core/testing';

import { MAX_PHOTOS, MAX_STORY_LENGTH, StoryService } from './story.service';

function imageFile(name = 'photo.jpg'): File {
  return new File(['bytes'], name, { type: 'image/jpeg' });
}

describe('StoryService', () => {
  let service: StoryService;

  beforeEach(() => {
    // jsdom has no object-URL support; stub it so photo state is testable.
    URL.createObjectURL = () => 'blob:mock';
    URL.revokeObjectURL = () => undefined;
    TestBed.configureTestingModule({});
    service = TestBed.inject(StoryService);
  });

  it('starts on the first-open example', () => {
    expect(service.phase()).toBe('example');
  });

  it('moves to the create step when the user starts', () => {
    service.startCreating();
    expect(service.phase()).toBe('create');
  });

  it('adds picked image files as photos', () => {
    service.addPhotos([imageFile('a.jpg'), imageFile('b.jpg')]);
    expect(service.photoCount()).toBe(2);
    expect(service.photos()[0].id).not.toBe(service.photos()[1].id);
  });

  it('ignores non-image files', () => {
    service.addPhotos([imageFile(), new File(['x'], 'notes.txt', { type: 'text/plain' })]);
    expect(service.photoCount()).toBe(1);
  });

  it('caps the number of photos at the maximum', () => {
    service.addPhotos(Array.from({ length: MAX_PHOTOS + 3 }, (_, i) => imageFile(`p${i}.jpg`)));
    expect(service.photoCount()).toBe(MAX_PHOTOS);
    expect(service.isFull()).toBe(true);
  });

  it('removes a photo by id', () => {
    service.addPhotos([imageFile('a.jpg'), imageFile('b.jpg')]);
    const [first] = service.photos();
    service.removePhoto(first.id);
    expect(service.photoCount()).toBe(1);
    expect(service.photos().some((p) => p.id === first.id)).toBe(false);
  });

  it('trims the story line to the soft max length', () => {
    service.setStoryLine('x'.repeat(MAX_STORY_LENGTH + 50));
    expect(service.storyLine().length).toBe(MAX_STORY_LENGTH);
  });

  it('sets and clears the optional tone', () => {
    service.setTone('heartfelt');
    expect(service.tone()).toBe('heartfelt');
    service.setTone(null);
    expect(service.tone()).toBeNull();
  });

  it('only allows generating with enough photos and a story line', () => {
    expect(service.canGenerate()).toBe(false);

    service.addPhotos([imageFile('a.jpg'), imageFile('b.jpg'), imageFile('c.jpg')]);
    expect(service.canGenerate()).toBe(false); // still no story line

    service.setStoryLine('Maya turns one at the lake');
    expect(service.canGenerate()).toBe(true);
  });

  it('moves to the generating screen on submit', () => {
    service.startGenerating();
    expect(service.phase()).toBe('generating');
  });

  it('clears photos, story, and tone on reset', () => {
    service.addPhotos([imageFile('a.jpg')]);
    service.setStoryLine('something');
    service.setTone('funny');

    service.reset();

    expect(service.phase()).toBe('example');
    expect(service.photoCount()).toBe(0);
    expect(service.storyLine()).toBe('');
    expect(service.tone()).toBeNull();
  });
});
