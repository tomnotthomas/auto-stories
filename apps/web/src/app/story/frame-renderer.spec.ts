import { renderFrame } from './frame-renderer';
import { composeFrame, type PhotoAnalysis } from './look';
import { DEFAULT_STYLE } from './caption-style';
import { DEFAULT_PLACEMENT, type EditableFrame } from './story.service';

/**
 * Export regression (decision 7.24). Once Looks are the only renderer, a frame
 * that fails to compose or draw is a blank PNG — the user's whole story. These
 * tests drive `renderFrame` through both paths (a composed frame and the
 * caption fallback) and assert it produces an image without throwing.
 *
 * jsdom has no canvas, so `OffscreenCanvas` and `createImageBitmap` are stubbed
 * here: this covers the wiring and the draw calls, not the encoded pixels. That
 * the PNG is genuinely valid is verified in a real browser against the sample
 * photos, which is the only place it can be.
 */

const CALM: PhotoAnalysis = {
  accent: 'rgb(232, 102, 58)',
  bands: { top: 0.1, middle: 0.1, bottom: 0.1 },
};

const PNG = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });

/** Records what the renderer painted, so a silently-empty frame fails. */
interface Recorder {
  fillTextCalls: number;
  fillRectCalls: number;
}

function stubCanvas(recorder: Recorder): void {
  const ctx = {
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    letterSpacing: '',
    lineWidth: 0,
    lineCap: 'butt',
    filter: 'none',
    fillText: () => {
      recorder.fillTextCalls += 1;
    },
    fillRect: () => {
      recorder.fillRectCalls += 1;
    },
    measureText: (text: string) => ({ width: text.length * 20 }),
    drawImage: () => undefined,
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    bezierCurveTo: () => undefined,
    arcTo: () => undefined,
    closePath: () => undefined,
    fill: () => undefined,
    stroke: () => undefined,
    save: () => undefined,
    restore: () => undefined,
  };

  const globals = globalThis as unknown as Record<string, unknown>;
  globals['OffscreenCanvas'] = class {
    getContext(): unknown {
      return ctx;
    }
    convertToBlob(): Promise<Blob> {
      return Promise.resolve(PNG);
    }
  };
  globals['createImageBitmap'] = (): Promise<unknown> =>
    Promise.resolve({ width: 1080, height: 1920, close: () => undefined });
}

function frame(over: Partial<EditableFrame> = {}): EditableFrame {
  return {
    photoId: 'p1',
    order: 1,
    caption: 'Where the mountain meets its mirror',
    headline: 'Where the mountain meets its mirror',
    style: DEFAULT_STYLE,
    placement: DEFAULT_PLACEMENT,
    legibility: true,
    light: true,
    imageFilter: 'none',
    extraTexts: [],
    ...over,
  };
}

describe('renderFrame', () => {
  let recorder: Recorder;

  beforeEach(() => {
    recorder = { fillTextCalls: 0, fillRectCalls: 0 };
    stubCanvas(recorder);
  });

  const file = new File([new Uint8Array([1, 2, 3])], 'p1.jpg', { type: 'image/jpeg' });

  it('exports a PNG for a composed frame', async () => {
    const composition = composeFrame(
      'magazine-masthead',
      { kicker: 'The Ascent', headline: 'Where the mountain meets its mirror', emphasis: 'mountain' },
      CALM,
    );

    const blob = await renderFrame(file, frame({ composition, accent: CALM.accent }));

    expect(blob.type).toBe('image/png');
    expect(recorder.fillTextCalls).toBeGreaterThan(0);
  });

  it('exports a PNG through the caption fallback when nothing composed', async () => {
    const blob = await renderFrame(file, frame());

    expect(blob.type).toBe('image/png');
    expect(recorder.fillTextCalls).toBeGreaterThan(0);
  });

  it('exports a PNG for a Look that is not built yet, via the default Look', async () => {
    const composition = composeFrame('scrapbook', { headline: 'Everyone made it' }, CALM);

    const blob = await renderFrame(file, frame({ composition }));

    expect(blob.type).toBe('image/png');
    expect(recorder.fillTextCalls).toBeGreaterThan(0);
  });

  it('exports a PNG when the photo is busy everywhere', async () => {
    const composition = composeFrame('magazine-masthead', { headline: 'A hard frame' }, {
      accent: CALM.accent,
      bands: { top: 0.98, middle: 0.98, bottom: 0.98 },
    });

    const blob = await renderFrame(file, frame({ composition }));

    expect(blob.type).toBe('image/png');
    expect(recorder.fillTextCalls).toBeGreaterThan(0);
  });

  it('exports a PNG when the frame has no accent sampled', async () => {
    const composition = composeFrame(
      'magazine-masthead',
      { headline: 'Everyone made it', emphasis: 'made it' },
      CALM,
    );

    const blob = await renderFrame(file, frame({ composition, accent: undefined }));

    expect(blob.type).toBe('image/png');
  });

  it('draws the scrim and the rules, not just type', async () => {
    const composition = composeFrame(
      'magazine-masthead',
      { kicker: 'The Ascent', headline: 'A line', location: 'Zermatt' },
      CALM,
    );

    await renderFrame(file, frame({ composition }));

    expect(recorder.fillRectCalls).toBeGreaterThan(0);
  });
});
