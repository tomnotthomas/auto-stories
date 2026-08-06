import { SAMPLE_WINDOW, SLOW_FRAME_MS, shouldLighten } from './frame-budget';

/** `n` frames that each took `ms`. */
const frames = (n: number, ms: number): number[] => Array.from({ length: n }, () => ms);

describe('shouldLighten', () => {
  it('says nothing until it has watched enough frames', () => {
    expect(shouldLighten(frames(SAMPLE_WINDOW - 1, 60))).toBe(false);
  });

  it('leaves a device that is keeping up alone', () => {
    expect(shouldLighten(frames(SAMPLE_WINDOW, 16.7))).toBe(false);
  });

  it('sheds load on a device that cannot hold the frame budget', () => {
    expect(shouldLighten(frames(SAMPLE_WINDOW, 40))).toBe(true);
  });

  it('ignores a single stall — one long frame is a hiccup, not a verdict', () => {
    const mostlyFine = frames(SAMPLE_WINDOW - 1, 16.7).concat(400);
    expect(shouldLighten(mostlyFine)).toBe(false);
  });

  it('judges on the recent frames, not on how the screen started', () => {
    // A slow start that has since recovered must not shed.
    const recovered = frames(SAMPLE_WINDOW * 2, 60).concat(frames(SAMPLE_WINDOW, 16.7));
    expect(shouldLighten(recovered)).toBe(false);
  });

  it('sheds once half the recent frames miss the budget', () => {
    const half = frames(SAMPLE_WINDOW / 2, 16.7).concat(
      frames(SAMPLE_WINDOW / 2, SLOW_FRAME_MS + 5),
    );
    expect(shouldLighten(half)).toBe(true);
  });
});
