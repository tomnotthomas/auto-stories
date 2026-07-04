import { TestBed } from '@angular/core/testing';

import { StoryService } from './story.service';

describe('StoryService', () => {
  let service: StoryService;

  beforeEach(() => {
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

  it('can return to the example', () => {
    service.startCreating();
    service.reset();
    expect(service.phase()).toBe('example');
  });
});
