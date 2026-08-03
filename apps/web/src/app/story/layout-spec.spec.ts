import {
  DEFAULT_SAFE_MARGIN_PCT,
  SIZE_RAMP,
  resolveLayout,
  type LayoutElement,
  type LayoutSpec,
} from './layout-spec';

/** A minimal element with sensible defaults; override per test. */
function element(over: Partial<LayoutElement> = {}): LayoutElement {
  return {
    role: 'title',
    text: 'Golden hour',
    font: 'inter',
    weight: 'bold',
    case: 'normal',
    align: 'left',
    size: 3,
    tracking: 'normal',
    leading: 'normal',
    x: 50,
    y: 50,
    anchor: 'center',
    ...over,
  };
}
const spec = (...elements: LayoutElement[]): LayoutSpec => ({ elements });

describe('resolveLayout', () => {
  it('has a monotonically increasing size ramp', () => {
    for (let i = 1; i < SIZE_RAMP.length; i++) {
      expect(SIZE_RAMP[i]).toBeGreaterThan(SIZE_RAMP[i - 1]);
    }
  });

  it('resolves a size index to its ramp multiplier and clamps out-of-range indices', () => {
    expect(resolveLayout(spec(element({ size: 2 })))[0].sizeScale).toBe(SIZE_RAMP[2]);
    expect(resolveLayout(spec(element({ size: -3 })))[0].sizeScale).toBe(SIZE_RAMP[0]);
    expect(resolveLayout(spec(element({ size: 99 })))[0].sizeScale).toBe(
      SIZE_RAMP[SIZE_RAMP.length - 1],
    );
  });

  it('clamps anchor points that fall outside the safe area', () => {
    const [r] = resolveLayout(spec(element({ x: 0, y: 100 })));
    expect(r.xPct).toBe(DEFAULT_SAFE_MARGIN_PCT);
    expect(r.yPct).toBe(100 - DEFAULT_SAFE_MARGIN_PCT);
    // A point already inside the safe area is left untouched.
    expect(resolveLayout(spec(element({ x: 40, y: 60 })))[0].xPct).toBe(40);
  });

  it('honours a custom safe margin', () => {
    const [r] = resolveLayout(spec(element({ x: 2, y: 2 })), 10);
    expect(r.xPct).toBe(10);
    expect(r.yPct).toBe(10);
    expect(r.maxWidthPct).toBe(80);
  });

  it('maps each anchor to a horizontal + vertical alignment', () => {
    const at = (anchor: LayoutElement['anchor']) => resolveLayout(spec(element({ anchor })))[0];
    expect(at('top-left')).toMatchObject({ hAlign: 'left', vAlign: 'top' });
    expect(at('bottom-right')).toMatchObject({ hAlign: 'right', vAlign: 'bottom' });
    expect(at('top')).toMatchObject({ hAlign: 'center', vAlign: 'top' });
    expect(at('left')).toMatchObject({ hAlign: 'left', vAlign: 'middle' });
    expect(at('center')).toMatchObject({ hAlign: 'center', vAlign: 'middle' });
  });

  it('stacks text into one line per word, and keeps a single line otherwise', () => {
    expect(
      resolveLayout(spec(element({ text: 'we drove till the', stack: true })))[0].lines,
    ).toEqual(['we', 'drove', 'till', 'the']);
    expect(resolveLayout(spec(element({ text: 'Golden hour', stack: false })))[0].lines).toEqual([
      'Golden hour',
    ]);
  });

  it('resolves the type tokens to CSS values', () => {
    const [r] = resolveLayout(
      spec(
        element({
          font: 'playfair',
          weight: 'bold',
          case: 'upper',
          align: 'right',
          tracking: 'wide',
          leading: 'tight',
        }),
      ),
    );
    expect(r.fontFamily).toContain('Fraunces'); // serif slot → bundled Fraunces
    expect(r.fontWeight).toBe(700);
    expect(r.textTransform).toBe('uppercase');
    expect(r.textAlign).toBe('right');
    expect(r.letterSpacingEm).toBeGreaterThan(0); // wide tracking
    expect(r.lineHeight).toBeLessThan(1); // tight leading
  });

  it('resolves every element in the spec, in order', () => {
    const resolved = resolveLayout(
      spec(element({ text: 'one' }), element({ text: 'two', stack: false })),
    );
    expect(resolved.map((r) => r.lines[0])).toEqual(['one', 'two']);
  });

  it('passes the accent + underline flags through, defaulting both to false', () => {
    const [on] = resolveLayout(spec(element({ accent: true, underline: true })));
    expect(on).toMatchObject({ accent: true, underline: true });
    const [off] = resolveLayout(spec(element()));
    expect(off).toMatchObject({ accent: false, underline: false });
  });
});
