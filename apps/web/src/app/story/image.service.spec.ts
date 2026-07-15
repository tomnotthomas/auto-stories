import { fitWithin, MAX_EDGE } from './image.service';

describe('fitWithin', () => {
  it('scales a landscape image so its long edge is the max', () => {
    // 4:3 source → long edge clamped to MAX_EDGE, short edge kept in proportion.
    expect(fitWithin(4000, 3000)).toEqual({ width: MAX_EDGE, height: 576 });
  });

  it('scales a portrait image so its long edge is the max', () => {
    expect(fitWithin(3000, 4000)).toEqual({ width: 576, height: MAX_EDGE });
  });

  it('scales a square image to the max on both sides', () => {
    expect(fitWithin(2000, 2000)).toEqual({ width: MAX_EDGE, height: MAX_EDGE });
  });

  it('never upscales an already-small image', () => {
    expect(fitWithin(600, 400)).toEqual({ width: 600, height: 400 });
  });

  it('leaves an image exactly at the max unchanged', () => {
    expect(fitWithin(MAX_EDGE, 500)).toEqual({ width: MAX_EDGE, height: 500 });
  });
});
