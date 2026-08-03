import { drawComposition, type CompositionColors, type Ctx2D } from './layout-canvas';
import { composeFrame, type Composition, type FrameContent, type PhotoAnalysis } from './look';

const WIDTH = 1080;
const HEIGHT = 1920;

const COLORS: CompositionColors = { ink: '#ffffff', accent: 'rgb(232, 102, 58)' };

const CALM: PhotoAnalysis = {
  accent: COLORS.accent,
  bands: { top: 0.1, middle: 0.1, bottom: 0.1 },
};

interface DrawnText {
  text: string;
  x: number;
  y: number;
  font: string;
  fill: string;
}

interface DrawnRect {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}

/** A fake 2D context that records what the renderer paints. measureText returns
 * a width proportional to the current font size, so wrapping is exercised. */
function fakeCtx() {
  const texts: DrawnText[] = [];
  const rects: DrawnRect[] = [];
  const gradientStops: string[] = [];
  const ctx = {
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    fillStyle: '' as string,
    globalAlpha: 1,
    strokeStyle: '' as string,
    lineWidth: 0,
    lineCap: 'butt' as CanvasLineCap,
    letterSpacing: '',
    fillText(text: string, x: number, y: number) {
      texts.push({ text, x, y, font: this.font, fill: String(this.fillStyle) });
    },
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h, fill: String(this.fillStyle) });
    },
    measureText(text: string) {
      const px = Number(/(\d+)px/.exec(this.font)?.[1] ?? 16);
      return { width: text.length * px * 0.5 };
    },
    createLinearGradient() {
      return {
        addColorStop(_offset: number, color: string) {
          gradientStops.push(color);
        },
      } as unknown as CanvasGradient;
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    bezierCurveTo() {},
    arcTo() {},
    closePath() {},
    fill() {},
    stroke() {},
  };
  return { ctx: ctx as unknown as Ctx2D, texts, rects, gradientStops };
}

/** The Magazine composition — the one Look P1 ships. */
function magazine(over: Partial<FrameContent> = {}): Composition {
  return composeFrame(
    'magazine-masthead',
    { kicker: 'The Ascent', headline: 'Where the mountain meets its mirror', ...over },
    CALM,
  );
}

/** Every string painted with fillText, joined. */
function allText(texts: DrawnText[]): string {
  return texts.map((t) => t.text).join(' ');
}

