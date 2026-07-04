import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { provideRouter } from '@angular/router';

import { Example } from './example';
import { ExampleHarness } from './example.harness';

describe('Example', () => {
  let harness: ExampleHarness;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Example],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(Example);
    harness = await TestbedHarnessEnvironment.harnessForFixture(fixture, ExampleHarness);
  });

  it('introduces the finished example Story', async () => {
    expect(await harness.getHeadingText()).toContain('finished Story');
  });

  it('offers a call-to-action to start with your own photos', async () => {
    expect(await harness.getCtaText()).toBe('Start with my photos');
  });
});
