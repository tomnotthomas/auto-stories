import { TestBed } from '@angular/core/testing';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatToolbarHarness } from '@angular/material/toolbar/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';

describe('App', () => {
  async function setup(): Promise<{ app: App; loader: HarnessLoader }> {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    return { app: fixture.componentInstance, loader: TestbedHarnessEnvironment.loader(fixture) };
  }

  it('creates the app', async () => {
    const { app } = await setup();
    expect(app).toBeTruthy();
  });

  it('shows the app name in the toolbar', async () => {
    const { loader } = await setup();
    const toolbar = await loader.getHarness(MatToolbarHarness);
    expect((await toolbar.getRowsAsText()).join(' ')).toContain('Auto Stories');
  });
});
