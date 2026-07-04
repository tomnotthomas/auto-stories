import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { provideRouter } from '@angular/router';

import { Landing } from './landing';
import { LandingHarness } from './landing.harness';

describe('Landing', () => {
  let harness: LandingHarness;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Landing],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(Landing);
    harness = await TestbedHarnessEnvironment.harnessForFixture(fixture, LandingHarness);
  });

  it('leads with the product promise', async () => {
    expect(await harness.getHeadingText()).toContain('Your photos already have a story');
  });

  it('offers both ways in: the example and starting from your photos', async () => {
    expect(await harness.getCtaLabels()).toEqual(['See a live example', 'Start with my photos']);
  });
});
