import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';

import { Create } from './create';
import { CreateHarness } from './create.harness';
import { StoryService } from '../../story/story.service';

describe('Create', () => {
  let harness: CreateHarness;
  let story: StoryService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Create],
    }).compileComponents();

    const fixture = TestBed.createComponent(Create);
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
});
