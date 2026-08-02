import { TestBed } from '@angular/core/testing';

import { ViewportService } from './viewport.service';

describe('ViewportService', () => {
  it('falls back to null height (CSS governs) when VisualViewport is unavailable', () => {
    // The test DOM has no window.visualViewport, so the service must degrade
    // gracefully rather than throw — callers then keep the CSS `dvh` height.
    const service = TestBed.inject(ViewportService);

    expect(service.height()).toBeNull();
    expect(service.mobile()).toBe(false);
  });
});
