import { DEFAULT_STYLE, normalizeStyle } from './caption-style';

describe('normalizeStyle', () => {
  it('passes a fully valid style through unchanged', () => {
    const style = {
      font: 'playfair',
      weight: 'bold',
      case: 'upper',
      align: 'left',
      size: 'l',
      position: 'top-right',
      letterbox: 'solid',
    };
    expect(normalizeStyle(style)).toEqual(style);
  });

  it('fills every field with a default when the model returns nothing', () => {
    expect(normalizeStyle(undefined)).toEqual(DEFAULT_STYLE);
    expect(normalizeStyle(null)).toEqual(DEFAULT_STYLE);
    expect(normalizeStyle({})).toEqual(DEFAULT_STYLE);
    expect(normalizeStyle('not an object')).toEqual(DEFAULT_STYLE);
  });

  it('replaces individual invalid values with their default, keeps valid ones', () => {
    const raw = {
      font: 'comic-sans', // invalid → default
      weight: 'bold', // valid → kept
      case: 'SHOUT', // invalid → default
      align: 'right', // valid → kept
      size: 'xl', // invalid → default
      position: 'middle', // invalid → default
      letterbox: 'blur', // valid → kept
    };
    expect(normalizeStyle(raw)).toEqual({
      font: DEFAULT_STYLE.font,
      weight: 'bold',
      case: DEFAULT_STYLE.case,
      align: 'right',
      size: DEFAULT_STYLE.size,
      position: DEFAULT_STYLE.position,
      letterbox: 'blur',
    });
  });

  it('ignores a wrongly-typed value (number/object) and uses the default', () => {
    expect(normalizeStyle({ font: 3, size: { s: true } })).toMatchObject({
      font: DEFAULT_STYLE.font,
      size: DEFAULT_STYLE.size,
    });
  });
});
