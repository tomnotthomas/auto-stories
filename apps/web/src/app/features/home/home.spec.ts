import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';

import { Home } from './home';
import { HomeHarness } from './home.harness';

describe('Home', () => {
  let component: Home;
  let harness: HomeHarness;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
    }).compileComponents();

    const fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    harness = await TestbedHarnessEnvironment.harnessForFixture(fixture, HomeHarness);
  });

  it('shows the landing headline', async () => {
    expect(await harness.getHeadingText()).toContain('Turn your photos into a Story');
  });

  it('offers a call-to-action to start', async () => {
    expect(await harness.getCtaText()).toBe('Try it with your photos');
  });

  it('emits start when the call-to-action is clicked', async () => {
    let started = false;
    component.start.subscribe(() => (started = true));

    await harness.clickCta();

    expect(started).toBe(true);
  });
});
