import { drawComposition, PAPER, type CompositionColors, type Ctx2D } from './layout-canvas';
import {
  composeFrame,
  splitEmphasis,
  type Border,
  type Composition,
  type FrameContent,
  type Mark,
  type Panel,
  type Part,
  type PhotoAnalysis,
  type TagPart,
  type TextPart,
} from './look';

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
  /** Paint order, so a test can prove a mark went down before its letters. */
  at: number;
}

interface DrawnRect {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  alpha: number;
  at: number;
}

interface PathOp {
  op: string;
  args: number[];
}

/** One completed path, captured at the moment it was filled or stroked. */
interface DrawnPath {
  kind: 'fill' | 'stroke';
  style: string;
  alpha: number;
  lineWidth: number;
  shadow: string;
  ops: PathOp[];
  at: number;
}

/** Every transform call, in order — how a rotation is proved. */
interface Transform {
  op: 'save' | 'restore' | 'translate' | 'rotate';
  args: number[];
}

/** A fake 2D context that records what the renderer paints. measureText returns
 * a width proportional to the current font size, so wrapping is exercised. */
function fakeCtx() {
  const texts: DrawnText[] = [];
  const strokedTexts: DrawnText[] = [];
  const rects: DrawnRect[] = [];
  const paths: DrawnPath[] = [];
  const transforms: Transform[] = [];
  const gradientStops: string[] = [];
  let ops: PathOp[] = [];
  let seq = 0;

  const ctx = {
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    fillStyle: '' as string,
    globalAlpha: 1,
    strokeStyle: '' as string,
    lineWidth: 0,
    lineCap: 'butt' as CanvasLineCap,
    lineJoin: 'miter' as CanvasLineJoin,
    letterSpacing: '',
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    fillText(text: string, x: number, y: number) {
      texts.push({ text, x, y, font: this.font, fill: String(this.fillStyle), at: seq++ });
    },
    strokeText(text: string, x: number, y: number) {
      strokedTexts.push({ text, x, y, font: this.font, fill: String(this.strokeStyle), at: seq++ });
    },
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h, fill: String(this.fillStyle), alpha: this.globalAlpha, at: seq++ });
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
    beginPath() {
      ops = [];
    },
    moveTo(x: number, y: number) {
      ops.push({ op: 'moveTo', args: [x, y] });
    },
    lineTo(x: number, y: number) {
      ops.push({ op: 'lineTo', args: [x, y] });
    },
    bezierCurveTo(...args: number[]) {
      ops.push({ op: 'bezierCurveTo', args });
    },
    arcTo(...args: number[]) {
      ops.push({ op: 'arcTo', args });
    },
    closePath() {
      ops.push({ op: 'closePath', args: [] });
    },
    fill() {
      paths.push({
        kind: 'fill',
        style: String(this.fillStyle),
        alpha: this.globalAlpha,
        lineWidth: this.lineWidth,
        shadow: this.shadowColor,
        ops: [...ops],
        at: seq++,
      });
    },
    stroke() {
      paths.push({
        kind: 'stroke',
        style: String(this.strokeStyle),
        alpha: this.globalAlpha,
        lineWidth: this.lineWidth,
        shadow: this.shadowColor,
        ops: [...ops],
        at: seq++,
      });
    },
    save() {
      transforms.push({ op: 'save', args: [] });
    },
    restore() {
      transforms.push({ op: 'restore', args: [] });
    },
    translate(x: number, y: number) {
      transforms.push({ op: 'translate', args: [x, y] });
    },
    rotate(angle: number) {
      transforms.push({ op: 'rotate', args: [angle] });
    },
  };
  return {
    ctx: ctx as unknown as Ctx2D,
    texts,
    strokedTexts,
    rects,
    paths,
    transforms,
    gradientStops,
  };
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

const TYPE = {
  fontFamily: 'Helvetica, sans-serif',
  fontWeight: 600,
  fontSizeWPct: 5,
  lineHeight: 1.2,
  letterSpacingEm: 0,
  textTransform: 'none',
  textAlign: 'left',
  color: 'ink',
} as const;

/** A bare composition to hang one primitive under test off. */
function composition(over: Partial<Composition> = {}): Composition {
  return {
    lookId: 'minimal',
    ink: 'light',
    leftPct: 7,
    rightPct: 7,
    anchor: 'top',
    offsetHPct: 10,
    scrim: null,
    accent: COLORS.accent,
    parts: [text({ runs: [{ text: 'Hello world' }] })],
    ...over,
  };
}

