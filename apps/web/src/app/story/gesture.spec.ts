import { swipeDismissed, DEFAULT_SWIPE } from './gesture';

describe('swipeDismissed', () => {
  it('dismisses a slow drag once it passes the distance threshold', () => {
    expect(swipeDismissed(DEFAULT_SWIPE.distance + 1, 5000)).toBe(true);
  });

  it('keeps a short, slow drag (neither far nor fast)', () => {
    expect(swipeDismissed(20, 5000)).toBe(false);
  });

  it('dismisses a short but fast flick (velocity beats distance)', () => {
    // 30px in 100ms → 0.3 px/ms, above the 0.11 flick threshold.
    expect(swipeDismissed(30, 100)).toBe(true);
  });

  it('does not divide by zero on a zero-duration gesture', () => {
    expect(swipeDismissed(20, 0)).toBe(false);
    expect(swipeDismissed(DEFAULT_SWIPE.distance, 0)).toBe(true);
  });

  it('treats left and right swipes the same (magnitude, not sign)', () => {
    expect(swipeDismissed(-30, 100)).toBe(true);
  });
});
