import { DISPLAY_MAX_EDGE, fitWithin, MAX_EDGE } from './image.service';

describe('DISPLAY_MAX_EDGE', () => {
  it('is smaller than a phone camera original but larger than a phone screen', () => {
    // Showing a 12MP original in a phone-sized box costs ~48MB of decoded
    // bitmap; this keeps the detail that shows and drops the rest.
    expect(DISPLAY_MAX_EDGE).toBeLessThan(2000);
    expect(DISPLAY_MAX_EDGE).toBeGreaterThan(1200);
  });

  it('scales a camera original down by roughly an order of magnitude in pixels', () => {
    const original = 4000 * 3000;
    const shown = fitWithin(4000, 3000, DISPLAY_MAX_EDGE);
    expect((shown.width * shown.height) / original).toBeLessThan(0.15);
  });
});

describe('fitWithin', () => {
  it('scales a landscape image so its long edge is the max', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: MAX_EDGE, height: 768 });
  });

  it('scales a portrait image so its long edge is the max', () => {
    expect(fitWithin(3000, 4000)).toEqual({ width: 768, height: MAX_EDGE });
  });

  it('scales a square image to the max on both sides', () => {
    expect(fitWithin(2000, 2000)).toEqual({ width: MAX_EDGE, height: MAX_EDGE });
  });

  it('never upscales an already-small image', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('leaves an image exactly at the max unchanged', () => {
    expect(fitWithin(MAX_EDGE, 500)).toEqual({ width: MAX_EDGE, height: 500 });
  });
});