function text(over: Partial<TextPart> = {}): TextPart {
  return { kind: 'text', ...TYPE, runs: [{ text: 'Hello' }], gapHPct: 0, ...over };
}

/** A headline with `emphasis` marked, so a mark has something to draw on. */
function marked(mark: Mark): Part {
  return text({ runs: splitEmphasis('a big word here', 'big'), mark, fontSizeWPct: 8 });
}

function tag(over: Partial<TagPart> = {}): TagPart {
  return { kind: 'tag', ...TYPE, text: 'Zermatt', style: 'pill', gapHPct: 0, ...over };
}

const PANEL: Panel = {
  color: 'paper',
  opacity: 1,
  padWPct: 4,
  padHPct: 2,
  radiusWPct: 2,
  fullWidth: false,
};

const BORDER: Border = { insetWPct: 4, widthWPct: 1, color: 'ink', radiusWPct: 0 };

/** The rectangle a path covers — for a rounded rect this is the rect itself. */
function bbox(path: DrawnPath): { x: number; y: number; w: number; h: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const { args } of path.ops) {
    for (let i = 0; i + 1 < args.length; i += 2) {
      xs.push(args[i]);
      ys.push(args[i + 1]);
    }
  }
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function fills(paths: DrawnPath[]): DrawnPath[] {
  return paths.filter((p) => p.kind === 'fill');
}

