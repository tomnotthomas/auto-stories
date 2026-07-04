import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';

import { Create } from './create';
import { CreateHarness } from './create.harness';

/** Build a change Event whose target reports the given number of files. */
function pickEventWith(fileCount: number): Event {
  const files = { length: fileCount } as FileList;
  return { target: { files } } as unknown as Event;
}

describe('Create', () => {
  let fixture: ComponentFixture<Create>;
  let component: Create;
  let harness: CreateHarness;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Create],
    }).compileComponents();

    fixture = TestBed.createComponent(Create);
    component = fixture.componentInstance;
    harness = await TestbedHarnessEnvironment.harnessForFixture(fixture, CreateHarness);
  });

  it('prompts the visitor to start with their photos', async () => {
    expect(await harness.getHeadingText()).toContain('Start with your photos');
  });

  it('offers a photo-picker call-to-action', async () => {
    expect(await harness.getPickButtonText()).toBe('Choose photos');
  });

  it('shows no selection confirmation before any photos are picked', async () => {
    expect(await harness.getSelectedCountText()).toBeNull();
  });

  it('confirms how many photos were picked', async () => {
    component.onPhotosPicked(pickEventWith(3));

    expect(await harness.getSelectedCountText()).toBe('3 photos selected');
  });
});