describe('drawComposition', () => {
  it('draws every word of the headline', () => {
    const { ctx, texts } = fakeCtx();

    drawComposition(ctx, magazine(), WIDTH, HEIGHT, COLORS);

    for (const word of ['Where', 'mountain', 'mirror']) {
      expect(allText(texts)).toContain(word);
    }
  });

  it('draws the kicker uppercased, as the Look asks', () => {
    const { ctx, texts } = fakeCtx();

    drawComposition(ctx, magazine(), WIDTH, HEIGHT, COLORS);

    expect(allText(texts)).toContain('THE ASCENT');
  });

  it('sizes type as a share of the frame width', () => {
    const { ctx, texts } = fakeCtx();
    const composition = magazine();
    const headline = composition.parts.find(
      (part): part is Extract<Composition['parts'][number], { kind: 'text' }> =>
        part.kind === 'text' && part.fontSizeWPct > 5,
    );

    drawComposition(ctx, composition, WIDTH, HEIGHT, COLORS);

    const expected = Math.round((WIDTH * (headline?.fontSizeWPct ?? 0)) / 100);
    expect(texts.some((t) => t.font.includes(`${expected}px`))).toBe(true);
  });

  it('paints text in the ink colour it was given', () => {
    const { ctx, texts } = fakeCtx();

    drawComposition(ctx, magazine(), WIDTH, HEIGHT, { ink: '#123456', accent: '#abcdef' });

    expect(texts.every((t) => t.fill === '#123456')).toBe(true);
  });

  it('keeps the whole stack inside the frame', () => {
    const { ctx, texts } = fakeCtx();

    drawComposition(ctx, magazine(), WIDTH, HEIGHT, COLORS);

    for (const drawn of texts) {
      expect(drawn.y).toBeGreaterThanOrEqual(0);
      expect(drawn.y).toBeLessThan(HEIGHT);
      expect(drawn.x).toBeGreaterThanOrEqual(0);
    }
  });

  it('hangs the stack off the bottom when the photo allows it', () => {
    const { ctx, texts } = fakeCtx();

    drawComposition(ctx, magazine(), WIDTH, HEIGHT, COLORS);

    expect(Math.min(...texts.map((t) => t.y))).toBeGreaterThan(HEIGHT / 2);
  });

  it('moves the stack up when the bottom of the photo is busy', () => {
    const { ctx, texts } = fakeCtx();
    const composition = composeFrame(
      'magazine-masthead',
      { headline: 'Where the mountain meets its mirror' },
      { accent: COLORS.accent, bands: { top: 0.05, middle: 0.05, bottom: 0.95 } },
    );

    drawComposition(ctx, composition, WIDTH, HEIGHT, COLORS);

    expect(Math.min(...texts.map((t) => t.y))).toBeLessThan(HEIGHT / 2);
  });

  it('wraps a long headline onto more lines than a short one', () => {
    const short = fakeCtx();
    const long = fakeCtx();

    drawComposition(short.ctx, magazine({ headline: 'Short' }), WIDTH, HEIGHT, COLORS);
    drawComposition(
      long.ctx,
      magazine({ headline: 'one two three four five six seven eight nine ten' }),
      WIDTH,
      HEIGHT,
      COLORS,
    );

    expect(long.texts.length).toBeGreaterThan(short.texts.length);
  });

  it('paints the accent bar under the emphasised phrase only', () => {
    const marked = fakeCtx();
    const plain = fakeCtx();
    const accentRects = (rects: DrawnRect[]): DrawnRect[] =>
      rects.filter((r) => r.fill === COLORS.accent);

    drawComposition(marked.ctx, magazine({ emphasis: 'mountain' }), WIDTH, HEIGHT, COLORS);
    drawComposition(plain.ctx, magazine(), WIDTH, HEIGHT, COLORS);

    expect(accentRects(marked.rects).length).toBeGreaterThan(accentRects(plain.rects).length);
  });

  it('draws the masthead rule', () => {
    const { ctx, rects } = fakeCtx();

    drawComposition(ctx, magazine(), WIDTH, HEIGHT, COLORS);

    // A rule is a wide, very short bar in the ink colour.
    expect(rects.some((r) => r.fill === COLORS.ink && r.w > WIDTH / 2 && r.h < 20)).toBe(true);
  });

  it('lays a scrim gradient behind the type', () => {
    const { ctx, gradientStops } = fakeCtx();

    drawComposition(ctx, magazine(), WIDTH, HEIGHT, COLORS);

    expect(gradientStops.length).toBeGreaterThan(0);
    expect(gradientStops[gradientStops.length - 1]).toContain('rgba(0, 0, 0, 0)');
  });

  it('draws the byline row when the frame names a place', () => {
    const { ctx, texts } = fakeCtx();

    drawComposition(ctx, magazine({ location: 'Zermatt' }), WIDTH, HEIGHT, COLORS);

    expect(allText(texts)).toContain('ZERMATT');
  });

  it('omits the byline row when there is no place', () => {
    const { ctx, texts } = fakeCtx();

    drawComposition(ctx, magazine(), WIDTH, HEIGHT, COLORS);

    expect(allText(texts)).not.toContain('ZERMATT');
  });

  it('draws no type for an empty part list', () => {
    const { ctx, texts } = fakeCtx();

    drawComposition(ctx, { ...magazine(), parts: [], scrim: null }, WIDTH, HEIGHT, COLORS);

    expect(texts).toHaveLength(0);
  });
});
