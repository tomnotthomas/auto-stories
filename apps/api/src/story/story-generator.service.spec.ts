import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ApiError } from '@google/genai';
import type { GenerateRequest } from '@auto-stories/api-types';
import { StoryGeneratorService } from './story-generator.service';
import { GENAI } from './story.constants';
import { DEFAULT_LOOK } from './caption-style';

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

function jsonResponse(frames: unknown, look?: unknown): { text: string } {
  return { text: JSON.stringify({ frames, look }) };
}

async function makeService(
  generateContent: jest.Mock,
): Promise<StoryGeneratorService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      StoryGeneratorService,
      { provide: GENAI, useValue: { models: { generateContent } } },
      {
        provide: ConfigService,
        useValue: { get: (_k: string, d: unknown) => d },
      },
    ],
  }).compile();
  return moduleRef.get(StoryGeneratorService);
}

describe('StoryGeneratorService', () => {
  it('returns ordered frames and the story Look (partial=false)', async () => {
    const generateContent = jest.fn().mockResolvedValue(
      jsonResponse(
        [
          { photoId: 'p2', order: 1, headline: 'hook' },
          { photoId: 'p1', order: 2, headline: 'build' },
          { photoId: 'p3', order: 3, headline: 'payoff' },
        ],
        'scrapbook',
      ),
    );
    const service = await makeService(generateContent);

    const result = await service.generate(makeRequest(3));

    expect(result).toEqual({
      frames: [
        { photoId: 'p2', order: 1, headline: 'hook', suggestions: [] },
        { photoId: 'p1', order: 2, headline: 'build', suggestions: [] },
        { photoId: 'p3', order: 3, headline: 'payoff', suggestions: [] },
      ],
      look: 'scrapbook',
      partial: false,
    });
  });

  it('falls back to the default Look when the model omits it', async () => {
    const generateContent = jest
      .fn()
      .mockResolvedValue(
        jsonResponse([{ photoId: 'p1', order: 1, headline: 'x' }]),
      );
    const service = await makeService(generateContent);

    const result = await service.generate(makeRequest(3));

    expect(result.look).toBe(DEFAULT_LOOK);
  });

  it('falls back to the default Look when the model invents one', async () => {
    const generateContent = jest
      .fn()
      .mockResolvedValue(
        jsonResponse([{ photoId: 'p1', order: 1, headline: 'x' }], 'polaroid'),
      );
    const service = await makeService(generateContent);

    const result = await service.generate(makeRequest(3));

    expect(result.look).toBe(DEFAULT_LOOK);
  });

  // One structured call per story again (decision 7.24): no second geometry pass.
  it('makes exactly one model call for a clean story', async () => {
    const generateContent = jest.fn().mockResolvedValue(
      jsonResponse(
        [
          { photoId: 'p1', order: 1, headline: 'a' },
          { photoId: 'p2', order: 2, headline: 'b' },
        ],
        'minimal',
      ),
    );
    const service = await makeService(generateContent);

    await service.generate(makeRequest(3));

    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('sends the prompt plus one inline image per photo', async () => {
    const generateContent = jest
      .fn()
      .mockResolvedValue(
        jsonResponse([{ photoId: 'p1', order: 1, headline: 'x' }]),
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
        { photoId: 'p1', order: 1, headline: 'a' },
        { photoId: 'p3', order: 2, headline: 'b' },
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
        jsonResponse([{ photoId: 'p1', order: 1, headline: 'x' }]),
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
        jsonResponse([{ photoId: 'ghost', order: 1, headline: 'x' }]),
      );
    const service = await makeService(generateContent);

    await expect(service.generate(makeRequest(3))).rejects.toMatchObject({
      code: 'empty_result',
    });
  });

  // The headline is the frame's only text (7.25) — a frame without one cannot
  // be composed, so it is dropped rather than shipped blank.
  // No words is a silent frame, not a dropped one (7.26): the photo carries the
  // moment on its own and the Look composes it without type.
  it('keeps a frame the model left without a headline, as silent', async () => {
    const generateContent = jest.fn().mockResolvedValue(
      jsonResponse([
        { photoId: 'p1', order: 1, headline: 'a' },
        { photoId: 'p2', order: 2 },
        { photoId: 'p3', order: 3, headline: '   ' },
      ]),
    );
    const service = await makeService(generateContent);

    const result = await service.generate(makeRequest(3));

    expect(result.frames.map((f) => f.photoId)).toEqual(['p1', 'p2', 'p3']);
    expect(result.frames.map((f) => f.headline)).toEqual(['a', '', '']);
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

  it('rejects with empty_result on JSON that is not a story object', async () => {
    for (const text of [undefined, '"sorry"', 'null']) {
      const generateContent = jest.fn().mockResolvedValue({ text });
      const service = await makeService(generateContent);

      await expect(service.generate(makeRequest(3))).rejects.toMatchObject({
        code: 'empty_result',
      });
    }
  });

  it('drops a photo and retries on a safety block, flagging partial', async () => {
    const generateContent = jest
      .fn()
      .mockResolvedValueOnce({ promptFeedback: { blockReason: 'SAFETY' } })
      .mockResolvedValueOnce(
        jsonResponse([
          { photoId: 'p1', order: 1, headline: 'a' },
          { photoId: 'p2', order: 2, headline: 'b' },
          { photoId: 'p3', order: 3, headline: 'c' },
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
});
