import { fitWithin, MAX_EDGE } from './image.service';

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
