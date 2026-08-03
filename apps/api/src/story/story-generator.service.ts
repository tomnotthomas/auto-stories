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
import { normalizeLook } from './caption-style';
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
 * ONE structured call with a responseSchema (architecture 3.3) — the model
 * picks the story's Look and writes the words, and deterministic client code
 * composes every frame from that (decision 7.24), so there is no second
 * geometry pass. The non-deterministic output is defended by shapeFrames and
 * normalizeLook. On a safety block the flagged photo is dropped and the call
 * retried with the rest.
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
      const response = await this.call(
        request.story,
        photos,
        request.tone,
        request.mustInclude,
        request.atmosphere,
      );

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

      const parsed = parseStory(response.text);
      const frames = shapeFrames(parsed.frames, validIds);
      if (frames.length === 0) {
        throw ApiErrors.emptyResult();
      }

      return {
        frames,
        // One Look for the whole story; an unknown or missing one falls back so
        // the client always has a renderer for it (decision 7.24).
        look: normalizeLook(parsed.look),
        // Curating a subset of the batch is the whole job (the user dumps 30,
        // we keep the best 5–7), not a failure — so only a safety-dropped photo
        // makes a story "partial" (4.3, 2.4/2.5).
        partial: safetyDropped,
      };
    }
  }

  private async call(
    story: string,
    photos: Photo[],
    tone?: Tone,
    mustInclude?: string[],
    atmosphere?: string,
  ): Promise<GenerateContentResponse> {
    const parts: Part[] = [
      { text: buildPrompt(story, tone, mustInclude, atmosphere) },
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
    this.logger.error(
      err instanceof Error ? (err.stack ?? err.message) : String(err),
    );
    return ApiErrors.upstreamError();
  }
}

/**
 * Pull the `frames` array and the story-level `look` out of the model's JSON
 * text. Defensive: unparseable or non-object output yields both undefined, and
 * the callers (shapeFrames / normalizeLook) turn that into an empty story and
 * the default Look rather than a throw.
 */
function parseStory(text: string | undefined): {
  frames?: unknown;
  look?: unknown;
} {
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed;
  } catch {
    return {};
  }
}
