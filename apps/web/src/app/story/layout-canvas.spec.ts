import { drawLayout, LAYOUT_BASE_PX, type Ctx2D, type ElementColor } from './layout-canvas';
import { SIZE_RAMP, type LayoutElement, type LayoutSpec } from './layout-spec';

interface DrawnText {
  text: string;
  x: number;
  y: number;
  font: string;
  align: CanvasTextAlign;
  baseline: CanvasTextBaseline;
  fill: string;
}

/** A fake 2D context that records what drawLayout paints. measureText returns a
 * width proportional to the current font size, so wrapping is exercised. */
function fakeCtx() {
  const texts: DrawnText[] = [];
  // Text is painted with fillText; only the scrim rect uses fill(), so every
  // fill() call is one scrim.
  let scrimFills = 0;
  const ctx = {
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    fillStyle: '' as string,
    letterSpacing: '',
    fillText(text: string, x: number, y: number) {
      texts.push({
        text,
        x,
        y,
        font: this.font,
        align: this.textAlign,
        baseline: this.textBaseline,
        fill: this.fillStyle,
      });
    },
    measureText(text: string) {
      const px = Number(/(\d+)px/.exec(this.font)?.[1] ?? 16);
      return { width: text.length * px * 0.5 };
    },
    beginPath() {},
    moveTo() {},
    arcTo() {},
    closePath() {},
    fill() {
      scrimFills += 1;
    },
  };
  return { ctx: ctx as unknown as Ctx2D, texts, get scrimFills() { return scrimFills; } };
}

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
const white: ElementColor = { fill: '#fff' };

describe('drawLayout', () => {
  it('sets the font from the element weight and its ramp-scaled size', () => {
    const { ctx, texts } = fakeCtx();
    drawLayout(ctx, spec(element({ weight: 'bold', size: 3 })), 1080, 1920, () => white);
    const fontPx = Math.round(LAYOUT_BASE_PX * SIZE_RAMP[3]);
    expect(texts[0].font).toContain(`700 ${fontPx}px`);
    expect(texts[0].fill).toBe('#fff');
  });

  it('uses the anchor to set canvas alignment and baseline', () => {
    const { ctx, texts } = fakeCtx();
    drawLayout(ctx, spec(element({ anchor: 'bottom-right' })), 1080, 1920, () => white);
    expect(texts[0].align).toBe('right');
    expect(texts[0].baseline).toBe('top'); // block top computed from vAlign
  });

  it('positions the anchor point in pixels', () => {
    const { ctx, texts } = fakeCtx();
    drawLayout(ctx, spec(element({ x: 25, y: 10, anchor: 'top-left' })), 1000, 2000, () => white);
    expect(texts[0].x).toBe(250); // 25% of 1000
    expect(texts[0].y).toBe(200); // 10% of 2000, top-anchored
  });

  it('draws one line per word when the element is stacked', () => {
    const { ctx, texts } = fakeCtx();
    drawLayout(ctx, spec(element({ text: 'we drove till', stack: true })), 1080, 1920, () => white);
    expect(texts.map((t) => t.text)).toEqual(['we', 'drove', 'till']);
  });

  it('wraps a long single line to the element max width', () => {
    const { ctx, texts } = fakeCtx();
    const long = 'everyone made it out to the lake for the whole beautiful chaotic day';
    drawLayout(ctx, spec(element({ text: long, size: 4 })), 1080, 1920, () => white);
    expect(texts.length).toBeGreaterThan(1); // it wrapped
  });

  it('applies uppercase casing before drawing', () => {
    const { ctx, texts } = fakeCtx();
    drawLayout(ctx, spec(element({ text: 'golden', case: 'upper' })), 1080, 1920, () => white);
    expect(texts[0].text).toBe('GOLDEN');
  });

  it('draws a scrim rect only when the colour resolver asks for one', () => {
    const withScrim = fakeCtx();
    drawLayout(withScrim.ctx, spec(element()), 1080, 1920, () => ({ fill: '#fff', scrim: 'rgba(0,0,0,.4)' }));
    expect(withScrim.scrimFills).toBe(1);

    const noScrim = fakeCtx();
    drawLayout(noScrim.ctx, spec(element()), 1080, 1920, () => white);
    expect(noScrim.scrimFills).toBe(0);
  });

  it('draws every element in the spec', () => {
    const { ctx, texts } = fakeCtx();
    drawLayout(ctx, spec(element({ text: 'a' }), element({ text: 'b' })), 1080, 1920, () => white);
    expect(texts.map((t) => t.text)).toEqual(['a', 'b']);
  });
});
