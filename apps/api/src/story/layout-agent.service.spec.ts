import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Frame, Photo, Style } from '@auto-stories/api-types';

import { LayoutAgentService } from './layout-agent.service';
import { GENAI } from './story.constants';

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

const STYLE: Style = {
  font: 'inter',
  weight: 'regular',
  case: 'normal',
  align: 'center',
  size: 'm',
  position: 'bottom-center',
  letterbox: 'blur',
};

function frame(photoId: string, order: number): Frame {
  return { photoId, order, caption: `caption ${order}`, style: STYLE };
}
const photos: Photo[] = [
  { id: 'a', b64: 'AAAA' },
  { id: 'b', b64: 'BBBB' },
];

/** A layout element JSON the model would return; override to exercise clamps. */
function elementJson(over: Record<string, unknown> = {}) {
  return {
    role: 'title',
    text: 'Golden hour',
    font: 'playfair',
    weight: 'bold',
    case: 'normal',
    align: 'left',
    size: 4,
    tracking: 'wide',
    leading: 'tight',
    x: 8,
    y: 12,
    anchor: 'top-left',
    ...over,
  };
}
const layoutResponse = (...elements: Record<string, unknown>[]) => ({
  text: JSON.stringify({ elements }),
});

async function makeService(
  generateContent: jest.Mock,
  opts: { critique?: boolean } = {},
): Promise<LayoutAgentService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      LayoutAgentService,
      { provide: GENAI, useValue: { models: { generateContent } } },
      {
        provide: ConfigService,
        useValue: {
          get: (k: string, d: unknown) =>
            k === 'LAYOUT_CRITIQUE_ENABLED'
              ? opts.critique
                ? 'true'
                : undefined
              : d,
        },
      },
    ],
  }).compile();
  return moduleRef.get(LayoutAgentService);
}

describe('LayoutAgentService.composeLayouts', () => {
  const opts = { story: 'a trip', tone: undefined };

  it('attaches a validated layout to each frame, clamping junk values', async () => {
    const generateContent = jest
      .fn()
      .mockResolvedValue(layoutResponse(elementJson({ size: 99, x: -20 })));
    const service = await makeService(generateContent);

    const out = await service.composeLayouts(
      [frame('a', 1), frame('b', 2)],
      photos,
      opts,
    );

    expect(out[0].layout?.elements[0]).toMatchObject({
      text: 'Golden hour',
      size: 6,
      x: 0,
    });
    expect(out[1].layout).toBeDefined();
  });

  it('art-directs every frame in one parallel pass', async () => {
    const generateContent = jest
      .fn()
      .mockResolvedValue(layoutResponse(elementJson()));
    const service = await makeService(generateContent);

    const out = await service.composeLayouts(
      [frame('a', 1), frame('b', 2)],
      photos,
      opts,
    );

    // One call per frame, results in frame order.
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(out.map((f) => f.photoId)).toEqual(['a', 'b']);
    expect(out.every((f) => f.layout)).toBe(true);
  });

  it('keeps a frame unchanged when its layout call fails', async () => {
    const generateContent = jest
      .fn()
      .mockRejectedValueOnce(new Error('model exploded'))
      .mockResolvedValueOnce(layoutResponse(elementJson()));
    const service = await makeService(generateContent);

    const out = await service.composeLayouts(
      [frame('a', 1), frame('b', 2)],
      photos,
      opts,
    );

    expect(out[0].layout).toBeUndefined();
    expect(out[1].layout).toBeDefined();
  });

  it('skips a frame whose photo is missing, without calling the model', async () => {
    const generateContent = jest
      .fn()
      .mockResolvedValue(layoutResponse(elementJson()));
    const service = await makeService(generateContent);

    const out = await service.composeLayouts(
      [frame('missing', 1)],
      photos,
      opts,
    );

    expect(out[0].layout).toBeUndefined();
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('leaves a frame without a layout when the model returns nothing usable', async () => {
    const generateContent = jest
      .fn()
      .mockResolvedValue({ text: JSON.stringify({ elements: [] }) });
    const service = await makeService(generateContent);

    const out = await service.composeLayouts([frame('a', 1)], photos, opts);

    expect(out[0].layout).toBeUndefined();
  });

  describe('self-critique (LAYOUT_CRITIQUE_ENABLED)', () => {
    it('does not run the critique by default — one call per frame', async () => {
      const generateContent = jest
        .fn()
        .mockResolvedValue(layoutResponse(elementJson()));
      const service = await makeService(generateContent);

      await service.composeLayouts([frame('a', 1)], photos, opts);

      expect(generateContent).toHaveBeenCalledTimes(1);
    });

    it('replaces the first pass with the improved layout when enabled', async () => {
      const generateContent = jest
        .fn()
        .mockResolvedValueOnce(
          layoutResponse(elementJson({ anchor: 'top-left' })),
        ) // propose
        .mockResolvedValueOnce(
          layoutResponse(elementJson({ anchor: 'bottom-right' })),
        ); // critique
      const service = await makeService(generateContent, { critique: true });

      const out = await service.composeLayouts([frame('a', 1)], photos, opts);

      expect(generateContent).toHaveBeenCalledTimes(2);
      expect(out[0].layout?.elements[0].anchor).toBe('bottom-right');
    });

    it('keeps the first pass when the critique call fails', async () => {
      const generateContent = jest
        .fn()
        .mockResolvedValueOnce(
          layoutResponse(elementJson({ anchor: 'top-left' })),
        )
        .mockRejectedValueOnce(new Error('critique exploded'));
      const service = await makeService(generateContent, { critique: true });

      const out = await service.composeLayouts([frame('a', 1)], photos, opts);

      expect(out[0].layout?.elements[0].anchor).toBe('top-left');
    });

    it('keeps the first pass when the critique returns nothing usable', async () => {
      const generateContent = jest
        .fn()
        .mockResolvedValueOnce(
          layoutResponse(elementJson({ anchor: 'top-left' })),
        )
        .mockResolvedValueOnce({ text: JSON.stringify({ elements: [] }) });
      const service = await makeService(generateContent, { critique: true });

      const out = await service.composeLayouts([frame('a', 1)], photos, opts);

      expect(out[0].layout?.elements[0].anchor).toBe('top-left');
    });
  });
});
