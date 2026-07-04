import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiError,
  type GenerateContentResponse,
  type GoogleGenAI,
  type Part,
} from '@google/genai';
import type {
  GenerateRequest,
  GenerateResponse,
  Photo,
  Tone,
} from '@auto-stories/api-types';
import { ApiException, ApiErrors } from '../common/api-exception';
import { buildPrompt } from './prompt.builder';
import { shapeFrames } from './story.mapper';
import { STORY_RESPONSE_SCHEMA } from './story.schema';
import {
  DEFAULT_MODEL,
  DEFAULT_TIMEOUT_MS,
  GENAI,
  MIN_PHOTOS,
  PROXY_MIME_TYPE,
} from './story.constants';

/**
 * Turns a validated request into an ordered, captioned story via Gemini.
 * A single structured call with a responseSchema (architecture 3.3); the
 * non-deterministic model output is defended by shapeFrames. On a safety
 * block the flagged photo is dropped and the call retried with the rest.
 */
@Injectable()
export class StoryGeneratorService {
  private readonly logger = new Logger(StoryGeneratorService.name);
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(
    @Inject(GENAI) private readonly genai: GoogleGenAI,
    config: ConfigService,
  ) {
    this.model = config.get<string>('MODEL', DEFAULT_MODEL);
    this.timeoutMs = config.get<number>(
      'GENERATION_TIMEOUT_MS',
      DEFAULT_TIMEOUT_MS,
    );
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const validIds = new Set(request.photos.map((photo) => photo.id));
    let photos = request.photos;
    let safetyDropped = false;

    // The loop lets us drop a safety-flagged photo and retry with the rest.
    for (;;) {
      const response = await this.call(request.story, photos, request.tone);

      if (response.promptFeedback?.blockReason) {
        // The API doesn't say which photo tripped safety, so drop one and
        // retry — best effort. Give up if we can't keep the 3-photo minimum.
        if (photos.length <= MIN_PHOTOS) {
          throw ApiErrors.emptyResult();
        }
        this.logger.warn(
          `Model blocked a prompt (${response.promptFeedback.blockReason}); dropping a photo and retrying.`,
        );
        photos = photos.slice(0, -1);
        safetyDropped = true;
        continue;
      }

      const frames = shapeFrames(parseFrames(response.text), validIds);
      if (frames.length === 0) {
        throw ApiErrors.emptyResult();
      }

      return {
        frames,
        partial: safetyDropped || frames.length < request.photos.length,
      };
    }
  }

  private async call(
    story: string,
    photos: Photo[],
    tone?: Tone,
  ): Promise<GenerateContentResponse> {
    const parts: Part[] = [
      { text: buildPrompt(story, tone) },
      ...photos.flatMap((photo): Part[] => [
        { text: photo.id },
        { inlineData: { mimeType: PROXY_MIME_TYPE, data: photo.b64 } },
      ]),
    ];

    try {
      return await this.genai.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: STORY_RESPONSE_SCHEMA,
          abortSignal: AbortSignal.timeout(this.timeoutMs),
        },
      });
    } catch (err) {
      throw this.mapError(err);
    }
  }

  /** Map a thrown model/transport error to a typed, user-safe outcome. */
  private mapError(err: unknown): ApiException {
    if (
      err instanceof Error &&
      (err.name === 'TimeoutError' || err.name === 'AbortError')
    ) {
      return ApiErrors.timeout();
    }
    if (err instanceof ApiError) {
      if (err.status === 429) {
        return /quota|resource_exhausted/i.test(err.message)
          ? ApiErrors.quotaExhausted()
          : ApiErrors.rateLimited();
      }
      return ApiErrors.upstreamError();
    }
    this.logger.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
    return ApiErrors.upstreamError();
  }
}

/** Pull the `frames` array out of the model's JSON text, or undefined. */
function parseFrames(text: string | undefined): unknown {
  if (!text) return undefined;
  try {
    return (JSON.parse(text) as { frames?: unknown }).frames;
  } catch {
    return undefined;
  }
}
