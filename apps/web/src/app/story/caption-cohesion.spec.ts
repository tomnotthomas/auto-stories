import { cohesionFilter } from './caption-cohesion';

/** Pull the number out of `brightness(x)`. */
function brightness(filter: string): number {
  const m = filter.match(/brightness\(([\d.]+)\)/);
  return m ? Number(m[1]) : NaN;
}

describe('cohesionFilter', () => {
  it('lightens a dark photo toward the shared mid, within the cap', () => {
    const b = brightness(cohesionFilter(0.2));
    expect(b).toBeGreaterThan(1);
    expect(b).toBeLessThanOrEqual(1.08);
  });

  it('dims a bright photo toward the shared mid, within the cap', () => {
    const b = brightness(cohesionFilter(0.85));
    expect(b).toBeLessThan(1);
    expect(b).toBeGreaterThanOrEqual(0.92);
  });

  it('leaves a mid-exposed photo untouched', () => {
    expect(cohesionFilter(0.5)).toBe('none');
  });

  it('is a no-op for an invalid measurement', () => {
    expect(cohesionFilter(0)).toBe('none');
    expect(cohesionFilter(-1)).toBe('none');
  });
});
