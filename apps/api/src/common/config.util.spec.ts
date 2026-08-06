import { positiveInt } from './config.util';

describe('positiveInt', () => {
  it('reads a configured number as a number', () => {
    expect(positiveInt(4000, 60)).toBe(4000);
  });

  it('reads the string an env var actually gives us', () => {
    // The defect this exists for: '4000' typed as number reached
    // AbortSignal.timeout() and threw TypeError on every generation.
    expect(positiveInt('4000', 60)).toBe(4000);
    expect(typeof positiveInt('4000', 60)).toBe('number');
  });

  it('falls back rather than accepting a value that would break the caller', () => {
    for (const bad of [undefined, null, '', ' ', 'lots', NaN, 0, -1, '-5']) {
      expect(positiveInt(bad, 60)).toBe(60);
    }
  });

  it('takes the whole part of a fractional setting', () => {
    expect(positiveInt('4000.9', 60)).toBe(4000);
  });
});