function strokes(paths: DrawnPath[]): DrawnPath[] {
  return paths.filter((p) => p.kind === 'stroke');
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
    const composed = magazine();
    const headline = composed.parts.find(
      (part): part is Extract<Composition['parts'][number], { kind: 'text' }> =>
        part.kind === 'text' && part.fontSizeWPct > 5,
    );

    drawComposition(ctx, composed, WIDTH, HEIGHT, COLORS);

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
    const composed = composeFrame(
      'magazine-masthead',
      { headline: 'Where the mountain meets its mirror' },
      { accent: COLORS.accent, bands: { top: 0.05, middle: 0.05, bottom: 0.95 } },
    );

    drawComposition(ctx, composed, WIDTH, HEIGHT, COLORS);

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
    const withMark = fakeCtx();
    const plain = fakeCtx();
    const accentRects = (rects: DrawnRect[]): DrawnRect[] =>
      rects.filter((r) => r.fill === COLORS.accent);

    drawComposition(withMark.ctx, magazine({ emphasis: 'mountain' }), WIDTH, HEIGHT, COLORS);
    drawComposition(plain.ctx, magazine(), WIDTH, HEIGHT, COLORS);

    expect(accentRects(withMark.rects).length).toBeGreaterThan(accentRects(plain.rects).length);
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

  describe('paper', () => {
    it('paints a paper part in the fixed paper tone, not the ink', () => {
      const { ctx, rects } = fakeCtx();
      const composed = composition({
        parts: [
          { kind: 'rule', gapHPct: 0, thicknessHPct: 1, widthPct: 100, opacity: 1, color: 'paper' },
        ],
      });

      drawComposition(ctx, composed, WIDTH, HEIGHT, COLORS);

      expect(rects.some((r) => r.fill === PAPER)).toBe(true);
    });
  });

  describe('panel', () => {
    it('fills a panel behind the type, padded around it', () => {
      const { ctx, paths, texts } = fakeCtx();

      drawComposition(ctx, composition({ panel: PANEL }), WIDTH, HEIGHT, COLORS);

      const panel = fills(paths).find((p) => p.style === PAPER);
      expect(panel).toBeDefined();
      const box = bbox(panel as DrawnPath);
      const padW = (WIDTH * PANEL.padWPct) / 100;
      // Padded out from the type column on both sides…
      expect(box.x).toBeCloseTo((WIDTH * 7) / 100 - padW, 5);
      expect(box.w).toBeCloseTo(WIDTH * 0.86 + padW * 2, 5);
      // …and clearing the type it sits behind, top and bottom.
      const top = Math.min(...texts.map((t) => t.y));
      expect(box.y).toBeLessThan(top);
      expect(box.y + box.h).toBeGreaterThan(top);
    });

    it('runs a full-width panel edge to edge, ignoring the column insets', () => {
      const { ctx, paths } = fakeCtx();
      const panel: Panel = { ...PANEL, fullWidth: true };

      drawComposition(ctx, composition({ panel }), WIDTH, HEIGHT, COLORS);

      const box = bbox(fills(paths).find((p) => p.style === PAPER) as DrawnPath);
      expect(box.x).toBe(0);
      expect(box.w).toBe(WIDTH);
    });

    it('paints the panel at the opacity the Look asked for', () => {
      const { ctx, paths } = fakeCtx();

      drawComposition(
        ctx,
        composition({ panel: { ...PANEL, opacity: 0.5 } }),
        WIDTH,
        HEIGHT,
        COLORS,
      );

      expect(fills(paths).find((p) => p.style === PAPER)?.alpha).toBe(0.5);
    });

    it('draws the panel under the type, not over it', () => {
      const { ctx, paths, texts } = fakeCtx();

      drawComposition(ctx, composition({ panel: PANEL }), WIDTH, HEIGHT, COLORS);

      const panel = fills(paths).find((p) => p.style === PAPER) as DrawnPath;
      expect(panel.at).toBeLessThan(Math.min(...texts.map((t) => t.at)));
    });

    it('draws nothing at all for a composition with no parts and no panel', () => {
      const { ctx, texts, rects, paths } = fakeCtx();

      drawComposition(ctx, composition({ parts: [] }), WIDTH, HEIGHT, COLORS);

      expect(texts).toHaveLength(0);
      expect(rects).toHaveLength(0);
      expect(paths).toHaveLength(0);
    });

    it('drops the panel when there is no stack to sit behind', () => {
      const { ctx, paths } = fakeCtx();

      drawComposition(ctx, composition({ parts: [], panel: PANEL }), WIDTH, HEIGHT, COLORS);

      expect(paths).toHaveLength(0);
    });
  });

  describe('border', () => {
    it('strokes an inset frame around the whole frame', () => {
      const { ctx, paths } = fakeCtx();

      drawComposition(ctx, composition({ border: BORDER }), WIDTH, HEIGHT, COLORS);

      const border = strokes(paths).find((p) => p.style === COLORS.ink);
      expect(border).toBeDefined();
      const inset = (WIDTH * BORDER.insetWPct) / 100;
      const box = bbox(border as DrawnPath);
      expect(box.x).toBeCloseTo(inset, 5);
      expect(box.y).toBeCloseTo(inset, 5);
      expect(box.w).toBeCloseTo(WIDTH - inset * 2, 5);
      expect(box.h).toBeCloseTo(HEIGHT - inset * 2, 5);
      expect(border?.lineWidth).toBeCloseTo((WIDTH * BORDER.widthWPct) / 100, 5);
    });

    it('draws no border when the Look does not ask for one', () => {
      const { ctx, paths } = fakeCtx();

      drawComposition(ctx, composition(), WIDTH, HEIGHT, COLORS);

      expect(strokes(paths)).toHaveLength(0);
    });
  });

  describe('rotation', () => {
    it('rotates the stack about its own centre and restores the context', () => {
      const { ctx, transforms } = fakeCtx();

      drawComposition(ctx, composition({ rotationDeg: 6 }), WIDTH, HEIGHT, COLORS);

      expect(transforms.map((t) => t.op)).toEqual([
        'save',
        'translate',
        'rotate',
        'translate',
        'restore',
      ]);
      const [, to, rotate, back] = transforms;
      expect(rotate.args[0]).toBeCloseTo((6 * Math.PI) / 180, 10);
      // Pivot in, rotate, pivot back out — so the stack turns in place.
      expect(back.args).toEqual([-to.args[0], -to.args[1]]);
      // The pivot is the centre of the type column, not the frame.
      expect(to.args[0]).toBeCloseTo(WIDTH / 2, 5);
    });

    it('leaves the transform alone when nothing is rotated', () => {
      const { ctx, transforms } = fakeCtx();

      drawComposition(ctx, composition(), WIDTH, HEIGHT, COLORS);

      expect(transforms).toHaveLength(0);
    });

    it('keeps the border square to the frame while the stack tilts', () => {
      const { ctx, paths, transforms } = fakeCtx();

      drawComposition(ctx, composition({ rotationDeg: 6, border: BORDER }), WIDTH, HEIGHT, COLORS);

      const border = strokes(paths).find((p) => p.style === COLORS.ink) as DrawnPath;
      const restoredAt = transforms.findIndex((t) => t.op === 'restore');
      expect(restoredAt).toBeGreaterThanOrEqual(0);
      // The border path is traced after the rotation has been unwound.
      expect(bbox(border).x).toBeCloseTo((WIDTH * BORDER.insetWPct) / 100, 5);
    });
  });

  describe('tags', () => {
    it('outlines a pill in the part colour and sets its text in the same', () => {
      const { ctx, paths, texts } = fakeCtx();

      drawComposition(ctx, composition({ parts: [tag({ style: 'pill' })] }), WIDTH, HEIGHT, COLORS);

      const pill = strokes(paths)[0];
      expect(pill.style).toBe(COLORS.ink);
      // Fully rounded: the radius is half the box height.
      expect(pill.ops.some((op) => op.op === 'arcTo')).toBe(true);
      expect(allText(texts)).toContain('Zermatt');
      expect(texts[0].fill).toBe(COLORS.ink);
      // The box clears the type it wraps.
      expect(bbox(pill).h).toBeGreaterThan(0);
    });

    it('fills tape in paper, with dark text and a shadow', () => {
      const { ctx, paths, texts } = fakeCtx();

      drawComposition(ctx, composition({ parts: [tag({ style: 'tape' })] }), WIDTH, HEIGHT, COLORS);

      const tape = fills(paths)[0];
      expect(tape.style).toBe(PAPER);
      expect(tape.shadow).not.toBe('');
      expect(tape.shadow).not.toBe('rgba(0, 0, 0, 0)');
      // Dark text on the paper, whatever the frame's ink happens to be.
      expect(texts[0].fill).not.toBe(COLORS.ink);
      expect(texts[0].fill).not.toBe(PAPER);
    });

    it('clears the shadow again so the rest of the stack is not smeared', () => {
      const { ctx, paths } = fakeCtx();
      const parts: Part[] = [tag({ style: 'tape' }), tag({ style: 'chip', gapHPct: 2 })];

      drawComposition(ctx, composition({ parts }), WIDTH, HEIGHT, COLORS);

      const chip = fills(paths).find((p) => p.style === COLORS.accent);
      expect(chip?.shadow).toBe('rgba(0, 0, 0, 0)');
    });

    it('draws a stamp outlined and rotated in the accent', () => {
      const { ctx, paths, texts, transforms } = fakeCtx();

      drawComposition(
        ctx,
        composition({ parts: [tag({ style: 'stamp' })] }),
        WIDTH,
        HEIGHT,
        COLORS,
      );

      expect(strokes(paths)[0].style).toBe(COLORS.accent);
      expect(texts[0].fill).toBe(COLORS.accent);
      expect(transforms.some((t) => t.op === 'rotate' && t.args[0] !== 0)).toBe(true);
    });

    it('fills a chip in the accent with the type reversed out of it', () => {
      const { ctx, paths, texts } = fakeCtx();

      drawComposition(ctx, composition({ parts: [tag({ style: 'chip' })] }), WIDTH, HEIGHT, COLORS);

      expect(fills(paths)[0].style).toBe(COLORS.accent);
      expect(texts[0].fill).toBe(PAPER);
    });

    it('honours a tag rotation the Look states outright', () => {
      const { ctx, transforms } = fakeCtx();
      const parts: Part[] = [tag({ style: 'pill', rotationDeg: -12 })];

      drawComposition(ctx, composition({ parts }), WIDTH, HEIGHT, COLORS);

      const rotate = transforms.find((t) => t.op === 'rotate');
      expect(rotate?.args[0]).toBeCloseTo((-12 * Math.PI) / 180, 10);
    });

    it('draws nothing for a tag with no words', () => {
      const { ctx, paths, texts } = fakeCtx();

      drawComposition(ctx, composition({ parts: [tag({ text: '  ' })] }), WIDTH, HEIGHT, COLORS);

      expect(texts).toHaveLength(0);
      expect(paths).toHaveLength(0);
    });
  });

  describe('stroked type', () => {
    it('outlines the letters instead of filling them', () => {
      const { ctx, texts, strokedTexts } = fakeCtx();
      const parts: Part[] = [text({ runs: [{ text: 'Stencil' }], stroke: true })];

      drawComposition(ctx, composition({ parts }), WIDTH, HEIGHT, COLORS);

      expect(allText(strokedTexts)).toContain('Stencil');
      expect(allText(texts)).not.toContain('Stencil');
      expect(strokedTexts[0].fill).toBe(COLORS.ink);
    });
  });

  describe('marks', () => {
    it('reverses the type out of an accent block', () => {
      const { ctx, texts, rects } = fakeCtx();

      drawComposition(ctx, composition({ parts: [marked('accent-block')] }), WIDTH, HEIGHT, COLORS);

      const block = rects.find((r) => r.fill === COLORS.accent);
      expect(block).toBeDefined();
      const word = texts.find((t) => t.text === 'big');
      expect(word?.fill).toBe(PAPER);
      // The block goes down first, so the letters land on top of it.
      expect(block?.at).toBeLessThan(word?.at ?? -1);
      // …and the plain runs keep the ink.
      expect(texts.find((t) => t.text.trim() === 'a')?.fill).toBe(COLORS.ink);
    });

    it('swipes a translucent highlighter under the words, not over them', () => {
      const { ctx, texts, rects } = fakeCtx();

      drawComposition(ctx, composition({ parts: [marked('highlighter')] }), WIDTH, HEIGHT, COLORS);

      const swipe = rects.find((r) => r.fill === COLORS.accent);
      expect(swipe).toBeDefined();
      expect(swipe?.alpha).toBeGreaterThan(0);
      expect(swipe?.alpha).toBeLessThan(1);
      const word = texts.find((t) => t.text === 'big');
      expect(swipe?.at).toBeLessThan(word?.at ?? -1);
      // The word itself is untouched — a marker does not reverse type.
      expect(word?.fill).toBe(COLORS.ink);
      // Thick enough to read as a pen, and struck through the word.
      expect(swipe?.h).toBeGreaterThan(0);
    });

    it('draws a hand underline as a loose curve, never a straight bar', () => {
      const { ctx, paths } = fakeCtx();

      drawComposition(
        ctx,
        composition({ parts: [marked('hand-underline')] }),
        WIDTH,
        HEIGHT,
        COLORS,
      );

      const stroke = strokes(paths)[0];
      expect(stroke.style).toBe(COLORS.accent);
      expect(stroke.ops.some((op) => op.op === 'bezierCurveTo')).toBe(true);
      // Uneven: the curve does not sit at one single height.
      const ys = stroke.ops.flatMap((op) => op.args.filter((_, i) => i % 2 === 1));
      expect(new Set(ys.map((y) => y.toFixed(3))).size).toBeGreaterThan(1);
    });

    it('wobbles the same way every time it is drawn', () => {
      const first = fakeCtx();
      const second = fakeCtx();
      const composed = composition({ parts: [marked('hand-underline')] });

      drawComposition(first.ctx, composed, WIDTH, HEIGHT, COLORS);
      drawComposition(second.ctx, composed, WIDTH, HEIGHT, COLORS);

      expect(strokes(second.paths)[0].ops).toEqual(strokes(first.paths)[0].ops);
    });

    it('marks nothing when no run is emphasised', () => {
      const { ctx, rects, paths } = fakeCtx();
      const parts: Part[] = [text({ runs: [{ text: 'a big word here' }], mark: 'accent-block' })];

      drawComposition(ctx, composition({ parts }), WIDTH, HEIGHT, COLORS);

      expect(rects).toHaveLength(0);
      expect(paths).toHaveLength(0);
    });
  });

  describe('bad input', () => {
    it('never throws, whatever the composition holds', () => {
      const { ctx } = fakeCtx();
      const parts: Part[] = [
        text({ runs: [], fontSizeWPct: 0 }),
        text({ runs: [{ text: '' }], mark: 'hand-underline' }),
        tag({ style: 'stamp', fontSizeWPct: 0 }),
      ];
      const composed = composition({
        parts,
        rotationDeg: Number.NaN,
        panel: { ...PANEL, opacity: Number.NaN, padWPct: -50, radiusWPct: 500 },
        border: { ...BORDER, insetWPct: 90, widthWPct: -4, radiusWPct: 400 },
      });

      expect(() => drawComposition(ctx, composed, WIDTH, HEIGHT, COLORS)).not.toThrow();
      expect(() => drawComposition(ctx, composed, 0, 0, COLORS)).not.toThrow();
    });
  });
});
