import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';

import { Generating } from './generating';
import { GeneratingHarness } from './generating.harness';

describe('Generating', () => {
  let harness: GeneratingHarness;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Generating],
    }).compileComponents();

    const fixture = TestBed.createComponent(Generating);
    harness = await TestbedHarnessEnvironment.harnessForFixture(fixture, GeneratingHarness);
  });

  it('tells the user the story is being built', async () => {
    expect(await harness.getHeadingText()).toContain('Building your story');
  });
});
