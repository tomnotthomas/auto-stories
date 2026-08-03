import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ApiError } from '@google/genai';
import type { Frame, GenerateRequest } from '@auto-stories/api-types';
import { StoryGeneratorService } from './story-generator.service';
import { LayoutAgentService } from './layout-agent.service';
import { GENAI } from './story.constants';
import { DEFAULT_STYLE } from './caption-style';

// The service logs unexpected causes on purpose; keep them out of test output.
beforeAll(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

function makeRequest(count = 3): GenerateRequest {
  return {
    story: 'Morning surf before the storm',
    photos: Array.from({ length: count }, (_, i) => ({
      id: `p${i + 1}`,
      b64: 'AAAA',
    })),
  };
}

function jsonResponse(frames: unknown): { text: string } {
  return { text: JSON.stringify({ frames }) };
}

async function makeService(
  generateContent: jest.Mock,
  opts: { composeLayouts?: jest.Mock } = {},
): Promise<StoryGeneratorService> {
  // The layout agent always runs; the identity default leaves frames untouched
  // (no layout) so the tests that assert the plain frames stay valid.
  const composeLayouts =
    opts.composeLayouts ??
    jest.fn((frames: Frame[]) => Promise.resolve(frames));
  const moduleRef = await Test.createTestingModule({
    providers: [
      StoryGeneratorService,
      { provide: GENAI, useValue: { models: { generateContent } } },
      { provide: LayoutAgentService, useValue: { composeLayouts } },
      {
        provide: ConfigService,
        useValue: { get: (_k: string, d: unknown) => d },
      },
    ],
  }).compile();
  return moduleRef.get(StoryGeneratorService);
}

describe('StoryGeneratorService', () => {
  it('returns ordered frames for a clean response (partial=false)', async () => {
    const generateContent = jest.fn().mockResolvedValue(
      jsonResponse([
        { photoId: 'p2', order: 1, caption: 'hook' },
        { photoId: 'p1', order: 2, caption: 'build' },
        { photoId: 'p3', order: 3, caption: 'payoff' },
      ]),
    );
    const service = await makeService(generateContent);

    const result = await service.generate(makeRequest(3));

    expect(result).toEqual({
      frames: [
        {
          photoId: 'p2',
          order: 1,
          caption: 'hook',
          style: DEFAULT_STYLE,
          texts: [],
          suggestions: [],
        },
        {
          photoId: 'p1',
          order: 2,
          caption: 'build',
          style: DEFAULT_STYLE,
          texts: [],
          suggestions: [],
        },
        {
          photoId: 'p3',
          order: 3,
          caption: 'payoff',
          style: DEFAULT_STYLE,
          texts: [],
          suggestions: [],
        },
      ],
      partial: false,
    });
  });

  it('sends the prompt plus one inline image per photo', async () => {
    const generateContent = jest
      .fn()
      .mockResolvedValue(
        jsonResponse([{ photoId: 'p1', order: 1, caption: 'x' }]),
      );
    const service = await makeService(generateContent);

    await service.generate(makeRequest(3));

    const parts = generateContent.mock.calls[0][0].contents[0].parts;
    const inlineImages = parts.filter(
      (p: unknown) => 'inlineData' in (p as object),
    );
    expect(inlineImages).toHaveLength(3);
  });

  // A curated subset is the product's job (dump 30, keep the best 5–7), not a
  // failure — so it must NOT flag partial. Only a safety drop does (see below).
  it('does not flag partial when the model curates a subset', async () => {
    const generateContent = jest.fn().mockResolvedValue(
      jsonResponse([
        { photoId: 'p1', order: 1, caption: 'a' },
        { photoId: 'p3', order: 2, caption: 'b' },
      ]),
    );
    const service = await makeService(generateContent);

    const result = await service.generate(makeRequest(3));

    expect(result.partial).toBe(false);
    expect(result.frames).toHaveLength(2);
  });

  it('threads must-include photo ids into the prompt', async () => {
    const generateContent = jest
      .fn()
      .mockResolvedValue(
        jsonResponse([{ photoId: 'p1', order: 1, caption: 'x' }]),
      );
    const service = await makeService(generateContent);

    await service.generate({ ...makeRequest(3), mustInclude: ['p2'] });

    const promptText = generateContent.mock.calls[0][0].contents[0].parts[0]
      .text as string;
    expect(promptText).toContain('p2');
    expect(promptText.toLowerCase()).toContain('must include');
  });

  it('rejects with empty_result when no frames are usable', async () => {
    const generateContent = jest
      .fn()
      .mockResolvedValue(
        jsonResponse([{ photoId: 'ghost', order: 1, caption: 'x' }]),
      );
    const service = await makeService(generateContent);

    await expect(service.generate(makeRequest(3))).rejects.toMatchObject({
      code: 'empty_result',
    });
  });

  it('rejects with empty_result when the model returns non-JSON', async () => {
    const generateContent = jest
      .fn()
      .mockResolvedValue({ text: 'sorry, I cannot' });
    const service = await makeService(generateContent);

    await expect(service.generate(makeRequest(3))).rejects.toMatchObject({
      code: 'empty_result',
    });
  });

  it('drops a photo and retries on a safety block, flagging partial', async () => {
    const generateContent = jest
      .fn()
      .mockResolvedValueOnce({ promptFeedback: { blockReason: 'SAFETY' } })
      .mockResolvedValueOnce(
        jsonResponse([
          { photoId: 'p1', order: 1, caption: 'a' },
          { photoId: 'p2', order: 2, caption: 'b' },
          { photoId: 'p3', order: 3, caption: 'c' },
        ]),
      );
    const service = await makeService(generateContent);

    const result = await service.generate(makeRequest(4));

    expect(generateContent).toHaveBeenCalledTimes(2);
    // Second attempt sends one fewer image.
    const retryParts = generateContent.mock.calls[1][0].contents[0].parts;
    const retryImages = retryParts.filter(
      (p: unknown) => 'inlineData' in (p as object),
    );
    expect(retryImages).toHaveLength(3);
    expect(result.partial).toBe(true);
  });

  it('gives up with empty_result when a safety block would drop below 3 photos', async () => {
    const generateContent = jest
      .fn()
      .mockResolvedValue({ promptFeedback: { blockReason: 'SAFETY' } });
    const service = await makeService(generateContent);

    await expect(service.generate(makeRequest(3))).rejects.toMatchObject({
      code: 'empty_result',
    });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('maps an abort/timeout to the timeout outcome', async () => {
    const timeout = Object.assign(new Error('timed out'), {
      name: 'TimeoutError',
    });
    const generateContent = jest.fn().mockRejectedValue(timeout);
    const service = await makeService(generateContent);

    await expect(service.generate(makeRequest(3))).rejects.toMatchObject({
      code: 'timeout',
    });
  });

  it('maps a 429 to rate_limited', async () => {
    const generateContent = jest
      .fn()
      .mockRejectedValue(
        new ApiError({ message: 'Too Many Requests', status: 429 }),
      );
    const service = await makeService(generateContent);

    await expect(service.generate(makeRequest(3))).rejects.toMatchObject({
      code: 'rate_limited',
    });
  });

  it('maps a 429 quota error to quota_exhausted', async () => {
    const generateContent = jest
      .fn()
      .mockRejectedValue(
        new ApiError({ message: 'RESOURCE_EXHAUSTED: quota', status: 429 }),
      );
    const service = await makeService(generateContent);

    await expect(service.generate(makeRequest(3))).rejects.toMatchObject({
      code: 'quota_exhausted',
    });
  });

  it('maps a 5xx to upstream_error', async () => {
    const generateContent = jest
      .fn()
      .mockRejectedValue(new ApiError({ message: 'boom', status: 503 }));
    const service = await makeService(generateContent);

    await expect(service.generate(makeRequest(3))).rejects.toMatchObject({
      code: 'upstream_error',
    });
  });

  it('maps an unknown thrown value to upstream_error', async () => {
    const generateContent = jest.fn().mockRejectedValue(new Error('weird'));
    const service = await makeService(generateContent);

    await expect(service.generate(makeRequest(3))).rejects.toMatchObject({
      code: 'upstream_error',
    });
  });

  it('runs the layout agent on every story, threading the atmosphere', async () => {
    const generateContent = jest.fn().mockResolvedValue(
      jsonResponse([
        { photoId: 'p1', order: 1, caption: 'hook' },
        { photoId: 'p2', order: 2, caption: 'build' },
      ]),
    );
    const composeLayouts = jest.fn((frames: Frame[]) =>
      Promise.resolve(frames.map((f) => ({ ...f, layout: { elements: [] } }))),
    );
    const service = await makeService(generateContent, { composeLayouts });

    const result = await service.generate({
      ...makeRequest(3),
      atmosphere: 'tender',
    });

    expect(composeLayouts).toHaveBeenCalledTimes(1);
    // The user-set atmosphere is threaded to the agent (decision 7.21).
    expect(composeLayouts).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ atmosphere: 'tender' }),
    );
    expect(result.frames.every((f) => f.layout !== undefined)).toBe(true);
  });
});
