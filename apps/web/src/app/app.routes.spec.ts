import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from './app.routes';
import { Landing } from './features/landing/landing';
import { Example } from './features/example/example';
import { Create } from './features/create/create';

describe('app routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });

  it('serves the landing page at the root', async () => {
    const harness = await RouterTestingHarness.create();
    const activated = await harness.navigateByUrl('/');

    expect(activated).toBeInstanceOf(Landing);
  });

  it('serves the example at /example', async () => {
    const harness = await RouterTestingHarness.create();
    const activated = await harness.navigateByUrl('/example');

    expect(activated).toBeInstanceOf(Example);
  });

  it('serves the create flow at /create', async () => {
    const harness = await RouterTestingHarness.create();
    const activated = await harness.navigateByUrl('/create');

    expect(activated).toBeInstanceOf(Create);
  });

  it('falls back to the landing page for an unknown route', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/nonsense');

    expect(TestBed.inject(Router).url).toBe('/');
  });
});
